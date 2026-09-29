# Go Wild Tracker

Color-void tracker + classic session bankroll for Go Wild.

## Local

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set your Supabase URL + anon key.

## Deploy

Push to GitHub, then import the repo in Vercel. Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SYNC_ID=main` (optional; default is already one shared save)
