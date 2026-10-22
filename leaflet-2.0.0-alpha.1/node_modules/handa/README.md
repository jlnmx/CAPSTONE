# HANDA — Offline-First Disaster Evacuation & Field Operations Management

An offline-first resident and responder mobile app, paired with a separate browser-based HANDA Command Center for administrators.

**Tagline:** "Ready When Connectivity Isn't."

## 📋 Project Status

The HANDA system includes:
- ✅ Splash Screen
- ✅ Role-specific sign-in backed by the HANDA API
- ✅ Responder Dashboard
- ✅ Resident Dashboard
- ✅ Role-aware navigation
- ✅ Reusable component architecture
- ✅ Professional UI with emergency-response design
- ✅ SQLite local database and offline outbox
- ✅ FastAPI + PostgreSQL/PostGIS backend scaffold
- ✅ Separate desktop-first Admin Command Center web app

**Coming Next:**
- Real GPS tracking with expo-location
- Evacuation center management
- Incident reporting module
- Advanced mapping with real-time data
- Push notifications
- Mobile-to-API synchronization worker

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ and npm
- **Android Studio** with the Android SDK (for Android) or **Xcode** (for iOS simulator)
- A Java JDK for Android builds (Android Studio's bundled JDK is suitable)
- An Android device or simulator for testing

### Installation

1. **Navigate to the project directory:**

   ```bash
   cd "F:\Py code\Capstone\CAPSTONE\HANDA"
   ```

2. **Install dependencies:**

   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start the development server:**

   ```bash
   npx expo start
   ```

4. **Run on Android:**

   - Use `npx expo run:android` to build and run the native app on a connected
     Android device or emulator.
   - For the USB steps to install and use a debug APK on a phone, see
     [Install a Development APK on an Android Phone](#install-a-development-apk-on-an-android-phone)

5. **Run on iOS (macOS only):**

   - Press `i` in the terminal

### Install a Development APK on an Android Phone

A debug APK is a native development build, not an Expo Go app. It needs the
Metro development server running on your computer to load the JavaScript
bundle. Keep the phone connected by USB while developing.

#### Requirements

- Node.js and npm dependencies installed in `HANDA/`
- Java and the Android SDK installed
- Android USB debugging enabled on the phone
- `HANDA/android/local.properties` configured with your Android SDK path if
  Gradle cannot find the SDK

#### Build the debug APK

From a PowerShell terminal:

```powershell
Set-Location "F:\Py code\Capstone\CAPSTONE\HANDA"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
Set-Content ".\android\local.properties" "sdk.dir=$($sdk -replace '\\','/')"
$env:NODE_ENV = "production"
Set-Location ".\android"
.\gradlew.bat assembleDebug
```

The `local.properties` command assumes Android Studio's default Windows SDK
location. If your SDK is elsewhere, set `$sdk` to that folder instead. This
machine-specific file is ignored by Git.

The APK is created at:

```text
HANDA\android\app\build\outputs\apk\debug\app-debug.apk
```

#### Install or update the APK over USB

Connect and unlock the phone, enable USB debugging, and accept the
authorization prompt if Android displays one. From a PowerShell terminal in
the `HANDA/` directory:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb install -r ".\android\app\build\outputs\apk\debug\app-debug.apk"
& $adb reverse tcp:8081 tcp:8081
```

`adb devices` should show the phone as `device`. If it shows `unauthorized`,
unlock the phone and accept the USB debugging prompt, then run `adb devices`
again. The `-r` option updates an existing install while preserving app data.
If Android rejects the update because its signing key differs, uninstall the
existing app from the phone and run the install command again; uninstalling
will clear that app's data.

#### Start Metro and open the app

In another PowerShell terminal, start Metro from `HANDA/` and leave it running:

```powershell
Set-Location "F:\Py code\Capstone\CAPSTONE\HANDA"
npx expo start --localhost
```

Open or reload HANDA on the phone. If Metro is already running, use its
terminal to reload the app. If you add or update a package with native Android
code, rebuild the APK and reinstall it before testing; JavaScript-only changes
can be picked up by Metro without reinstalling.

### Admin Command Center

The administrator console runs as its own web app and is not part of the resident/responder mobile navigation. From the project root:

```bash
npm run admin:web
```

To create a production web export:

```bash
npm run admin:build
```

The mobile app and Admin Command Center use the same backend accounts and role verification. Administrators sign in at the Command Center; residents and responders sign in through the mobile app. Set `VITE_API_URL` for the Admin web app when the API is not available at `http://localhost:8000`.

## 🔐 Testing Authentication

### Responder Account

- **Email:** `responder@handa.local`
- **Password:** `responder123`
- **Dashboard:** Full responder features (evacuees, incidents, map, etc.)

### Resident Account

- **Email:** `resident@handa.local`
- **Password:** `resident123`
- **Dashboard:** Simplified resident view (evacuation centers, alerts, etc.)

### Administrator Account

- **Email:** `admin@handa.local`
- **Password:** `admin123`
- **Sign-in:** Admin Command Center web app (`npm run admin:web`)
- **Dashboard:** Command overview, analytics, access control, evacuation centers, and operations records

### Sign-in Boundaries

Resident and responder accounts use the mobile sign-in screen. Administrator access is restricted to the separate Command Center web app.

### Administrator Console

Administrators can manage authorized user accounts, responder access, evacuation center information, incidents, and evacuee records. The overview includes registration charts, incident status, center capacity, personnel counts, and attention queues.

## 📁 Project Structure

```
HANDA/
├── admin-web/                    # Standalone web app for the Command Center
├── app/                           # Expo Router screens and layouts
│   ├── _layout.tsx               # Root layout with AuthProvider
│   ├── index.tsx                 # Splash screen
│   ├── (auth)/                   # Auth stack
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   ├── (responder)/              # Responder app stack
│   │   ├── _layout.tsx           # Bottom tab navigation
│   │   ├── index.tsx             # Dashboard (Home)
│   │   ├── evacuees.tsx          # Placeholder
│   │   ├── incidents.tsx         # Placeholder
│   │   ├── map.tsx               # Placeholder
│   │   └── more.tsx              # Placeholder
│   └── (resident)/               # Resident app stack
│       ├── _layout.tsx           # Bottom tab navigation
│       ├── index.tsx             # Dashboard (Home)
│       ├── map.tsx               # Placeholder
│       ├── report.tsx            # Placeholder
│       ├── alerts.tsx            # Placeholder
│       └── more.tsx              # Placeholder
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── HandaLogo.tsx
│   │   ├── Buttons.tsx
│   │   ├── TextInputs.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ScreenHeader.tsx
│   │   └── index.ts
│   ├── constants/                # Colors, spacing, typography
│   │   ├── colors.ts
│   │   └── index.ts
│   ├── services/                 # Business logic
│   │   ├── authService.ts        # Mock authentication
│   │   └── index.ts
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.tsx           # Auth context and provider
│   │   └── index.ts
│   ├── types/                    # TypeScript interfaces
│   │   └── index.ts
│   ├── data/                     # Mock data
│   │   ├── mockData.ts
│   │   └── index.ts
│   └── utils/                    # Utility functions (future)
├── assets/                       # Images, icons, fonts
│   └── fonts/
├── app.json                      # Expo configuration
├── backend/                      # FastAPI service
│   ├── app/                      # API, schemas, and database connection
│   ├── requirements.txt
│   └── Dockerfile
├── database/
│   └── init.sql                  # PostgreSQL/PostGIS schema
├── docker-compose.yml             # Local API + PostGIS stack
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript configuration
├── .babelrc                      # Babel configuration
├── .gitignore
└── README.md                     # This file
```

## 🎨 Design System

### Color Palette

- **Primary:** `#0B3A63` (Dark Navy Blue)
- **Secondary:** `#1769AA` (Secondary Blue)
- **Emergency:** `#D62828` (Emergency Red)
- **Success:** `#2E8B57` (Green)
- **Warning:** `#F4A261` (Amber/Orange)
- **Background:** `#F5F7FA` (Light Gray)
- **Text:** `#17212B` (Dark)
- **Text Muted:** `#667085` (Muted Gray)

### Components

All reusable components are in `src/components/`:

- **HandaLogo** — App branding
- **PrimaryButton** — Main action buttons
- **SecondaryButton** — Alternative actions
- **LinkButton** — Text link buttons
- **IconButton** — Icon with text and description
- **TextInput** — Standard text input
- **PasswordInput** — Password field with visibility toggle
- **StatusBadge** — Online/offline/sync status
- **ConnectivityStatus** — Network connectivity indicator
- **StatCard** — Statistics display
- **ActivityItem** — Recent activity list item
- **ScreenHeader** — Screen title with icons
- **EmptyState** — Placeholder for coming-soon screens
- **Card** — Reusable card component

## 🔄 Navigation Flow

```
Splash Screen (2.5s)
    ↓
Login Screen
    ├─ Valid Credentials / Demo User
    │   ├─ Responder Role → (responder) Stack
    │   │   ├─ Home Dashboard ✅
    │   │   ├─ Evacuees (Placeholder)
    │   │   ├─ Incidents (Placeholder)
    │   │   ├─ Map (Placeholder)
    │   │   └─ More (Placeholder)
    │   └─ Resident Role → (resident) Stack
    │       ├─ Home Dashboard ✅
    │       ├─ Map (Placeholder)
    │       ├─ Report (Placeholder)
    │       ├─ Alerts (Placeholder)
    │       └─ More (Placeholder)
    └─ Invalid Credentials → Error message
```

## 🔑 Key Features (Current Release)

### Splash Screen
- HANDA logo and tagline
- Loading indicator
- 2.5-second auto-navigation to login

### Login Screen
- Email/username and password inputs
- Password visibility toggle
- Error message display
- "Forgot Password?" link (future implementation)
- Demo user option for quick testing
- Test credentials reference

### Responder Dashboard
- Connectivity status indicator
- Active disaster card (emergency red)
- Statistics: evacuees, incidents, centers, pending sync
- Quick action buttons (Register Evacuee, Report Incident, View Map, Evacuation Centers)
- Recent activity feed with sync status
- Bottom tab navigation
- Logout functionality

### Resident Dashboard
- Connectivity status indicator
- Welcome message
- Active alert card
- Nearby evacuation centers with capacity indicators
- Important emergency information
- Bottom tab navigation
- Logout functionality

## 🔧 Development

### Add a New Component

1. Create a new `.tsx` file in `src/components/`
2. Export it from `src/components/index.ts`
3. Import and use in your screens

Example:

```typescript
// src/components/MyComponent.tsx
import { StyleSheet, View, Text } from 'react-native';
import { Colors, Spacing } from '@constants/colors';

export function MyComponent() {
  return (
    <View style={styles.container}>
      <Text>My Component</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
});
```

### Add a New Screen

1. Create a new `.tsx` file in `app/(role)/`
2. If it's a new major section, create a new folder with `_layout.tsx` and screen files
3. Update the navigation in `app/_layout.tsx` and role layouts

### Modify Authentication

- **Mock users:** Edit `src/services/authService.ts`
- **Auth context:** Edit `src/hooks/useAuth.tsx`
- **Credentials:** Edit `src/data/mockData.ts` if needed

## 📦 Dependencies

### Core
- `expo` — React Native framework
- `react-native` — Mobile UI framework
- `react` — React library
- `expo-router` — File-based routing
- `@react-native-async-storage/async-storage` — Local data storage

### Database & Location (Future)
- `expo-sqlite` — Offline database
- `expo-location` — GPS tracking

### UI & Styling
- `react-native-screens` — Screen component optimization
- `react-native-safe-area-context` — Safe area handling
- `react-native-gesture-handler` — Gesture recognition
- `react-native-reanimated` — Animation library
- `react-native-vector-icons` — Icon library (optional)

### Development
- `typescript` — Type safety
- `@types/react-native` — React Native types
- `eslint` — Code linting
- `jest` — Testing framework

## 🧪 Testing

Currently, manual testing is the primary method:

1. Login with responder credentials to test the responder dashboard
2. Logout and login with resident credentials to test the resident dashboard
3. Use demo login buttons for quick testing
4. Test navigation between tabs
5. Test offline/online status toggle (mock)

**Note:** Full test suite will be added in future releases.

## 📋 Offline-First Architecture

The app is designed to support:

```
Offline Mode:
User Input → Mobile UI ↔ SQLite (Local Database) → Sync Queue

Online Mode:
SQLite (Local) → Sync Queue → FastAPI Backend → PostgreSQL/PostGIS
```

The mobile SQLite database and outbox are implemented. Incident reports and evacuee registrations are written locally first, then posted to `/api/v1/sync` when the device is online. The app retries the queue on startup, when returning to the foreground, and when network connectivity is restored; accepted rows are marked as synced only after the server acknowledges them.

### Start the backend locally

From `c:\Codes\HANDA`:

```powershell
docker compose up --build
```

- API: `http://localhost:8000`
- Health check: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`
- PostgreSQL/PostGIS: `localhost:5432`, database `handa`, user `handa`

See [backend/README.md](backend/README.md) for the sync contract.

## 🚀 Next Steps

1. **Integrate expo-location** for GPS tracking
2. **Build evacuee management module** (full CRUD operations)
3. **Build incident reporting module** with photo/video capture
4. **Implement real map view** with evacuation centers and routes
5. **Implement push notifications** for emergency alerts
6. **Add role-based access control** (RBAC)
7. **Create admin web dashboard** for supervision

## 📝 Notes

- This is a **demonstration/capstone project**, not production-ready software
- All authentication is mocked using local data
- The mobile app syncs queued records automatically when connectivity is restored
- GPS, maps, and synchronization are placeholders
- This app is designed for Android devices; iOS support is available but not actively tested

## 📄 License

This project is part of a capstone initiative for Biñan City, Laguna.

## 👨‍💻 Development Tips

### Common Errors

**Error: `Cannot find module '@components/...'`**
- Check that the path alias in `tsconfig.json` matches your imports
- Verify the file exists in the correct directory

**Error: `AuthProvider is not defined`**
- Make sure `AuthProvider` is imported at the top of `_layout.tsx`
- Verify the auth hook is properly exported

**Error: App crashes on startup**
- Check the Metro bundler output in the terminal
- Ensure all dependencies are installed: `npm install`
- Try clearing cache: `expo start --clear`

### Debugging

- Use React Native Debugger: `https://github.com/jhen0409/react-native-debugger`
- Use the Expo Dev Tools by shaking your device
- Check terminal output for detailed error messages
- Use `console.log()` liberally for debugging

### Performance Tips

- Use `React.memo()` for component memoization
- Implement lazy loading for large lists
- Optimize re-renders with proper dependency arrays
- Use FlatList for long lists instead of ScrollView with many items

## 📞 Support

For questions or issues during development, refer to:
- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Last Updated:** 2026-09-13
**Version:** 0.1.0
