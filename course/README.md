# ExplAIn course materials

Nine 2-hour modules (00–08). Every module has a slide deck with speaker notes, a facilitator script and a public module page. Open `index.html` for a clickable overview.

```
course/
├── index.html              Materials hub (instructor)
├── workbook.html           Participant workbook: every exercise, the capstone and a printable course summary
├── content/                Source of truth: one JSON file per module
│   └── module-00.json … module-08.json
├── cheatsheets/            One-page cheat sheet per module (HTML + PDF) and ExplAIn-Course-Cheat-Sheets.pdf
├── certificate/
│   ├── index.html                        Certificate generator: type names, print A4 certificates with IDs
│   ├── ExplAIn-Certificate-Template.pptx Editable single certificate
│   └── ExplAIn-Certificate-Sample.pdf
├── module-00/ … module-08/
│   ├── ExplAIn-Module-NN-<title>.pptx          Slide deck (16:9, speaker notes on every slide)
│   └── ExplAIn-Module-NN-Facilitator-Script.docx
│       (module-00 also has worksheet.html, a printable paper version of the system map)
├── dist/
│   └── ExplAIn-Course-Materials.zip   Decks, scripts, cheat sheets and certificate in one file
└── _build/                 Generator scripts (you only need these to rebuild)
```

The public module pages live at the site root as `module-00.html` … `module-08.html`.

## Editing a module

The decks, scripts and module pages are generated. To change content, edit `content/module-NN.json`, then rebuild:

```
cd course/_build
npm install          # first time only
npm run build        # checks every module, then regenerates decks, scripts and pages
```

`npm run build` refuses content that won't fit the slide layouts and says which field to shorten.

## Session format

Each module runs as one 2-hour live session: a 10-minute opening, content blocks, a 20-minute applied exercise, and a 10-minute close. Module 08 also holds the capstone presentations. Participants record everything in the workbook; its Summary page compiles their whole course.
