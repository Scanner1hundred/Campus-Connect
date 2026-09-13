# Campus Connect — Repo Breakdown

Group: 404: Team Name Not Found
Repo: github.com/Scanner1hundred/Campus-Connect (branch: main)
Stack: Next.js (App Router, JavaScript) + Supabase (auth + Postgres) + Netlify (hosting)

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
│   │   └── page.js             # ✅ MARKETPLACE — renders the <Marketplace /> component (see components/)
│   │
│   └── laundry/
│       └── page.js             # 🔨 Laundry placeholder — exists but not linked from landing page yet
│
├── components/
│   ├── icons.js                 # MarketIcon, LaundryIcon (inline SVGs used as button graphics)
│   └── Marketplace.js            # ✅ Full Marketplace UI — browsing, search, category filters,
│                                  #    favoriting, listing grid. Client component, talks to Supabase directly.
│
├── lib/supabase/
│   ├── client.js                # Supabase client for use in the BROWSER (client components)
│   └── server.js                 # Supabase client for use on the SERVER (server components/actions)
│
├── supabase/
│   └── schema.sql                # Run this in Supabase SQL Editor — full schema (see below)
│
├── middleware.js                 # Protects routes — redirects to /login if not signed in
├── jsconfig.json                 # Enables the "@/" shortcut in imports (e.g. @/lib/supabase/server)
├── next.config.js                # Next.js config (currently empty/default)
├── package.json                  # Dependencies: next, react, @supabase/supabase-js, @supabase/ssr
├── .env.local.example            # Template for local Supabase keys (never commit real .env.local)
└── README.md                     # Setup + deploy instructions
```

## Planned modules

- **Marketplace** — student-to-student buying and selling of used goods. Active focus, built out.
- **Laundry Booking** — deferred. Placeholder exists in code but hidden from the landing page.
  Scope has shifted from per-residence to a single campus-wide laundry room open to all
  students, with a separate section for staff.
- **Student Center** — an on-campus convenience store / mini market. Not yet started. Planned
  to share the same database as the other two modules — having one trusted on-campus option
  for food and everyday items is meant to reduce people using the Marketplace to sell food.

## Database schema (supabase/schema.sql)

The schema now covers the full Marketplace, not just auth:

- `profiles` — linked to Supabase Auth (`auth.users`), RLS-protected, one row per user
- `categories` / `subcategories` — listing taxonomy
- `listings` / `listing_images` — the core Marketplace items and their photos
- `favorites` — saved listings per user
- `orders` / `order_items` / `payments` — purchase flow tables (not yet wired into the frontend)
- `messages` — buyer/seller messaging (not yet wired into the frontend)
- `reviews` — per-listing ratings (not yet wired into the frontend)
- `notifications` / `audit_logs` — system-level tables (not yet wired into the frontend)

**Only `profiles`, `categories`, `listings`, `listing_images`, and `favorites` are currently
read/written by live app code** (via `components/Marketplace.js`). The rest exist in the
database but have no frontend yet — treat them as "ready for the next feature," not "done."
No tables exist yet for the Student Center module — it will need its own schema work when
that module starts.

## Where YOU probably need to work

- **Extending the Marketplace (create-listing form, listing detail page, checkout):**
  Work in `components/Marketplace.js` and add new routes under `app/market/` (e.g.
  `app/market/create/page.js`, `app/market/[id]/page.js`). The `orders`, `order_items`,
  `payments`, `messages`, and `reviews` tables already exist in `schema.sql` — waiting on
  frontend work to use them.

- **Changing what the profile form collects:**
  `app/profile/page.js` (the form) + `app/profile/actions.js` (saving it) +
  `supabase/schema.sql` (the `profiles` table — you'd add a column there too).

- **Changing login/signup behavior:**
  `app/login/page.js` and `app/login/actions.js`.

- **Changing the landing page (e.g. re-adding the Laundry button later):**
  `app/page.js` — the Laundry card is commented out there, ready to uncomment.

- **Styling / colors / layout:**
  Everything is in `app/globals.css` — plain CSS classes, no framework. Class names are
  descriptive (`.module-card`, `.auth-form`, `.listing-card`, `.btn-primary`, etc.).

- **Database access pattern:**
  Any page/component that reads or writes Supabase data needs to import the right client:
  - Server Components / Server Actions → `import { createClient } from '@/lib/supabase/server'`
  - Client Components (anything with `'use client'` at the top) → `import { createClient } from '@/lib/supabase/client'`

## Hosting & deployment

- **Hosting is Netlify** (Pro plan, flat $20/month for the whole team — not Vercel).
  Connected directly to this GitHub repo; every push to `main` auto-deploys.
- Build command `npm run build`, publish directory `.next` — Netlify auto-attaches its
  Next.js runtime plugin, no `netlify.toml` needed.
- Custom domain: `ufhcampusconnect.app`, SSL auto-issued by Netlify.
- **Why the move from Vercel:** Vercel's Pro plan charges per seat (~$280/month for 14
  people), which didn't fit a free-tier school project. On top of that, Vercel's deployment
  pipeline kept breaking whenever someone other than the project lead pushed code — meaning
  all edits had to funnel through one person and nobody else could build or test
  independently. Netlify's flat $20/month plan solved the cost problem, and moving to it also
  resolved the deployment bottleneck.

## Team access

All 14 members have access to GitHub, Supabase, and Netlify — the group's intentional choice
so everyone can see what's happening on the project at any time, rather than splitting access
by role.

## Schema-change workflow (important — read before touching the database)

**Never run SQL directly against the live Supabase database.** The correct flow is:

1. Edit `supabase/schema.sql` and open a PR to GitHub.
2. Once merged, manually run the changed SQL in the Supabase SQL Editor yourself.

There is no automated migration pipeline — pushing `.sql` files to GitHub does **not**
apply them to the live database. This workflow exists because of a past incident: unclear
communication about how the database should be edited led to a teammate running a
conflicting schema directly in the SQL Editor, which broke the live `profiles` table and the
entire auth flow. Recovery required dropping and rebuilding the schema from scratch — don't
repeat that.

## Ground rules

- Don't commit `.env.local` — real Supabase keys stay out of GitHub. Use `.env.local.example`
  as the template.
- Every push to `main` auto-deploys to Netlify — test locally or in a branch for bigger changes if you can.
- New database tables need Row Level Security policies (copy the pattern in `supabase/schema.sql`)
  or Supabase will block all access to them by default.
- All 14 members have full Supabase Developer access (full SQL Editor access) — this is the
  main reason the PR-first schema workflow above is non-negotiable for now.
