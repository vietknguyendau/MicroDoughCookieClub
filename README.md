# 🍪 Microdough Cookie Club

**Small Batch. Big Flavor. · Rate. Vote. Win.**

A mobile-first feedback and giveaway app for Microdough pop-ups. Customers scan a QR code, rate the cookies they tried, vote for a favorite, and can enter a free 6-pack giveaway, with or without doing the survey. The owner runs everything from her phone: pop-ups, flavors, the Doughboard leaderboard, feedback, printable QR signs, and a fair, audited winner drawing.

Stack: Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Neon Postgres · Drizzle ORM · Vercel · GitHub. Everything runs on free tiers. There are no paid APIs and no third-party auth or email services.

---

## Contents
1. [How it works](#how-it-works)
2. [Key decisions](#key-decisions)
3. [Run it locally](#run-it-locally)
4. [Deploy (Neon → GitHub → Vercel)](#deploy)
5. [Owner quick-start](#owner-quick-start)
6. [Deployment checklist](#deployment-checklist)
7. [Security checklist](#security-checklist)
8. [Manual acceptance checklist](#manual-acceptance-checklist)
9. [Tests](#tests)
10. [Data model](#data-model)
11. [Placeholders to replace](#placeholders-to-replace)
12. [Later (not built on purpose)](#later)

---

## How it works

**Customer (phone, no account):**
`/` → redirects to the live pop-up → `/event/[slug]` welcome → `/feedback` tasting card (tap cookies, rate 1–5★, "buy again?") → favorite + "bake next?" + comments → `/enter` giveaway (optional) → `/success`.
Direct entry, no survey: **Enter Giveaway Without Survey** on the welcome page, or `/event/[slug]/enter` from anywhere during the entry period.

**Owner (`/admin`):**
| Page | What it does |
|---|---|
| Home | Live pop-up, entries, surveys, average rating, most-loved cookie, upcoming drawing, recent comments |
| Pop-ups | Create and edit events, pick flavors, approve official rules, go live or end, print QR signs |
| Giveaways | Eligible count, close entries, draw a winner, mark contacted or claimed, redraw for a stated reason, permanent audit trail |
| Menu planner | Sorts every cookie into **Bring every time / Keep in rotation / Save for later / Rethink / Needs more tastings**, with the reasons, a trend line across pop-ups, a "divisive" flag, and a ranked, grouped list of "bake next" suggestions. The rules are in `src/lib/services/insights.ts` |
| Doughboard | Flavor leaderboard (fair score, average, favorites, % buy again, sample size), filtered by current pop-up, a past pop-up, or all-time |
| Feedback | Every response, search, filter by event, CSV export |
| Flavors | Add, edit, reorder, set active or inactive, upload photos (resized on the phone first) |
| Settings | Sponsor info, "next pop-up" note, retention period, data cleanup, delete a person's data, export marketing opt-ins, change password |

## Key decisions

- **Auth: a small custom owner login, not Auth.js.** Auth.js's password provider is deliberately bare-bones and doesn't handle sessions or rate limiting. Its email-link login needs an email service. Here, passwords are hashed with bcrypt (cost 12). Sessions are 256-bit random tokens stored *hashed* in Postgres, in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie that lasts 14 days. Logins are rate-limited per IP and per email, and take the same time whether or not the email exists. "Log out on all devices" works, and changing the password signs out everywhere. `requireAdmin()` runs in every admin page, action and route. The middleware is only a fast first gate.
- **DB driver: `pg` + `@vercel/functions` `attachDatabasePool`** pointed at Neon's **pooled** URL. This is the Neon and Vercel pattern for Fluid compute. It supports real transactions, which the winner drawing needs.
- **Anonymous feedback.** Survey tables hold no name, email, phone or IP, and there is **no link** between a survey and a giveaway entry. Feedback can't affect anyone's odds, and the owner can't see who said what.
- **Fair drawing.** `crypto.randomInt` picks one entry, inside a transaction with a `SELECT … FOR UPDATE` lock on the event, so simultaneous taps queue instead of racing. A partial unique index means **the database itself refuses a second live winner**. Every action goes into `giveaway_audit_log`, which a trigger makes **append-only** (no UPDATE, DELETE or TRUNCATE). Redraws require a reason from the published rules. A "no response" redraw only works once the claim window has actually passed.
- **Duplicates.** One entry per normalized email per event. Lowercase, `+tags` stripped, and Gmail dots ignored. A duplicate gets the *same* "You're in!" screen, so nobody can tell whether an email has already entered.
- **Bot protection (free).** A hidden honeypot field, an HMAC-signed form timing token, and per-IP rate limits stored in Postgres. IPs are only ever stored as a salted hash. Honeypot hits and forged tokens get a fake success. A real person who's just *fast* is asked to tap again and is never silently dropped. Limits are generous because many phones at a pop-up share one carrier IP.
- **Fair Doughboard ranking.** Every flavor starts with 5 imaginary 3.5★ ratings, so one excited 5★ can't beat a cookie twenty people loved. Each score shows its sample size (n) and a label: *too early*, *early signal*, or *solid*.
- **Photos live in Postgres** as compressed WebP (about 100 KB each, resized in the browser). That means one fewer account to manage. They're served with immutable caching and versioned URLs.
- **Admin forms navigate with a full page load after each action.** Next's client-side redirect after a server action sometimes dropped the second of two back-to-back actions in testing. The data was saved, but the screen didn't update. Plain navigation is boring and always shows fresh data.
- **Times** are stored in UTC and entered and shown in **America/Chicago**, DST-safe.

## Run it locally

Requires Node 20+ and a Postgres you can throw away (Docker is easiest).

```bash
docker run -d --name md-pg -p 5433:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16
psql -h localhost -p 5433 -U postgres -c "create database microdough" -c "create database microdough_test"

cp .env.example .env
# set DATABASE_URL=postgres://postgres@localhost:5433/microdough  (and delete the _UNPOOLED line)
# set AUTH_SECRET=$(openssl rand -base64 48)
# set NEXT_PUBLIC_SITE_URL=http://localhost:3000

npm install
npm run db:migrate
npm run db:seed                                   # the six signature flavors + temporary photos
npm run admin:create -- you@example.com "Your Name" # prompts for a 12+ char password
npm run dev                                       # http://localhost:3000/admin
```

## Deploy

> Every step uses a free plan. Total time is about 30 minutes.

**Easiest path (no terminal): Vercel's Neon integration + the one-time setup page.**

1. **Create the Neon database.** In your Vercel project, go to **Storage → Create → Neon**. It adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.
2. **Push the code to GitHub** (a private repo) and import it in Vercel. The framework must be **Next.js**, and the Root Directory must be the folder that contains `package.json`.
3. **Add three environment variables** in Vercel → Settings → Environment Variables (Production + Preview):
   - `AUTH_SECRET`: 32+ random characters, from `openssl rand -base64 48` or a password manager
   - `NEXT_PUBLIC_SITE_URL`: the live address, for example `https://microdoughcookieclub.vercel.app` (QR codes print this)
   - `ADMIN_SETUP_CODE`: any secret phrase of 12+ characters, used once
4. **Deploy (or redeploy).** Every build automatically **applies database migrations** and, on a brand-new database only, **seeds the six flavors**. Look for `✓ Database migrations applied` in the build log.
5. **Create Emmy's account.** Open `https://YOUR-SITE/admin/setup`, enter the setup code, her name, email and password. The page disappears once the account exists. You can then delete `ADMIN_SETUP_CODE`.
6. **Test the live site** with the [manual acceptance checklist](#manual-acceptance-checklist) on a real phone, including scanning a printed QR.

**Terminal path (alternative):** put the Neon URLs in a local `.env`, then run `npm run db:migrate && npm run db:seed && npm run admin:create -- emmy@example.com "Emmy"`.

> Builds migrate the database that `DATABASE_URL_UNPOOLED` (or `DATABASE_URL`) points to. Migrations only ever add things. If preview deploys share the production database, that's fine. If they use Neon preview branches, each branch gets migrated too.

*Optional:* to add a custom domain, go to Vercel → Settings → Domains, then update `NEXT_PUBLIC_SITE_URL` and redeploy **before** printing signs.

## Owner quick-start

1. **Settings:** enter your sponsor name and contact. These appear in the official rules.
2. **Flavors:** replace the temporary photos (tap *Replace photo* and pick from the camera roll).
3. **Pop-ups → + New pop-up:** set the name, place and times, then tick the cookies you're bringing. The giveaway defaults are prefilled.
4. Read the **official rules preview**, tick the box, then tap **Approve & publish**. *(Have someone with legal know-how review the template once.)*
5. Tap **Go live**, then **Print sign** (permanent QR) and test-scan it.
6. After the entry deadline, go to **Giveaways** → **Draw winner**. Email the winner, then tap **Mark contacted**, and later **Mark prize claimed**.
7. Check the **Doughboard** to see which flavors people loved.
8. About once a month: **Settings → Run data cleanup**.

The **permanent QR** always opens whichever pop-up is live. Print it once and reuse it forever. The **event QR** opens one specific pop-up, and its link never changes.

## Deployment checklist

- [ ] Neon project created and both connection strings saved in a password manager
- [ ] Build log shows `✓ Database migrations applied`
- [ ] Owner account created at `/admin/setup` with a strong unique password (then `ADMIN_SETUP_CODE` removed)
- [ ] GitHub repo is **private** and `.env` is not committed
- [ ] Vercel env vars set: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_SETUP_CODE` (temporary)
- [ ] Framework preset is Next.js and Root Directory is correct
- [ ] Deployed and `/` loads; `/admin` redirects to login
- [ ] Settings: sponsor shows Emmy Le d/b/a Microdough (edit the contact if she wants an email listed)
- [ ] Real logo, bunny and cookie photos uploaded (see placeholders)
- [ ] Official rules reviewed (ideally by someone with legal knowledge) and approved
- [ ] QR sign printed **after** the final domain was set, and test-scanned on iPhone and Android

## Security checklist

- [x] Server-side DB access only; no DB credentials in client bundles (`server-only` guards `src/db`)
- [x] Secrets only in env vars; `.env.example` contains no real values
- [x] Every query goes through Drizzle (parameterized); search escapes `%` and `_`
- [x] XSS: React escapes all output; the only raw HTML is the QR SVG this app generates itself
- [x] CSRF: Next.js server actions check `Origin` against `Host`; the session cookie is `SameSite=Lax`
- [x] `requireAdmin()` on every admin page, action and route; middleware is just a first gate
- [x] Session tokens stored hashed; HttpOnly + Secure cookie; logout on all devices
- [x] Login rate limiting, same timing for unknown emails, bcrypt cost 12
- [x] Rate limits, honeypot and signed timing tokens on public forms
- [x] Upload checks: type, size (1.5 MB) and file signature (magic bytes)
- [x] CSV exports protected against spreadsheet formula injection
- [x] Security headers: HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy; admin pages `noindex` + `no-store`
- [x] Winner drawing: authenticated-only, CSPRNG, row lock + unique index, append-only audit log
- [x] Duplicate entries don't reveal whether an email already entered
- [x] PII kept separate from feedback; configurable retention; per-person deletion
- [ ] **Your part:** keep `AUTH_SECRET` private, use a strong owner password, and enable 2FA on GitHub, Vercel and Neon

## Manual acceptance checklist

Do this on a real phone, on the live site.

- [ ] Scan the permanent QR → lands on the live pop-up's welcome page
- [ ] Welcome shows the logo, pop-up name, date, cookie photos, RATE. VOTE. WIN., two buttons, and the no-purchase note
- [ ] Rate 2 cookies, pick a favorite, add a suggestion → reaches the giveaway screen in **under 60 seconds**
- [ ] Tap "No thanks" → thank-you screen without entering
- [ ] From the welcome page, "Enter Giveaway Without Survey" → entered in **under 30 seconds**
- [ ] Entering again with the same email → same success screen; admin shows only one entry
- [ ] Unticked rules box → friendly error; typed name and email are kept
- [ ] Marketing box starts unticked and is optional
- [ ] Event-specific QR opens that exact pop-up even after a newer pop-up goes live
- [ ] `/admin` in a private window → login page; wrong password → error; 6 bad tries → lockout message
- [ ] Doughboard shows n for each flavor and the "too early to tell" label for small samples
- [ ] Feedback search finds a comment; CSV export opens in Excel or Google Sheets
- [ ] After the deadline: Draw winner → one winner; tapping twice fast doesn't create two
- [ ] Mark contacted → Mark claimed; audit trail lists every step
- [ ] Settings → delete a test email → its entries are gone
- [ ] VoiceOver or TalkBack can operate the star ratings and checkboxes

## Tests

```bash
npm test          # 36 integration tests against a real local Postgres (TEST_DATABASE_URL)
npm run typecheck
npm run lint
```
These cover survey saves, multiple ratings per survey, anonymity, menu validation, direct entry without a survey or purchase, optional marketing consent, rules acceptance, duplicate and concurrent duplicate entries, server-side deadlines (including manual close), unapproved and draft giveaways, drawing only from eligible entries of that event, uniform randomness, **concurrent draw requests creating exactly one winner**, a DB-level backstop against two winners, audited redraws that never re-pick a forfeited winner, claim-window enforcement, no redraw after claim, audit log immutability, audit history surviving data deletion, one active event, Doughboard small-sample handling, search wildcard safety, rate limiting, and bot tokens.

The test setup **refuses to wipe a Neon database** unless you explicitly set `ALLOW_NEON_TESTS=1`. Use a local DB or a throwaway Neon branch.

`tests/e2e/smoke.py` is an optional Playwright run at phone size (390×844). It covers owner login, settings, creating an event, approving rules, going live, a customer survey plus entry, a direct entry, a duplicate entry, a forged admin cookie, the export auth check, a bot submission, the dashboard, the Doughboard, feedback and CSV, closing entries, drawing, marking contacted, and the sign. It also confirms no winner data shows up on public pages.

## Data model

```
admin_users ─< admin_sessions
settings (single row)
flavors ─ flavor_images (1:1, blob kept separate)
events ─< event_flavors >─ flavors
events ─< survey_responses ─< flavor_ratings >─ flavors        ← anonymous
                         └── flavor_votes (favorite, suggestion)
events ─< giveaway_entries                                      ← only place PII lives
events ─< giveaway_draws >─ giveaway_entries (ON DELETE SET NULL)
events ─< giveaway_audit_log (append-only trigger)
rate_limits (hashed IP buckets)
```
Notable constraints: `events_one_active` (only one live pop-up), `entries_one_per_email_per_event`, `draws_one_live_winner`, `ratings_stars_range` (1–5), `ratings_one_per_flavor`, and time-order checks on every event.

## Placeholders to replace

| Item | Where | Notes |
|---|---|---|
| Logo, wordmark, bunny | `public/brand/*-placeholder.png` | Cropped from Instagram screenshots. Drop in originals with the same filenames, or edit `src/components/brand.tsx` |
| Cookie photos | Admin → Flavors | The seed uses crops from the menu post (`seed-assets/`) |
| Sponsor name and contact | Admin → Settings | Defaults to Emmy Le d/b/a Microdough, Instagram @micro.dough |
| Prize value | Each pop-up's giveaway section | Defaults to $24.00 |
| Official rules wording | `src/components/official-rules.tsx` | A sensible template, **not legal advice**. Have it reviewed once |

## Later

Deliberately not built in v1: public leaderboard, pop-up calendar, preorders, loyalty rewards, email announcements, flavor competitions, Instagram sharing, sales tracking. The schema leaves room for all of them.
