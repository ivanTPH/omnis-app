#!/usr/bin/env bash
# pre-write-check.sh
# Runs before every Write tool call.
# Extracts exported symbol names from the content being written and checks
# whether they already exist in the codebase.  Blocks (exit 2) if exact
# duplicates are found in a *different* file.
#
# Covered scopes:
#   app/actions/**/*.ts   — server action functions
#   components/**/*.tsx   — React components
#   app/**/page.tsx       — route pages
#
# Input: JSON on stdin  { "file_path": "...", "content": "..." }

PROJECT="/Users/ivan-imac/omnis-app"

# ── Parse input ───────────────────────────────────────────────────────────────

INPUT=$(cat)

FILE=$(echo "$INPUT" | python3 -c \
  "import json,sys; print(json.load(sys.stdin).get('file_path',''))" 2>/dev/null || true)

CONTENT=$(echo "$INPUT" | python3 -c \
  "import json,sys; print(json.load(sys.stdin).get('content','')[:4000])" 2>/dev/null || true)

# ── Scope filter ──────────────────────────────────────────────────────────────

[[ "$FILE" != "$PROJECT/app/actions/"*   ]] && \
[[ "$FILE" != "$PROJECT/components/"*    ]] && \
[[ "$FILE" != "$PROJECT/app/"*/page.tsx  ]] && \
exit 0

RELATIVE="${FILE#$PROJECT/}"

# ── Check 1: route page that already exists on disk ──────────────────────────

if [[ "$RELATIVE" == app/*/page.tsx ]] && [[ -f "$FILE" ]]; then
  echo "DUPLICATE BLOCKED: $RELATIVE already exists on disk." >&2
  echo "Use the Edit tool to modify an existing page, or Read it first." >&2
  exit 2
fi

# ── Extract exported names from new content ───────────────────────────────────

# Named exports: "export async function foo" / "export function foo"
NAMED=$(echo "$CONTENT" \
  | grep -oE '^export (async )?function ([A-Za-z_][A-Za-z0-9_]*)' \
  | awk '{print $NF}')

# Default component export: "export default function FooBar"
DEFAULT=$(echo "$CONTENT" \
  | grep -oE '^export default function ([A-Z][A-Za-z0-9]*)' \
  | awk '{print $NF}' \
  | head -1)

# ── Check 2: duplicate server-action functions in app/actions/ ────────────────

if [[ "$RELATIVE" == app/actions/* ]] && [[ -n "$NAMED" ]]; then
  DUPLICATES=""
  for NAME in $NAMED; do
    MATCH=$(grep -rn \
      "export async function ${NAME}[^A-Za-z0-9_]\|export function ${NAME}[^A-Za-z0-9_]" \
      "$PROJECT/app/actions/" \
      --include="*.ts" 2>/dev/null \
      | grep -v "^${FILE}:" || true)
    if [[ -n "$MATCH" ]]; then
      DUPLICATES="${DUPLICATES}\n  '${NAME}' already exists in:\n$(echo "$MATCH" | head -3 | sed 's/^/    /')"
    fi
  done

  if [[ -n "$DUPLICATES" ]]; then
    printf "DUPLICATE BLOCKED — these server actions already exist before writing %s:\n%b\n\nRead the existing files, reuse or extend them rather than duplicating.\n" \
      "$RELATIVE" "$DUPLICATES" >&2
    exit 2
  fi
fi

# ── Check 3: duplicate React component default export ─────────────────────────

if [[ "$RELATIVE" == components/* ]] && [[ -n "$DEFAULT" ]]; then
  MATCH=$(grep -rn \
    "export default function ${DEFAULT}[^A-Za-z0-9_]" \
    "$PROJECT/components/" \
    --include="*.tsx" 2>/dev/null \
    | grep -v "^${FILE}:" || true)
  if [[ -n "$MATCH" ]]; then
    printf "DUPLICATE BLOCKED — component '%s' already exists before writing %s:\n%s\n\nRead the existing component first.\n" \
      "$DEFAULT" "$RELATIVE" "$MATCH" >&2
    exit 2
  fi
fi

# ── All clear ─────────────────────────────────────────────────────────────────

exit 0
