module.exports = {
  "expo": {
    "name": "Spediak",
    "slug": "Spediak",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": false,
    "sdkVersion": "54.0.0",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.spediak.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "name": "Spediak",
      "shortName": "Spediak",
      "favicon": "./public/favicon.png",
      "bundler": "metro",
      "output": "static",
      "template": "./web-build/index.html"
    },
    "extra": {
      "clerkPublishableKey": process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      "apiUrl": process.env.EXPO_PUBLIC_API_URL,
      "eas": {
        "projectId": "your-project-id"
    }
    },
    "plugins": [
      "expo-router"
    ]
  }
};
