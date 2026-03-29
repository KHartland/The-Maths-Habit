# Apple Sign-In Crash Fix — Step-by-Step Instructions

## Problem
After signing in with Apple, the app crashes with React Error #310 ("Objects are not valid as a React child"). This happens because Apple Sign-In can return `user_metadata.full_name` as an **object** (e.g. `{firstName: "Karra", familyName: "Hartland"}`) instead of a string. When this object is rendered in JSX, React crashes.

The Capacitor native shell then shows "Something went wrong / Refresh App" because there's no React-level error boundary to catch it.

## Files already created (ready to use)
- `src/components/ErrorBoundary.jsx` — top-level error boundary
- `src/lib/safeDisplayName.js` — safe string extraction helper

---

## EDIT 1: AuthContext.jsx — Await fetchProfile in getSession callback

**File:** `src/contexts/AuthContext.jsx`
**Around line 345** — find this code:

```js
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchDailyCount(session.user.id);
      }
      setLoading(false);
    });
```

**Replace with:**

```js
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
        await fetchDailyCount(session.user.id);
      }
      setLoading(false);
    });
```

The only changes are:
1. Add `async` before `({ data: { session } })`
2. Add `await` before `fetchProfile(...)`
3. Add `await` before `fetchDailyCount(...)`

---

## EDIT 2: App.jsx — Wrap app in ErrorBoundary

**File:** `src/App.jsx`

**Step A:** Add the import at the top of the file:

```js
import ErrorBoundary from './components/ErrorBoundary';
```

**Step B:** Find the main return statement (the outermost JSX). Wrap everything inside it with `<ErrorBoundary>`:

```jsx
return (
  <ErrorBoundary>
    {/* ...all existing JSX stays here unchanged... */}
  </ErrorBoundary>
);
```

---

## EDIT 3: OneVsOne.jsx (or wherever the 1v1 battle component lives) — Safe name extraction

**File:** `src/components/OneVsOne.jsx`

**Step A:** Add the import at the top:

```js
import { safeDisplayName } from '../lib/safeDisplayName';
```

**Step B:** Find the line that extracts the player name from user_metadata. It looks like:

```js
// Something like:
const playerName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Player';
```

**Replace with:**

```js
const playerName = safeDisplayName(user);
```

---

## EDIT 4: App.jsx — Safe avatar initial (profile section)

**File:** `src/App.jsx`

Search for any place that does something like:

```js
user?.user_metadata?.full_name?.[0]?.toUpperCase() || '?'
```

or:

```js
(user?.user_metadata?.full_name || user?.email)?.[0]?.toUpperCase()
```

**Add the import** (if not already added from Edit 2):

```js
import { safeInitial } from './lib/safeDisplayName';
```

**Replace** the full_name[0] expression with:

```js
safeInitial(user)
```

---

## Testing

After making these changes:
1. Run `npm run build` to check for errors
2. Test Apple Sign-In on the Vercel preview
3. The app should no longer crash after Apple auth redirect
4. If any other crash occurs, the ErrorBoundary will show a friendly recovery screen instead of the Capacitor native error page

---

## Why this works

- **safeDisplayName** always returns a string, even when Apple provides `full_name` as an object
- **await** in the getSession callback ensures profile data is loaded before rendering starts
- **ErrorBoundary** catches any remaining React crashes gracefully instead of letting the whole app die
