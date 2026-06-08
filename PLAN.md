# Dexterpreter 1.0.0 Release Roadmap

Dexterpreter is the release identity for the local/offline transcription and
translation app. Version 1.0.0 supports Spanish audio to Spanish transcript to
English translation.

## Release Identity

- Product name: Dexterpreter
- Package ID: `io.github.westkitty.dexterpreter`
- NPM package: `dexterpreter-client`
- Version: `1.0.0`
- Tag: `v1.0.0`
- Short description: Offline audio transcription and translation. No cloud. No
  nonsense.

## Source Of Truth

- Active web app: `frontend/`
- Active Android project: `frontend/android/`
- Release artifacts: `dist/release/`
- README media: `docs/images/readme/`
- Branding source: `assets/branding/`

Generated root-level Android and iOS trees are not release sources.

## Validation Gates

Run from `frontend/` unless noted:

```bash
npm install
npm run build
npm run test
npm run eval:gate || true
npx cap sync android
cd android
./gradlew clean assembleRelease || ./gradlew clean assembleDebug
```

`eval:gate` is not accuracy validation until non-demo reference fixtures are
present and scored in the aggregate.

## Signing Hygiene

Release signing must use local environment variables:

- `DEXTERPRETER_RELEASE_STORE_FILE`
- `DEXTERPRETER_RELEASE_STORE_PASSWORD`
- `DEXTERPRETER_RELEASE_KEY_ALIAS`
- `DEXTERPRETER_RELEASE_KEY_PASSWORD`

No keystores or signing secrets belong in the repository.

## Remaining Manual Release Steps

1. Rename the GitHub repository if desired.
2. Publish tag `v1.0.0`.
3. Upload the prepared APK and SHA-256 checksum file to the GitHub release.
4. Capture a real device demo if the synthetic storyboard is not enough.
