# Syria market gateway handoff

No Syria repository or production resource was changed by this gateway batch.

When a separate Syria change is approved, use the same disabled-by-default contract as Saudi Arabia:

```dotenv
VITE_ENABLE_MARKET_GATEWAY=false
VITE_MARKET_GATEWAY_ORIGIN=https://go.rawa-j.com
VITE_ADMIN_GATEWAY_ORIGIN=https://admin.rawa-j.com
```

The integration adapter should:

- keep direct Syria URLs as the fallback while the flag is false;
- accept only the two exact HTTPS origins above;
- send customer choices to `https://go.rawa-j.com/go/{market}`;
- send admin choices to `https://admin.rawa-j.com/go/{market}`;
- store only the selected market code, never auth tokens or user data;
- preserve Syria's own authentication, API, database, storage, roles, and sessions.

Do not enable the flag until the independent Vercel gateway project, both gateway subdomains,
destination checks, market-specific admin authentication checks, and production approval have all
passed the release gate.
