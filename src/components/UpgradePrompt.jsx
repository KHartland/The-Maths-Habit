import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { redirectToCheckout, STRIPE_PRICES } from '../lib/stripe';

function PromoCodeSection({ onSuccess }) {
  const [showInput, setShowInput] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { redeemPromoCode } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    const result = await redeemPromoCode(code);
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
    } else {
      setSuccess(result.message);
      setTimeout(() => onSuccess(), 1500);
    }
  };

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="text-purple-500 hover:text-purple-700 text-sm transition-colors"
      >
        Have a class code? Enter it here
      </button>
    );
  }

  return (
    <div className="text-left">
      {error && <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
      {success && <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. MATHS2026"
          className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase tracking-wider text-sm"
          disabled={isLoading || !!success}
        />
        <button
          type="submit"
          disabled={isLoading || !code.trim() || !!success}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '...' : 'Apply'}
        </button>
      </form>
    </div>
  );
}

const UpgradePrompt = ({ isOpen, onClose, onSignUp }) => {
  const { user, questionsRemaining, FREE_DAILY_LIMIT, dailyQuestionsUsed } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const remaining = questionsRemaining();
  const isLimitReached = remaining <= 0;

  const handleUpgrade = async () => {
    if (!user) {
      onSignUp();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const priceId = selectedPlan === 'monthly'
        ? STRIPE_PRICES.MONTHLY
        : STRIPE_PRICES.YEARLY;

      await redirectToCheckout({
        priceId,
        userId: user.id,
        userEmail: user.email,
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Unable to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          disabled={isLoading}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center pt-4">
          {isLimitReached ? (
            <>
              {/* Limit reached */}
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Daily limit reached
              </h2>
              <p className="text-gray-500 mb-6">
                You've used all {FREE_DAILY_LIMIT} free questions for today.
                Upgrade to continue practicing!
              </p>
            </>
          ) : (
            <>
              {/* Questions running low */}
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Unlock unlimited practice
              </h2>
              <p className="text-gray-500 mb-6">
                You have <span className="font-semibold text-blue-600">{remaining} questions</span> left today.
                Upgrade for unlimited access!
              </p>
            </>
          )}

          {/* Pricing cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setSelectedPlan('monthly')}
              disabled={isLoading}
              className={`border-2 rounded-xl p-4 text-left transition-all ${
                selectedPlan === 'monthly'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="text-sm text-gray-500 mb-1">Monthly</div>
              <div className="text-2xl font-bold text-gray-900">£3.99</div>
              <div className="text-xs text-gray-400">/month</div>
            </button>
            <button
              onClick={() => setSelectedPlan('yearly')}
              disabled={isLoading}
              className={`border-2 rounded-xl p-4 text-left relative transition-all ${
                selectedPlan === 'yearly'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="absolute -top-2 right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                Save 37%
              </div>
              <div className="text-sm text-gray-500 mb-1">Yearly</div>
              <div className="text-2xl font-bold text-gray-900">£29.99</div>
              <div className="text-xs text-gray-400">/year</div>
            </button>
          </div>

          {/* Features */}
          <div className="text-left mb-6 space-y-2">
            {[
              'Unlimited daily questions',
              'Unlimited battles',
              'Handwriting input',
              'All 700+ GCSE questions',
              'AI-powered explanations',
              'Weekly parent progress summary',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* CTA Buttons */}
          {user ? (
            <button
              onClick={handleUpgrade}
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                `Upgrade Now - ${selectedPlan === 'monthly' ? '£3.99/mo' : '£29.99/yr'}`
              )}
            </button>
          ) : (
            <>
              <button
                onClick={onSignUp}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity mb-3"
              >
                Create Account & Upgrade
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
              >
                {isLimitReached ? 'Come back tomorrow' : 'Maybe later'}
              </button>
            </>
          )}

          {/* Promo code option */}
          {user && (
            <div className="mt-4 text-center">
              <PromoCodeSection onSuccess={() => window.location.reload()} />
            </div>
          )}

          {/* Secure payment badge */}
          <p className="mt-4 text-xs text-gray-400 flex items-center justify-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure payment via Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
