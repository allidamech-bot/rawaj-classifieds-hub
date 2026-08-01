## RAWAJ Market Gateway Architecture

This repository is a navigation gateway only.

- It may render Syria and Saudi Arabia selection cards.
- It may store only a scoped market code (`SY` or `SA`).
- It may use Vercel or Cloudflare request country data as a non-binding suggestion.
- It must redirect only to fixed, reviewed RAWAJ destinations.
- It must never proxy, query, aggregate, or display marketplace or administration data.
- It must never receive, copy, inspect, or share Firebase sessions, user identifiers, roles,
  conversations, favorites, D1 records, R2 objects, or API credentials.
- Customer and administrator market preferences must remain separate.
- Geographic detection must never force a redirect by itself.

## Safety

- Do not add remote DNS, secrets, bindings, deployments, or resources without
  explicit user approval.
- Do not add a deploy script. Local validation may build both runtime adapters.
- Do not push or create a remote repository without explicit approval.
- Do not modify either the Syria or Saudi application from this repository.
