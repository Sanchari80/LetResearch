# LetResearch

**The academic research network – published by SKT Software Land.**

LetResearch is an installable web app (PWA) for researchers. It runs in any browser on phones, tablets and computers, and installs like a normal app on Android, iPhone, iPad, Windows, macOS and ChromeOS – no app store needed. Researchers build a profile with per-detail privacy, curate a paper index, share research in an academic-only feed, connect, and chat in real time. Notifications arrive even when the app is closed, and content you have already opened stays readable offline.

```
LetResearch/
├── web/           The app: React + Vite + TypeScript, installable PWA → deploy to Vercel
│   ├── src/       Pages, components, service worker (src/sw.ts)
│   └── public/    Icons, install screenshots, sounds
├── server/        Node.js API (Express + Socket.IO + MongoDB) → deploy to Render
├── docs/          Screenshots
├── render.yaml    Render Blueprint for the API
└── README.md
```

---

## Screenshots

<p>
  <img src="docs/phone-profile-index.png" width="240" alt="Profile with the research paper count and the paper index opened" />
  <img src="docs/phone-feed.png" width="240" alt="Academic feed" />
  <img src="docs/phone-chat.png" width="240" alt="Live chat with read receipts" />
</p>
<p>
  <img src="docs/phone-network.png" width="240" alt="Network suggestions" />
  <img src="docs/phone-notifications.png" width="240" alt="Notification center" />
  <img src="docs/phone-moderation.png" width="240" alt="A meme-like post is not published" />
</p>
<p>
  <img src="docs/phone-install-android.png" width="240" alt="Installing the app on Android" />
  <img src="docs/phone-install-iphone.png" width="240" alt="Adding the app to the iPhone Home Screen" />
</p>
<p>
  <img src="docs/desktop-profile-index.png" alt="Profile on a computer" />
  <img src="docs/desktop-privacy.png" alt="Choosing who can see a profile detail" />
  <img src="docs/desktop-feed.png" alt="Feed on a computer" />
</p>

---

## Features

**Profile and privacy**
- Profile photo, cover, name, headline, qualification, institution, location, about, research interests.
- Contact links: WhatsApp (opens a direct `wa.me` chat), LinkedIn, Telegram, email, phone, GitHub, website, Google Scholar, ResearchGate, ORCID, X.
- Every detail and every link has its own privacy pill – **Public**, **Connections** or **Only me** – changeable at any time on the profile itself or in Edit profile. The server filters every field, so hidden details never leave it.
- **Copy profile link** – a public profile page that opens in any browser (`https://your-site/u/username`).
- The **Message** button is always on other researchers' profiles, next to their messaging links.

**Paper count and paper index**
- The top of every profile shows a graphite plaque with the paper count, e.g. **[12] Research papers**.
- Clicking it drops down the **paper index**: the titles in citation style – `[1] Title. Journal, Year.`
- The author chooses which papers appear and arranges their order (Profile → Papers → drag the grip or use the arrows, eye to show or hide).
- Visitors see papers according to each paper's privacy: connection-only papers appear as locked rows, "Only me" papers are hidden.

**Research papers**
- Upload PDF or Word files (up to 20 MB, or drag a file onto the upload area on a computer) or add a DOI / arXiv / journal link.
- Per-paper **view access**: Public, Connections, Only me.
- Per-paper **download access**: Everyone, Connections, No one, or Paid for uploaded files. Paid papers keep their title and abstract free; the full file stays locked until checkout is connected.
- Paid access currently displays a fixed **$4.99 USD** price and a **20%** platform-fee split (**$1.00** platform / **$3.99** researcher). This is a preview only: no payment is collected and no buyer can unlock a file yet. The paper owner can still download their own upload.
- Downloads use short-lived signed links. The author is notified instantly – **"X downloaded your research paper"** – with a sound and vibration, and can see the full download history.

**Academic feed with strict moderation**
- Post types: research update, research link, a paper from your portfolio, photos (up to 4) or one short video (up to 90 s).
- Every post needs an academic category and passes a moderation pipeline before it is published:
  - blocks memes, reels, jokes, giveaways, spam, profanity, laughing-emoji posts and all-caps shouting;
  - blocks links to reels / short-video / meme / adult sites (TikTok, Instagram Reels, YouTube Shorts, 9GAG …);
  - blocks animated GIFs; photos and videos must describe their research context;
  - optional AI image review with Claude (set `ANTHROPIC_API_KEY`);
  - community reports: posts reported by several researchers are hidden until a moderator restores or removes them.
- Likes (heart pop + ring burst + sound), comments, share links.

**Network**
- Suggested researchers: best match, near you (same city), shared interests, same institution.
- Connection requests: send, accept, decline, withdraw, remove.
- Search by name, username, headline, institution or interest.

**Messaging (Facebook-style requests)**
- Messages to someone you are not connected with become a **message request** in their *Message requests* tab.
- When they accept (or reply), the chat moves to the main **Inbox** for both people. Declining stays private.
- Live chat over WebSockets: instant delivery, **typing indicator**, **online status / last seen**, **read receipts** ("Seen"), photo and file sharing.
- Researchers can turn message requests off (Settings → Message requests).

**Notifications**
- Real-time in-app alerts with sound and vibration for connection requests, message requests, likes, comments and paper downloads.
- **Phone and computer notifications while the app is closed** (web push) – turned on with one tap (Notifications page or Settings → Notifications). Tapping a notification opens the right chat, paper or post. Messages from one chat are grouped into one notification.
- Unread count on the installed app's icon on computers and on iPhone/iPad (where the system supports app badges).
- Notification center with categories: All, Requests, Activity, Downloads.

**Installable app (PWA)**
- **Install app** button (feed, welcome page, Settings) opens the browser's install dialog, or shows short step-by-step instructions on iPhone and iPad.
- Opens full screen from the home screen or the desktop, with the LetResearch icon, splash colour and shortcuts (New post, Messages, Notifications).
- Starts instantly and **works offline**: the app itself is stored on the device, and the feed, profiles, chats and notifications you have opened stay readable without a connection (a small notice says you're offline).
- When a new version is deployed, a banner offers **Reload** – no reinstalling.
- Optional **Download Android app (APK)** button when you set `VITE_ANDROID_APK_URL` (see *How people get the app*).

**Design**
- Simple, professional brushed-silver theme (platinum and paper surfaces, graphite ink, one patina accent).
- Source Serif 4 for names and paper titles, IBM Plex Sans for the interface.
- Animations nearly everywhere: sliding tab indicator, page and list entrances, press springs, dropdowns, sheets, toasts, typing dots, like bursts, step transitions, drag-to-reorder. People who turn on "reduce motion" in their system get calm transitions.
- Fully responsive: bottom tabs on phones, a sidebar layout on tablets and computers. Pull down to refresh in the installed app.

---

## Run it locally

You need **Node.js 22 LTS** (20.19 or newer also works) and a **MongoDB** database (a free MongoDB Atlas cluster is easiest – see below).

### 1. API server

```bash
cd server
cp .env.example .env        # then edit .env: set MONGODB_URI and JWT_SECRET
npm install
npm run seed                # optional: demo researchers, papers, posts and chats
npm run dev                 # API on http://localhost:4000
```

Check it: open http://localhost:4000/api/health

### 2. Web app

```bash
cd web
npm install
npm run dev                 # app on http://localhost:5173
```

Leave `VITE_API_URL` unset while developing: the app then uses port 4000 on the same computer. To use another API, copy `.env.example` to `.env` and set `VITE_API_URL`.

- **On your phone (same Wi-Fi):** open `http://<your-computer-ip>:5173`. The app works, but installing it and phone notifications need HTTPS, so test those on your Vercel link.
- **Production build:** `npm run build`, then `npm run preview` (http://localhost:4173). The offline cache and the install button only run in this build, not in `npm run dev`.

### Demo accounts (after `npm run seed`)

Password for all of them: `Research@123`

| Email | Researcher |
| --- | --- |
| nusrat.jahan@example.com | Nusrat Jahan – has papers, chats, a message request and notifications |
| arif.hossain@example.com | Arif Hossain – connected with Nusrat |
| laila.haddad@example.com | Laila Haddad – sent Nusrat a message request |
| michael.chen@example.com | Michael Chen – sent Nusrat a connection request |
| sadia.rahman@example.com, elena.markovic@example.com, kenji.watanabe@example.com, amara.okafor@example.com | more researchers |

`npm run seed` only runs on an empty database. `npm run seed -- --reset` **wipes the whole database** first – never run it against real data.

---

## Deploy

### All commands in order

Run these in a terminal (on Windows use PowerShell; in Command Prompt write `copy` instead of `cp`).

```bash
# 1. Put the project on GitHub (create an empty repository named letresearch on github.com first)
cd LetResearch
git init
git add .
git commit -m "LetResearch"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/letresearch.git
git push -u origin main

# 2. Optional: load the demo researchers into your Atlas database (from your computer)
cd server
cp .env.example .env        # put your Atlas connection string in MONGODB_URI
npm install
npm run seed
cd ..

# 3. Render (API) and Vercel (app) are set up in their dashboards – steps 2 and 3 below, no commands.

# 4. Later, after changing code: push again and Render + Vercel redeploy by themselves
git add .
git commit -m "Update"
git push
```

### Step 1 – MongoDB Atlas (free)

1. Create an account at https://www.mongodb.com/atlas and create a free **M0** cluster.
2. **Database Access** → add a database user with a password.
3. **Network Access** → add `0.0.0.0/0` (Render's free servers don't have fixed IPs).
4. **Connect → Drivers** → copy the connection string and put a database name in it, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/letresearch?retryWrites=true&w=majority`

All uploads (papers, photos, videos, chat files) are stored in this database with GridFS, so you don't need any other storage service.

### Step 2 – API on Render

- **Blueprint (easiest):** Render Dashboard → **New → Blueprint** → choose the repository. `render.yaml` creates the service; paste your `MONGODB_URI` when asked. `JWT_SECRET` is generated for you. Optional: under the service's **Environment** tab add `ADMIN_EMAILS` (your email, so you can review reported posts) and `ANTHROPIC_API_KEY` (AI review of images).
- **Manual:** New → **Web Service** → choose the repository and set
  - Root Directory: `server`
  - Build Command: `npm install`
  - Start Command: `npm start`
  - Health Check Path: `/api/health`
  - Environment: `MONGODB_URI`, `JWT_SECRET` (a long random string), `NODE_VERSION=22`, `CORS_ORIGIN=*`

When it's live, open `https://<your-service>.onrender.com/api/health` – you should see `"database": "connected"`.

Notifications need nothing extra: on its first start the API creates its notification keys (VAPID) and keeps them in your database. To manage them yourself instead, run `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:you@example.com`) on Render. Keep the same keys afterwards – new keys make every browser turn notifications on again.

To load demo data: Render's free plan has no Shell, so run the seed from your own computer (command step 2 above).

> The free Render plan sleeps after 15 minutes without traffic. The first request afterwards takes up to a minute; the app shows "Waking up the server…" meanwhile.

### Step 3 – App on Vercel

1. Vercel → **Add New → Project** → import the repository.
2. **Root Directory:** `web`. Vercel detects **Vite**; `web/vercel.json` already sets the build (`npm run build`), the output folder (`dist`), the routing for links such as `/u/username`, and the caching rules the service worker needs.
3. **Environment Variables:**
   - `VITE_API_URL` = `https://<your-service>.onrender.com`
   - optional: `VITE_ANDROID_APK_URL` = a download link to an APK (see *How people get the app*)
4. Deploy. If you change environment variables later, redeploy so they are built in.

Your app is now at `https://<your-project>.vercel.app`. Profile, post and paper links use whatever address the app is opened from, so a custom domain works without changes.

### Step 4 – Lock CORS to your site (recommended)

On Render set `CORS_ORIGIN=https://<your-project>.vercel.app,http://localhost:5173` and redeploy.

---

## How people get the app

After deploying, your Vercel link (for example `https://letresearch.vercel.app`) **is** the app. Share it anywhere.

**1. Install from the website – Android, iPhone, iPad, computers (free, nothing to build)**
- **Android (Chrome, Edge, Samsung Internet):** tap **Install app** in the app (top of the feed, the welcome page or Settings) and confirm. Or browser menu ⋮ → *Install app* / *Add to Home screen*.
- **iPhone / iPad:** open the link in Safari → **Share** → **Add to Home Screen** → **Add**. The app's Install button shows these steps. On iPhone and iPad, notifications work in the installed app (iOS 16.4 or newer): open it from the Home Screen, then turn on notifications.
- **Computer (Chrome / Edge):** click **Install app**, or the install icon at the right end of the address bar. Safari on a Mac: File → Add to Dock.
- People who open the link inside Facebook or Messenger are asked to open it in their browser first, because those viewers cannot install apps.
- The installed app updates itself: after a deploy it shows "A new version of LetResearch is ready" with a **Reload** button.

**2. Android app file (APK) and Google Play – with PWABuilder (free)**

PWABuilder wraps the deployed PWA in a real Android app (a Trusted Web Activity), so it always shows your latest deploy.

1. Open https://www.pwabuilder.com, enter your Vercel URL and click **Start**.
2. **Package for stores → Android → Generate Package**, keep the defaults and download the zip. It contains an `.apk` to install or share, an `.aab` for Google Play, your signing key (keep it safe – you need it for every update) and an `assetlinks.json` file.
3. Put that `assetlinks.json` at `web/public/.well-known/assetlinks.json`, commit and push. Vercel then serves it at `https://<your-project>.vercel.app/.well-known/assetlinks.json`, which lets the Android app open full screen without a browser address bar. If you publish on Google Play with Play App Signing, add the SHA-256 fingerprint from Play Console (Setup → App integrity) to that file too.
4. To offer the APK on your site: attach it to a **GitHub Release** (repository → *Releases* → *Draft a new release* → attach the file → *Publish*), set `VITE_ANDROID_APK_URL` on Vercel to the file's link and redeploy. Android visitors then see **Download Android app (APK)**. The repository must be public for others to download release files.
5. **Google Play** (optional): a developer account costs US$25 once (new personal accounts must run a closed test first). Upload the `.aab` in Play Console.

**3. Apple App Store (optional)** – PWABuilder can also create an iOS project (Package for stores → iOS). Building it needs a Mac with Xcode and the Apple Developer Program (US$99 a year). For most people, *Add to Home Screen* is enough.

---

## Environment variables

**server/.env** (on Render: the service's Environment tab)

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes (production) | Long random string that signs login tokens |
| `CORS_ORIGIN` | no | Allowed web origins, comma separated, or `*` |
| `ADMIN_EMAILS` | no | Emails that get moderator access (review reported posts) |
| `REPORT_THRESHOLD` | no | Reports needed to hide a post (default 3) |
| `PAPER_PRICE_USD` | no | Fixed displayed price for paid uploaded papers (default `4.99`; checkout is not enabled) |
| `PAPER_PLATFORM_FEE_PERCENT` | no | Displayed platform share of a future paid-paper sale (default `20`) |
| `ANTHROPIC_API_KEY` | no | Turns on AI review of post images |
| `ANTHROPIC_MODEL` | no | Model for AI review (default `claude-haiku-5-5`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | no | Your own notification keys (created automatically when empty) |
| `MAX_PAPER_MB`, `MAX_IMAGE_MB`, `MAX_VIDEO_MB`, `MAX_CHAT_FILE_MB` | no | Upload limits (20 / 8 / 40 / 15) |
| `FILE_URL_SECRET` | no | Secret for signed download links (defaults to `JWT_SECRET`) |

**web/.env** (on Vercel: Project → Settings → Environment Variables, then redeploy)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Your API URL, e.g. `https://letresearch-api.onrender.com` (empty in development = port 4000 on this computer) |
| `VITE_ANDROID_APK_URL` | Optional download link to an APK made with PWABuilder; shows a "Download Android app (APK)" button to Android visitors |

---

## How it works

```
[ Web app (PWA) – browser tab / installed on phone or computer ]
   ├─ UI: React pages, Motion animations, Web Audio sounds, vibration
   ├─ Data: TanStack Query cache, optimistic updates, saved on the device (IndexedDB) for offline reading
   ├─ Service worker: app files cached for instant, offline start; shows push notifications
   ├─ REST  ──────────────►  [ API on Render – Express ]
   │                           ├─ Privacy engine: filters every field, paper view/download rights
   │                           ├─ Moderation pipeline: rules → optional AI → community reports
   │                           ├─ Web push: VAPID-signed notifications via the browser's push service
   │                           └─ MongoDB Atlas (data) + GridFS (files, signed URLs, video range requests)
   └─ WebSocket ──────────►  [ Socket.IO on the same server ]
                               ├─ message:new / message:read (receipts) / typing / presence
                               ├─ notification:new (downloads, likes, comments, requests)
                               └─ counts (live badges)
```

**Download flow:** the app asks `POST /api/papers/:id/download` → the server checks the paper's download setting against the viewer's connection status → returns a 15-minute signed link → logs the download and sends "X downloaded your research paper" to the author: live over the WebSocket when LetResearch is on their screen, otherwise as a phone or computer notification.

**Message request flow:** a message to a non-connection creates a conversation with status `request`. It appears only in the recipient's *Message requests* tab (no typing indicator or read receipts are shared). Accepting – or replying – switches it to `active`, moving it to both inboxes. Connecting with someone also activates any pending request between you.

**Notifications:** the app tells the server when it goes to the background. Events for someone who has no LetResearch window on screen are sent through web push to every browser where they turned notifications on (Chrome/Android, Edge, Firefox, Safari on Mac, iPhone/iPad Home Screen apps). Dead subscriptions are removed automatically, and the server only sends to the browsers' official push services.

---

## API overview

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Profiles | `GET /api/users/:username`, `PATCH /api/users/me`, `PATCH /api/users/me/visibility`, `POST/DELETE /api/users/me/avatar`, `POST/DELETE /api/users/me/cover`, `GET /api/users/search`, `GET /api/users/suggestions`, `GET /api/users/:username/connections`, `GET /api/users/me/counts` |
| Papers | `GET /api/papers/pricing`, `GET /api/papers/mine`, `POST /api/papers`, `GET/PATCH/DELETE /api/papers/:id`, `PUT /api/papers/order`, `POST /api/papers/:id/download`, `GET /api/papers/:id/downloads` |
| Connections | `GET /api/connections`, `GET /api/connections/requests`, `POST /api/connections/request`, `POST /api/connections/:id/accept`, `POST /api/connections/:id/decline`, `DELETE /api/connections/:id` |
| Messages | `GET /api/conversations?box=inbox\|requests`, `POST /api/conversations/open`, `GET /api/conversations/:id`, `GET/POST /api/conversations/:id/messages`, `POST /api/conversations/:id/read`, `POST /api/conversations/:id/accept`, `POST /api/conversations/:id/decline` |
| Feed | `GET /api/posts/feed`, `GET /api/posts/user/:userId`, `POST /api/posts`, `GET/DELETE /api/posts/:id`, `POST /api/posts/:id/like`, `GET/POST /api/posts/:id/comments`, `DELETE /api/posts/:id/comments/:commentId`, `POST /api/posts/:id/report` |
| Notifications | `GET /api/notifications?category=`, `POST /api/notifications/read-all`, `POST /api/notifications/:id/read` |
| Push | `GET /api/push/key`, `POST /api/push/subscribe`, `DELETE /api/push/subscribe` |
| Moderation | `GET /api/moderation/queue`, `POST /api/moderation/posts/:id/approve`, `POST /api/moderation/posts/:id/remove` |
| Files | `GET /api/files/:id` (public files, or private files with a signed link) |

---

## Troubleshooting

- **"Can't reach LetResearch"** – check `VITE_API_URL` on Vercel (then redeploy), and open `<API>/api/health` in a browser. On the free Render plan wait a minute for the server to wake up.
- **The app can't call the API** – set `CORS_ORIGIN` on Render to your Vercel URL (or `*`).
- **No "Install app" option** – open the link in Chrome (Android) or Safari (iPhone), not inside Facebook/Messenger. If it is already installed, the option is hidden. Installing needs HTTPS (your Vercel link), not a local `http://` address.
- **Notifications don't arrive** – turn them on in Settings → Notifications on each device. If the switch says they are blocked, allow notifications for the site in the browser's site settings. On iPhone and iPad, add the app to the Home Screen first and turn them on from there.
- **Changes don't show after a deploy** – the installed app shows a "new version" banner; tap Reload. In a browser tab, reload the page.
- **Uploads fail** – papers must be PDF/DOC/DOCX up to 20 MB; photos JPG/PNG/WEBP/HEIC; videos MP4/MOV/WEBM up to 90 seconds and 40 MB. MongoDB Atlas free tier holds 512 MB in total.
- **`git push` asks for a password** – GitHub no longer accepts passwords; sign in through the browser window that opens, or use GitHub Desktop.

---

© SKT Software Land. LetResearch is published by SKT Software Land.
