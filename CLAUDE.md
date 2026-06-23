# POS & QR Ordering - Development Guidelines

This file provides instructions for build, verification, and code style rules, alongside routing instructions for gstack agent skills.

## Build and Validation Commands

- **Build project**: `npm run build`
- **Run dev server**: `npm run dev` (or `npm run dev:turbopack` / `npm run dev:webpack`)
- **Run typecheck**: `npm run typecheck`
- **Run linting**: `npm run lint`
- **Run all Phase 2 security/isolation checks**: `npm run phase2:checks`
- **Run performance SLA check**: `npm run perf:sla`
- **Run operational smoke check**: `npm run ops:smoke`

### PWA Validation Scripts
- **PWA routes check**: `npm run pwa:routes`
- **PWA cashier page check**: `npm run pwa:cashier`
- **PWA kitchen page check**: `npm run pwa:kitchen`
- **PWA tables order flow check**: `npm run pwa:tables`
- **PWA delivery/service page check**: `npm run pwa:delivery-service`

## Project Structure & Guidelines

- **Architecture**: Next.js 16 (App Router) with TypeScript, Tailwind CSS (v4), and Supabase (PostgreSQL + RLS).
- **Routes**:
  - Customer routes: `/[businessSlug]/qr/table-1` (dynamic tenant QR menu), `/qr/table-1` (fallback).
  - Staff operational routes (mobile-optimized): `/m/ops`, `/m/tables`, `/m/kitchen`, `/m/cashier`, `/m/delivery`, `/m/service-requests`.
  - Backoffice routes: `/studio/*` (protected content, settings, SEO, media, leads).
  - Public landing page: `/` (Turkish product-focused), `/demo` (interactive tour), `/blog`.
- **Localization**: Turkish is the primary public locale. Ensure visible UI copy matches correct Turkish spelling (e.g. use `adisyon` instead of `adısyon`, ensure no UTF-8 mojibake).
- **Authentication**: Role-based access control. Unauthenticated `/m/*` or `/ops` routes must redirect to login using `ClientRouteRedirect` or mobile layout auth guards to prevent Next RSC not-found/404 fallbacks on first load.

## Skill Routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
