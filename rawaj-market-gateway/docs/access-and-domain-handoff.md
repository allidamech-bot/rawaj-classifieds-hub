# Retired Cloudflare Access path

RAWAJ DNS is managed through Vercel, and `rawa-j.com` is not a Cloudflare zone. Cloudflare Access is
therefore not part of the approved gateway architecture.

Do not:

- add or transfer `rawa-j.com` to Cloudflare;
- change the domain's nameservers;
- create a Cloudflare Access application for this gateway;
- attach a route to the uploaded `rawaj-market-gateway` Worker.

The previously uploaded Cloudflare Worker has no target and is not serving traffic. It remains
separate from the Syria application and can be removed later through a separately approved cleanup.

Continue with `vercel-domain-handoff.md`.
