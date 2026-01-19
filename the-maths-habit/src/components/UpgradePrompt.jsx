import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const UpgradePrompt = ({ isOpen, onClose, onSignUp }) => {
  const { user, questionsRemaining, FREE_DAILY_LIMIT, dailyQuestionsUsed } = useAuth();

  if (!isOpen) return null;

  const remaining = questionsRemaining();
  const isLimitReached = remaining <= 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
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
            <div className="border-2 border-gray-200 rounded-xl p-4 text-left">
              <div className="text-sm text-gray-500 mb-1">Monthly</div>
              <div className="text-2xl font-bold">£3.99</div>
              <div className="text-xs text-gray-400">/month</div>
            </div>
            <div className="border-2 border-blue-500 rounded-xl p-4 text-left relative bg-blue-50">
              <div className="absolute -top-2 right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                Save 37%
              </div>
              <div className="text-sm text-gray-500 mb-1">Yearly</div>
              <div className="text-2xl font-bold">£29.99</div>
              <div className="text-xs text-gray-400">/year</div>
            </div>
          </div>

          {/* Features */}
          <div className="text-left mb-6 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Unlimited daily questions
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Sync progress across devices
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              All 700+ GCSE questions
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              AI-powered explanations
            </div>
          </div>

          {/* CTA Buttons */}
          {user ? (
            <button
              onClick={() => {
                // TODO: Redirect to Stripe checkout
                alert('Stripe checkout coming soon!');
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Upgrade Now
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
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
