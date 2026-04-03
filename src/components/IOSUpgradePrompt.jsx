/**
 * IOSUpgradePrompt.jsx — Native iOS subscription purchase modal
 *
 * Uses iapService.js (cordova-plugin-purchase / StoreKit) instead of Stripe.
 * Prices are fetched live from Apple so they always match App Store Connect.
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getProducts, purchaseProduct, restorePurchases, PRODUCT_IDS } from '../lib/iapService';

export default function IOSUpgradePrompt({ isOpen, onClose, onSuccess }) {
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

  // Fetch live pricing from Apple whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      const p = getProducts();
      setProducts(p);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const monthlyProduct = products.find(p => p.id === PRODUCT_IDS.MONTHLY);
  const yearlyProduct  = products.find(p => p.id === PRODUCT_IDS.YEARLY);

  const monthlyPrice = monthlyProduct?.pricing?.price ?? '£2.99';
  const yearlyPrice  = yearlyProduct?.pricing?.price  ?? '£24.99';

  const handlePurchase = async () => {
    setIsLoading(true);
    setError(null);

    const productId = selectedPlan === 'monthly'
      ? PRODUCT_IDS.MONTHLY
      : PRODUCT_IDS.YEARLY;

    try {
      await purchaseProduct(productId);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('[IOSUpgrade] Purchase error:', err);
      setError(err.message || 'Purchase failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setError(null);
    try {
      await restorePurchases();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('[IOSUpgrade] Restore error:', err);
      setError('Could not restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#1a1140] to-[#0d0a1a] border border-violet/30 p-6 shadow-xl">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white">Unlock Premium</h2>
          <p className="text-secondary-text text-sm mt-1">Unlimited questions, every topic, all features</p>
        </div>

        {/* Features */}
        <div className="space-y-2 mb-6">
          {[
            'Unlimited daily questions',
            'All topics & difficulty levels',
            'Detailed worked solutions',
            'Progress tracking & insights',
            'Unlimited 1v1 challenges',
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-white/80">
              <span className="text-mint">✓</span>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Monthly */}
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`rounded-xl p-3 border text-left transition-all ${
              selectedPlan === 'monthly'
                ? 'border-mint bg-mint/10'
                : 'border-white/20 bg-white/5'
            }`}
          >
            <div className="text-xs text-secondary-text">Monthly</div>
            <div className="text-lg font-bold text-white">{monthlyPrice}</div>
            <div className="text-xs text-secondary-text">/month</div>
          </button>

          {/* Yearly */}
          <button
            onClick={() => setSelectedPlan('yearly')}
            className={`rounded-xl p-3 border text-left transition-all relative ${
              selectedPlan === 'yearly'
                ? 'border-mint bg-mint/10'
                : 'border-white/20 bg-white/5'
            }`}
          >
            <div className="absolute -top-2 right-2 bg-mint text-[#0d0a1a] text-[10px] font-bold px-2 py-0.5 rounded-full">
              BEST VALUE
            </div>
            <div className="text-xs text-secondary-text">Yearly</div>
            <div className="text-lg font-bold text-white">{yearlyPrice}</div>
            <div className="text-xs text-secondary-text">/year</div>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Subscribe button */}
        <button
          onClick={handlePurchase}
          disabled={isLoading || isRestoring}
          className="w-full py-3 btn-gradient-mint font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : (
            `Subscribe — ${selectedPlan === 'monthly' ? monthlyPrice + '/mo' : yearlyPrice + '/yr'}`
          )}
        </button>

        {/* Restore purchases */}
        <button
          onClick={handleRestore}
          disabled={isLoading || isRestoring}
          className="w-full mt-3 py-2 text-sm text-secondary-text hover:text-white transition-colors disabled:opacity-50"
        >
          {isRestoring ? 'Restoring...' : 'Restore previous purchase'}
        </button>

        {/* Legal text */}
        <p className="text-center text-[10px] text-white/30 mt-3">
          Payment charged to your Apple ID. Subscription auto-renews unless cancelled
          at least 24 hours before the end of the current period.
          Manage in Settings → Apple ID → Subscriptions.
        </p>
      </div>
    </div>
  );
}
