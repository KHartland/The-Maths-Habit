import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Capacitor } from '@capacitor/core';

// Platform detection helper — hide Google and use native Apple Sign In on iOS
const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// Stagger delay helper — each element gets a progressively later start
const staggerStyle = (index) => ({
  animationDelay: `${index * 80}ms`,
});

const AuthModal = ({ isOpen, onClose, initialMode = 'signin' }) => {
  const [mode, setMode] = useState(initialMode); // 'signin', 'signup', 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation state: triggers re-stagger when mode changes
  const [animKey, setAnimKey] = useState(0);

  const { signIn, signUp, signInWithGoogle, signInWithApple, resetPassword } = useAuth();

  // Re-trigger stagger animation when switching modes
  const switchMode = useCallback((newMode) => {
    setMode(newMode);
    setError('');
    setMessage('');
    setAnimKey((k) => k + 1);
  }, []);

  // Also re-trigger when modal opens
  useEffect(() => {
    if (isOpen) {
      setAnimKey((k) => k + 1);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onClose();
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, displayName);
        if (error) throw error;
        setMessage('Check your email to confirm your account!');
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setMessage('Password reset email sent!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await signInWithApple();
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Running stagger index — increments per visible element
  let i = 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 auth-overlay-enter">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative auth-card-enter">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header — stagger item */}
        <div key={`header-${animKey}`} className="text-center mb-6 auth-stagger-item" style={staggerStyle(i++)}>
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create account'}
            {mode === 'reset' && 'Reset password'}
          </h2>
          <p className="text-gray-500 mt-1">
            {mode === 'signin' && 'Sign in to sync your progress'}
            {mode === 'signup' && 'Start your GCSE revision journey'}
            {mode === 'reset' && "We'll send you a reset link"}
          </p>
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm auth-stagger-item" style={staggerStyle(0)}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm auth-stagger-item" style={staggerStyle(0)}>
            {message}
          </div>
        )}

        {/* Social Sign-In Buttons */}
        {mode !== 'reset' && (
          <>
            {/* Sign in with Apple — stagger item */}
            <div key={`apple-${animKey}`} className="auth-stagger-item" style={staggerStyle(i++)}>
              <button
                onClick={handleAppleSignIn}
                disabled={loading}
                className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mb-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Continue with Apple
              </button>
            </div>

            {/* Google Sign In — stagger item */}
            {!isNativeIOS() && (
              <div key={`google-${animKey}`} className="auth-stagger-item" style={staggerStyle(i++)}>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
              </div>
            )}

            {/* Divider — stagger item */}
            <div key={`divider-${animKey}`} className="auth-stagger-item" style={staggerStyle(i++)}>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or {mode === 'signup' ? 'create account' : 'sign in'} with email</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div key={`name-${animKey}`} className="auth-stagger-item" style={staggerStyle(i++)}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div key={`email-${animKey}`} className="auth-stagger-item" style={staggerStyle(i++)}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div key={`pass-${animKey}`} className="auth-stagger-item" style={staggerStyle(i++)}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          {/* Submit button — always last in the stagger */}
          <div key={`btn-${animKey}`} className="auth-stagger-item" style={staggerStyle(i++)}>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                <>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'reset' && 'Send Reset Link'}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Mode switcher — last stagger item */}
        <div key={`switch-${animKey}`} className="mt-6 text-center text-sm auth-stagger-item" style={staggerStyle(i++)}>
          {mode === 'signin' && (
            <>
              <button
                onClick={() => switchMode('reset')}
                className="text-blue-600 hover:underline"
              >
                Forgot password?
              </button>
              <span className="mx-2 text-gray-400">•</span>
              <button
                onClick={() => switchMode('signup')}
                className="text-blue-600 hover:underline"
              >
                Create account
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button
              onClick={() => switchMode('signin')}
              className="text-blue-600 hover:underline"
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === 'reset' && (
            <button
              onClick={() => switchMode('signin')}
              className="text-blue-600 hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
