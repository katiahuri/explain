# The podcast pipeline

Turns the facilitator scripts into ten two-voice episodes. A host who asks what
a builder would ask, and one guest per episode who knows that topic to the
bottom. Both voices are synthetic and the show says so in every intro.

Nothing here is deployed. Everything the pipeline writes lands in
`course/podcast/`, which is gitignored along with the rest of the course
material.

## One-time setup

1. **ffmpeg**, for stitching and loudness:

   ```bash
   winget install Gyan.FFmpeg
   ```

2. **A text-to-speech key** in `.env.local` (already gitignored). Azure is the
   cheap route — its free Speech tier covers a few hundred thousand characters a
   month, which is roughly this whole series:

   ```
   TTS_PROVIDER=azure
   AZURE_SPEECH_KEY=...
   AZURE_SPEECH_REGION=westeurope
   ```

   Or OpenAI, which is one key and no Azure portal:

   ```
   TTS_PROVIDER=openai
   OPENAI_API_KEY=...
   ```

3. Check the voice ids are real, since providers retire them:

   ```bash
   npm run podcast:voices
   ```

   Put the ones you like into `scripts/podcast/cast.json`.

## Making an episode

```bash
npm run podcast:extract          # facilitator scripts -> course/podcast/raw/
```

Then, in Claude Code, for each episode:

```
/podcast-write 02
```

That reads the raw script, the house style and the guest's character, and writes
`course/podcast/scripts/02-....md`. Read it, edit anything that sounds wrong —
it is plain text, `HOST:` and `GUEST:` turns — then:

```bash
npm run podcast:check 02         # format, word count, runtime, cost
npm run podcast:render 02        # the MP3 and the transcript
```

`npm run podcast:render all` does every episode that has a script.

## What costs what

Characters are what you pay for. An episode is around fifteen thousand
characters, so the ten-episode series is in the region of a hundred and fifty
thousand — a couple of dollars at current rates, or nothing at all inside
Azure's free tier. `podcast:check` prints the estimate per episode, and the
price constant in `render.js` is worth re-checking against the provider, because
it moves.

Rendered turns are cached by the hash of their text and voice. Fix one line in
an episode and the re-render pays for that one turn, not the whole thing.

## Publishing

Don't put the MP3s in this repo — it is public, and ten episodes is a couple of
hundred megabytes. Upload to a podcast host that gives you an RSS feed and
distributes to the apps; Spotify for Creators does that free. The transcript in
`course/podcast/dist/NN-slug.txt` is the show notes, and it is worth pasting in
properly rather than leaving it empty, because the episode text is the only part
of a podcast search engines can read.

## The files

| File | What it is |
| --- | --- |
| `cast.json` | The show bible: host, ten guests, voices, source scripts. Edit this, not the scripts. |
| `house-style.md` | The spec for what an episode sounds like. Fix this before fixing an episode. |
| `extract.py` | Facilitator `.docx` and `.txt` to plain text. No dependencies. |
| `render.js` | Dialogue to MP3: speech per turn, cached, stitched, normalised to the podcast standard. |
| `.claude/commands/podcast-write.md` | The `/podcast-write` command that writes an episode. |
