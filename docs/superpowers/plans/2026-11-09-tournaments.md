# Tournament implementation plan

Approved scope is in the user request and `docs/tournaments-design.md`. Use Superpowers execution, review and verification with Supabase/Postgres skills. Parallel tasks have disjoint source ownership.

- [x] Engine with seeded byes, CSV mapping/round trip, graph/result validation and constraint scheduling, verified with Node tests.
- [x] Dashboard tab for manager creation/edit/import/generation/scheduling/results/review and AD transportation, verified through normal entry points.
- [x] RLS-backed checked save/review/publication/transport operations, stale and revoked-access tests, and publication/history projection in test Supabase.
- [x] Calendar/feed and public bracket integration with identity, filters, transportation isolation and updates checks.
- [x] Integrate and run full Node/rollback SQL checks, browser phone/desktop checks and independent review; address findings.
- Delivery uses a reviewed branch commit, push, pull request and merge, followed by updating Desktop main. Deployment and remaining limitations are recorded in `docs/tournaments-design.md` and the pull request.
