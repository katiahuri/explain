---
description: Turn one facilitator script into a two-voice podcast episode, ready to render
argument-hint: "<episode number, 01-10> [all]"
---

Arguments: $ARGUMENTS

Write episode `$ARGUMENTS` of the ExplAIn podcast. With `all`, do every episode
that does not yet have a script file, one at a time, finishing each before
starting the next.

For each episode:

1. Read `scripts/podcast/house-style.md` in full. It is the spec, not a hint.
2. Read the episode's entry in `scripts/podcast/cast.json` — the guest's name,
   expertise and `pushback` line are the character you are writing.
3. Read the whole source in `course/podcast/raw/NN-slug.txt`. Every teaching
   point in it has to survive into the episode.
4. Write the dialogue to `course/podcast/scripts/NN-slug.md` in the format the
   house style defines. Write it in one pass, start to finish — do not draft an
   outline and expand it, which is what makes these sound generic.
5. Run `node scripts/podcast/render.js NN --check`. It validates the format,
   counts spoken words and estimates runtime and cost. Fix anything it reports.
6. Tell the user the word count, the estimated runtime, and one line on what you
   cut or converted. Do not paste the script into the chat.

Hold the line on two things, because they are the ones that slip: the host never
explains the topic, and nothing from the live room survives — no slides, no
"in pairs", no worksheets, no module numbers.
