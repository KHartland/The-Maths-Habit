import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyQuestionsUsed, setDailyQuestionsUsed] = useState(0);

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

  // Increment daily question count
  const incrementDailyQuestions = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    // Update in Supabase
    const { data, error } = await supabase
      .from('daily_activity')
      .upsert({
        user_id: user.id,
        date: today,
        questions_answered: dailyQuestionsUsed + 1
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (!error) {
      setDailyQuestionsUsed(data.questions_answered);
    }
  };

  // Fetch user profile
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);
    }
    return data;
  };

  // Fetch today's question count
  const fetchDailyCount = async (userId) => {
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('daily_activity')
      .select('questions_answered')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (data) {
      setDailyQuestionsUsed(data.questions_answered);
    } else {
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

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
      setDailyQuestionsUsed(0);
    }
    return { error };
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

  // Listen for auth changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchDailyCount(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
          await fetchDailyCount(session.user.id);
        } else {
          setProfile(null);
          setDailyQuestionsUsed(0);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updateProfile,
    canPractice,
    questionsRemaining,
    incrementDailyQuestions,
    dailyQuestionsUsed,
    FREE_DAILY_LIMIT,
    isSubscribed: profile?.subscription_status === 'active'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
