# Apple App Store Submission Checklist — The Maths Habit

**Created:** 21 March 2026
**Status:** Pre-submission
**Timeline:** Can run in parallel with Google Play 14-day closed testing (ends ~4 April 2026)

---

## The Big Risk: Guideline 4.2

Apple's Guideline 4.2 (Minimum Functionality) rejects apps that are "repackaged websites." Since The Maths Habit is a Capacitor-wrapped web app, this is the most likely reason for rejection. The good news: your app already has genuine functionality (spaced repetition engine, offline capability, streaks, leaderboard) — it's not a brochure site. But you'll want to make it feel as native as possible.

### What helps pass Guideline 4.2

- **Push notifications** — remind students to do their daily practice (Capacitor has a push notifications plugin)
- **Offline mode working well** — the app should launch and function without a connection
- **Native splash screen and app icon** — not a web loading spinner
- **No visible browser chrome** — no URL bars, no "back to Safari" prompts
- **Smooth transitions** — avoid full-page reloads that look like web navigation
- **Haptic feedback** — small native touches (e.g., on correct/incorrect answers)

---

## Checklist

### Already Done (code + config)

- [x] Apple Developer account active
- [x] Capacitor project set up with iOS target
- [x] Bundle ID defined: `uk.co.themathshabit.app`
- [x] App Store metadata prepared (APPLE_APP_STORE_METADATA.md)
- [x] Store listing copy written (store-listing.md)
- [x] Privacy policy URL live
- [x] App review notes drafted (updated to highlight native features for Guideline 4.2)
- [x] Capacitor config updated with iOS-specific settings (iosScheme, splash screen, background colour)
- [x] Push notifications wired in — `initPushNotifications()` called on app startup
- [x] Haptic feedback wired in — correct/wrong answers + streak milestones
- [x] Local notifications — daily 6pm streak reminder scheduled
- [x] Info.plist has notification permissions and background modes
- [x] Service worker for offline caching
- [x] Splash screen asset exists in iOS project
- [x] Web app builds successfully with all changes

### On Your Mac: Build & Configure

**Step 1 — Clean the dist folder and rebuild:**
```bash
cd ~/The-Maths-Habit
rm -rf dist
npm run build
npx cap sync ios
npx cap open ios
```

**Step 2 — In Xcode, configure signing:**
- [ ] Open `ios/App/App.xcworkspace` (NOT .xcodeproj)
- [ ] Select the **App** target in the left sidebar
- [ ] Go to **Signing & Capabilities** tab
- [ ] Check **"Automatically manage signing"**
- [ ] Select your **Apple Developer Team** from the dropdown
- [ ] Verify Bundle Identifier is `uk.co.themathshabit.app`

**Step 3 — Set version numbers:**
- [ ] Go to **General** tab
- [ ] Set **Version** to `1.0.0`
- [ ] Set **Build** to `1`

**Step 4 — Test on Simulator:**
- [ ] Select **iPhone 15 Pro Max** simulator
- [ ] Press **Cmd+R** to build and run
- [ ] Verify the app launches with splash screen (not white screen)
- [ ] Verify the status bar looks correct
- [ ] Answer a question — you should feel haptic feedback on a real device
- [ ] Check push notification permission prompt appears

**Step 5 — Test on a real iPhone (recommended):**
- [ ] Connect your iPhone via USB
- [ ] Select it as the build target
- [ ] Run the app and test haptics, notifications, offline mode

### Build and Upload

```bash
# 1. Build the web app
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open in Xcode
npx cap open ios
```

Then in Xcode:
- [ ] Select **Any iOS Device (arm64)** as the build target
- [ ] **Product → Archive**
- [ ] When archive completes, click **Distribute App → App Store Connect → Upload**

### App Store Connect Setup

Go to https://appstoreconnect.apple.com

- [ ] **Create new app** — Platform: iOS, Name: The Maths Habit, Bundle ID: uk.co.themathshabit.app, SKU: themathshabit001
- [ ] **Fill in app information** — use values from APPLE_APP_STORE_METADATA.md
- [ ] **Set category** to Education
- [ ] **Set age rating** to 4+
- [ ] **Enter promotional text** (170 chars — can update without a new build)
- [ ] **Enter full description**
- [ ] **Enter keywords** (100 chars max, comma-separated)
- [ ] **Set support URL** and marketing URL
- [ ] **Fill in App Privacy section** (data linked to you, not linked to you, not collected)
- [ ] **Enter review contact info** (name, email, phone)
- [ ] **Add review notes** explaining the app is for GCSE students and works without sign-in

### Screenshots

Take these using the Xcode Simulator:

| Device | Resolution | Required? |
|--------|-----------|-----------|
| iPhone 6.7" (15 Pro Max) | 1290 × 2796 | Yes |
| iPhone 6.5" (11 Pro Max) | 1242 × 2688 | Yes |
| iPad Pro 12.9" | 2048 × 2732 | Only if supporting iPad |

Suggested screenshots (aim for 5):
- [ ] Practice question screen (answering a question)
- [ ] Dashboard with streak counter
- [ ] Topic selection screen
- [ ] Leaderboard
- [ ] Worked solution / hint view

**Tip:** You can reuse the visual style/framing from your Google Play screenshots — just re-capture at Apple's required sizes.

### Submit for Review

- [ ] Select your uploaded build
- [ ] Double-check all fields are filled in
- [ ] **Submit for Review**
- [ ] Apple typically reviews within 24-48 hours (can take up to a week)

---

## If Apple Rejects Under 4.2

Don't panic — this is common and fixable. The appeal/resubmission process looks like:

1. **Read the rejection reason carefully** — Apple usually gives specific feedback
2. **Add native features** — push notifications and haptics are the quickest wins
3. **Write a detailed reply** in the Resolution Centre explaining what your app does that a website can't (offline practice, spaced repetition scheduling, streak tracking, push reminders)
4. **Resubmit** — each review cycle takes 1-3 days

---

## Parallel Timeline

| Date | Google Play | Apple |
|------|-------------|-------|
| 21 Mar | Closed testing starts | Start iOS prep |
| 21 Mar – 4 Apr | 14-day waiting period | Build, test, upload, submit for review |
| ~4 Apr | Ready for production release | Hopefully approved (or in resubmission cycle) |

You can work on both stores simultaneously — no need to wait for Google Play to finish before starting Apple.
