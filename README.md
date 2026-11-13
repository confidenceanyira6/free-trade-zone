# Saage Free Trade Zone

B2B international trade marketplace.

## Test build (no backend)
`public/index.html` is a self-contained test build with sample data. It needs no install, no build and no environment variables. Vercel serves it as-is (see `vercel.json`). Any email and password works on the login page; pick a role in the "Test as" dropdown.

## Backend-connected app (not deployed yet)
The React + TypeScript + Supabase app in `src/` is connected to the Supabase project and needs `VITE_SUPABASE_PUBLISHABLE_KEY`. It will replace the test build once testing is done.
