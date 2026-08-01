# Vercel project and domain handoff

This checklist keeps the gateway separate from the existing RAWAJ Syria Vercel project.

## Project boundary

Create a new Vercel project named `rawaj-market-gateway` from this folder only. Do not import,
relink, or change the existing `rawaj-lovable` project. The new project has no database, storage,
Firebase credentials, API credentials, or marketplace data.

## Approved host contract

| Host | Audience | Destination |
| --- | --- | --- |
| `go.rawa-j.com` | Customers | Public Vercel gateway chooser |
| `admin.rawa-j.com` | Operators | Admin chooser; each destination enforces its own login and role |

The hostname is authoritative on the two production hosts. Query parameters cannot turn the
customer host into the admin gateway. Requests for `/admin` on `go.rawa-j.com` redirect to
`admin.rawa-j.com`.

## No shared authentication

The admin gateway displays only two fixed navigation cards and contains no administrative data.
After an operator chooses a market, the Syrian or Saudi admin application must independently verify
its own Firebase session and admin role. The gateway never receives or shares those sessions.

## Controlled release order

1. Create a separate Vercel project from the `rawaj-market-gateway` folder.
2. Verify its generated `rawaj-market-gateway*.vercel.app` URL and `/health` endpoint.
3. Add `go.rawa-j.com` to that new project.
4. Add `admin.rawa-j.com` to that same new project.
5. Apply only the DNS records Vercel explicitly shows for those two subdomains.
6. Do not alter the apex `rawa-j.com`, `www`, or the existing Syria project domain.
7. Verify the four fixed destinations in `src/gateway.ts`, including each market's own admin login.
8. Run `npm run check` and then update `config/launch-readiness.json` from observed evidence.

Every value in `config/launch-readiness.json` must be `true` before the market integrations are
enabled. The repository intentionally contains no deployment command and no remote credentials.
