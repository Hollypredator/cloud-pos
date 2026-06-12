# Cloud POS PWA Redesign Findings

## User-Provided Screens
- The desktop product UI is significantly stronger than the competitor POS examples in product depth and operational scope.
- Current responsive/mobile operation center is not store-ready: it reads as a stacked desktop dashboard rather than a native mobile app.
- Existing mobile screenshot has good basics: clear title, live badge, bottom nav. Weakness is hierarchy, repeated cards, oversized buttons, and low information density.

## Competitive Notes
- Competitor POS screens communicate "restaurant ordering" quickly with product images and simple category/product grids.
- Cloud POS communicates "full operations platform" better through kitchen, cashier, adisyon, region/table, product, and reporting screens.
- Store listing screenshots should emphasize end-to-end workflow rather than only visual polish.

## Product Strengths
- Strong operational modules: orders, tables, kitchen, cashier, adisyon, region/table, products, revenue/expense.
- Good status vocabulary: pending, preparing, ready, critical, revenue, balance.
- Good cashier depth: split, quick amount, QR/adisyon sharing, payment type.

## Product Weaknesses
- Mobile layout currently overuses stacked cards.
- Primary actions compete visually instead of forming a guided flow.
- Large empty spaces make some screens look unfinished on desktop and inefficient on mobile.
- Product/order cards could use stronger touch affordance and optional demo imagery.
- Bottom nav/action model needs a native-app pattern.

## PWA / Store Considerations
- Phone screenshots need focused, captionable moments: "Live orders", "Take orders", "Kitchen queue", "Collect payment", "Daily cash flow".
- Store screenshots should avoid admin-only setup clutter as the first impression.
- PWA should feel usable offline/online with visible realtime and sync states.

## 2026-06-08 Operational PWA Audit
- `/m/cashier`, `/m/kitchen`, `/m/delivery`, and `/m/service-requests` currently re-export the desktop pages. Those pages contain mobile-only blocks, but the mobile PWA still depends on desktop page structure and desktop links, so old-screen regressions remain likely.
- Login now calculates a mobile default `next`, but an already-authenticated user still redirects to `/ops`; this can put mobile users back on the desktop operation route after a login/session refresh.
- Mobile desktop-route protection is client-side for exact routes (`/cashier`, `/kitchen`, etc.). It does not cover deeper desktop management links like `/cashier/session` and `/admin/tables` from the mobile action sheet.
- The new-order table flow correctly stopped auto-selecting the first table, but the "choose a table first" prompt appears after the table list; the operator does not get the required instruction before scanning the list.
- Offline PWA behavior is read-only by disabling form submits. That is safer than losing writes, but operationally incomplete for order-taking and payment workflows unless the UI clearly shows what cannot be done and what will retry.
- The current mobile docs require one primary action per screen; several operational surfaces still expose multi-action card stacks and desktop-style secondary controls.
- Mobile unauthenticated `/m/*` first loads could show a Next not-found fallback while nested pages redirected to login. Guarding the mobile layout before child rendering is the stable fix.
- Old mobile screen reports are consistent with an installed PWA/service worker cache serving an older shell; cache version bumps plus `skipWaiting`/controller reload are required whenever the mobile shell changes materially.
- Mobile `Siparis Ac` must be table-first on phone. Opening the composer before table selection or using the tablet three-pane layout makes the flow look like the wrong screen.

## 2026-06-12 Mobile Surface Follow-up
- `/m/delivery` still re-exports `/delivery`, which keeps the mobile dispatch flow tied to desktop BackofficePage layout and desktop links.
- `/m/service-requests` still re-exports `/service-requests`, even though the desktop page contains mobile-only blocks; this leaves first-load/auth behavior and route identity coupled to the desktop page.
- The established mobile pattern is now dedicated `/m/*` server pages using `MobileAuthRedirect`, `LiveRouteRefresh`, `m-card`, `m-stack`, and mobile route redirects for actions.

## 2026-06-12 Operations Hardening Follow-up
- `middleware.ts` and `next.config.ts` had separate CSP definitions; keeping them separate risks production/dev drift.
- Existing web performance profiles did not classify `/m/*` operations routes or `/admin/orders` as critical/interactive flows.
- Mobile AppShell quick actions still used text abbreviations even though the sidebar now uses real Lucide icons.
- PWA shell changes need an explicit service worker cache version bump plus a static guard to avoid installed-app stale shell regressions.

## 2026-06-12 Landing Page Product Redesign
- The current public home page is generated by `src/components/landing-page-renderer.tsx` through `src/app/page.tsx`.
- The existing renderer is CMS-oriented and restaurant-owner focused: pricing cards, restaurant copy, rounded SaaS card grids, large gradients, and mega-menu content.
- The user rejected the acquisition-only direction and requested a Turkish product marketing landing page.
- Required landing traits: Turkish copy, real product screenshots, more colorful/attractive design, visible operation panel login CTA, and clear product/feature explanation.
- Strong trust signals available without inventing proof: real operations panel screenshots, mobile PWA screenshots, self-service / QR flows, cafe-restaurant modules, multi-branch model, role-based modules, kitchen/cashier/order/inventory/reporting coverage, security headers, and route guards.

## 2026-06-12 Surface Alignment Follow-up
- Pixelated-looking public text likely came from the previous display font stack and very heavy heading weights.
- Global smoothing plus a smoother display stack and lower public heading weights make the home/demo typography cleaner.
- `/demo` should behave as a real product tour, not a separate old marketing/demo template.
- `/studio` and `/support` are protected surfaces; visual updates can be build-verified and clean-session redirect-verified without authenticated screenshots.
- Studio and Support navs should keep active-state styling, horizontal scrolling on small screens, and clean Turkish labels.

## 2026-06-12 Turkish Copy Cleanup
- The remaining Turkish problem had two layers: true mojibake in shared data/error-message sources, and ASCII Turkish spelling in visible labels.
- PowerShell output can display valid UTF-8 Turkish as mojibake, so final verification used a Node-based UTF-8 scan instead of relying only on terminal rendering.
- `src/lib/data.ts` was the main shared source of broken user-facing error and demo-copy strings.
- Studio/support/demo visual editor labels also had many high-visibility ASCII Turkish labels, so they were cleaned directly.
- Broad replacements can corrupt code identifiers when Turkish-like substrings appear in English code words such as `section`, `loading`, `secure`, or `radius`; typecheck is required after any mechanical Turkish text pass.
