# Knowing how the site is doing

The site counts its own visitors. No Google Analytics, no tag manager, no
third-party script: a 3 KB beacon posts to `/api/track`, and the rows land in
the same Neon Postgres that holds the waitlist.

The point of collecting it is to have something to act on, so there is an agent
that reads it: **site-analyst**.

## Turn it on

Two environment variables in the Vercel project (Settings → Environment
Variables), then redeploy:

| Name | Why |
| --- | --- |
| `ADMIN_TOKEN` | Guards `/api/stats` and the CSV export. A long random string. |
| `IP_SALT` | Salts the hashes. Any random string. |

`DATABASE_URL` is already there from the Neon integration. The two new tables
are created on the first pageview, so there is nothing to run by hand.

To read the numbers from your own machine, add the same values to `.env.local`:

```
SITE_ORIGIN=https://explaincourse.com
ADMIN_TOKEN=the-same-string
```

`SITE_ORIGIN` is read from `.env.local` by both the report and the build, so a
local build carries the same canonical URLs, sitemap and feed as production. On
Vercel the same variable is set in the project's production environment.

## Reading it

```bash
npm run report                      # last 30 days: traffic + SEO audit + findings
node scripts/site-report.js --days=7
node scripts/site-report.js --json  # the same thing for a script to chew on
npm run audit                       # SEO only, no traffic needed
npm run dashboard                   # the same numbers as one page: dashboard.html
node scripts/build-dashboard.js --no-list   # ...without the sign-up list
node scripts/build-dashboard.js --demo   # the layout, on sample data
```

`dashboard.html` is for looking at: headline numbers, landings per day, where
people land, which channels convert, and the same ranked findings the written
report ends with, and **the list**: everyone who has given you an email
address, with the form they came from. That last section is the only one that
names anybody — `--no-list` leaves it out when you are sharing a screen.
It is gitignored and never deployed — it is your copy of
numbers that are nobody else's business. The charts are plain SVG in one file,
so it opens from disk with nothing to fetch.

Or hand the whole job to the agent, which reads the report, applies the fixes
and can write the next newsletter issue:

```
/site-report
/site-report 7 fix
/site-report newsletter
```

## What is collected

One row per pageview:

| Field | Example | Note |
| --- | --- | --- |
| `path` | `/article-confident-and-wrong` | `.html` and `index` stripped |
| `is_landing` | `true` | the first page of a visit |
| `referrer_host` | `linkedin.com` | host only, never the full URL |
| `source` / `medium` | `chatgpt` / `ai` | from UTM tags, or derived from the referrer |
| `device` | `phone` | from the window width |
| `country` | `IL` | from Vercel's edge header |
| `visitor_hash` | `3f9c…` | salted hash of IP + user agent **+ the date** |

And one row per action: `signup`, `cta`, `outbound`, `scroll75`, `pdf`.

What is not collected: no cookies, no IP addresses, no full URLs from other
sites, no cross-site anything, nothing that survives in the browser except one
random id that dies with the tab. The visitor hash includes the date, so it
cannot follow anyone from one day to the next — which also means "visitors" is
a daily count, and a person who comes back tomorrow counts twice.

The beacon stays silent for anyone sending Do Not Track or Global Privacy
Control, and on localhost, so your own editing never shows up in the numbers.

## What search engines get

`npm run build` writes, alongside the pages:

- `robots.txt` — everything allowed except `/api/`, pointing at the sitemap
- `sitemap.xml` — every public page, with its last-modified date
- `feed.xml` — articles and newsletter issues in one RSS feed
- a canonical URL, Open Graph and Twitter tags, and the `assets/og-card.png`
  social image on every page
- structured data: `Organization` and `Course` on the home page, `Article` on
  each article and issue, `LearningResource` on each module

Regenerate the social card after a brand change with `python scripts/og-card.py`.

## The newsletter

The Dispatch and the articles are one stream. An issue is an object in
`content/articles.json` and publishes as `/article-<slug>`, so every issue is an
indexable page rather than a mail that disappears. `npm run articles` writes:

- `articles.html` — the index, linked from the nav and the footer
- `article-<slug>.html` — one page per article or issue
- `email-drafts/<slug>.html` — the same issue as a single-column email, with
  `{{site}}` and `{{unsubscribe}}` left for whatever sends it

Nothing in this repository sends email. The draft is handed over, and sending it
stays a deliberate act.
