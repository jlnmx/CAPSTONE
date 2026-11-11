# HANDA Command Center

The administrator web app uses React and Vite. It has a desktop-first operations shell, responsive navigation, and a dedicated administrator sign-in. The resident and responder experience remains in the Expo mobile app.

The web app and mobile app use the same HANDA backend accounts and role checks. Administrator sign-in is accepted only in the Command Center.

The **Dispatch** page sorts active responders by fresh live GPS distance to the selected incident. Set `VITE_SUPABASE_URL` to the Supabase project root (for example, `https://<project-ref>.supabase.co`, without `/rest/v1`) and `VITE_SUPABASE_ANON_KEY` to the same public Supabase key used by the mobile app to enable live positions. Dispatch assignments and responder notifications are managed by the HANDA API.

From the repository root:

```bash
npm install
npm run admin:web
```

Create a production build with `npm run admin:build`. Set `VITE_API_URL` to the reachable HANDA API origin when it is not `http://localhost:8000`.

The administrator map is monitoring-only and uses the Google Maps JavaScript API. Set `VITE_GOOGLE_MAPS_API_KEY` in the admin-web build environment to a key restricted to the deployed web referrers, with billing enabled and Maps JavaScript API and Places API (New) enabled. The key is read from the build environment and must not be committed. Places search uses the current Places library `PlaceAutocompleteElement` and `Place.fetchFields` APIs. The map shows evacuation centers and incidents with a satellite/road toggle; it does not provide navigation. When the browser reports itself offline, it displays locally cached incident and center markers on a neutral canvas without a basemap or tile requests. The latest map snapshot is saved in browser local storage for offline reloads. Google Maps failures while online are shown as actionable errors and do not switch providers. Google map tiles are not cached by this app.

The Vercel deployment uses `vercel.json` to add a restrictive Content Security Policy, clickjacking and MIME-sniffing protections, and a same-origin CORS value to the static app. Inline scripts remain blocked. Inline styles are permitted because Expo web injects its reset and font-face styles at runtime, and React/map controls use data-driven inline styles. The `connect-src` policy includes `places.googleapis.com` for Places API (New) search, in addition to the Google Maps JavaScript API, map asset hosts, and API/Supabase hosts. Update the policy's API/Supabase host allowlist and CORS origin if the production domains change.