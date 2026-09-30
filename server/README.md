# ExplAIn site server

Serves the public site and stores waitlist sign-ups. Plain Node, no dependencies.

## Run it

```
node server/server.js
```

Then open http://localhost:3000. Use `node server/server.js --port=8080` for another port.

## Sign-ups

The forms post to `/api/signup`. Every sign-up is appended to:

- `server/data/signups.json` — the full list
- `server/data/signups.csv` — the same list, ready for a mail tool

The same email twice updates the existing row instead of adding a duplicate. Bots that fill
the hidden field are silently ignored, and each IP may try at most 5 times per 10 minutes.

**Keep `server/data/` private.** It holds people's email addresses: don't commit it to a public
repository, and back it up somewhere safe.

## Downloading the list

Start the server with a token, then open the URL with that token:

```
ADMIN_TOKEN=pick-a-long-secret node server/server.js
```

http://localhost:3000/api/signups?token=pick-a-long-secret downloads the CSV. Without
`ADMIN_TOKEN` the export is turned off.

Other endpoints: `GET /api/health` reports that the server is up and how many sign-ups exist.

## What's public

The server only serves the public site: the pages, `assets/`, the articles data, the workbook,
the cheat sheets and the Module 00 worksheet. Your decks, facilitator scripts, course sources and
the certificate generator are **not** reachable, even though they live in the same folder.

## Putting it online

The site deploys to Vercel — see `DEPLOY.md` in the project root. There the
sign-ups go to a Postgres database instead of `server/data/`, because Vercel has
no writable disk. This local server is for working on the site.

## Other hosts

The server is a normal Node app: it listens on `PORT` and needs a writable `server/data` folder.
That works on any host that runs Node, for example Railway or Render. On a host with no writable
disk, switch the sign-up storage to a database or an email provider's API before going live.

If you would rather host the site as static files (Netlify, GitHub Pages, S3), use
`course/dist/ExplAIn-Website.zip` instead, and point `SIGNUP_ENDPOINT` in `assets/site.js` at a
form service, because static hosting can't run this server.
