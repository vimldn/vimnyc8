# Building Health X

NYC building reality check: violations, complaints, signals (heat/pests/noise), and resident reviews with 30/90-day and 1–3 year views.

A Next.js app that aggregates NYC Open Data into a single building intelligence view.

## Quick start

1) Install dependencies

```bash
npm install
```

2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase details.

```bash
cp .env.example .env.local
```

Recommended for API routes: use a **server-only** key.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If you use the anon key instead, make sure your Supabase Row Level Security policies allow the required operations.

3) Run locally

```bash
npm run dev
```

## Privacy note (important)

Reviews collect contact info for verification. The API routes are configured to **never return contact fields** (email/phone) back to clients.

