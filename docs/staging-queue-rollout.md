# Staging Queue Rollout (Tables -> Cashier -> Auth Perf)

Bu runbook, queue rollout'unu iki dalgada güvenli şekilde açmak ve auth perf baseline almak için kullanılır.

## 1) Preflight

```bash
npm run rollout:preflight
```

Manuel onaylar:
- Staging deploy güncel.
- `20260321_*` migration'lari staging'de uygulanmis.
- Admin test hesabi aktif (`/ops`, `/kitchen`, `/cashier`, `/admin/*`).

## 2) Wave-1: Tables

Staging env:
- `NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES=true`
- `NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER=false`
- (Gerekirse) `VERCEL_PROTECTION_BYPASS=<bypass-token>`

Redeploy sonrası:

```powershell
$env:NEXT_PUBLIC_APP_URL="https://<staging-domain>"
$env:NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES="true"
$env:NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER="false"
$env:VERCEL_PROTECTION_BYPASS="<bypass-token>"
npm run rollout:wave:tables
```

Manual smoke:
1. `/tables` render.
2. `empty -> reserved -> empty`.
3. Optimistic `Isleniyor` ve ACK sonrası kalicilik.
4. Duplicate submit kontrolü.

## 3) Wave-2: Cashier

Staging env:
- `NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES=true`
- `NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER=true`
- (Gerekirse) `VERCEL_PROTECTION_BYPASS=<bypass-token>`

Redeploy sonrası:

```powershell
$env:NEXT_PUBLIC_APP_URL="https://<staging-domain>"
$env:NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES="true"
$env:NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER="true"
$env:VERCEL_PROTECTION_BYPASS="<bypass-token>"
npm run rollout:wave:cashier
```

Manual smoke:
1. `ORDER_FINANCIALS_SET`
2. `PAYMENT_SALE_CASH`
3. `ORDER_ITEM_CANCEL`
4. `ORDER_CANCEL`
5. `ORDER_REFUND_CASH`
6. ACK/REJECT feedback ve UI tutarlılığı

## 4) Auth Perf Baseline

```powershell
$env:PERF_BASE_URL="https://<staging-domain>"
$env:PERF_REQUIRE_AUTH_BASELINE="true"
$env:PERF_ALLOW_LOCAL_AUTH_BASELINE="false"
$env:PERF_AUTH_COOKIE="<auth-cookie>"
$env:VERCEL_PROTECTION_BYPASS="<bypass-token>"
$env:PERF_RUNS="7"
$env:PERF_WARMUP_RUNS="2"
npm run rollout:perf:auth
```

Rapor:
- `/ops`, `/kitchen`, `/cashier` `avg`, `p95`
- `x-app-shell-ms`, `x-operation-ms`

Gate:
- Auth page `avg <= 900ms`
- Auth page `p95 <= 1200ms`

## 5) Rollback

- Wave-1 fail: `NEXT_PUBLIC_POS_CLIENT_QUEUE_TABLES=false`, redeploy.
- Wave-2 fail: yalnızca `NEXT_PUBLIC_POS_CLIENT_QUEUE_CASHIER=false`, redeploy (`Tables=true` kalir).
