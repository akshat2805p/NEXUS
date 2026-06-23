# Nexus: Android APK Build Guide

Follow these steps to build Nexus into a standalone Android APK.

## Prerequisites
1. **Node.js** installed (v18+)
2. **Android Studio** installed (with SDK API 33+)
3. **Java JDK** 17

## Step 1: Install Dependencies & Build Frontend
Open your terminal in the root `Nexus` folder:
```bash
# Install root dependencies
npm install

# Navigate to frontend and build the production bundle
cd frontend
npm run build
cd ..
```

## Step 2: Add Capacitor Android Platform
If you haven't added the Android platform yet, run:
```bash
npx cap add android
```
*Note: This creates an `android` folder in your project containing the native Android project.*

## Step 3: Sync Web Assets to Android
Every time you run `npm run build` in the frontend, you must sync the new files into the Android project:
```bash
npx cap sync android
```

## Step 4: Build the APK
Open the Android project in Android Studio:
```bash
npx cap open android
```

1. Wait for Gradle to finish syncing (watch the bottom status bar).
2. Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)** in the top menu.
3. Once finished, a popup will appear in the bottom right corner. Click **locate**.
4. You will find your `app-debug.apk` in `android/app/build/outputs/apk/debug/`.

**You can now transfer this APK to your phone and install it!**

---

> **Note on Backend Connection**: By default, the app will try to connect to the backend URL specified in your frontend environment variables. If you are testing locally on your phone, ensure your computer and phone are on the same Wi-Fi network, and use your computer's local IP address (e.g. `http://192.168.1.5:8080`) instead of `localhost` when the app connects.
