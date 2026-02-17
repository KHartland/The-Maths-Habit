// Paste this in your browser console on the deployed app (while logged in)
// It will check if cloud sync is actually working

(async () => {
  const supabaseUrl = 'https://kxvtiqkmxhqwqckjikje.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4dnRpcWtteGhxd3Fja2ppa2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDcxMTEsImV4cCI6MjA4NDM4MzExMX0.AP5MvYUCHYZ5V-kmtCRrOyK0bHV2iqUbnGnVhXqpAeo';

  // 1. Check auth token
  let token;
  try {
    const raw = localStorage.getItem('sb-kxvtiqkmxhqwqckjikje-auth-token');
    if (raw) {
      const parsed = JSON.parse(raw);
      token = parsed?.access_token;
      console.log('✅ Auth token found');
      // Decode JWT to get user ID
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('   User ID:', payload.sub);
      console.log('   Expires:', new Date(payload.exp * 1000).toLocaleString());
      if (payload.exp * 1000 < Date.now()) {
        console.log('⚠️  TOKEN IS EXPIRED - this could be the issue!');
      }
    } else {
      console.log('❌ No auth token in localStorage');
      console.log('   This means cloud sync cannot authenticate.');
      return;
    }
  } catch (e) {
    console.log('❌ Error reading auth token:', e);
    return;
  }

  // 2. Check if localStorage has progress
  const localProgress = localStorage.getItem('maths-habit-progress');
  if (localProgress) {
    const parsed = JSON.parse(localProgress);
    const keys = Object.keys(parsed);
    console.log(`✅ Local progress: ${keys.length} objectives`);
  } else {
    console.log('❌ No local progress data');
  }

  // Helper fetch
  const check = async (table, label) => {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=5`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ ${label}: ${data.length} rows found (showing max 5)`);
        return data;
      } else {
        const body = await res.text();
        console.log(`❌ ${label}: HTTP ${res.status} - ${body.slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`❌ ${label}: ${e.message}`);
    }
    return null;
  };

  // 3. Check each table
  console.log('\n--- Checking Supabase tables ---');
  await check('user_progress', 'user_progress');
  await check('user_fsrs_cards', 'user_fsrs_cards');
  await check('user_streaks', 'user_streaks');
  await check('user_settings', 'user_settings');
  await check('daily_activity', 'daily_activity');

  // 4. Try a test write to user_progress
  console.log('\n--- Testing write ---');
  const payload = JSON.parse(atob(token.split('.')[1]));
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/user_progress`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: payload.sub,
        objective_code: '_SYNC_TEST_',
        quick_correct: 0,
      })
    });
    if (res.ok) {
      console.log('✅ Test write to user_progress succeeded');
      // Clean up test row
      await fetch(`${supabaseUrl}/rest/v1/user_progress?user_id=eq.${payload.sub}&objective_code=eq._SYNC_TEST_`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
        }
      });
      console.log('   (cleaned up test row)');
    } else {
      const body = await res.text();
      console.log(`❌ Test write failed: HTTP ${res.status} - ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.log(`❌ Test write error: ${e.message}`);
  }

  console.log('\n--- Done ---');
})();
