# ROR Planner (Vite + React)

Plan Warhammer: Return of Reckoning gear by career and rank. The planner now fetches item lists live from the public GraphQL API and hydrates details on demand.

## Run the app

- Dev: npm run dev (Vite HMR)
- Build: npm run build (outputs to dist/)
- Preview: npm run preview

## Data source

- Live GraphQL: https://production-api.waremu.com/graphql (proxied in dev via Vite at `/graphql`).
- No local scraping required. Some example GraphQL outputs may be present under `public/data/_gql_*` for debugging.

## GraphQL utilities (optional)

- Probe a single item by ID and dump details: npm run probe:gql
- Query items by filters (slot/career/name/level/renown): npm run gql:items

Notes

- Icons use https://armory.returnofreckoning.com/item/{iconId} when available.
- Equipped selections persist per career in localStorage. Use the Reset Gear button to clear.
