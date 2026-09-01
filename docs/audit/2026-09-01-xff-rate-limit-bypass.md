# X-Forwarded-For rate-limit bypass — investigation & fix (2026-09-01)

**Severity:** Moderate — defensive fix, not an active incident. No evidence
this was ever actively exploited; found and closed proactively.

## What was investigated

Whether the app's per-IP rate limiters (`lib/kv.ts`: login, password reset,
contact forms) could be bypassed by a client sending a fabricated
`X-Forwarded-For` header, given the app runs behind Coolify's Traefik
reverse proxy.

## What the code was doing

All 4 places that extract a client IP for rate-limiting took the **first**
comma-separated value out of `X-Forwarded-For`:

```ts
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
```

- `lib/auth.ts` — gates `checkLoginRatelimit` (5 attempts/15 min), also had
  a second fallback to `req.headers.get('x-real-ip')`
- `app/api/auth/forgot-password/route.ts` — gates `checkPasswordResetRateLimit`
  (3/hour)
- `app/api/contact/beta/route.ts` and `app/api/contact/investors/route.ts`
  — both gate `checkContactRateLimit` (5/hour)

(`checkMfaRequestRateLimit`, the 3-codes/10-min MFA limiter, is keyed by
`userId`, not IP — not part of this bypass. It's still indirectly relevant:
MFA *code verification* happens inside the same `authorize()` call the
IP-keyed login limiter gates, so bypassing the login limiter also removes
the rate-limit on guessing a 6-digit OTP code, even though the OTP-request
limiter itself is unaffected.)

## Why taking the first hop is wrong here

`X-Forwarded-For` is a comma-separated list that grows by *appending* —
each hop in the chain is supposed to add the IP it received the request
from onto the end. A client controls what it sends as the *starting* value;
it cannot control what a proxy appends afterward, because that's based on
the proxy's own view of the actual TCP connection. So in a chain of any
length, **the first entry is whatever the original sender claimed** (fully
attacker-controlled) and **the last entry is whatever the proxy closest to
the app observed** (not attacker-controlled, short of spoofing a live TCP
connection's source IP — a fundamentally different and far more involved
attack than adding a header).

Taking `[0]` reads the attacker-controlled end of the chain.

## Traefik's actual default behaviour (researched, not assumed)

Confirmed from Traefik's own entrypoint documentation
([doc.traefik.io/traefik/reference/install-configuration/entrypoints](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/)):
the `forwardedHeaders.notAppendXForwardedFor` option — "when set to `true`,
Traefik will not append the client's `RemoteAddr` to the `X-Forwarded-For`
header" — **defaults to `false`**. That means Traefik's default behaviour
is exactly what the theory above assumes: it **appends** the real,
TCP-level connecting IP to whatever `X-Forwarded-For` it received, rather
than replacing it outright. A client sending
`X-Forwarded-For: 1.2.3.4` to Traefik directly gets forwarded to the app as
`X-Forwarded-For: 1.2.3.4, <their real IP>` — the fake value survives at
position 0, the real value lands at the end.

Also confirmed: **Traefik does not set `X-Real-Ip` by default at all** —
it's not part of Traefik core; populating it requires an explicit
third-party community plugin. There's no evidence in this repo or in
Coolify's own configuration surface that such a plugin is installed here
(checked Coolify's GitHub discussions — forwarded-header behaviour isn't
even documented as a first-class Coolify setting; users manually add
Traefik CLI flags for edge cases like Cloudflare, which don't apply to this
deployment — see below). This means `lib/auth.ts`'s `x-real-ip` fallback
was trusting a header with no confirmed origin — if a client sent one
directly and nothing strips it, it would have passed through untouched.

## This deployment's actual topology (verified directly, not assumed)

- `dig +short omnis.education A` → `165.232.96.51` — the same DigitalOcean
  droplet IP already on record for this Coolify server. DNS points straight
  at the app's own box.
- `curl -I https://omnis.education/` shows no CDN/WAF fingerprint (no
  `cf-ray`, no `server: cloudflare`, nothing else recognisable).

Together, this confirms the request path is exactly **client → Traefik →
Next.js app**, both on the same droplet — one reverse-proxy hop, no CDN in
front. That's the topology "take the last `X-Forwarded-For` entry" is
correct for. If a CDN or WAF is ever put in front of this app in future,
this needs revisiting — trusting "the last entry" would then trust the
CDN's own claim rather than Traefik's, and the correct fix would be
"second-to-last" (trust 2 hops) or a CDN-specific header
(e.g. `CF-Connecting-IP` for Cloudflare) instead.

## Fix

New `getClientIp(headers)` in `lib/kv.ts`, used at all 4 call sites (plus
the `x-real-ip` fallback in `lib/auth.ts` removed entirely, since it has no
confirmed trustworthy source here):

```ts
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (!xff) return 'unknown'
  const hops = xff.split(',').map(h => h.trim()).filter(Boolean)
  return hops.at(-1) ?? 'unknown'
}
```

Takes the **last** hop instead of the first. Full reasoning is captured in
a comment directly above the function in `lib/kv.ts`, so a future edit
doesn't casually "simplify" this back to `[0]`.

## Verification

Exercised the actual exported `getClientIp()` against representative
header values (no header, real-IP-only, spoofed-prefix, spoofed multi-hop
chain, messy whitespace, empty string) — all correctly resolved to the
real (last) IP or `'unknown'`. Separately reproduced the *old* behaviour
side by side to confirm the exploit concretely: for the same real client
sending two different fake first-hop values across two requests, the old
code produced two different rate-limit buckets
(`"1.2.3.4"` then `"9.9.9.9"`) for the same actual visitor — i.e. an
unlimited supply of fresh buckets, one per request, fully defeating the
5-attempts/15-min login limiter (and the password-reset and contact-form
limiters the same way).

- `npx tsc --noEmit` — exit 0.
- `npm run build` — exit 0.

## What still needs Ivan to confirm

Everything above is either (a) Traefik's documented default behaviour,
(b) directly observed against the real production DNS/headers, or (c) the
app's own code — nothing here was guessed. The one thing genuinely outside
what this session can check: whether Coolify's *generated* Traefik
configuration for this specific app deviates from Traefik's defaults (e.g.
a manually-added `forwardedHeaders.trustedIPs` or
`notAppendXForwardedFor: true` flag in a custom Traefik label/config
override). No evidence of that was found — Coolify's own community
discussions show this isn't something Coolify configures automatically,
and users who need it add it by hand for scenarios (like sitting behind
Cloudflare) that don't apply to this deployment. If you want to rule this
out with certainty: check the Traefik dynamic configuration Coolify
generated for this app (via the Coolify UI's advanced/raw config view, or
directly on the droplet), specifically for `forwardedHeaders` entries — or,
low-effort empirical check, send a request with a deliberately fake
`X-Forwarded-For` header from an external machine and confirm the
5-attempts login limiter still triggers correctly after 5 fake-header
attempts from the same real IP.
