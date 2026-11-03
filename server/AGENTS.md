# server/AGENTS.md

Backend rules for Bench Supply. Read the root `AGENTS.md` first, then `docs/architecture.md`, `docs/data-model.md`, and `docs/api.md`.

## Scope

Express 5, Postgres 17, Drizzle ORM, JWT auth. Plain JavaScript (ESM). No TypeScript, no ORM alternatives, no raw SQL string interpolation.

## Structure

```text
server/src/
├─ server.js              process entry, graceful shutdown
├─ app.js                 createApp(), middleware, static client, routes, 404, error handler
├─ routes.js              mounts feature routers under /api
├─ config/env.js          Zod-validated environment
├─ db/client.js           pg Pool + Drizzle
├─ db/schema.js           tables, indexes, constraints
├─ db/migrate.js          migration runner
├─ db/seed.js             idempotent seed
├─ db/seed-data.js        categories and products
├─ modules/<feature>/     routes, controller, service, schema
├─ middleware/            auth, error, validate, rate-limit, origin
└─ lib/                   errors, password, tokens, money
```

## Module pattern

- `routes.js` wires the router and middleware.
- `controller.js` reads `req`, calls the service, sends `res`. No business logic.
- `service.js` owns business rules, Drizzle queries, ownership checks, and transactions.
- `schema.js` holds Zod request schemas.
- Shared code goes in `db/`, `middleware/`, or `lib/`. Do not add a repository layer in v1.

## Rules

- Validate body, params, and query with Zod at the route boundary.
- Throw `AppError(status, code, message, details?)` for expected failures. The central error handler shapes the response.
- Use one response shape: `{ data }`, `{ data, meta }`, or `{ error: { code, message, details? } }`.
- Money is integer cents. Never use floats for money.
- Use `db.transaction` for multi-step writes. Checkout locks product rows with `FOR UPDATE`.
- Use Drizzle query builders. No `sql.raw` with user input.
- Never log passwords, tokens, cookies, or full auth request bodies.
- Hash passwords with bcryptjs at cost 12. Use generic login errors.
- JWT access token: 15 minutes, `sub` and `role` only. Verify issuer and audience.
- Refresh token: opaque 48-byte random value, SHA-256 hash in `refresh_tokens`, httpOnly cookie, `SameSite=Lax`, `Secure` in production. Revoke on logout.
- `requireAuth` loads the user by `sub`; deleted users get 401. It attaches `{ id, name, email, role, createdAt }` to `req.user`.
- `optionalAuth` is for public routes that personalize when a valid Bearer token is present (the cart). An invalid or expired token is treated as a guest, not a 401.
- Ownership checks return 404, not 403, for another user's order.
- Rate-limit auth endpoints (10 per 15 minutes), order creation (20 per hour), and the global API (300 per 15 minutes).
- Keep `helmet`, `express.json({ limit: '100kb' })`, `cookie-parser`, `morgan`, and the origin check in `app.js`.
- `trust proxy` in production.

## Migrations and seed

- Edit `db/schema.js`, then run `npm run db:generate`. Commit the generated SQL and meta files.
- Do not hand-edit a migration unless the generated SQL is wrong; note it in the progress entry.
- Seed is idempotent: upsert categories by slug and products by slug. Do not delete user data.
- The seed includes one out-of-stock and one low-stock product for UI state testing.

## Tests

- `node:test` + `supertest`, against `TEST_DATABASE_URL`.
- One integration file per module: `auth`, `products`, `cart`, `orders`, plus `health`, `db`, `seed`, `format`, and the cross-cutting `security` file.
- Reset tables between files. Use the test database, never the development database.
- Use the `authorized(agent, token)` wrapper for signed-in cart/order requests; it keeps the cookie jar and adds the Bearer header. Do not create a fresh agent.
- Close the pool with an `after()` hook in `helpers.js` so the test process exits.
- Cover happy paths and the failure modes in the phase brief.
- No snapshots, no generated coverage reports, no scratch scripts committed.

```bash
npm run db:up
npm run db:migrate
npm test
npm run lint
```

## Verification

Run the phase's test command and paste the result in `docs/progress.md`. If a test is skipped, say why. Do not claim a passing suite without the command output.
