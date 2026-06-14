# Mobile PWA Route Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent mobile PWA operators from falling back to desktop operation routes during login, navigation, and cashier session work.

**Architecture:** Keep the existing mobile shell and desktop page reuse for this first package, but harden route targets so mobile links stay under `/m/*`. Add a small static regression script because this repo currently has no Jest/Vitest setup.

**Tech Stack:** Next.js App Router, React Server Components, PowerShell/Node verification script.

---

### Taşk 1: Add Mobile Route Regression Check

**Files:**
- Create: `scripts/mobile-pwa-route-hardening-check.mjs`
- Modify: `package.json`

- [ ] Add a Node script that reads `src/app/login/page.tsx`, `src/components/mobile-ops-shell.tsx`, `src/app/cashier/page.tsx`, and `src/app/cashier/session/page.tsx`.
- [ ] Assert login uses `redirect(resolvedNext)` for authenticated users.
- [ ] Assert mobile shell does not contain desktop management hrefs `/cashier/session` or `/admin/tables`.
- [ ] Assert cashier mobile links can target `/m/cashier` and `/m/cashier/session`.
- [ ] Assert cashier session actions accept a return path for `/m/cashier/session`.
- [ ] Add `pwa:routes` script to `package.json`.
- [ ] Run `npm run pwa:routes` and confirm it fails before implementation.

### Taşk 2: Harden Login And Mobile Shell Links

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/mobile-ops-shell.tsx`

- [ ] Change already-authenticated login redirect from `/ops` to `resolvedNext`.
- [ ] Change mobile shell "Gün İşlemleri" href from `/cashier/session` to `/m/cashier/session`.
- [ ] Remove or replace `/admin/tables` from the mobile action sheet so phone operators do not enter a desktop admin page from the PWA shell.
- [ ] Run `npm run pwa:routes`.

### Taşk 3: Add Mobile Cashier Session Route

**Files:**
- Create: `src/app/m/cashier/session/page.tsx`
- Modify: `src/app/cashier/page.tsx`
- Modify: `src/app/cashier/session/page.tsx`

- [ ] Add `/m/cashier/session` as a mobile-shell route that reuses cashier session content.
- [ ] In cashier page actions and mobile queue links, resolve hrefs to `/m/*` when rendering mobile markup.
- [ ] In cashier session open/close forms, include a hidden `returnPath`.
- [ ] In cashier session server actions, only allow `/cashier/session` and `/m/cashier/session` as return paths.
- [ ] Revalidate both desktop and mobile cashier session paths after actions.
- [ ] Run `npm run pwa:routes`, `npm run typecheck`, and `npm run build`.

### Self-Review

- The first package only closes route escapes; it does not redesign cashier/adisyon yet.
- The next package should split mobile cashier/adisyon into a dedicated queue-first PWA page.
