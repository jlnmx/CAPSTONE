# HANDA Command Center

The administrator web app uses React and Vite. It has a desktop-first operations shell, responsive navigation, and a dedicated administrator sign-in. The resident and responder experience remains in the Expo mobile app.

The web app and mobile app use the same HANDA backend accounts and role checks. Administrator sign-in is accepted only in the Command Center.

From the repository root:

```bash
npm install
npm run admin:web
```

Create a production build with `npm run admin:build`. Set `VITE_API_URL` to the reachable HANDA API origin when it is not `http://localhost:8000`.