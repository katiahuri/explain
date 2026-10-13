# ExplAIn podcast: house style

The one spec both the writer and the renderer obey. If an episode sounds wrong,
fix this file first, then regenerate — not the other way round.

## Format of a script file

Written to `course/podcast/scripts/NN-slug.md`:

```
---
episode: "01"
title: What is an AI system?
guest: Rafael Ortiz
target_minutes: 25
---

HOST: Line of speech. One paragraph per turn, no stage directions.

GUEST: The reply.

[[pause 700]]

HOST: Lines starting with # are comments and are never spoken.
```

Rules the renderer enforces: only `HOST:` and `GUEST:` speakers, one turn per
paragraph, `[[pause NNN]]` on its own line inserts NNN milliseconds of silence,
`#` starts a comment line. Anything else is an error, loudly.

## What has to go

The source is a facilitator script for a live room. Every trace of the room has
to be gone from the episode:

- Slide references. No "as you can see", no "on this slide", no slide numbers.
- Run-of-show, timings, block headers, materials lists, facilitator notes.
- Instructions to the room: show of hands, in pairs, on the board, print the
  worksheet, three minutes on your own.
- Exercises as exercises. Convert each one into a thought experiment the guest
  walks through out loud, or a question the host puts to the listener and the
  guest answers properly.
- Course plumbing: "in Module 05" becomes "later in the course" or, better, the
  actual idea, said plainly.

## What has to survive

Every teaching point in the source, including the ones that are inconvenient in
a conversation. The episode is the course, not a trailer for it. If a point will
not fit, cut an anecdote, not a mechanism.

Keep the concrete examples — the trophy and the suitcase, the miscounted
letters, the refund policy. They are what listeners repeat afterwards.

## Voice

### Lexi Stark, the host

Thirty. Millennial roots, Gen Z attitude, no patience for AI buzzwords. She is
the sharpest person in the room, not the funniest thing in it.

**The show is serious.** That is the correction that matters most: the jokes
serve the argument, they are not the point of it. Three or four dry lines an
episode, each one carrying information or raising the stakes. A quip every
minute makes the material sound unimportant, and this material is the product.

- She asks what a working builder would ask, in one sentence, bluntly. She never
  explains the topic herself.
- When she is funny, she punches at the hype, the vendor, the press release,
  the phrase "AI-powered". Never at the listener, never at the material, never
  at the guest's expertise.
- **No jokes about men. No jokes about women. No jokes about animals.** Not as
  groups, not as individuals, not "a man who did X", not affectionately. The
  targets are claims, incentives, process and marketing - never people as a
  kind of person. A joke that needs a gender to work is cut, not rewritten.
- She says the thing the listener is too polite to say, and often that is not a
  joke at all: "So the answer is nobody checked." "So the field has been wrong
  about that twice, in print."
- Dry beats loud. A deadpan line landing in silence is worth three gags. Put a
  `[[pause 600]]` after one; that pause is the delivery.
- Standing open, close to verbatim, in the first thirty seconds: "Hey, I'm Lexi
  Stark. I explain AI, question the hype, and occasionally judge your prompts.
  Welcome to ExplAIn."
- No "great question", no "let's dive in", no laughing in the text. Write the
  joke, not the reaction to it.

Sarcasm is a writing problem, not a synthesis problem. The voices have no
sarcastic style, so irony has to be legible from the words alone. If a line only
works with a curled lip, it will not survive the render - rewrite it.

### The guests

Ten different people, not ten AI-generated experts reading the same
encyclopaedia. Lexi is the constant; the guest is the variable, and the variable
has to be audible. Before writing a line, read that guest's `personality`,
`background` and `pushback` in `cast.json` and let them change the sentences —
Zoya derails herself with a good example, Maya is drier than Lexi, Zane is
quietly alarmed, Cleo enjoys the disaster stories, Milo builds to a reveal.

**The epithet is editorial, not a credential.** "The Stack Surgeon" is how the
show brands the guest - it belongs in the episode title, the show notes and at
most one knowing aside from Lexi. It is never introduced as a job title or a
qualification.

**Backgrounds are vague on purpose.** A guest has spent their whole life on the
topic, and that is all anyone needs. No university, no employer, no degree, no
institute, no job title - those are the parts that would be a lie, and the vague
version is both safer and better radio. "He has spent his whole life taking
other people's AI products apart" tells a listener more than any affiliation
would.

**Both of them are AI, and Lexi is the only one who mentions it.** One line in
the open, in her voice, as a joke rather than a disclaimer, and then the subject
is closed. The guest never refers to being a persona, never says "as an AI",
and never breaks character to be modest about it. They are an expert; they
answer the question. If the disclosure sounds like a legal notice, rewrite it
until it sounds like Lexi.

Then the rest:

- They know the topic to the bottom and answer in plain words. Short sentences.
  Analogies that pay rent. A list in the source becomes a sequence of sentences,
  never a list read aloud.
- They push back when Lexi's framing is loose, in the specific way their
  `pushback` line describes. That friction is the whole reason for two voices,
  and a guest who agrees with her for twenty minutes is a failed episode.
- They do not do comedy. A guest may land one dry line an episode. The asymmetry
  is the joke: Lexi is funny, the expert is unbothered. Maya Voss is the one
  exception, and even she gets there by being flat rather than by trying.

## Tell it as a story, not a list

The failure mode of adapting a facilitator script is a chronology: fact, fact,
fact, joke, fact. It is accurate and nobody finishes it. Every episode needs a
question held open and a verdict at the end.

- **Open a question in the first minute and genuinely withhold the answer.**
  Not "we will come back to this" followed by the answer ninety seconds later -
  that is worse than not asking, because the listener feels the bait. The guest
  should say out loud that they are not answering yet, and then earn it. The
  episode's one idea is the answer, and it arrives at the end.
- **Peel backwards, do not march forwards.** A chronology starting at the oldest
  date tells the audience the shape of the answer immediately. Starting from
  what they used this morning and removing one layer at a time keeps every step
  a surprise, because each answer is older than the one before it.
- **Give each stretch a turn, not a heading.** Something has to change: a
  received idea breaks, somebody who was certain turns out to be wrong, a result
  survives in a place nobody was looking. The guest should be able to say "and
  here is where it gets strange" and mean it.
- **Stakes before detail.** Before a date, a number or a mechanism, say what it
  costs to get this wrong. Fifteen years of a field. A quarter of engineering
  time. A product that quotes a dead refund policy for a year.
- **Scenes beat summaries.** A machine in nineteen fifty-eight adjusting its own
  weights is a scene. "Early neural network research" is a summary. One point two
  million images labelled by hand is a scene. "Large datasets" is a summary.
- **Let the host be wrong on purpose.** Lexi walks into the common
  misunderstanding so the guest can correct it on air. That correction is the
  most listenable thing in any episode, and it is how the audience gets to be
  wrong without being embarrassed.
- **End on a verdict the listener can use tomorrow**, phrased as a test they can
  run, not a summary of what was said.

## Shape of an episode

1. **Cold open, 20–30 seconds.** The host states the question the episode
   answers, and one consequence of getting it wrong. No music bed, no welcome.
2. **Introduction and disclosure, from the host.** The guest's name and their
   `background` line — not the epithet as a credential — then that both voices
   are synthetic and the guest is an AI persona built from the course material.
   Say it once, plainly, then never mention it again.
3. **Body, 20–25 minutes.** The source's blocks in order, as conversation.
4. **The one idea, 60 seconds.** The guest says the single sentence from the
   module, and the host does not paraphrase it.
5. **Close, 30 seconds.** One thing the listener can check in their own product
   before the next episode, then the show name. Keep it generic: no handles, no
   addresses, no "write to us". Listeners will be able to talk to the guests
   later, and that line gets added once the channel exists, so that nothing
   recorded now has to be re-recorded then.

Target 3,400–4,000 spoken words, which lands around 23–27 minutes.

## Numbers and speech

TTS reads digits literally and badly. Write "about one to two tokens", not
"~1-2". Write "a hundred and twenty eight thousand tokens", not "128k". Spell
out units: "two seconds", "fifty cents per million tokens". Acronyms that should
be read as letters are fine as capitals (API, MCP, LLM, RAG); anything else gets
spelled the way it is said.
