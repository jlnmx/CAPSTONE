# HANDA — Offline-First Disaster Evacuation & Field Operations Management

An offline-first mobile application for managing disaster evacuations and field operations in Barangay communities.

**Tagline:** "Ready When Connectivity Isn't."

## 📋 Project Status

This is the **initial foundation** of the HANDA system with:
- ✅ Splash Screen
- ✅ Login Screen with mock authentication
- ✅ Responder Dashboard
- ✅ Resident Dashboard
- ✅ Role-aware navigation
- ✅ Reusable component architecture
- ✅ Professional UI with emergency-response design

**Coming Next:**
- SQLite offline database integration
- Real GPS tracking with expo-location
- Evacuation center management
- Incident reporting module
- Advanced mapping with real-time data
- Data synchronization system
- Push notifications
- FastAPI backend integration

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ and npm
- **Expo CLI**: `npm install -g expo-cli`
- **Android Studio** (for Android emulator) or **Xcode** (for iOS simulator)
- An Android device or simulator for testing

### Installation

1. **Navigate to the project directory:**

   ```bash
   cd c:\Codes\HANDA
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npx expo start
   ```

4. **Run on Android:**

   - Press `a` in the terminal to launch Android emulator
   - Or scan the QR code with the Expo Go app on your physical Android device

5. **Run on iOS (macOS only):**

   - Press `i` in the terminal

## 🔐 Testing Authentication

### Responder Account

- **Email:** `responder@handa.local`
- **Password:** `responder123`
- **Dashboard:** Full responder features (evacuees, incidents, map, etc.)

### Resident Account

- **Email:** `resident@handa.local`
- **Password:** `resident123`
- **Dashboard:** Simplified resident view (evacuation centers, alerts, etc.)

### Demo Login

Both login screens include a "Continue as Demo User" button for quick testing without entering credentials.

## 📁 Project Structure

```
HANDA/
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

## 📋 Offline-First Architecture (Future)

The app is designed to support:

```
Offline Mode:
User Input → Mobile UI ↔ SQLite (Local Database) → Sync Queue

Online Mode:
SQLite (Local) → Sync Queue → FastAPI Backend → PostgreSQL/PostGIS
```

Currently, this infrastructure is **not implemented**, but the UI and navigation are ready for it.

## 🚀 Next Steps

1. **Implement SQLite database** for local data storage
2. **Integrate expo-location** for GPS tracking
3. **Build evacuee management module** (full CRUD operations)
4. **Build incident reporting module** with photo/video capture
5. **Implement real map view** with evacuation centers and routes
6. **Create data synchronization system** for offline→online sync
7. **Build FastAPI backend** for centralized data management
8. **Implement push notifications** for emergency alerts
9. **Add role-based access control** (RBAC)
10. **Create admin web dashboard** for supervision

## 📝 Notes

- This is a **demonstration/capstone project**, not production-ready software
- All authentication is mocked using local data
- No real backend is integrated yet
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
