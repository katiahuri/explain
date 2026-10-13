# ExplAIn

Website for ExplAIn, a practical AI course for technical people.
**Don't just use AI. Own it.**

## Running it locally

```
node server/server.js
```

Serves the site at http://localhost:3000 and stores waitlist sign-ups in
`server/data/`. Plain Node, no dependencies needed to run it.

## Knowing how it is doing

The site counts its own visitors (no third-party analytics) and there is an
agent that reads the numbers, fixes what they point at, and writes the
newsletter. See [ANALYTICS.md](ANALYTICS.md).

```
npm run report        where people land, where they come from, what to fix
npm run audit         the SEO audit on its own
npm run newsletter    rebuild the newsletter from content/newsletter.json
```

## Deploying

The site runs on Vercel. See [DEPLOY.md](DEPLOY.md) for the full procedure —
deploy, connect a Postgres store for the waitlist, then set `ADMIN_TOKEN` to
enable the CSV export.

`npm run build` copies only the public site into `public/`, which is what gets
deployed.

## Layout

```
index.html, digital-course.html, syllabus.html, articles.html, about.html
newsletter.html                      The Dispatch archive
module-00.html … module-08.html      Module pages
article-*.html                       Articles
newsletter-*.html                    Newsletter issues
assets/                              Shared CSS, JS, logo and the beacon
content/articles.json                Article sources
content/newsletter.json              Newsletter sources
course/workbook.html                 Participant workbook
course/cheatsheets/                  One-page cheat sheet per module
api/                                 Waitlist, tracking and stats endpoints
server/                              Local development server
scripts/build-public.js              Builds the deployable site
scripts/site-report.js               Traffic + SEO report
.claude/agents/site-analyst.md       The agent that reads it and acts
```

The course materials themselves — slide decks, facilitator scripts, module
sources and the certificate template — are deliberately **not** in this
repository. See `.gitignore`.
