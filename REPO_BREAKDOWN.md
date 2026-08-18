# Campus Connect — Repo Breakdown

Repo: github.com/Scanner1hundred/Campus-app (branch: main)
Stack: Next.js (App Router, JavaScript) + Supabase (auth + Postgres) + Vercel (hosting)

Copy this whole file into your AI coding tool (ChatGPT, Claude, Copilot, etc.) along with
a description of what you're trying to build — it'll know exactly where things live.

## Folder structure

```
campus-connect/
├── app/
│   ├── layout.js              # Root layout, wraps every page, site title/metadata
│   ├── page.js                 # Landing page (after login) — shows the Marketplace button
│   ├── globals.css             # All app-wide CSS (no CSS framework, plain classes)
│   ├── actions.js              # Shared server action: signOut()
│   │
│   ├── login/
│   │   ├── page.js             # Login + signup forms (combined on one page)
│   │   └── actions.js          # Server actions: login(), signup()
│   │
│   ├── profile/
│   │   ├── page.js             # Shared profile form (full name, student number, phone)
│   │   └── actions.js          # Server action: updateProfile()
│   │
│   ├── market/
│   │   └── page.js             # 🔨 MARKETPLACE — placeholder, build real features here
│   │
│   └── laundry/
│       └── page.js             # Laundry placeholder — exists but not linked from landing page yet
│
├── components/
│   └── icons.js                 # MarketIcon, LaundryIcon (inline SVGs used as button graphics)
│
├── lib/supabase/
│   ├── client.js                # Supabase client for use in the BROWSER (client components)
│   └── server.js                 # Supabase client for use on the SERVER (server components/actions)
│
├── supabase/
│   └── schema.sql                # Run this in Supabase SQL Editor — creates the `profiles` table + security rules
│
├── middleware.js                 # Protects routes — redirects to /login if not signed in
├── jsconfig.json                 # Enables the "@/" shortcut in imports (e.g. @/lib/supabase/server)
├── next.config.js                # Next.js config (currently empty/default)
├── package.json                  # Dependencies: next, react, @supabase/supabase-js, @supabase/ssr
├── .env.local.example            # Template for local Supabase keys (never commit real .env.local)
└── README.md                     # Setup + deploy instructions
```

## Where YOU probably need to work

- **Building out the Marketplace (listings, buy/sell, browsing):**
  Work in `app/market/page.js`. Add new files under `app/market/` for sub-pages
  (e.g. `app/market/new/page.js` for "create a listing"). You'll likely add a new table
  in `supabase/schema.sql` (e.g. `listings`) with its own Row Level Security policies,
  following the same pattern as the `profiles` table.

- **Changing what the profile form collects:**
  `app/profile/page.js` (the form) + `app/profile/actions.js` (saving it) +
  `supabase/schema.sql` (the `profiles` table — you'd add a column there too).

- **Changing login/signup behavior:**
  `app/login/page.js` and `app/login/actions.js`.

- **Changing the landing page (e.g. re-adding the Laundry button later):**
  `app/page.js` — the Laundry card is commented out there, ready to uncomment.

- **Styling / colors / layout:**
  Everything is in `app/globals.css` — plain CSS classes, no framework. Class names are
  descriptive (`.module-card`, `.auth-form`, `.btn-primary`, etc.).

- **Database access pattern:**
  Any page/component that reads or writes Supabase data needs to import the right client:
  - Server Components / Server Actions → `import { createClient } from '@/lib/supabase/server'`
  - Client Components (anything with `'use client'` at the top) → `import { createClient } from '@/lib/supabase/client'`

## Ground rules
- Don't commit `.env.local` — real Supabase keys stay out of GitHub. Use `.env.local.example` as the template.
- Every push to `main` auto-deploys to Vercel — test locally or in a branch for bigger changes if you can.
- New database tables need Row Level Security policies (copy the pattern in `supabase/schema.sql`) or Supabase will block all access to them by default.
