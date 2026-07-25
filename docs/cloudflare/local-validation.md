# Local validation

Run the complete local gate from the repository root:

```bash
npm ci
npm run check:cloudflare
```

The gate verifies the runtime boundary, Cloudflare feature contracts, D1 migration replay,
administrative authorization, application TypeScript, Worker TypeScript, and the production build.

For a faster backend-only loop:

```bash
npm run test:runtime-boundary
npm run test:cloudflare-cutover
npm run test:d1-migrations
npm run test:admin-security
npx tsc -p cloudflare/worker/tsconfig.json --noEmit
```

These commands are local-only and do not deploy or modify remote resources.
