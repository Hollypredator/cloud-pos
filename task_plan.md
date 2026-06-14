# Cloud POS PWA Responsive Redesign Plan

## Goal
Improve Cloud POS product screens for PWA use and future App Store, Google Play, and Microsoft Store publication. The redesign should make mobile/tablet views feel native, operationally fast, and visually credible while preserving the product's current SaaS depth.

## Current Status
- Phase 1: Competitive and current-screen assessment - in progress
 - Phase 2: PWA layout strategy - complete
 - Phase 3: Screen-by-screen redesign plan - in progress
 - Phase 4: Wireframe/mockup directions - in progress
- Phase 5: Mobile route hardening - complete
- Phase 6: Mobile cashier/adisyon redesign - complete
- Phase 7: Mobile kitchen refinement - complete
- Phase 8: Mobile first-load/order-flow regression fixes - complete
- Phase 9: Mobile delivery/service-request refinement - complete
- Phase 10: Desktop operations visual modernization - complete
- Phase 11: Operations performance, UI consistency, and seçurity hardening - complete
- Phase 12: Turkish product-focused landing page redesign - complete
- Phase 13: Public demo, studio, support visual alignment - complete
- Phase 14: Login surface visual alignment - complete
- Phase 15: Studio content visual builder correction - complete
- Phase 16: General Turkish copy and mojibake cleanup - complete
- Phase 17: Landing/demo image asset path fix - complete
- Phase 18: Google Search Console file verification - complete
- Phase 19: QR menü feature toggles and customer menü redesign - complete
- Phase 20: Landing Turkish copy and speed pass - complete
- Phase 21: Lightweight SEO landing pages for POS search clusters - complete

## Design Thesis
Cloud POS should feel like a native operations cockpit: calm surfaces, large touch targets, clear queues, and a small number of decisive actions per screen.

## Target Surfaces
- Mobile PWA: phone portrait, app-store screenshot ready
- Tablet PWA: cashier/order entry, landscape preferred
- Desktop web: management, reporting, setup
- Store listing visuals: feature-led screenshots with clean captions and real product state

## Success Criteria
- Mobile first screen no longer looks like squeezed desktop UI.
- Every operational screen has one primary action and one obvious next step.
- Bottom navigation, headers, and actions respect thumb reach.
- Product looks publishable as a native-like app, not just responsive web.
- Screenshots can be used directly in store listings after minor framing.

## Key Screens To Redesign
1. Mobile operation center
2. Mobile/tablet table selection
3. Mobile/tablet order entry
4. Kitchen board
5. Cashier/adisyon flow
6. Region/table management
7. Product/category management
8. Revenue/expense dashboard

## Current Session Focus
- Phase 20 complete: landing Turkish copy and speed pass.
- Fixed `adısyon` -> `adisyon`.
- Removed unused homepage data fetch and optimized landing screenshots with `next/image` plus a smaller mobile table-flow preview asset.

## Decisions
- Keep the current professional light SaaS direction.
- Reduce card-heavy stacking on phone; use compact status rows, trays, and action sheets.
- Use mobile-specific navigation instead of shrinking desktop/sidebar behavior.
- Prioritize operational clarity over decorative visuals.
- Mobile order entry uses a product-first screen with a bottom basket sheet instead of persistent side cart.
- Tablet order entry keeps the three-pane model.
- Landing page should introduce the product and its features, not only acquisition value.
- Avoid fake testimonials, fake customer counts, fake screenshots, and exaggerated claims.
- Use actual product screenshots, module coverage, mobile PWA visuals, and operational capabilities as trust signals.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| In-app browser unavailable | Tried to open local app through Browser plugin | Continued with user-provided screenshots and local repo context |
| Mobile route regression risk | Desktop cashier/session and admin links existed inside mobile navigation | Added a route hardening check and moved mobile-visible links under `/m/*` |
| Auth-only mobile cashier visual QA | Clean Playwright session redirected to `/login?next=/m/cashier` | Verified route protection and no console errors; relied on static regression, typecheck, and build for page implementation |
| Auth-only mobile kitchen visual QA | Clean Playwright session redirected to `/login?next=/m/kitchen` | Verified route protection, no console errors, route status, static regression, typecheck, and build |
| Mobile kitchen first-load 404 | Nested `/m/kitchen` page redirected during server rendering and exposed not-found fallback HTML | Added mobile layout auth guard plus clean mobile Playwright check with no 404 |
| Installed PWA showing old screen | Existing service worker cache could keep old mobile shell assets | Bumped ops service worker cache to `v7` and retained skip-waiting/controller reload handling |
| Mobile `Sipariş A?` wrong screen | Flow opened order composer without a table and used tablet three-pane layout | Required selected table before composer, moved prompt above table list, and switched to `mobile_stack` |
| Auth-only mobile delivery/service visual QA | Demo login stayed on `/login?next=/m/*` in local production server | Verified unauthenticated first-load redirects, no visible 404, route guards, typecheck, lint, and build |
| CSP drift risk | Middleware and `next.config.ts` generated different seçurity policies | Added a shared seçurity header source and `seçurity:headers` guard |
| Public landing/demo screenshots not loading | Image paths used Turkish characters while files in `public/landing-assets` use ASCII filenames | Fixed component paths and verified `/` plus `/demo` image assets load with HTTP 200 |
| Windows `Start-Process npm` failed | Tried to start local Next server with `npm` as executable | Retry with `npm.cmd`, which is the Windows command shim |
| Google verification file route returned app 404 HTML | Public file path was intercepted by the app `[slug]` route in local production check | Added an explicit route handler for `/google25ee5ff439ffbaa2.html` |
| Browser plugin unavailable | Tried to acquire the in-app `iab` browser for QR visual QA | Used Playwright fallback and saved screenshots under the Windows temp directory |
