# AGENTS.md

This is the operating contract for every agent working on Bench Supply. Read it before touching code.

## Project

Bench Supply is a learning-focused e-commerce store. Express 5 + Postgres 17 + Drizzle ORM on the backend; plain HTML, CSS, and ES modules on the frontend. The frontend is served by Express from the same origin. No template engine, no frontend framework, no build step.

The full design and phase docs live in `docs/` and are **local-only** (gitignored). This file and the two folder-level `AGENTS.md` files are tracked.

## Read order

Read these in order before starting any phase:

1. `AGENTS.md` (this file)
2. `docs/phases/phase-<n>-<name>.md` — your phase brief
3. `docs/architecture.md`
4. `docs/data-model.md`
5. `docs/api.md`
6. `docs/ui-pages.md` — for any frontend work
7. `docs/plan.md`
8. The last entry in `docs/progress.md`

Then verify the previous phase's acceptance checks before writing anything. If the previous phase is broken, fix it within scope or stop and log a blocker. Do not build on a broken base.

## Commands

```bash
npm install
npm run db:up          # start local Postgres
npm run db:migrate     # apply Drizzle migrations
npm run db:seed        # idempotent seed
npm run dev            # Express on http://localhost:3000
npm test               # focused integration suite
npm run lint
npm run format:check
npm run sloplint       # Hallmark static UI gates
```

Reset the local database:

```bash
npm run db:down
docker volume rm e-commerce_pgdata   # only when a clean reset is intended
npm run db:up
npm run db:migrate
npm run db:seed
```

## Non-negotiables

- **No EJS, no React/Vue/Svelte, no build step, no TypeScript.** Plain HTML, CSS, and ES modules.
- **No access token in `localStorage`.** The access token lives in memory; the refresh token is an httpOnly cookie.
- **No raw SQL string interpolation.** Use Drizzle. Parameterized queries only.
- **No secrets in the repo.** `.env` is ignored; `.env.example` contains placeholders only.
- **No `innerHTML` with user or API data.** Use DOM APIs and `textContent`.
- **No invented proof.** No reviews, ratings, testimonials, customer counts, logo walls, or fake brand logos.
- **No external image URLs.** Store assets locally and credit library photos in the footer.
- **No admin panel in v1.** Products and categories are seeded.
- **No real payments.** Checkout uses the mock payment service and says so.
- **No docs committed.** `docs/` and `design.md` are gitignored. Commit code, migrations, seed, tests, `README.md`, and `AGENTS.md` files only.
- **No unnecessary test files.** One focused integration file per module plus the checkout transaction test. No snapshots, scratch scripts, or generated reports.

## Phase protocol

1. Read the phase brief and the last progress entry.
2. Run the previous phase's acceptance checks.
3. Create a short task list in the phase brief or a local note. Do not edit `docs/progress.md` until the end.
4. Implement in small, testable steps. Prefer the existing patterns over new abstractions.
5. Run the focused tests and the relevant manual checks.
6. Append (never rewrite) a progress entry to `docs/progress.md`.
7. Commit code only. Docs are local and ignored.
8. Stop. Do not start the next phase.

If you change an API, schema, or UI contract, update `docs/api.md`, `docs/data-model.md`, or `docs/ui-pages.md` and note the change in the progress entry.

## Progress log format

Append one entry per phase to `docs/progress.md`:

```markdown
## Phase <n> — <name> — YYYY-MM-DD — agent: <name or session id>

Status: complete | blocked | partial
Built: <what shipped, in 2–5 bullets>
Decisions: <decisions made, with reasons>
Files: <key files created or changed>
Tests: `<command>` — <pass/fail counts and any failures>
Manual checks: <what was checked and the result>
Known issues: <anything unfinished or fragile>
Next phase notes: <what the next agent must know>
```

Evidence beats claims. Paste the commands and their results. If a check was not run, say so.

## Definition of done

A phase is complete only when:

- Every acceptance criterion in the phase brief has evidence.
- `npm test` passes (or the phase's documented subset, with a reason).
- `npm run lint` passes.
- No secrets, generated reports, or unrelated files are staged.
- The progress entry is appended.
- The next agent can start from the progress entry and the phase brief without asking questions.

## Code conventions

- ESM (`"type": "module"`), Node 26.
- Two-space indentation, single quotes, semicolons, trailing commas where Prettier puts them.
- Feature modules: `routes` → `controller` → `service` → Drizzle. Controllers do not contain business logic.
- Validate at the boundary with Zod. Throw `AppError` for expected failures. Let the central error middleware shape the response.
- Money is integer cents. Timestamps are ISO strings at the API edge.
- Use `db.transaction` for multi-step writes.
- Keep comments for non-obvious decisions, not narration.
- Prefer named exports. Default exports only for page modules if needed.

## UI rules

- Use the Hallmark Cobalt tokens in `client/css/tokens.css`. No literal colours or font families outside the token block.
- No `transition: all`; animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.
- Every interactive element has a visible `:focus-visible` state.
- Every data region has loading, empty, error, and full states.
- Labels are sentence case, untracked. No eyebrow labels, no tracked-caps labels, no middle-dot meta strings, no arrows glued to link text, no decorative status dots.
- One primary button style, one container width, one column gap below the hero.
- The hero headline is seven words or fewer; the sentence is twelve words or fewer. The headline, sentence, and primary action are visible at 1280 × 800.
- Product images are slots. If `image_url` is null, render the Cobalt product plate. Do not draw a fake product.
- Run `npm run sloplint` after frontend changes. Fix every FAIL; fix or waive every REFLEX with a reason in the progress entry.

## Security rules

- `helmet` with a self-only CSP; self-hosted fonts; no inline scripts or styles.
- `express-rate-limit` on auth, orders, and the global API.
- `bcryptjs` cost 12. Generic login errors.
- JWT access token: 15 minutes, HS256, `sub` and `role` only.
- Refresh token: opaque 48-byte random value, SHA-256 hash in `refresh_tokens`, httpOnly cookie, `SameSite=Lax`, `Secure` in production.
- `origin` check for state-changing requests in production.
- `express.json({ limit: '100kb' })`.
- `trust proxy` in production.
- Never log passwords, tokens, cookies, or full request bodies for auth routes.

## Git rules

- Commit after each task or logical unit.
- Do not commit `docs/`, `design.md`, `.env`, `node_modules/`, coverage, test reports, or logs.
- Do not rewrite history or force-push.
- Keep commits small and descriptive: `feat: add product listing endpoint`, `fix: cap cart quantity at stock`.
- If the repo is not initialized yet, phase 0 runs `git init` and makes the first commit.

## Blockers

If a dependency, migration, or environment issue blocks the phase:

1. Record the exact command and error in `docs/progress.md` under `Known issues`.
2. Do not silently skip acceptance criteria.
3. Stop and report the blocker. The next agent needs an honest handoff, not a false completion.
