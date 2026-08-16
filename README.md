# Campus App — Barebones Demo

A minimal, working Next.js app with:
- Email/password login + signup (Supabase Auth)
- A landing page with two image buttons: **Marketplace** and **Laundry Booking**
- One shared profile (full name, student number, phone) used by both modules
- Placeholder pages for `/market` and `/laundry` you can flesh out later

No local setup is required to get it live — everything below can be done from a browser plus GitHub. You'll only touch VS Code to edit code afterward.

## 1. Create a free Supabase project

1. Go to https://supabase.com → New project (free tier is fine).
2. Once it's created, go to **SQL Editor** → paste the contents of `supabase/schema.sql` from this project → Run.
3. Go to **Project Settings → API**. Copy:
   - `Project URL`
   - `anon public` key

(Optional but recommended for a fast demo: **Authentication → Providers → Email** → turn OFF "Confirm email", so test accounts can log in immediately without checking an inbox. Turn it back on before real students use it.)

## 2. Push this code to GitHub

From this folder:

```bash
git init
git add .
git commit -m "Barebones campus app demo"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

(Or just create a new repo on GitHub and upload the files via the web UI — no local git needed either.)

## 3. Deploy to Vercel (free)

1. Go to https://vercel.com → New Project → Import the GitHub repo.
2. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
3. Click **Deploy**. You'll get a live `https://your-app.vercel.app` URL in about a minute.

Every push to `main` will auto-redeploy from now on.

## 4. Try it

1. Visit your live URL → you'll be redirected to `/login`.
2. Create an account (email + password).
3. You'll land on the home page with the **Marketplace** and **Laundry Booking** buttons.
4. Click **Profile** to fill in name, student number, phone — this one profile powers both modules.

## Local development (optional)

If you ever do want to run it locally in VS Code:

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase values
npm run dev
```

## Where to build next

- `app/market/page.js` — replace the placeholder with real listings/buy/sell logic
- `app/laundry/page.js` — replace the placeholder with the time-slot booking UI + double-booking prevention you've already designed
- `supabase/schema.sql` — extend with your `residence`, `booking`, and third-module tables
