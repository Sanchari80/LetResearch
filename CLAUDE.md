# LetResearch – notes for Claude

LetResearch is an academic research network published by SKT Software Land. Read `README.md` for features, deploy steps and environment variables.

- `web/` – the app: React 19 + Vite + TypeScript, an installable PWA (service worker in `web/src/sw.ts`, built with vite-plugin-pwa `injectManifest`). Deployed on Vercel with root directory `web`.
- `server/` – Node.js API: Express 5, Socket.IO, Mongoose/MongoDB, uploads in MongoDB GridFS, web push with `web-push`. Deployed on Render with `render.yaml`.

There is no Expo or React Native code any more; don't add it back.

## Rules

- All text people see is in English.
- Keep the simple, professional gray-silver design. Use the CSS custom properties in `web/src/styles/global.css` (colours, fonts, sizes, radii, shadows, motion) and the components in `web/src/components/ui` instead of new hex values or one-off styles. JavaScript colours come from `web/src/theme.ts`.
- Styles are CSS Modules next to each component. Keyframes in a module are local to it, so define them in the module that uses them. Entrance animations use `backwards` fill (not `both`), so they never override transforms afterwards.
- Animate with CSS keyframes or `motion/react` (`AnimatePresence`, `layout`, `Reorder`). `MotionConfig reducedMotion="user"` and the reduced-motion block in `global.css` must keep working.
- Sound and vibration go through `web/src/lib/feedback.ts`.
- Privacy is enforced on the server (`server/src/services/privacy.js`, `server/src/services/serializers.js`). Never send a hidden field to the app and rely on the UI to hide it.
- Every other researcher's profile keeps the Message button. A message to someone you are not connected with is a message request until they accept or reply.
- State that should survive opening a page and coming back (tabs, filters, wizard steps, search text) lives in the URL search params, not in component state.
- Forms with unsaved work use `useUnsavedChanges` (`web/src/components/useUnsavedChanges.ts`); call `allowLeave()` before navigating away after a save.
- `VITE_*` values are built into the app. Change them on Vercel (or `web/.env`) and rebuild.
- The query cache is saved on the device (`web/src/lib/persist.ts`) for offline reading. Add new query keys that must not be stored (search results, admin data) to `NOT_SAVED`.
- Web push: the server only posts to the browsers' own push services (`isAllowedEndpoint` in `server/src/services/push.js`). Push is sent when the user has no LetResearch window on screen (`isOnScreen` in `server/src/realtime/socket.js`).

## Commands

App (`web/`):
- `npm install`, then `npm run dev` – app on http://localhost:5173 (uses the API on port 4000 of the same host unless `VITE_API_URL` is set)
- `npm run typecheck` – must pass before finishing a change (checks the app and the service worker)
- `npm run build` – the same build Vercel runs; `npm run preview` serves it on http://localhost:4173. The service worker, offline cache and install button only run in this build.

API (`server/`, needs `server/.env` – copy `.env.example`):
- `npm install`, then `npm run dev` – API on http://localhost:4000 (check `/api/health`)
- `npm run seed` – demo researchers (empty database only); `npm run seed -- --reset` wipes the database first

There is no automated test suite in the repository; check changes by running the app (both phone and desktop widths).

## Where things are

- `web/src/App.tsx` – routes (react-router data router): auth pages, signed-in pages inside `AppShell`, public pages (`/u/:handle`, `/post/:id`, `/paper/:id`, `/guidelines`).
- `web/src/pages` – one file per page (Feed, Network, Messages, Notifications, MyProfile, Chat, Compose, EditProfile, Papers, PaperEditor, PaperDetail, PostDetail, PublicProfile, Search, Settings, Moderation, Connections, Welcome, Login, Register, Guidelines, NotFound).
- `web/src/components` – `ui/` kit, `layout/` (AppShell with sidebar and bottom tabs, update and offline banners), feature folders (`profile/` has the paper count plaque and paper index), `InstallApp.tsx`, `PushNotifications.tsx`.
- `web/src/lib` – `api.ts` client, `queries.ts` (TanStack Query), `persist.ts`, `socket.ts`, `config.ts`, `pickers.ts`, `install.ts`, `push.ts`, `nav.ts`.
- `web/vite.config.ts` – manifest, icons, shortcuts and precache settings. `web/public` – icons, screenshots, sounds.
- `server/src` – `routes/` (including `push.js`), `models/`, `services/` (privacy, moderation, notify, files, push), `realtime/socket.js`.

## Shipping

Commit and push to GitHub. Render (API) and Vercel (app) redeploy automatically. Installed apps show "A new version of LetResearch is ready" and reload into the new version.
