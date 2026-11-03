# Bench Supply

A learning-focused e-commerce store. The backend is the main subject: Express 5, Postgres 17, Drizzle ORM, JWT auth, migrations, seed data, and focused integration tests. The frontend is plain HTML, CSS, and JavaScript served by Express, with no framework and no build step.

> **Demo store.** No real payments are processed. Product images are replaceable slots. Do not use this project as-is for production commerce.

## What it does

- Product catalog with search, category filter, sorting, and pagination
- Product detail pages with specs, stock state, and quantity selection
- Server-side cart for guests and signed-in users, merged on login
- Registration and login with JWT access tokens and an httpOnly refresh cookie
- Checkout with a real database transaction, stock locking, price snapshots, and idempotency
- Order history and order detail pages
- Responsive, accessible UI built on the Hallmark Cobalt system

## Stack

| Layer     | Choice                                  |
| --------- | --------------------------------------- |
| Runtime   | Node.js 26                              |
| Server    | Express 5                               |
| Database  | Postgres 17 locally; Neon in production |
| ORM       | Drizzle ORM + drizzle-kit               |
| Auth      | JWT access token + opaque refresh token |
| Frontend  | HTML, CSS, ES modules                   |
| Tests     | `node:test` + `supertest`               |
| UI system | Hallmark Cobalt (modern-minimal)        |

## Quick start

```bash
cp .env.example .env
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>.

The seed creates four categories and twelve desk/tech products, including one out-of-stock item and one low-stock item.

## Scripts

| Script                 | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start Express with Node watch mode               |
| `npm start`            | Start Express normally                           |
| `npm run db:up`        | Start the local Postgres container               |
| `npm run db:down`      | Stop the local Postgres container                |
| `npm run db:generate`  | Generate a Drizzle SQL migration from the schema |
| `npm run db:migrate`   | Apply migrations                                 |
| `npm run db:seed`      | Seed categories and products (idempotent)        |
| `npm run db:studio`    | Open Drizzle Studio                              |
| `npm test`             | Run the focused integration suite                |
| `npm run test:watch`   | Run tests in watch mode                          |
| `npm run lint`         | Run ESLint                                       |
| `npm run format`       | Format with Prettier                             |
| `npm run format:check` | Check formatting                                 |
| `npm run sloplint`     | Run Hallmark's static UI checks                  |

`sloplint` is a thin wrapper at `scripts/sloplint.mjs`. It looks for the Hallmark skill at `$HALLMARK_SKILL_DIR`, then `~/.agents/skills/hallmark`, then `~/.claude/skills/hallmark`. Set `HALLMARK_SKILL_DIR` if the skill lives elsewhere. The render tier needs Chromium; this environment runs the static gates only.

## Environment

Copy `.env.example` to `.env` and fill in the values. The important ones:

| Variable                        | Purpose                                             |
| ------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                      | `development` or `production`                       |
| `PORT`                          | Express port, default `3000`                        |
| `APP_ORIGIN`                    | Public origin, used by the origin check and cookies |
| `DATABASE_URL`                  | Local Docker Postgres or Neon connection string     |
| `TEST_DATABASE_URL`             | Test database, created by the Docker init script    |
| `JWT_SECRET`                    | At least 32 random characters                       |
| `JWT_ISSUER`, `JWT_AUDIENCE`    | Fixed token claims                                  |
| `JWT_ACCESS_TTL`                | Access token lifetime, default `15m`                |
| `REFRESH_TTL_DAYS`              | Refresh token lifetime, default `7`                 |
| `SHIPPING_FLAT_CENTS`           | Flat shipping in cents, default `800`               |
| `FREE_SHIPPING_THRESHOLD_CENTS` | Free shipping threshold, default `10000`            |

Neon connection strings must include `sslmode=require`. Use the direct connection string for Express; the pooled string is for serverless clients.

## Project structure

```text
client/                 HTML pages, CSS, ES modules, local assets
server/src/app.js       Express app factory
server/src/server.js    Process entry, graceful shutdown
server/src/config/      Validated environment
server/src/db/          Drizzle client, schema, migrations, seed
server/src/modules/     auth, products, cart, orders
server/src/middleware/  auth, errors, validation, rate limits, origin
server/src/lib/         errors, passwords, tokens, money
server/tests/           Focused integration tests
docs/                   Local-only design and phase docs (gitignored)
```

## Testing

```bash
npm run db:up
npm run db:migrate
npm test
```

Tests use `TEST_DATABASE_URL` and reset the test database between files. Keep the suite focused: one integration file per module plus the checkout transaction test. Do not commit coverage reports, Playwright artifacts, or scratch test files.

## Deployment

The app is a single Node service that serves the static client and the API from the same origin. Neon provides Postgres. See `docs/deployment.md` for the full Render/Neon walkthrough.

```bash
npm ci
npm run db:migrate
npm start
```

Set `NODE_ENV=production`, `APP_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, and the shipping variables.

## Documentation and repository rules

- `docs/` and root `design.md` are local-only and gitignored, per the project owner's request.
- `README.md`, `AGENTS.md`, `client/AGENTS.md`, and `server/AGENTS.md` are tracked.
- Do not commit `.env`, coverage, test reports, or generated artifacts.
- The full design, plan, progress log, and phase briefs live in `docs/` in the working copy.

## Known limits

- No real payment gateway; `payment.service.js` is the replacement seam.
- No admin panel; products and categories are seeded.
- No product image upload; `products.image_url` is the replacement seam.
- No email delivery, password reset, reviews, ratings, coupons, or multi-currency.
- The Hallmark render tier needs Chromium; the current environment runs static gates only.
