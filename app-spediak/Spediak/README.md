# Spediak App - Build & Deployment Guide

## Local Development

### Prerequisites

- Node.js installed
- Expo Go app on your phone
- Phone and computer on the same Wi-Fi network

### Install Dependencies

```bash
cd app-spediak/Spediak
npm install
```

### Run the App

```bash
npx expo start
```

If the connection times out, try tunnel mode:

```bash
npx expo start --tunnel
```

To clear cache:

```bash
npx expo start --clear
```

---

## App Store Submission (iOS)

### 1. Set Up EAS Build

```bash
npm install -g eas-cli
eas login
eas build:configure
```

EAS CLI and `eas.json` are already configured for this project. These steps are only needed for a fresh setup.

### 2. Verify `app.config.js`

Ensure the following are correct in `app.config.js`:

- **`extra.eas.projectId`** — Must be set. Run `eas init` if missing.
- **`version`** — Increment before each new App Store submission.
- **`ios.bundleIdentifier`** — Must match what's registered in your Apple Developer account.

### 3. Build for Production

```bash
eas build --profile production --platform ios
```

This builds a signed `.ipa` in the cloud. EAS will prompt you to set up your Apple credentials (signing certificates, provisioning profiles) — it handles most of this automatically.

### 4. Submit to App Store Connect

```bash
eas submit --platform ios
```

This uploads the build to App Store Connect / TestFlight.

### 5. Complete Setup in App Store Connect

Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) and complete the following:

1. **TestFlight** — Test internally first with your team.
2. **App Information** — Fill in app name, category, description, and keywords.
3. **Screenshots** — Upload required screenshots for each device size.
4. **Privacy Policy URL** — Required. Must be a publicly accessible link.
5. **App Review Information** — Provide demo credentials if your app requires login.
6. **Submit for Review** — Apple typically reviews within 24-48 hours.

### Quick Reference

```
npm install → test locally → eas build → eas submit → App Store Connect → Submit for Review
```
