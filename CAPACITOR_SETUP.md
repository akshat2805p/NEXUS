# Nexus - Mobile App Setup with Capacitor

This guide explains how to build Nexus as an iOS or Android app using Apache Capacitor.

## Prerequisites

- Node.js 16+ and npm
- For iOS: Xcode 14+, CocoaPods
- For Android: Android Studio 4.2+, JDK 11+

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
npm install @capacitor/core @capacitor/cli
```

### 2. Build for Web

```bash
npm run build
```

### 3. Initialize Capacitor (First time only)

```bash
npx cap init
```

When prompted:
- **App name**: Nexus
- **App package ID**: com.nexus.fintech

### 4. Add Platforms

#### For iOS:
```bash
npm run cap:add:ios
npm run cap:sync:ios
```

#### For Android:
```bash
npm run cap:add:android
npm run cap:sync:android
```

### 5. Open in IDE

#### For iOS:
```bash
npm run cap:open:ios
```
Then build and run from Xcode.

#### For Android:
```bash
npm run cap:open:android
```
Then build and run from Android Studio.

## Building APK (Android)

### Debug APK:
```bash
# In Android Studio, go to Build → Build Bundle(s)/APK(s) → Build APK(s)
```

### Release APK:
```bash
# Generate signed APK following Android documentation
# https://developer.android.com/studio/publish/app-signing
```

## Building IPA (iOS)

1. Open the iOS project in Xcode: `npm run cap:open:ios`
2. Set signing certificates
3. Archive via Product → Archive
4. Distribute via App Store Connect

## Development

### Live Reload (Hot Reload)
```bash
# In one terminal, run the dev server:
npm run dev

# In another terminal (inside ios or android folder):
# iOS: npx cap run ios --liveReload --external
# Android: npx cap run android --liveReload --external
```

## App Features

- **Chat & Messaging** - Real-time communication with WebSocket
- **Biometric Auth** - Fingerprint/Face ID/Windows Hello
- **Fintech Integration** - Integrated financial transaction system
- **Offline Support** - Works offline with sync when back online
- **Push Notifications** - Using Capacitor plugins
- **Camera Access** - For photo uploads in chats
- **Geolocation** - Optional location sharing

## Troubleshooting

### iOS Build Issues
- Clear cache: `rm -rf ios/Pods && rm -rf ios/Podfile.lock`
- Update CocoaPods: `pod repo update`

### Android Build Issues
- Clean build: `./gradlew clean`
- Update SDK: Run Android Studio SDK Manager

### Web-to-Native Bridge Issues
- Check console: `adb logcat | grep chromium` (Android)
- Use Safari Web Inspector (iOS)

## Capacitor Plugins Used

- **App** - App lifecycle management
- **Camera** - Photo/video capture
- **Geolocation** - Location services
- **Network** - Network status
- **Device** - Device information
- **Filesystem** - File system access
- **NativeAudio** - Play notification sounds
- **StatusBar** - Status bar styling
- **Keyboard** - Keyboard management

## Next Steps

1. Customize app icons and splash screens
2. Set up push notifications
3. Configure deep linking
4. Add crash reporting (Sentry)
5. Submit to App Store & Google Play
