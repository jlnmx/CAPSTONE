# HANDA Deployment

This repository deploys three services on Render and two separate frontend projects on Vercel. The resident/responder interface is an Expo web export for browser testing; these web deployments do not create Android or iOS binaries. To build a standalone Android APK for direct installation, see [Build an Installable APK with Expo EAS](README.md#build-an-installable-apk-with-expo-eas). iOS builds require macOS and Xcode.

## Render

Connect the `CAPSTONE` repository to Render and set the Blueprint file path to `HANDA/render.yaml`. The Blueprint's Docker and static-site paths are relative to the cloned repository root, while the npm commands use `--prefix HANDA`. It defines:

- `handa-api`: FastAPI Docker service, health check `/health/ready`.
- `handa-mobile-web`: Expo web export.
- `handa-admin-web`: Vite admin console.

The API uses the existing PostgreSQL database. During the initial Blueprint setup, provide `DATABASE_URL` from the database provider. For Supabase, use its Session pooler URL and preserve `sslmode=require`; see [backend/README.md](backend/README.md). Render generates `AUTH_SECRET` for the API.

The frontend services use `https://handa-api.onrender.com` as their API origin. If Render assigns a different service URL, update both frontend variables to that URL and redeploy:

- `EXPO_PUBLIC_API_URL` for the resident/responder web app.
- `EXPO_PUBLIC_MAPBOX_TOKEN` (optional) for Mapbox maps and directions. Without it, the app uses OpenStreetMap tiles and routing.
- `VITE_API_URL` for the admin web app.

`CORS_ORIGIN_REGEX` allows only the configured `handa-mobile-web` and `handa-admin-web` Vercel project domains and their Vercel preview variants, plus the corresponding Render sites. Keep the Vercel project names aligned with those prefixes. `CORS_ORIGINS` retains the local development origins.

## Vercel

Create two separate Vercel projects from the same Git repository. For both, set **Framework Preset** to **Other**, **Root Directory** to `HANDA`, and the install command to `npm ci`. Enable **Include source files outside of the Root Directory in the Build Step** because HANDA references the sibling `leaflet-2.0.0-alpha.1` package. The `HANDA/vercel.json` file provides history fallback for Expo's single-page export and the admin app's client-side routes.

**Resident/responder project**

- Project name: `handa-mobile-web`
- Build command: `npm run web:export`
- Output directory: `dist`
- Environment variable: `EXPO_PUBLIC_API_URL=https://handa-api.onrender.com`
- Optional environment variable: `EXPO_PUBLIC_MAPBOX_TOKEN=<restricted-public-mapbox-token>`
- The resident Weather screen uses the keyless Open-Meteo API (`https://api.open-meteo.com/v1/forecast`); no environment variable is required.

**Admin project**

- Project name: `handa-admin-web`
- Build command: `npm run admin:build`
- Output directory: `admin-web/dist`
- Environment variable: `VITE_API_URL=https://handa-api.onrender.com`

Set the API URL for both Preview and Production environments. If using Mapbox, set its optional token in both environments as well. Vite and Expo inline public values during the build, so redeploy after changing them. Restrict the Mapbox public token to the deployed site URLs in the Mapbox dashboard; never use a secret server token in a frontend build.

When no Mapbox token is configured, resident and responder maps use OpenStreetMap tiles and the public OpenStreetMap routing service for driving, cycling, and walking directions. The fallback route service receives the start and destination coordinates.

## Database and release checks

Use the existing database rather than creating a second database for these frontends. Make sure the configured database is reachable from Render and has the schema/migrations described in [backend/README.md](backend/README.md). After deployment, check:

- `https://handa-api.onrender.com/health/ready` returns a healthy response.
- Both frontends can load and sign in against the same API.
- Deep links such as `/account/profile` and admin routes still load after a browser refresh.

Build locally from `HANDA/` with `npm run web:export` and `npm run admin:build` before connecting the Git repository to the hosts.