# Customer Journey Integrity batch status

Implemented primitives in this branch:

- listing lifecycle UI status helpers
- latest owner draft recovery and guarded draft discard
- private favorite listing snapshots with RLS and existing-favorite backfill
- explicit favorite availability state
- exact conversation target resolution with missing-target state
- safe journey fallback mapping primitives

UI wiring is intentionally separate from these persistence and resolution foundations.
