# ExplAIn

Website for ExplAIn, a practical AI course for technical people.
**Don't just use AI. Own it.**

## Running it locally

```
node server/server.js
```

Serves the site at http://localhost:3000 and stores waitlist sign-ups in
`server/data/`. Plain Node, no dependencies needed to run it.

## Deploying

The site runs on Vercel. See [DEPLOY.md](DEPLOY.md) for the full procedure —
deploy, connect a Postgres store for the waitlist, then set `ADMIN_TOKEN` to
enable the CSV export.

`npm run build` copies only the public site into `public/`, which is what gets
deployed.

## Layout

```
index.html, digital-course.html, syllabus.html, articles.html, about.html
module-00.html … module-08.html      Module pages
article-*.html                       Articles
assets/                              Shared CSS, JS and logo
content/articles.json                Article sources
course/workbook.html                 Participant workbook
course/cheatsheets/                  One-page cheat sheet per module
api/                                 Waitlist endpoints (Vercel)
server/                              Local development server
scripts/build-public.js              Builds the deployable site
```

The course materials themselves — slide decks, facilitator scripts, module
sources and the certificate template — are deliberately **not** in this
repository. See `.gitignore`.
