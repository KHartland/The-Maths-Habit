---
name: maths-habit-project
description: "Project location and build context for The Maths Habit app. Use this skill whenever working on The Maths Habit codebase — building, debugging, updating, syncing Capacitor, generating AAB/IPA builds, or any development task. Also use when Claude needs to find or access the source code, or when the user says 'update the app', 'build the app', 'sync android', 'generate AAB', 'open the project', or references The Maths Habit source files. If the project folder isn't already mounted, this skill tells you where to find it."
---

# The Maths Habit — Project Location & Build Context

## Source code location

The Maths Habit source code lives in the user's home folder:

```
~/The-Maths-Habit
```

Full path: `/Users/karrahartland/The-Maths-Habit`

If this folder isn't already mounted in the session, use `request_cowork_directory` with path `~/The-Maths-Habit` to mount it before doing any work.

## Tech stack

- **Frontend**: React + Vite + Tailwind CSS
- **Mobile wrapper**: Capacitor 8.2.0 (iOS + Android)
- **Backend**: Supabase (auth, database)
- **Payments**: Stripe (hidden on iOS per Apple Guideline 3.1.1)
- **Error tracking**: Sentry
- **Deployment (web)**: Vercel at www.themathshabit.co.uk

## Android AAB build process

1. `npm run build` — build the web assets
2. `npx cap sync android` — sync web build into the Android project
3. Bump `versionCode` and `versionName` in `android/app/build.gradle`
4. `cd android && ./gradlew bundleRelease` — generate the signed AAB
5. Output: `android/app/build/outputs/bundle/release/app-release.aab`

Signing requires the release keystore (`themathshabit-upload.keystore`) and credentials in `android/gradle.properties`.

## iOS build process

iOS builds are done through Xcode. After `npx cap sync ios`, open the Xcode project and archive from there.

## Key config files

- `capacitor.config.ts` — app ID: `com.squareonemaths.app`
- `android/app/build.gradle` — Android version, SDK levels, signing config
- `package.json` — dependencies and web build scripts
- `ios/App/App.xcodeproj` — Xcode project

## Important notes

- Karra prefers using GitHub Desktop for git operations, not the terminal
- The web version deploys automatically via Vercel when changes are pushed to GitHub
- Android and iOS builds need to be done manually after web changes — they don't auto-deploy
