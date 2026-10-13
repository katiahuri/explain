# Putting the site on Vercel

The site is ready to deploy. Three steps: deploy it, connect a database so the
waitlist form can store sign-ups, then set a token so you can download the list.

## 1. Deploy

From this folder:

```
vercel
```

The first run asks a few questions (scope, project name) and then gives you a
preview URL. When you are happy with it:

```
vercel --prod
```

Vercel runs `node scripts/build-public.js`, which copies **only** the public site
into `public/` and deploys that. Your decks, facilitator scripts, course sources
and the certificate template are never uploaded — `.vercelignore` keeps them off
Vercel entirely.

## 2. Connect the database

The sign-up form needs somewhere to put people. On Vercel:

1. Open the project → **Storage** → **Create Database** → **Neon (Postgres)**.
2. Accept the free plan and connect it to this project.

That adds a `DATABASE_URL` environment variable automatically. Redeploy
(`vercel --prod`) and the form starts working. The tables are created on the
first sign-up, so there is nothing to run by hand.

Until a database is connected the form shows "Something went wrong" rather than
silently losing anyone.

## 3. Turn on the CSV export

Add an environment variable in the project settings:

- **Name:** `ADMIN_TOKEN`
- **Value:** a long random string you keep private

Redeploy, then `https://explaincourse.com/api/signups?token=YOUR_TOKEN`
downloads every sign-up as CSV. Without `ADMIN_TOKEN` the export stays off, so
nobody can pull your list.

Add `IP_SALT` (any random string) too: it salts the hashed IPs used for rate
limiting and for counting visitors. The same `ADMIN_TOKEN` opens
`/api/stats?token=…`, which is where the site's traffic numbers come from — see
[ANALYTICS.md](ANALYTICS.md).

## What is deployed

| Path | What it is |
| --- | --- |
| `/` `/digital-course` `/syllabus` `/articles` `/about` | The site |
| `/module-00` … `/module-08` | Module pages |
| `/article-…` | The articles |
| `/course/workbook.html` | The participant workbook |
| `/course/cheatsheets/` | Cheat sheets, web and PDF |
| `/newsletter` `/newsletter-…` | The Dispatch and its issues |
| `/robots.txt` `/sitemap.xml` `/feed.xml` | Generated at build time |
| `/api/signup` | Receives the form (POST) |
| `/api/signups?token=` | CSV export, token required |
| `/api/track` | Receives pageviews from the beacon (POST) |
| `/api/stats?token=` | The numbers, as JSON, token required |
| `/api/health` | Says whether the database is reachable |

## Working locally

`node server/server.js` still runs the whole site on your machine and stores
sign-ups in `server/data/`. It does not need the database. Use it for editing;
use Vercel for the live site.

## The domain

The site lives at **https://explaincourse.com**. Both `explaincourse.com` and
`www.explaincourse.com` are attached to the Vercel project; `vercel.json`
redirects www to the bare domain so there is only ever one address in search
results. Vercel issues and renews the certificate.

The domain is registered at Namecheap, which still answers DNS for it. The
records it needs:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `216.150.1.1` |
| A | `@` | `216.150.16.1` |
| CNAME | `www` | `c62e4e660c4e5940.vercel-dns-016.com.` |

`vercel domains verify explaincourse.com` says whether Vercel can see them yet.

`SITE_ORIGIN` is set to `https://explaincourse.com` in the project's production
environment, and the build puts it in every canonical URL, the sitemap, the feed
and the social cards. If the domain ever changes, change that one variable and
redeploy.
