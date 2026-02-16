# Profile Picture Implementation Plan

## Overview
Allow paid subscribers to upload a profile picture that appears on the school leaderboard and in 1v1 battles. Free users keep the current initial-based avatar.

## Steps

### 1. Database: Add `avatar_url` column to profiles
- Add `avatar_url text` column to `public.profiles`
- SQL: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;`
- User runs this in Supabase SQL Editor

### 2. Supabase Storage: Create `avatars` bucket
- User creates a public bucket called `avatars` in Supabase Dashboard → Storage
- Add RLS policy: authenticated users can upload to their own folder (`{user_id}/avatar.webp`)
- Add RLS policy: anyone can read (public bucket)

### 3. Create `src/lib/avatarService.js`
- `uploadAvatar(userId, file)` — compresses image client-side using Canvas (max 256x256, WebP format, <100KB), uploads via raw fetch to Supabase Storage API (`/storage/v1/object/avatars/{userId}/avatar.webp`)
- `getAvatarUrl(userId)` — returns the public URL for a user's avatar
- `deleteAvatar(userId)` — removes the avatar file
- Uses raw fetch (not supabase.storage) to stay consistent with the project pattern

### 4. Settings page: Add avatar upload UI (subscriber-only)
- In the "Account" section of SettingsPage, add an avatar preview + "Change Photo" button
- Only shown when `isSubscribed` is true
- File picker accepts image/* (jpg, png, webp)
- Client-side compression before upload
- Shows loading state during upload
- Updates `profiles.avatar_url` via restFetch after successful upload
- Option to remove avatar (reverts to initials)

### 5. Update leaderboard RPC to return `avatar_url`
- Modify the `get_school_leaderboard` SQL function to also return `avatar_url` from profiles
- User runs updated SQL in Supabase
- Update `leaderboardService.js` to include `avatarUrl` in the returned data

### 6. Update SchoolLeaderboard.jsx
- If `entry.avatarUrl` exists, show `<img>` instead of the initial circle
- Keep initial circle as fallback
- Same rank-based border colors for top 3

### 7. Update OneVsOne.jsx
- Show avatar images for host/guest if available
- Fall back to initials if no avatar
- Both ready screen and results screen

### 8. Update match creation to include avatar
- When creating/joining a match, pass the user's avatar_url so it's available in the match data
- Add `host_avatar` and `guest_avatar` columns to matches table (or read from profiles)

## Files Changed
- `src/lib/avatarService.js` (NEW)
- `src/lib/leaderboardService.js` (add avatarUrl to response)
- `src/components/SchoolLeaderboard.jsx` (render avatar image)
- `src/components/OneVsOne.jsx` (render avatar image)
- `src/App.jsx` (settings page avatar upload UI)

## SQL Changes (user runs in Supabase)
- `ALTER TABLE profiles ADD COLUMN avatar_url text`
- Update `get_school_leaderboard` RPC to return avatar_url
- Storage bucket + RLS policies
