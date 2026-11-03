# client/AGENTS.md

Frontend rules for Bench Supply. Read the root `AGENTS.md` first, then `docs/ui-pages.md`.

## Scope

Plain HTML pages, CSS, and ES modules. No framework, no template engine, no build step, no TypeScript. Express serves this folder statically.

## Structure

```text
client/
├─ index.html, products.html, product.html, cart.html, checkout.html,
│  login.html, register.html, account.html, order.html, credits.html, 404.html
├─ css/tokens.css      Hallmark Cobalt tokens + shared scale (do not edit casually)
├─ css/base.css        Reset, typography, focus, reduced motion
├─ css/app.css         Components and page layouts
├─ js/api.js           The only place that calls fetch
├─ js/auth.js          Access token in memory, refresh flow, auth events
├─ js/cart.js          Cart fetch/mutations and cart-count events
├─ js/currency.js      Display currency, fixed demo rates, price formatting
├─ js/layout.js        Header, footer, mobile menu, auth/cart/currency hydration
├─ js/format.js        Dates, stock text, next-path sanitization
├─ js/ui.js            Toasts, skeletons, empty/error states, product card
├─ js/pages/*.js       One module per page
└─ assets/             Self-hosted fonts and local product images
```

## Rules

- Use tokens from `client/css/tokens.css`. No literal colours or `font-family` outside the token block.
- Use `api.js` for every request. Do not call `fetch` from page modules.
- Use `auth.js` for token state. Never put the access token in `localStorage` or `sessionStorage`.
- Use `layout.js` to render the header and footer. Do not duplicate the shell across pages.
- Use DOM APIs and `textContent`. Never pass API or user data to `innerHTML`.
- Every page has one `h1`, a skip link, and semantic landmarks.
- Every data region has loading, empty, error, and full states.
- Every control has default, hover, `:focus-visible`, active, disabled, loading, error, and success states where applicable.
- No `transition: all`; animate only `transform` and `opacity`.
- Respect `prefers-reduced-motion`. The hero field becomes a still.
- Labels are sentence case, untracked. No eyebrow labels, tracked caps, middle-dot meta strings, arrows glued to link text, or decorative status dots.
- Product images are local files in `assets/products/` and are credited on `credits.html`. If `image_url` is null or the file fails, render the Cobalt product plate.
- All storefront prices use `formatPrice` from `js/currency.js`. The API stores USD cents; INR is the default display currency and the user can switch to USD or EUR with fixed demo rates.
- No external image or font URLs. Self-host assets locally.
- No fake reviews, ratings, testimonials, customer counts, or brand logos.
- No admin UI.

## API and auth

- Same-origin only. `api.js` uses `credentials: 'same-origin'`.
- The access token is kept in a module variable in `auth.js`.
- On load, call `POST /api/auth/refresh` to restore a session. If it fails, treat the visitor as signed out.
- On a 401, try refresh once, then retry the original request once. If refresh fails, emit `auth:signed-out`.
- Protected pages call `requireAuth({ next })` and redirect to `/login.html?next=...`.
- Sanitize `next` to a same-origin path. Reject absolute URLs and protocol-relative paths.
- Show API error messages, not raw JSON.

## Cart

- The cart cookie is httpOnly; the frontend never reads it.
- Fetch `/api/cart` after layout hydration and after auth changes.
- Update the cart badge from the returned `itemCount`.
- Disable a line's controls while a mutation is in flight. Show a toast on failure.
- Cap quantity inputs at the product's available stock.

## Verification

```bash
npm run sloplint
npm run lint
```

Manual checks: 360px, 768px, 1024px, 1440px, 1920px; keyboard-only tab order; reduced motion; empty/error/loading states; no console errors.

Report results in the phase progress entry. Do not claim a render-tier pass when Chromium is unavailable; say "static gates only".
