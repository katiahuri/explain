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

Redeploy, then `https://your-site.vercel.app/api/signups?token=YOUR_TOKEN`
downloads every sign-up as CSV. Without `ADMIN_TOKEN` the export stays off, so
nobody can pull your list.

Optionally add `IP_SALT` (any random string) to salt the hashed IPs used for
rate limiting.

## What is deployed

| Path | What it is |
| --- | --- |
| `/` `/digital-course` `/syllabus` `/articles` `/about` | The site |
| `/module-00` … `/module-08` | Module pages |
| `/article-…` | The articles |
| `/course/workbook.html` | The participant workbook |
| `/course/cheatsheets/` | Cheat sheets, web and PDF |
| `/api/signup` | Receives the form (POST) |
| `/api/signups?token=` | CSV export, token required |
| `/api/health` | Says whether the database is reachable |

## Working locally

`node server/server.js` still runs the whole site on your machine and stores
sign-ups in `server/data/`. It does not need the database. Use it for editing;
use Vercel for the live site.

## A custom domain

Project → **Settings** → **Domains** → add your domain and follow the DNS
instructions. Vercel issues the certificate.
