# Binary-free Android folder notes

This repository intentionally excludes binary assets (PNG launcher/splash files and `gradle-wrapper.jar`) so PR systems that reject binary diffs can accept changes.

## How to restore a fully buildable Android project locally

1. Recreate Android resources from Capacitor defaults:
   - `npx cap sync android`
2. Regenerate launcher/splash assets (Android Studio Image Asset / Splash tooling) if needed.
3. Restore Gradle wrapper JAR:
   - `cd android && gradle wrapper`
   - or run from Android Studio which will regenerate wrapper files.

## Included native functionality

Even without binary resources committed, native source/config changes remain in the repo:
- `AmbientDreamService` screensaver service.
- TV launcher + dream service + location/network permissions in `AndroidManifest.xml`.
- MainActivity geolocation WebChromeClient handling.
