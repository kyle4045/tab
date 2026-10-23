# Tab — handoff

Tab is a phone-first bill splitter for groups of friends in Taiwan: New Taiwan Dollars (whole dollars), English and Traditional Chinese. You add a bill (who came, who paid, who shared each item, optional service charge and tax), and it keeps running balances per group and works out the fewest payments that settle everyone up. It also has a chat per group, profile pictures, a receipt scanner and a "Split with AI" assistant.

## Now: GitHub Pages + Firebase + an Apps Script AI proxy

The app is served as a static site from this repo's `main` branch (GitHub Pages, no build step). Everything below "This folder is the latest version" describes the original Claude-artifact version and is kept as history; where it disagrees with this section, this section wins.

- **Data and sign-in:** Firebase project `tab-bill-splitter` (Spark plan, no billing). Firestore in `asia-east1`, Google sign-in. `config.js` holds the public web config. `store.js` is still the only file that talks to the backend, and keeps the same API for `app.js`.
- **Who sees what** (`firestore.rules`, tested by `tests/rules.test.mjs`): an account joins the "circle" (`members/{uid}`) only through an invite link (`invites/{code}`, 14 days). Circle members share `people` and `photos`. A group, and its `bills`, `payments` and `messages` subcollections, is readable only by the accounts in its `memberUids`. Each account's language is in `settings/{uid}`, and its "who am I" in `members/{uid}.personId`.
- **Invites:** Members or Friends → Invite a friend makes `…/?openExternalBrowser=1#join=CODE` (LINE opens it in the phone's browser, where Google sign-in works).
- **AI:** `proxy/` is a Google Apps Script web app (deployed with clasp). It checks the caller's Firebase ID token by reading their own `members/{uid}` doc, rate-limits (20/hour per user, 300/day total), and calls `gemini-3.8-flash` on Vertex AI (global endpoint), billed to the Cloud project in the gitignored `proxy/Secrets.gs`. Receipt photos are shrunk to 1600px in the browser first. The prompts in `store.js` are unchanged.
- **Local testing:** start `firebase-emulators` and `tab-preview` from `.claude/launch.json`, open `http://localhost:8765/?emu`, and run `node tests/e2e.mjs`. Rules: `firebase emulators:exec --only firestore --project demo-tab "npm --prefix tests test"`.
- **First owner:** a brand-new database has no circle members, so the first account is added by hand (an admin write of `members/{uid}`).

The original artifact (private, owner only) was https://claude.ai/artifact/XH4hTFuiReiWfZY9BRzVto. Its data was not moved; the new app started fresh.

## This folder is the latest version

The six app files are byte-for-byte the files of the published artifact, **version 17 (id `1792688468-2e1c`, published 2026-10-23)**. They were downloaded from the artifact and checked with sha256:

| File | Bytes | sha256 |
|---|---:|---|
| `index.html` | 1,233 | `e00a7bb57954c007beb18d679fabbe6550eaf71c4d3ed2138c8457fd1a99f2cb` |
| `app.js` | 104,264 | `098ee60fa823a57699acf0d471ff90193d4d5c2244c495997c24d86bdfe37c23` |
| `store.js` | 19,704 | `0b0166a4e875d430507bdd7eff4da477d2335c3ea7049338bb9f89df187b2154` |
| `i18n.js` | 27,502 | `909a8b2a11b6625d5082b5a9ae081ecc6045e2a4c519560c3b6d5369535c1a87` |
| `app.css` | 21,377 | `44d9058e181f2dd26351db49e7c1d51fa880434b7b9c1186bc275928c0febd53` |
| `calc.js` | 4,103 | `dbbbc5dcbd84a00feae6912417dab7a16797d451c9ca3f3c84faf89a1515a0fd` |

Those six are every file the artifact publishes. The original working copy lives in `D:\claude code\calculator app test\` (its `index.html` is the un-wrapped source, see below; the other five files are identical).

## File structure

```
tab-bill-splitter/
├── index.html        the page: fonts, app.css, Preact+htm from unpkg, then the four scripts in order
├── app.css           all styles; colour tokens at the top of :root
├── calc.js           money maths only (no DOM, no storage); also loads in Node via module.exports
├── i18n.js           English and zh-TW strings, t(key, vars); keys ending in 1 / N are singular / plural
├── store.js          the ONLY file that talks to the platform (data, photos, AI)
├── app.js            every screen (Preact components written with htm), routing and the view model
├── HANDOFF.md        this file
├── dev/
│   ├── serve.ps1         local static server (PowerShell; this PC has no Node or Python)
│   └── mock-claude.js    fake `window.claude` for local testing (fake shared db in localStorage, fake AI)
└── .claude/
    └── launch.json       preview config "tab-preview" for Claude Code (runs dev/serve.ps1 on port 8765)
```

- **No build step, no package.json, no dependencies installed.** Plain ES5-style JavaScript in IIFEs. Everything hangs off `window.Tab` (`Tab.calc`, `Tab.i18n`, `Tab.store`); `app.js` loads last and renders into `#app`.
- **External requests:** Google Fonts (Bricolage Grotesque, JetBrains Mono, Noto Sans TC) and `https://unpkg.com/htm@3.1.1/preact/standalone.umd.js` (exposes `window.htmPreact`). If unpkg fails to load, `app.js` shows "The app could not load".
- **`index.html` quirk:** Claude's publisher wraps the source in its own skeleton (doctype, `<meta charset>`, viewport, a small reset that sets `body { margin: 0 }` and a light `color-scheme` that the page's own styles override). This file is that wrapped page, so it is a complete document, but `<title>` and the stylesheet `<link>`s ended up inside `<body>`. Browsers handle it; move them into `<head>` when you tidy up. Keep `body { margin: 0 }` if you replace the skeleton.

### Screens and navigation

- Bottom tab bar (floating, only on the four main screens): **Groups** (home: group list with balance, last message, unread badge), **Settle** (what you pay / get back across all groups), **Friends** (everyone the app knows), **Me** (profile, language, "This isn't me").
- Inside a group: group page (balances, outings, chat link), Members, Group chat, Add/Edit bill, Scan receipt, Split with AI, Bill details, Settle up.
- Other: first-run Setup, "Who are you?", New group, Profile editor, Invite a friend, a "not connected" screen.
- Navigation is in-memory state (`route = {name, id, gid, from}` in `App`), not the URL. Reloading returns to Groups, and the browser's Back button leaves the app.

## Where the data lives

### Shared data: the Claude artifact's database

`store.js` gets it with `claude.use('db')`. The API is Firestore-like: `db.collection(path).doc(id).set(data)`, `.delete()`, `.onSnapshot(next, error)`, `.orderBy(field, dir).limit(n)`. Every collection is subscribed live, so changes from other people appear at once. Writes replace whole documents (`set`), so the last write wins.

| Path | Document |
|---|---|
| `people/{id}` | `{ name, isMe, archived, avatar: {kind:'preset', preset: 0–7} or {kind:'photo', assetId}, example? }` |
| `groups/{id}` | `{ name, ownerId, memberIds: [personId], preset, createdAt, example? }` |
| `bills/{id}` | `{ groupId, title, date:'YYYY-MM-DD', payerId, presentIds: [], items: [{ id, name, price, sharerIds: [] }], servicePct or null, taxPct or null, createdAt, example? }` |
| `payments/{id}` | `{ groupId, fromId, toId, amount, date, createdAt, example? }` (written by "Mark as paid") |
| `groups/{id}/messages/{id}` | `{ personId, text, at }` (the newest 200 per group are kept; the sender's device deletes the oldest) |
| `settings/app` | `{ lang }` (also holds leftovers `groupName` and `groupsReady` that nothing reads any more) |

- Prices are whole NT$. A bill's shares are computed on the fly by `calc.js` and are never stored.
- `isMe: true` marks the page owner's own person. `example: true` marks the optional demo data (Setup → "Load an example outing"); "Remove example" deletes every row that has it.
- **Legacy data (real data has it):** the group with id `main` is the original group from before there could be several. Its old bills and payments have no `groupId` (`store.groupOf(row)` treats a missing one as `'main'`), and its chat lives in the top-level `messages` collection instead of `groups/main/messages` (`chatPath()` in `store.js`). Old `people` docs also carry an unused `regular` field.

### Photos

`claude.use('assets')`: `assets.upload(blob)` returns an id, stored as `avatar.assetId`. `app.js` shows it from the Claude-hosted path `'/_blob/' + assetId`. That path does not exist on GitHub Pages.

### This device only (localStorage)

- `tab.me`: which person this device is (picked on "Who are you?").
- `tab.chatRead`: JSON `{ groupId: timestamp }`, how far each group's chat has been read.
- `mock.db`: only used by `dev/mock-claude.js`.

### The real data is not in this folder

Kyle's real groups, bills, people and chat stay in the Claude artifact's database. To move them to a new backend, ask Claude in a session that can reach the artifact to export each collection (the ArtifactData tool can list `people`, `groups`, `bills`, `payments`, `messages`, `groups/{id}/messages`, `settings`). It contains real names and private chat, so **never commit it to a public GitHub repo**.

## How the AI features are called

**There is no API key and no direct call to the Anthropic API anywhere in the code.** Both AI features use the artifact runtime's `claude.use('sample')`. It runs Claude under the signed-in viewer's own claude.ai account and usage, and Claude asks the viewer for consent on the first use.

- **Scan a receipt** (`store.scanReceipt(file, signal)`): `sample.json(RECEIPT_PROMPT, { images: file, signal })`. The prompt asks for `{ title, items: [{ name, price, unsure }], servicePct, taxPct, total }`, which `store.js` cleans up before the review screen shows it.
- **Split with AI** (`store.askAssistant({ history, context, message, file, signal })`): sends `ASSISTANT_RULES` plus the last 12 chat turns, then a message with TODAY, KNOWN PEOPLE, CURRENT BILL and the user's text. It uses `cache: false` and attaches the receipt photo if there is one. The model must answer `{ reply, bill: { title, date, payer, people: [names], items: [{ name, price, sharers: [names], unsure }], servicePct, taxPct } }`. `applyAiBill()` in `app.js` maps names back to person ids, creating new people for unknown names. **The model never does arithmetic**: all totals come from `calc.js`.
- Sending photos needs the artifact to be published with the capability `sample: { images: true }` and `sample.limits().images` to be truthy. Otherwise the camera buttons hide themselves.
- Error codes handled: `rate_limited`, `image_rejected`, `session_expired`, `refused`, `not_granted` and similar, and `cancelled`.

To keep AI on GitHub Pages you need a small backend (for example a Cloudflare Worker, Vercel function or Supabase Edge Function). It would hold an Anthropic API key and call the Messages API with the same two prompts and image input, and `store.js` would call that endpoint. **Never put an API key in the front-end files.** GitHub Pages serves everything publicly.

## Features that only exist inside a Claude artifact

Everything below is in `store.js` unless noted. All of it is reached through `window.claude.use(name)`, which only exists when the page runs on claude.ai. Each call is guarded, so the page still loads without it.

| Feature | Used for | Without Claude (e.g. GitHub Pages) |
|---|---|---|
| `claude.use('db')` | All shared data, live updates between people | No db: everything is kept in memory and lost on reload; a warning banner says changes aren't saved |
| `claude.use('assets')` + `/_blob/<id>` (`Avatar` in `app.js`) | Profile photo upload and display | Upload button hidden; only the 8 colour avatars |
| `claude.use('sample')` | Receipt scan and Split with AI | Both hidden |
| `claude.use('user')` → `isOwner()`, `can('data.write')` | Picks the owner's own person automatically; detects view-only visitors (shows a view-only banner) | `isOwner` becomes `true`, nothing is view-only |
| `window.claude.hot` (bottom of `app.js`) | Keeps an open bill draft when the artifact is republished | Ignored |
| Artifact sharing (Claude's Share menu) | Who may open or edit the app. The **Invite a friend** screen in `app.js` only explains these Claude steps, and `APP_LINK` points at the Claude URL | Needs a real invite / sign-in flow |
| Publish-time settings (not in code) | Runtime contract `0.2.75`; capabilities `{"db":{}, "assets":{}, "sample":{"images":true}}` | Not applicable |
| `Disconnected` screen in `app.js` | Shown inside Claude when the viewer has no access to the shared db | Never shown (only appears when `window.claude` exists) |

**Identity:** there are no accounts. Each device picks "who am I" from the people list and remembers it in `tab.me`. The owner's device auto-picks the person with `isMe: true`.

## Deploying to GitHub Pages

- The folder is already static. Push it to a repo and enable Pages from the branch root. All paths are relative except the `/_blob/` photo path, and no `.nojekyll` is needed. `dev/` and `.claude/` are harmless if published, but you can leave them out.
- **As-is it works only as a one-visit demo:** no saving, no AI, no photos, and the Invite screen talks about Claude.
- To make it real, replace `store.js`. It is the only file that touches the platform, so the rest of the app shouldn't need changes beyond the `/_blob/` URL in `Avatar` and the Invite screen. Keep its public API and state shape:
  - **API:** `start, getState, subscribe(fn) → unsubscribe, newId, put(collection, id, data), remove(collection, id), saveSettings(patch), uploadPhoto(blob) → id, deletePhoto(id), scanReceipt(file, signal), askAssistant(req), claim(personId), markChatRead(groupId), sendMessage(groupId, personId, text), removeGroup(groupId), groupOf(row)`.
  - **State fields:** `ready, persistent, platform, canWrite, isOwner, meId, chatRead, chats{groupId: [messages]}, canUpload, canAsk, canScan, scanTypes, people, bills, payments, groups, settings`.
  - `put` and `remove` are also called with the chat path `groups/{id}/messages` (and `messages` for the `main` group).
- A good fit is Supabase: tables for the five collections, Realtime for live updates and chat, Storage for photos, an Edge Function for the AI proxy, and Row Level Security for the rules below.

## Local preview

Open this folder in Claude Code and start the `tab-preview` server (`.claude/launch.json`):

- `http://localhost:8765/`: the app as GitHub Pages will serve it (no platform, memory only).
- `http://localhost:8765/mock`: with the fake Claude platform. Data persists in localStorage key `mock.db`. AI answers are canned; set `window.__mockReply = (input, options) => ({ reply, bill })` to script them.
- Viewer modes: `/mock#friend` (another person who can edit), `/mock#viewer` (view-only), `/mock#nodb` (no database). After changing only the `#hash`, change the query too (`/mock?r=2#friend`) so the page actually reloads.
- Unlike the real platform, the mock always says images are allowed.

Manual check for the money maths (no test file exists yet): the built-in example "Hotpot night" (items 400 / 720 / 640 / 240 / 360, 10% service, Mei paid) must give shares 572 / 792 / 572 / 660, total 2,596. With the other two example bills, Settle must show Dana → Mei 964, Dana → You 476, Arjun → You 152.

## Known issues

- **No real accounts.** Anyone with edit access can pick any name. The group rules (only the creator renames a group, adds or removes members, or deletes it; others can leave) are enforced by the screens only, not by database rules.
- **Friends can't easily join while it stays in Claude.** The artifact is private ("readable by only you"). A friend needs a Claude account and an email invite as Editor from the Share menu, and it is unconfirmed whether Kyle's plan allows outside people to edit. With "Anyone with the link" turned on, visitors can only view, and they must be signed in to Claude.
- **Last write wins.** Documents are replaced whole, so two people editing the same bill or the same group's members at the same moment can overwrite each other.
- **The language setting is shared** (stored in `settings/app`), so switching language changes it for everyone.
- **Unread counts are per device**, not per person.
- **Chat keeps the newest 200 messages per group.** Pruning is done by whoever sends the 201st.
- **No URL routing.** Reload goes back to Groups and browser Back leaves the app.
- **Visual effects are untested on a real phone.** The tap glow and press animation and the count-up on the Home banner were tested only in a desktop preview.
- **Odd legacy data shapes:** the `main` group, its top-level `messages` chat, and unused `regular`, `groupName` and `groupsReady` fields.
- **`index.html` layout:** `<title>` and the stylesheet links sit in `<body>` (see above).
- **Needs internet to start.** Fonts and Preact come from CDNs, so the app can't start offline.

## Not done yet

- A real backend for GitHub Pages:
  - sign-in (or "open link + pick your name" with a per-group invite code)
  - a database with row-level rules for group membership and creator rights
  - realtime chat
  - photo storage
  - the AI proxy
- Moving Kyle's existing data out of the Claude artifact.
- Replacing the Claude-specific Invite screen with real invite links.
- URL routing (hash routes) so Back and reload behave.
- An automated test for `calc.js` (the numbers above).
- Optional: installable PWA and offline support.
