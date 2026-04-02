import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { Capacitor, registerPlugin } from '@capacitor/core';
// Custom native Apple Sign In plugin (AppleSignInPlugin.swift in Xcode project)
const AppleSignIn = registerPlugin('AppleSignIn');

const AuthContext = createContext({});
// Deep-sanitize any metadata object so no nested objects can crash React rendering.
// Apple Sign-In returns full_name as {firstName, familyName}, and other providers
// may return unexpected nested objects. This converts them all to strings.
const sanitizeObj = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !(val instanceof Array) && !(val instanceof Date)) {
      // Convert nested object to "value1 value2" string
      const vals = Object.values(val).filter(v => typeof v === 'string' && v.trim());
      obj[key] = vals.length > 0 ? vals.join(' ') : String(val);
    }
  }
};

const sanitizeUser = (user) => {
  if (!user) return null;
  // Sanitize every metadata bag on the user object
  if (user.user_metadata) sanitizeObj(user.user_metadata);
  if (user.app_metadata) sanitizeObj(user.app_metadata);
  return user;
};


// Helper: get auth token from localStorage
const getAuthToken = () => {
  try {
    const raw = localStorage.getItem('sb-kxvtiqkmxhqwqckjikje-auth-token');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed.access_token;
    }
  } catch (e) {}
  return supabaseAnonKey;
};

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuestionsUsed, setDailyQuestionsUsed] = useState(0);
  const signingOutRef = useRef(false);

  const FREE_DAILY_LIMIT = 5;

  // Check if user can practice (has subscription or under free limit)
  const canPractice = () => {
    if (!user) return true; // Not logged in, use localStorage
    if (profile?.subscription_status === 'active') return true;
    return dailyQuestionsUsed < FREE_DAILY_LIMIT;
  };

  const questionsRemaining = () => {
    if (!user) return Infinity;
    if (profile?.subscription_status === 'active') return Infinity;
    return Math.max(0, FREE_DAILY_LIMIT - dailyQuestionsUsed);
  };

  // Increment daily question count (raw fetch — supabase.from() hangs)
  const incrementDailyQuestions = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const newCount = dailyQuestionsUsed + 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${supabaseUrl}/rest/v1/daily_activity?on_conflict=user_id,date`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            user_id: user.id,
            date: today,
            questions_answered: newCount,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          setDailyQuestionsUsed(rows[0].questions_answered);
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('incrementDailyQuestions error:', err);
    }
  };

  // Fetch user profile (raw fetch — supabase.from() hangs)
  const fetchProfile = async (userId) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.pgrst.object+json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        return data;
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('fetchProfile error:', err);
    }
    return null;
  };

  // Fetch today's question count (raw fetch — supabase.from() hangs)
  const fetchDailyCount = async (userId) => {
    const today = new Date().toISOString().split('T')[0];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${supabaseUrl}/rest/v1/daily_activity?user_id=eq.${userId}&date=eq.${today}&select=questions_answered`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          setDailyQuestionsUsed(rows[0].questions_answered);
        } else {
          setDailyQuestionsUsed(0);
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('fetchDailyCount error:', err);
      setDailyQuestionsUsed(0);
    }
  };

  // Sign up with email
  const signUp = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    });
    return { data, error };
  };

  // Sign in with email
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    return { data, error };
  };

  // Sign in with Apple — native on iOS, OAuth redirect on web
  const signInWithApple = async () => {
    try {
      // On native iOS: use the native Apple Sign In dialog
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        const result = await AppleSignIn.authorize();

        if (result?.response?.identityToken) {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: result.response.identityToken,
            nonce: result.response.nonce || undefined,
          });
          return { data, error };
        } else {
          return { data: null, error: new Error('No identity token received from Apple') };
        }
      }

      // On web: use the existing OAuth redirect flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });
      return { data, error };
    } catch (error) {
      // User cancelled the native dialog — not a real error
      if (error?.message?.includes('cancel') || error?.code === '1001') {
        return { data: null, error: null };
      }
      return { data: null, error };
    }
  };

  // Sign out
  const signOut = async () => {
    // Block the auth listener from re-setting the user
    signingOutRef.current = true;
    // Clear local state immediately
    setUser(null);
    setProfile(null);
    setDailyQuestionsUsed(0);
    // Clear auth token from localStorage
    try {
      const storageKey = `sb-kxvtiqkmxhqwqckjikje-auth-token`;
      localStorage.removeItem(storageKey);
    } catch {}
    // Try to sign out on server (with timeout so it doesn't hang)
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      await Promise.race([supabase.auth.signOut(), timeout]);
    } catch {}
    signingOutRef.current = false;
    return { error: null };
  };

  // Reset password
  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { data, error };
  };

  // Update profile
  const updateProfile = async (updates) => {
    if (!user) return { error: 'Not logged in' };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data);
    }
    return { data, error };
  };

  // Redeem a promo code for free premium
  const redeemPromoCode = async (code) => {
    if (!user) return { error: { message: 'You must be logged in to redeem a code' } };

    // Check if the code exists and is valid
    const { data: promoCode, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (fetchError || !promoCode) {
      return { error: { message: 'Invalid promo code' } };
    }

    // Check if code is still active
