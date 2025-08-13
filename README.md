# ROR Planner (Vite + React)

Plan Warhammer: Return of Reckoning gear by career and rank. The planner fetches items live from the public GraphQL API and hydrates details on demand.

## Run the app

- Dev: npm run dev (Vite HMR)
- Build: npm run build (outputs to dist/)
- Preview: npm run preview

## Data source

- Live GraphQL: https://production-api.waremu.com/graphql (proxied in dev via Vite at `/graphql`). In production you can point the app to a proxy via `VITE_GQL_PROXY_URL`.

## GraphQL utilities (optional)

- Probe a single item by ID and dump details: npm run probe:gql
- Query items by filters (slot/career/name/level/renown): npm run gql:items

Notes

- Icons use https://armory.returnofreckoning.com/item/{iconId} when available.
- Equipped selections persist per career in localStorage. Use the Reset Gear button to clear.

## Deploy to GitHub Pages

This app is a Vite + React SPA and can be hosted on GitHub Pages.

Configured in this repo:
- Vite base set to `/rorplanner/` in `vite.config.js` (update if your repo name differs).
- SPA routing: `public/404.html` redirects unknown paths to `index.html`.
- GitHub Actions workflow `.github/workflows/deploy.yml` builds on pushes to `master` and deploys `dist`.

Steps:
1) Push to `master` (or adjust the workflow branch in the workflow file).
2) In GitHub → Settings → Pages, set Source: GitHub Actions.
3) Visit `https://<your-user>.github.io/rorplanner/` when the action completes.

Note: If the API blocks CORS for `github.io`, set an edge proxy (e.g., Cloudflare Worker) and add `VITE_GQL_PROXY_URL` in the Pages workflow or repository secrets to point the app at the proxy.
