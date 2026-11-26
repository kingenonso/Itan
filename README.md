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

- Boards are portals: each board card shows a live miniature of what's inside, and opening one zooms you through it
- A floating dock of tools at the bottom, and a ring of tools wherever you double-click
- Checklists with progress, voice notes, and a recorded voice explanation for any board
- Notes, headings, to-do lists, links, pictures, videos, colour swatches
- Boards inside boards, with a breadcrumb trail and an "All boards" tree
- Columns you can drag cards into and out of
- Lines connecting cards
- Search across every board (Ctrl+K)
- Undo/redo, duplicate, colours, resize, zoom and pan, pinch on touch screens
- Paste or drop links, text, pictures and videos straight onto the board
- Several open tabs stay in sync
- Storage panel: see space used, protect your data from browser clean-up, remove unused media

## Project layout

| File | What it does |
|---|---|
| `index.html` | The page layout |
| `css/app.css` | The look and the motion |
| `js/config.js` | App name and which storage to use (`local` today) |
| `js/storage-local.js` | Saves boards and media on the user's device (IndexedDB) |
| `js/app.js` | The board app itself |
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
