# Android Build And Signing

Dexterpreter builds from `frontend/android/`. Root-level generated platform
trees are stale duplicates and are not release sources.

## Debug APK

```bash
cd <repo>/frontend
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

## Unsigned Release APK

```bash
cd <repo>/frontend
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

If no signing environment variables are present, the release build is unsigned.

## Locally Signed Release APK

```bash
cd <repo>/frontend
export DEXTERPRETER_RELEASE_STORE_FILE=~/path/to/repo-private/release.keystore
export DEXTERPRETER_RELEASE_STORE_PASSWORD=...
export DEXTERPRETER_RELEASE_KEY_ALIAS=...
export DEXTERPRETER_RELEASE_KEY_PASSWORD=...
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

Do not commit keystores, passwords, aliases, or signing credentials.

## Release Packaging

```bash
mkdir -p <repo>/dist/release
cp <repo>/frontend/android/app/build/outputs/apk/release/*.apk \
  <repo>/dist/release/Dexterpreter-1.0.1-android-unsigned.apk
cd <repo>/dist/release
shasum -a 256 *.apk > Dexterpreter-1.0.1-SHA256SUMS.txt
```

If only a debug APK is available, name it
`Dexterpreter-1.0.1-android-debug.apk` and document that it is not a final
signed release.
