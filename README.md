# Notera

Free visual boards for notes, to-do lists, links, pictures, videos and plans, in the spirit of Milanote. Boards can hold other boards, as many and as deep as you like.

**Live app:** https://kingenonso.github.io/notera/ (after GitHub Pages is switched on, see below)

## Why it's free and close to unlimited

Like a Word document, everything you make in Notera is saved **on your own device**, inside the browser's storage. Nothing is uploaded to a server, so:

- there's no storage bill for whoever runs the app
- the only limit for users is their device's free space, and videos can be any size
- it keeps working without internet after the first visit, and can be installed like an app (browser menu → Install)

Each device and browser keeps its own copy. To move or share a board, use **Share → Download** to get a `.board` file. Pictures and videos travel inside the file. The other person opens it with **Share → Open a board file**.

## Features

**What makes it different**
- **Boards are portals.** Each board card shows a live miniature of what's inside, and opening one zooms you through it.
- **Narrated walkthroughs.** Record your voice while you move around a board and click cards. Playback moves the screen and highlights each card in time with your voice.
- **Present mode** (P). A slideshow that glides from card to card in reading order.
- **Voice to text.** Optional, on the device: voice notes, board explanations and walkthroughs get written out and become searchable. Needs a one-time download of about 80 MB, then works offline.

**Every day**
- **Today** (T). Every unticked checklist item from every board, grouped by due date, with reminders while Notera is open or installed.
- **Share to WhatsApp, Telegram or email** through the phone's share sheet. When installed, Notera also appears in other apps' share menus, and shared items land on an Inbox board.
- **History.** Slide back through earlier versions of a board and restore one.

**Trust and polish**
- **PIN lock** for a board and everything inside it. This keeps casual eyes out on a shared phone, but it is not encryption, and a forgotten PIN can't be recovered.
- **Tidy** lines cards up neatly. Dragging snaps to nearby cards (hold Alt to place freely).
- **Templates**: wedding or event, business plan, content calendar, study timetable, moving house, trip, weekly planner, moodboard.
- **Save as picture or PDF** for people who don't use Notera.

**The basics**
- Notes, headings, checklists with due dates, links, pictures, videos, voice notes, colour swatches, columns, lines between cards
- Boards inside boards, a floating dock of tools, and a ring of tools wherever you double-click
- Search across every board (Ctrl+K), undo and redo, works offline, installs like an app

## Project layout

| File | What it does |
|---|---|
| `index.html` | The page layout |
| `css/app.css` | The look and the motion |
| `js/config.js` | App name and which storage to use (`local` today) |
| `js/storage-local.js` | Saves boards and media on the user's device (IndexedDB) |
| `js/app.js` | The board app itself |
| `js/features/` | Today, sharing, walkthroughs and Present, voice to text, history, PIN lock, tidy, templates, export |
| `sw.js` | Offline support |
| `manifest.json`, `icons/` | Install as an app |

## Run it on your computer

Any static web server works, for example:

```bash
cd notera
python3 -m http.server 8000
```

Then open http://localhost:8000

## Put it online with GitHub Pages (free)

1. On GitHub, open the repository → **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*
3. Choose branch **main** and folder **/ (root)** → **Save**
4. After a minute the app is live at `https://kingenonso.github.io/notera/`

## Switching to cloud storage later

The app talks to storage only through `js/storage-local.js`. A cloud version adds a second file with the same functions (`loadAll`, `put`, `del`, `onChange`, `putMedia`, `getMedia`, `mediaUrl`, `listMedia`, `deleteMedia`, `usage`) that saves to a server instead, and `js/config.js` switches `storage` to `"cloud"`. That version adds sign-in, live collaboration, invites and permissions. Its cost scales with how much people store. For example, Cloudflare R2 gives 10 GB free each month, then charges per GB stored, with no download fees.

## Rename the app

Change the name in `js/config.js`, the `<title>` in `index.html`, and `name`/`short_name` in `manifest.json`.
