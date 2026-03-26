# Security Audit Report: The Maths Habit

**Date:** 10 March 2026
**Auditor:** Automated scan + manual review via Cowork
**App:** The Maths Habit (GCSE maths revision app)
**Users:** Students aged 14-16 (under-18 data handling applies)

---

## Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 3 | 2 | 1 |
| HIGH | 4 | 4 | 0 |
| MEDIUM | 3 | 2 | 1 |
| LOW | 3 | 1 | 2 |

**Total issues:** 13 found, 9 fixed, 4 require manual action.

**Evening 9 fixes:** Deleted sync-diagnostic.js (hardcoded creds), added DOMPurify for dangerouslySetInnerHTML, added display name length/whitespace validation, added CSP + security headers to vercel.json, cleaned up console.logs for production, deleted duplicate App 2.jsx.

---

## 1. Key Exposure Check

### Supabase Anon Key

| Check | Status |
|-------|--------|
| Anon key in environment variable | PASS |
| Anon key hardcoded as fallback | FIXED (removed from src/lib/supabase.js) |
| Anon key in sync-diagnostic.js | REMAINING (manual removal needed) |
| Service role key in frontend code | PASS (not found) |
| Service role key in server-side only | PASS (api/stripe-webhook.js uses it correctly) |

### Mathpix API Keys

| Check | Status |
|-------|--------|
| Keys in VITE_ env vars (frontend-exposed) | CRITICAL - REMAINING |
| Keys sent directly from browser to api.mathpix.com | CRITICAL - REMAINING |
| Keys visible in browser DevTools Network tab | CRITICAL - REMAINING |

**Required fix:** Create a Supabase Edge Function to proxy Mathpix calls. The frontend should call your Edge Function; the Edge Function calls Mathpix with the key stored as a Supabase secret.

### .gitignore

| Check | Status |
|-------|--------|
| .env listed | PASS |
| .env.local listed | PASS |
| .env.*.local listed | PASS |
| No .env files committed | PASS |

---

## 2. RLS (Row Level Security) Status

**Status:** NOT YET AUDITED FROM DATABASE

Run these queries in Supabase SQL Editor to check:

```sql
-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- List all existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';
```

**Expected:** Every table in the public schema should have `rowsecurity = true`. Any table with `false` is a critical security gap.

---

## 3. API Endpoint Security

### CORS Configuration

| Endpoint | Before | After |
|----------|--------|-------|
| api/create-checkout-session.js | Access-Control-Allow-Origin: * | FIXED: restricted to FRONTEND_URL |
| api/create-portal-session.js | Access-Control-Allow-Origin: * | FIXED: restricted to FRONTEND_URL |
| api/stripe-webhook.js | N/A (webhook) | PASS (Stripe signature verification present) |

### Rate Limiting

| Endpoint | Status |
|----------|--------|
| Supabase API calls | NO RATE LIMITING (needs implementation) |
| api/create-checkout-session.js | NO RATE LIMITING |
| api/create-portal-session.js | NO RATE LIMITING |
| Mathpix handwriting calls | NO RATE LIMITING |

---

## 4. Input Validation

| Check | Status |
|-------|--------|
| Display name sanitisation (profanity filter) | PASS (comprehensive filter in profanityFilter.js) |
| Display name length validation | MISSING (no max length enforced) |
| Display name whitespace validation | MISSING (could be all spaces) |
| dangerouslySetInnerHTML usage | HIGH RISK (App.jsx line 7548 - diagram rendering) |
| innerHTML assignment | HIGH RISK (App.jsx line 10755 - image error handler) |

---

## 5. Authentication Configuration

| Check | Status |
|-------|--------|
| Supabase Auth used | PASS |
| JWT tokens stored in localStorage | STANDARD (Supabase default) |
| Logout clears session | NEEDS VERIFICATION |
| Password requirements | NEEDS VERIFICATION (check Supabase dashboard) |
| Email confirmation | NEEDS VERIFICATION (check Supabase dashboard) |

---

## 6. Dependency Audit

| Metric | Result |
|--------|--------|
| npm audit vulnerabilities | 0 (4 fixed via npm audit fix) |
| Fixed: ajv ReDoS | RESOLVED |
| Fixed: minimatch ReDoS | RESOLVED |
| Fixed: qs denial of service | RESOLVED |
| Fixed: rollup path traversal | RESOLVED |
| Outdated packages | @supabase/supabase-js (2.91.1 -> 2.99.0), stripe (20.2.0 -> 20.4.1) |
| Package-lock.json committed | PASS |

---

## 7. GDPR / Under-18 Compliance

| Check | Status |
|-------|--------|
| Minimum data collection (email + display name) | PASS |
| No location data | PASS |
| No advertising identifiers | PASS |
| Account deletion / right to erasure | NEEDS IMPLEMENTATION |
| Privacy policy | NEEDS CREATION (Evening 6) |
| Parental consent flow for under-13s | NEEDS CONSIDERATION |
| Data retention policy | NEEDS DOCUMENTATION |

---

## 8. Error Tracking

| Tool | Status |
|------|--------|
| Sentry (@sentry/browser) | INSTALLED (needs DSN in env) |
| Sentry init in main.jsx | DONE |
| Test error function (window.__testSentry) | DONE |
| UptimeRobot | NOT YET SET UP (manual task) |

---

## 9. Mathpix API Security

| Check | Status |
|-------|--------|
| API keys in frontend bundle | CRITICAL - keys exposed via VITE_ prefix |
| Browser-to-Mathpix direct calls | CRITICAL - visible in DevTools |
| Console.log monitoring added | DONE |
| Server-side proxy (Edge Function) | NEEDS IMPLEMENTATION |
| Per-user rate limiting on handwriting | NEEDS IMPLEMENTATION |

---

## Remaining Actions (Manual)

### CRITICAL (do before app store submission)

1. **Route Mathpix through a Supabase Edge Function** - Create an Edge Function that holds the Mathpix key server-side. Frontend calls your Edge Function, which calls Mathpix. This prevents key theft.

2. **Remove hardcoded key from sync-diagnostic.js** - Delete the file or remove the credentials.

3. **Run the RLS audit SQL** in Supabase SQL Editor and fix any tables without RLS enabled.

4. **Rotate your Supabase anon key** - Go to Supabase Dashboard > Settings > API > Regenerate anon key. Update your .env and Vercel env vars.

### HIGH (do before app store submission)

5. **Replace dangerouslySetInnerHTML** in diagram rendering with React components or DOMPurify sanitisation.

6. **Add display name length/whitespace validation** on both frontend and backend.

7. **Set FRONTEND_URL in Vercel env vars** so CORS restriction works correctly.

### MEDIUM (do within 2 weeks of launch)

8. **Add rate limiting** on Supabase API calls using a db_pre_request hook.

9. **Add Content Security Policy headers** in vercel.json.

10. **Update Supabase client** from 2.91.1 to 2.99.0 (minor version, should be safe).

### LOW (do when convenient)

11. **Set up UptimeRobot** for www.themathshabit.co.uk and Supabase endpoint.

12. **Create a Sentry account** at sentry.io and add the DSN to your .env and Vercel env vars.

13. **Implement account deletion** (right to erasure) - add a "Delete my account" button in settings.

---

## Sentry Setup Instructions

1. Go to https://sentry.io and create a free account
2. Create a new project: select "JavaScript" as the platform, then "React"
3. Copy the DSN string (looks like https://xxx@xxx.ingest.sentry.io/xxx)
4. Add to your .env file: `VITE_SENTRY_DSN=your_dsn_here`
5. Add the same to Vercel Environment Variables
6. Deploy and test: open browser console and run `window.__testSentry()`
7. Check Sentry dashboard for the test error

## UptimeRobot Setup Instructions

1. Go to https://uptimerobot.com and create a free account
2. Add monitor: HTTP(s), URL: https://www.themathshabit.co.uk, interval: 5 min
3. Add monitor: HTTP(s), URL: your Supabase project URL, interval: 5 min
4. Add your email and phone for alerts
