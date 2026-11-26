# Notera

Free visual boards for notes, to-do lists, links, pictures, videos and plans, in the spirit of Milanote. Boards can hold other boards, as many and as deep as you like.

**Live app:** https://kingenonso.github.io/notera/ (after GitHub Pages is switched on, see below)

## Get Notera

| Device | How |
|---|---|
| **iPhone / iPad** | Open the web app in Safari → **Get the app** → Share → **Add to Home Screen** |
| **Android** | Open the web app in Chrome → **Get the app** → **Install** |
| **Windows** | Download the installer from [Releases](https://github.com/kingenonso/notera/releases/latest), or install from Edge or Chrome |
| **Mac** | Download the `.dmg` from [Releases](https://github.com/kingenonso/notera/releases/latest), or in Safari choose File → Add to Dock |
| **Linux** | `.AppImage`, `.deb` or `.rpm` from [Releases](https://github.com/kingenonso/notera/releases/latest) |

The desktop installers aren't signed yet, so Windows and Mac ask you to confirm the first time (Windows: **More info → Run anyway**; Mac: right-click → **Open**). App store listings are explained in [STORES.md](STORES.md).

Each device and each way of opening Notera keeps its own boards. To move boards between them, use **Share → Download everything** on one and **Open a board file** on the other.

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

**Work together live**
- **Live**: tap Live on any board to share it and everything inside it. You get an edit link and a view link to send on WhatsApp. Everyone sees changes as they happen, sees who's online and which board they're on, and pictures and videos (up to 95 MB each) are shared too. Each person keeps a full copy, so it works offline and catches up later. It runs free on Cloudflare (the `server/` folder, deployed by the Live server GitHub Action using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets).

**Made for planning films**
- **Film production template**: one tap builds pre-production, production and post-production boards for a whole film.
- **Script writing**: a screenplay editor that formats as you type (Enter moves to the next element, Tab changes it). Save as a proper screenplay PDF or a Fountain file, and send it straight to the breakdown.
- **Script breakdown**: paste or open a script (plain text, Fountain, Final Draft .fdx or PDF). Notera splits it into scenes, finds the characters, and lets you tag props, wardrobe, hair and makeup, vehicles, effects and extras by selecting words.
- **Smart breakdown**: Suggest tags finds props, wardrobe, makeup, vehicles, effects, extras and missing cast in every scene, offline. Check with Gemini adds Google’s AI using your own free key (kept on your device). You choose which suggestions to keep.
- **Shooting schedule**: colour-coded scene strips (inside or outside, day or night) that you drag into shoot days, with page counts and screen time per day. Group by location puts scenes in the same place together.
- **Call sheets**: made for each shoot day from the schedule, breakdown and cast list. Add the address, parking, weather and nearest hospital, then send it to WhatsApp or save it as a picture or PDF.
- **Shot cards**: numbered shots (1A, 1B…) with size, lens, movement, angle, a storyboard frame and a status. The Shots tab lists every shot in the film and saves as a picture or PDF.
- **Budget**: departments and line items (quantity × rate × days), planned against actual, contingency, any currency (naira by default). Add cast and crew fills in a line per person. Save the summary as a PDF.
- **Reports**: Day Out of Days, one-line schedule, location report and needs by day, each saved as a PDF or picture.
- **Review notes**: open any video card in Review, pause anywhere and pin a note to that moment. Export the notes as markers for DaVinci Resolve (EDL) or copy them as text.

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
| `js/features/live.js`, `server/` | Live teamwork: the app side and the free Cloudflare server |
| `js/features/film-*.js`, `css/film.css` | Film workspace: script, breakdown, smart tags, schedule, call sheets, shots, budget, reports, people, review notes |
| `js/features/` | Today, sharing, walkthroughs and Present, voice to text, history, PIN lock, tidy, templates, export |
| `sw.js` | Offline support |
| `manifest.json`, `icons/` | Install as an app |
| `src-tauri/` | Desktop app for Windows, Mac and Linux (Tauri) |
| `.github/workflows/desktop.yml` | Builds the desktop installers on GitHub |

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
