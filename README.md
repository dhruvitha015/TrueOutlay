# SmartBuy / TrueOutlay (frontend + backend connected)

One Node.js process serves both the API and the web app.

## Requirements
- Node.js 18 or newer (see `requirements.txt`). No `npm install` needed.

## Run
```bash
node server.js        # or: npm start, ./start.sh, start.bat (Windows)
```
Open http://localhost:3000

Tests: `node --test test/api.test.js` (9 tests)

## Structure
- `server.js`            HTTP server: `/api/*` routes + serves `public/`
- `src/`                 products (seed data), EMI engine, simulator, activity store
- `public/`              frontend (index.html, styles.css, script.js) - calls the API
- `data/activity.json`   created automatically (per-browser click history)
- `.env`                 PORT, CORS_ORIGIN, DATA_DIR (set as environment variables)

## API
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/meta` | Categories, merchants, tenures |
| GET | `/api/products?q=&category=&merchant=&minDiscount=&maxPrice=` | Search / filter (simulated deal if nothing matches) |
| GET | `/api/products/:id` | One product |
| GET | `/api/products/:id/emi?downPayment=&tenures=3,6,9,12` | EMI table + best plan |
| POST | `/api/activity` | `{userId, productId}` records a click |
| GET | `/api/recommendations?userId=` | Products from your most-clicked category |

## Hosting frontend separately
Set `API_BASE` at the top of `public/script.js` to the backend URL (e.g. `http://localhost:3000`).
