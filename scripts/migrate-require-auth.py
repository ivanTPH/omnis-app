#!/usr/bin/env python3
"""
Migrate session.user as any  →  requireAuth() across all pages and actions.

Handles all known patterns:
  - const { ... } = session.user as any
  - const { ... } = session.user as { id: string; ... }
  - (session.user as any).field
  - Inline role redirect guards that follow immediately
"""

import re, sys, os

REQUIRE_AUTH_IMPORT = "import { requireAuth } from '@/lib/session'"
AUTH_IMPORT_RE      = re.compile(r"import \{ auth \} from '@/lib/auth'\n")

# ── helpers ────────────────────────────────────────────────────────────────────

def ensure_require_auth_import(content: str) -> str:
    if "requireAuth" in content and "from '@/lib/session'" in content:
        return content  # already present
    # Insert after the last 'use server' or after the first import block
    # Try to insert near the auth import, or at the top
    if "from '@/lib/auth'" in content:
        return content.replace(
            "from '@/lib/auth'",
            "from '@/lib/auth'\n" + REQUIRE_AUTH_IMPORT,
            1,
        )
    # Fallback: insert before the first import
    return REQUIRE_AUTH_IMPORT + "\n" + content

def maybe_remove_auth_import(content: str) -> str:
    """Remove `import { auth } from '@/lib/auth'` if auth() is no longer called."""
    if re.search(r'\bauth\(\)', content):
        return content  # still needed
    return AUTH_IMPORT_RE.sub("", content)

def clean_eslint_any_comments(line: str) -> str:
    """Remove trailing // eslint-disable... no-explicit-any comments."""
    return re.sub(r'\s*//\s*eslint-disable(?:-next-line)?\s+@typescript-eslint/no-explicit-any\s*$', '', line)

# ── core transform ─────────────────────────────────────────────────────────────

# Matches the whole session block:
#   const session = await auth()
#   <ws>if (!session) redirect/throw
#   <ws>const { FIELDS } = session.user as any/...
BLOCK_RE = re.compile(
    r'([ \t]*)const session = await auth\(\)\n'
    r'[ \t]*if \(!session\)(?: \?)? (?:redirect\([\'"][^\'"]*[\'"]\)|throw new Error\([^\)]*\))[^\n]*\n'
    r'([ \t]*)const \{ ([^}]+) \} = session\.user as (?:any|{[^}]+})[^\n]*\n'
    r'(?:[ \t]*// eslint-disable[^\n]*\n)*',
    re.DOTALL,
)

# Multi-line session.user type assertion (session.user as {\n  ...\n})
BLOCK_MULTI_RE = re.compile(
    r'([ \t]*)const session = await auth\(\)\n'
    r'[ \t]*if \(!session\)[^\n]*\n'
    r'([ \t]*)const \{ ([^}]+) \} = session\.user as \{[^}]+\}[^\n]*\n',
    re.DOTALL,
)

# Also handles the `(session.user as any).field` property access pattern
PROP_RE = re.compile(
    r'const (\w+)\s*=\s*\(session\.user as any\)\.(\w+)(?: as \w+)?\n'
    r'(?:[ \t]*// eslint-disable[^\n]*\n)*'
)

def build_replacement(fields_str: str, indent: str) -> str:
    fields = fields_str.strip()
    return f'{indent}const {{ {fields} }} = await requireAuth()\n'

def transform_file(path: str) -> tuple[str, bool]:
    with open(path) as f:
        original = f.read()

    content = original

    # ── Phase 1: simple single-line pattern ────────────────────────────────────
    def replace_block(m: re.Match) -> str:
        indent    = m.group(1)
        fields    = m.group(3)
        return build_replacement(fields, indent)

    content, n1 = BLOCK_RE.subn(replace_block, content)

    # ── Phase 2: multi-line type assertion ─────────────────────────────────────
    content, n2 = BLOCK_MULTI_RE.subn(replace_block, content)

    # ── Phase 3: (session.user as any).field repeated property access ─────────
    # e.g. const userId = (session.user as any).id as string
    # Group these into a single requireAuth() destructure
    # Strategy: replace each one, then manually fix any orphan `const session` blocks
    prop_pattern = re.compile(
        r'[ \t]*const session = await auth\(\)\n'
        r'[ \t]*if \(!session\)[^\n]*\n'
        r'((?:[ \t]*(?://[^\n]*)?\n)*'
        r'(?:[ \t]*const \w+ \s*=\s*\(session\.user as any\)\.\w+[^\n]*\n'
        r'(?:[ \t]*// eslint-disable[^\n]*\n)*)+)'
    )

    def replace_prop_block(m: re.Match) -> str:
        block = m.group(1)
        # Extract each variable mapping: name = .field
        pairs = re.findall(r'const (\w+)\s*=\s*\(session\.user as any\)\.(\w+)', block)
        if not pairs:
            return m.group(0)
        fields = ", ".join(
            f"{field}: {name}" if field != name else name
            for name, field in pairs
        )
        indent = re.match(r'([ \t]*)', m.group(0)).group(1)
        return f'{indent}const {{ {fields} }} = await requireAuth()\n'

    content, n3 = prop_pattern.subn(replace_prop_block, content)

    # ── Phase 4: plans/page.tsx style custom type (session.user as { ... }) ────
    custom_type_re = re.compile(
        r'([ \t]*)const session = await auth\(\)\n'
        r'[ \t]*if \(!session\)[^\n]*\n'
        r'[ \t]*const \{ ([^}]+) \} = session\.user as \{\n'
        r'(?:[^\n]+\n)*?'
        r'[ \t]*\}',
        re.DOTALL,
    )
    def replace_custom(m: re.Match) -> str:
        indent = m.group(1)
        fields = m.group(2).strip()
        return f'{indent}const {{ {fields} }} = await requireAuth()'

    content, n4 = custom_type_re.subn(replace_custom, content)

    # ── Phase 5: remaining orphan `const session = await auth()` ──────────────
    # If session is no longer used for user destructuring but still exists:
    orphan_re = re.compile(
        r'[ \t]*const session = await auth\(\)\n'
        r'[ \t]*if \(!session\) redirect\([^\)]*\)\n'
    )
    # Only remove if session isn't used anywhere else after
    def remove_orphan(m: re.Match) -> str:
        return ""

    # Check carefully before removing
    if content.count("session") == content.count("await auth()"):
        content, _ = orphan_re.subn(remove_orphan, content)

    # ── Phase 6: fix imports ───────────────────────────────────────────────────
    changed = content != original
    if changed:
        content = ensure_require_auth_import(content)
        content = maybe_remove_auth_import(content)

    return content, changed

# ── entry point ────────────────────────────────────────────────────────────────

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    targets: list[str] = []
    for dirpath, _, filenames in os.walk(root):
        # Skip non-app directories
        rel = os.path.relpath(dirpath, root)
        if any(rel.startswith(skip) for skip in ['node_modules', '.next', 'omnis-files', 'e2e', 'scripts', 'prisma']):
            continue
        for fn in filenames:
            if fn.endswith(('.ts', '.tsx')):
                targets.append(os.path.join(dirpath, fn))

    changed_files = []
    for path in sorted(targets):
        new_content, changed = transform_file(path)
        if changed:
            with open(path, 'w') as f:
                f.write(new_content)
            changed_files.append(os.path.relpath(path, root))

    print(f"Modified {len(changed_files)} files:")
    for f in changed_files:
        print(f"  {f}")

if __name__ == "__main__":
    main()
