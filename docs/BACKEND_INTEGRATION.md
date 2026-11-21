# Backend integration guide

The app now has the full buyer-owned agent, negotiation, escrow, inspection, delivery, dispute, review and admin screens. **No money moves from the browser.** Every action goes through `src/lib/api.ts`, which returns `BACKEND_NOT_CONNECTED` until `VITE_API_URL` is set.

## What works today (no backend)
- Buyer: My Agents (invite by phone, email or link; activate, deactivate, remove), agent profiles, private chat with image sharing, fee proposals (propose, accept, reject, counter) and the **Agreed Agent Fee** field, assignments (create, cancel, review reports, approve, reject, request another inspection, ask for clarification), transaction requests, escrow breakdown, locations, disputes, reviews, notifications.
- Agent: My Buyer, assigned tasks, accept or decline (only when a fee is agreed), start inspection, upload report (photos, videos, quality, quantity, measurements, comments, recommendation), delivery evidence, fee negotiation chat, earnings.
- Seller: incoming requests (accept, reject, negotiate), dispatch details, delivery updates, confirmation, escrow status, locations, reviews.
- Admin: overview, users, transactions, escrow, inspections, deliveries, disputes, ratings, ledger.

Non-financial records (agents, chat, assignments, notes, reviews, locations, dispute drafts) are saved **on the device only** and show a "Saved on this device" badge. Sample transactions and the ledger are read-only fixtures (`src/lib/fixtures.ts`).

## What you still have to connect
1. Run `supabase/migrations/0001_agents_escrow.sql` in a **staging** project, review it, and adapt it to your existing tables.
2. Build the API behind `VITE_API_URL` (Supabase Edge Functions or your own server) for the endpoints in `src/lib/api.ts`. Each POST receives an `Idempotency-Key` header and must return the first result on a retry.
3. Payment provider: create a verified payment, and call `fund_escrow` only from the provider's signed webhook (service role). The browser never calls it.
4. File storage for photos, videos, documents and chat images (private bucket, signed URLs, permissions that match the table policies).
5. Notifications: insert rows into `notifications` from the same server code that changes a status. Replace the local list in `src/lib/repo.ts`.
6. Replace the `useCollection` calls with queries to the real tables (the screens only read through that hook and `src/lib/fixtures.ts`).
7. Admin role: set `profiles.role = 'admin'` for admins only. The UI checks it, the database enforces it.
8. Issue all IDs on the server: transaction IDs (`TX-`), assignment IDs (`ASG-`), dispute IDs (`DSP-`) and financial references (`FIN-`). The `LOCAL` IDs you see in the app are placeholders.
9. Delivery and inspection state transitions (dispatch, in transit, arrived, approve, reject) as server functions that validate the allowed order of statuses and who may do each step.

## Money rules the server must keep
- Buyer funds: goods + delivery allocation + agreed agent fee. The platform fee is taken from the seller's proceeds (goods + delivery), not added to the buyer's bill.
- Reserve three amounts separately: goods, delivery allocation, agent fee. The agent fee must never be spendable by the seller's payout.
- Release only when: inspection approved (if required), goods arrived, buyer **and** seller confirmed, and no dispute hold. One atomic, idempotent database function.
- A dispute only puts a hold. Refunds happen only after an admin resolves it. Inspection work already completed is still paid to the agent.
- Every movement writes an append-only ledger row with a unique reference.

## Privacy rules the server must keep
- Precise locations are in `party_locations`, which has no cross-user read access. Other users call `visible_locations(tx)`, which returns the general area until the transaction has started and the caller needs the precise one.
- Buyer-agent chat and fee proposals are visible only to that buyer, that agent and admins. Sellers cannot read them.
- Agents can read only assignments (and, once accepted, the inspection location) assigned to them. Buyers can read only their own agents.
