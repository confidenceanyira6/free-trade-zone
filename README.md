# Saage Free Trade Zone

B2B international trade marketplace: React + TypeScript + Vite + Tailwind on Supabase.

## Setup
1. `cp .env.example .env.local` and add the project's publishable key (Supabase dashboard, Project Settings, API).
2. `npm install && npm run dev`

## Backend (Supabase project `pzwuarejywtnkyereufc`)
Schema, RLS, RPCs, storage buckets and realtime are applied as migrations. Business logic runs in database functions (orders, RFQs, quotations, refunds, disputes, admin review). The frontend never decides payment success.

## Built
Auth, business profiles and verification submission, marketplace search and filters, product detail (quote, order, message, save), RFQs with quotations, orders, realtime messaging with reporting, dashboard, admin verification.

## Still to build
Flutterwave edge functions and webhook, product creation UI, document upload UI, shipment tracking UI, reviews, disputes UI, notifications UI, currency conversion function, remaining admin screens.
