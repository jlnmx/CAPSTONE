# HANDA Command Center

The administrator web app uses React and Vite. It has a desktop-first operations shell, responsive navigation, and a dedicated administrator sign-in. The resident and responder experience remains in the Expo mobile app.

The web app and mobile app use the same HANDA backend accounts and role checks. Administrator sign-in is accepted only in the Command Center.

The **Dispatch** page sorts active responders by fresh live GPS distance to the selected incident. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the same public Supabase values used by the mobile app to enable live positions. Dispatch assignments and responder notifications are managed by the HANDA API.

From the repository root:

```bash
npm install
npm run admin:web
```

Create a production build with `npm run admin:build`. Set `VITE_API_URL` to the reachable HANDA API origin when it is not `http://localhost:8000`.

The Vercel deployment uses `vercel.json` to add a restrictive Content Security Policy, clickjacking and MIME-sniffing protections, and a same-origin CORS value to the static app. Update the policy's API/Supabase host allowlist and CORS origin if the production domains change.