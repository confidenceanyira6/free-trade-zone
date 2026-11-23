# Saage backend: status and plan

Legend: **Written** = in this repo, not run. **Tested** = run against a real Supabase project with passing tests. **Deployed** = live. Right now nothing is Tested or Deployed, because this work was done through GitHub only, without Supabase access or a shell.

## What already existed (migration 0001, a draft)
Buyer-owned agents, chat, fee proposals, transactions, assignments, private locations with `visible_locations()`, wallets, escrow accounts, append-only ledger, idempotent `fund_escrow` / `release_escrow` / `release_agent_fee` / `refund_escrow`, disputes that only place a hold, reviews, notifications. The frontend (`src/lib/api.ts`) already calls a REST backend that does not exist yet (`VITE_API_URL` unset).

## Problems found in 0001 (fixed or flagged)
| # | Problem | Status |
|---|---|---|
| 1 | `profiles` had no RLS: any user could set their own role to admin | Fixed in 0002 (written) |
| 2 | `is_admin()` trusted `profiles.role`; no admin permission levels | Fixed in 0002: `admin_users`, `has_permission()` |
| 3 | No currency on any money column | Added `currency` columns in 0002 |
| 4 | `post_ledger` / `credit_wallet` callable by clients | Revoked in 0002 |
| 5 | Fee proposals had no write path; accepted fees not immutable | `propose_fee`, `respond_fee`, `fee_agreements` in 0002 |
| 6 | `fund_escrow` takes totals from the transaction row but never compares them to the amount the provider actually collected | **Open.** Needs `payment_intents` (expected amount + currency) checked inside `fund_escrow` |
| 7 | `wallets.available` is an internal balance that `release_escrow` credits. It is not protected money | **Open, legal.** See below |
| 8 | Ledger is single-entry, not balanced double-entry | **Open** |
| 9 | `refund_escrow` checks `is_admin()`, not `finance.refund` | **Open.** Replace the check with `has_permission('finance.refund')` |
| 10 | `open_dispute` works on any status, and holds the whole transaction including agent fee already earned | **Open** |
| 11 | Fee agreement is not yet linked into `assignments.agreed_fee` | **Open.** `create_assignment` must read it from `fee_agreements` |

## Escrow: a decision you need to make before real money
I have not checked Flutterwave's current products or your licensing, and a database ledger is not protected customer funds. Until you confirm in writing with Flutterwave (or a licensed escrow partner) that they can hold funds and release them on instruction in each target country, keep `fund_escrow` unreachable from any live payment. Payment collection into an ordinary merchant account is not escrow. Get legal advice on whether holding buyer funds needs a licence in Nigeria and in each country you serve.

## Phase 1 (this branch)
- `0002_security_foundation.sql`: countries, currencies, exchange rates; profile lockdown and signup trigger (admin cannot be self-selected); admin roles/permissions and append-only audit log; verification tables (no raw NIN/BVN, hashes plus last 4 only); verification limits and `can_transact()`; agent fee negotiation with immutable agreements.
- Verification limits seeded for NGN are **placeholders** (partial tier: 5M per transaction, 20M per 30 days). Set your real numbers.

## Next phases
2. Edge Functions: shared auth, validation and rate-limit helpers; `register-user`, `submit-verification` with a provider adapter (no provider endpoints invented; needs your chosen NIN/BVN/CAC provider); `create-transaction` calling `can_transact`.
3. Marketplace: products, units, inventory with atomic reservation, RFQs, buyer-seller negotiation and amendments.
4. Payments: `payment_intents`, webhook with signature check and dedupe, provider adapter (Flutterwave collection only until escrow is confirmed).
5. Delivery, double confirmation, disputes with partial refunds, reviews, notifications, Realtime.
6. Storage buckets and policies.
7. Replace `demo` / `fixtures` data in the frontend with real calls; point `api.ts` at the Edge Functions.
8. Tests (pgTAP for RLS and money functions, Deno tests for functions) run against a staging project.

## To apply
```
supabase link --project-ref <your-staging-ref>
supabase db push
```
Test on staging first. I could not verify that 0001 has been applied to your project, or what is currently in it.
