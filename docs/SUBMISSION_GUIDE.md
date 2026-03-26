# App Store Submission Guide — The Maths Habit

## Part A: Google Play Store

### Step 1: Generate Upload Keystore (one-time, on your Mac)

```bash
cd ~/The-Maths-Habit

keytool -genkeypair \
  -v \
  -storetype JKS \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -alias themathshabit \
  -keystore themathshabit-upload.keystore \
  -dname "CN=Karra Hartland, O=The Maths Habit, L=London, C=GB"
```

**IMPORTANT**: Back up `themathshabit-upload.keystore` somewhere safe (cloud storage, USB). If you lose it, you cannot update your app.

### Step 2: Add signing properties

Create/edit `android/gradle.properties` and add:

```properties
RELEASE_STORE_FILE=../../themathshabit-upload.keystore
RELEASE_STORE_PASSWORD=YOUR_STORE_PASSWORD
RELEASE_KEY_ALIAS=themathshabit
RELEASE_KEY_PASSWORD=YOUR_KEY_PASSWORD
```

**Do NOT commit this file to git.** Add it to `.gitignore`.

### Step 3: Build Release AAB

```bash
cd The-Maths-Habit
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

The AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

### Step 4: Google Play Console Setup

1. Go to https://play.google.com/console
2. Create a new app:
   - App name: **The Maths Habit**
   - Default language: **English (United Kingdom)**
   - App or game: **App**
   - Free or paid: **Free**
3. Fill in store listing using `store-listing.md`:
   - Short description (80 chars)
   - Full description
   - Feature graphic: upload `public/icons/feature-graphic.png` (1024×500)
   - App icon: upload `public/icons/icon-512.png`
   - Screenshots: you'll need phone screenshots (min 2)
4. Fill in Content Rating questionnaire (IARC) — answer: no violence, no sexual content, education app
5. Fill in Data Safety using `GOOGLE_PLAY_DATA_SAFETY.md`
6. Set Target Audience: **Ages 14-16** (select appropriate age range)
7. Set up App Signing: opt into Google Play App Signing (recommended)
8. Upload AAB to Production track (or Internal Testing first)

### Step 5: Taking Screenshots

Easiest approach — use Android Studio emulator:
1. Open project in Android Studio
2. Run on a Pixel 7 emulator (1080×2400)
3. Navigate to each screen and use the camera icon in emulator toolbar
4. You need minimum 2 screenshots, recommend 5:
   - Practice question screen
   - Dashboard/streaks
   - Topic selection
   - Leaderboard
   - Settings/accessibility

---

## Part B: Apple App Store

### Step 1: Apple Developer Account

You need an Apple Developer account ($99/year): https://developer.apple.com/programs/

### Step 2: Xcode Setup

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the **App** target
3. Under **Signing & Capabilities**:
   - Check "Automatically manage signing"
   - Select your Team (your Apple Developer account)
   - Bundle Identifier should be: `uk.co.themathshabit.app`
4. Under **General**:
   - Version: `1.0.0`
   - Build: `1`

### Step 3: Build for App Store

1. Select **Any iOS Device** as build target (not a simulator)
2. Product → Archive
3. When archive completes, click **Distribute App**
4. Select **App Store Connect**
5. Upload

### Step 4: App Store Connect Setup

1. Go to https://appstoreconnect.apple.com
2. Create a new app:
   - Platform: iOS
   - Name: The Maths Habit
   - Bundle ID: uk.co.themathshabit.app
   - SKU: themathshabit001
   - Primary Language: English (UK)
3. Fill in metadata using `APPLE_APP_STORE_METADATA.md`
4. Upload screenshots (use Simulator):
   - iPhone 6.7" (iPhone 15 Pro Max): 1290 × 2796
   - iPhone 6.5" (iPhone 11 Pro Max): 1242 × 2688
5. Fill in App Privacy section using values in `APPLE_APP_STORE_METADATA.md`
6. Submit for Review

### Step 5: App Review Notes

Include in the review notes:
> This is an educational app for GCSE students (ages 14-16). The app can be used without signing in for basic practice. Google Sign-In enables cloud sync and leaderboard features. The app targets the UK AQA GCSE Maths specification.

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Google rejects for target audience | Make sure Data Safety says no ads, and privacy policy mentions children |
| Apple rejects for missing purpose strings | Check Info.plist has all usage descriptions for permissions used |
| Build fails on iOS | Run `npx cap sync ios` then clean build in Xcode (Cmd+Shift+K) |
| Screenshots wrong size | Use exact device simulators listed above |
| App crashes on launch | Check Supabase env vars are set in the web build |
