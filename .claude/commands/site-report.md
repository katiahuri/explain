---
description: Run the site analyst — traffic, landings, SEO audit, and the fixes worth making
argument-hint: "[days] [fix|newsletter]"
---

Use the `site-analyst` agent.

Arguments: $ARGUMENTS

- A number is the window in days (default 30).
- `fix` means apply the changes it recommends, not only report them.
- `newsletter` means draft the next Dispatch issue into `content/articles.json`,
  run `npm run articles`, and leave the email draft in `email-drafts/` for review.

With no arguments, report only: run `node scripts/site-report.js --days=30`,
explain where people are landing and where they come from, and list the fixes
worth making in priority order without applying them.
