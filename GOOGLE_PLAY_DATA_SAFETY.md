# Google Play Data Safety Form — The Maths Habit

Use these answers when filling in the Data Safety section on Google Play Console.

---

## Does your app collect or share any of the required user data types?
**Yes**

## Is all of the user data collected by your app encrypted in transit?
**Yes** (all connections use HTTPS)

## Do you provide a way for users to request that their data is deleted?
**Yes** (contact email + in-app Settings page)

---

## Data Types Collected

### 1. Personal info — Email address
- **Collected**: Yes
- **Shared**: No
- **Ephemeral**: No
- **Required**: No (app works without sign-in)
- **Purpose**: Account management

### 2. Personal info — Name
- **Collected**: Yes
- **Shared**: No
- **Ephemeral**: No
- **Required**: No
- **Purpose**: Account management, shown on leaderboard

### 3. Personal info — Profile picture (via Google Sign-In)
- **Collected**: Yes
- **Shared**: No
- **Ephemeral**: No
- **Required**: No
- **Purpose**: Account management (avatar display)

### 4. App activity — In-app search history
- **Collected**: No

### 5. App activity — Other user-generated content
- **Collected**: Yes (practice answers, scores, streaks, mastery levels)
- **Shared**: No
- **Ephemeral**: No
- **Required**: Yes (core functionality)
- **Purpose**: App functionality

### 6. App info and performance — Crash logs
- **Collected**: Yes (via Sentry, when configured)
- **Shared**: No
- **Ephemeral**: Yes
- **Purpose**: Analytics (app stability)

---

## Data Types NOT Collected
- Location
- Financial info
- Health and fitness
- Messages
- Photos or videos
- Audio files
- Files and docs
- Calendar
- Contacts
- Device or other IDs (beyond what Supabase auth generates)
- Web browsing history

---

## Notes for the form
- **Target audience**: includes children (14-16, GCSE students)
- **Ads**: No — the app does not show ads
- **Data shared with third parties**: No
- **Privacy policy URL**: https://the-maths-habit-clrx.vercel.app/privacy-policy.html
