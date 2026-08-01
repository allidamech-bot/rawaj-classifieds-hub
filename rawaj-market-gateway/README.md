# RAWAJ Market Gateway

Independent Vercel project for the shared RAWAJ customer and administration market chooser. The
gateway core remains a Web-standard handler and retains an unrouted Cloudflare Worker adapter only
for portability; Vercel is the approved production host because RAWAJ DNS is already managed there.

## What it does

- Renders two clear cards: RAWAJ Syria and RAWAJ Saudi Arabia.
- Uses `go.rawa-j.com` for customers and `admin.rawa-j.com` for administration.
- Treats the hostname as authoritative and rejects unrecognized hosts.
- Supports `/admin` locally for the same protected-destination chooser UI.
- Stores customer and administrator market preferences under separate cookies.
- Redirects only to fixed RAWAJ destinations.
- Uses Vercel's country header only to highlight a non-binding suggestion.
- Automatically continues only after an explicit or previously stored choice.

## What it does not do

- It does not authenticate users or administrators.
- It does not share Firebase sessions or tokens.
- It does not call either marketplace API.
- It does not combine Syria and Saudi data.
- It does not contain D1, R2, KV, or secret bindings.
- It does not include a deployment command, credentials, or remote DNS mutation.

## Local routes

| Route      | Purpose                                                  |
| ---------- | -------------------------------------------------------- |
| `/`        | Customer chooser, or admin chooser on `admin.rawa-j.com` |
| `/admin`   | Admin chooser for local verification                     |
| `/resolve` | Continue from explicit or remembered preference          |
| `/go/SY`   | Persist the scoped Syria choice and redirect             |
| `/go/SA`   | Persist the scoped Saudi choice and redirect             |
| `/health`  | Minimal service health response                          |

## Decision order

1. Explicit market selection.
2. Stored preference for the current customer/admin scope.
3. Vercel country suggestion.
4. Safe fallback.

The gateway cannot infer an account's market because authentication remains intentionally isolated.
After the user reaches a market application, that application's authenticated account becomes
authoritative.

## Validation

```bash
npm install
npm run check
```

`npm run build` validates both the Web Worker core and the Vercel Function adapter. No deployment is
performed.

`npm run release:gate` intentionally fails while any Vercel project/domain or destination check
remains incomplete. See `docs/vercel-domain-handoff.md` for the controlled release sequence.

## Production source

The Vercel project `rawaj-market-gateway` builds this directory from the `main` branch. Changes are
released through pull requests after the repository and gateway quality gates pass.
