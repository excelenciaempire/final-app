import { Platform } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../config/api';

// Native-only import — guarded so web bundle doesn't break
let Purchases: any = null;
if (Platform.OS !== 'web') {
  try {
    Purchases = require('react-native-purchases').default;
  } catch {
    console.warn('[PaymentService] react-native-purchases not available');
  }
}

export type PlanId = 'pro' | 'platinum';

// RevenueCat product IDs (must match what you configure in the RC dashboard)
const RC_PRODUCT_IDS: Record<PlanId, string> = {
  pro: 'spediak_pro_monthly',
  platinum: 'spediak_platinum_monthly',
};

/**
 * Initialize RevenueCat on native platforms.
 * Call this once at app startup (e.g. in App.tsx).
 */
export async function initializePayments(): Promise<void> {
  if (Platform.OS === 'web' || !Purchases) return;

  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  if (!key) {
    console.warn('[PaymentService] RevenueCat API key not configured');
    return;
  }

  try {
    Purchases.configure({ apiKey: key });
    console.log('[PaymentService] RevenueCat initialized');
  } catch (error) {
    console.error('[PaymentService] Failed to initialize RevenueCat:', error);
  }
}

/**
 * Purchase a subscription plan.
 * - Web: creates a Stripe Checkout session and redirects
 * - Native: triggers RevenueCat purchase flow
 */
export async function purchaseSubscription(
  planId: PlanId,
  getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    return purchaseWeb(planId, getToken);
  }
  return purchaseNative(planId);
}

async function purchaseWeb(
  planId: PlanId,
  getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    const response = await axios.post(
      `${BASE_URL}/api/payments/create-checkout-session`,
      { planId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { url } = response.data;
    if (!url) return { success: false, error: 'No checkout URL returned' };

    // Redirect to Stripe Checkout
    window.location.href = url;
    return { success: true };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || 'Failed to start checkout';
    console.error('[PaymentService] Web purchase error:', msg);
    return { success: false, error: msg };
  }
}

async function purchaseNative(planId: PlanId): Promise<{ success: boolean; error?: string }> {
  if (!Purchases) {
    return { success: false, error: 'In-app purchases not available on this platform' };
  }

  try {
    const productId = RC_PRODUCT_IDS[planId];
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;

    if (!offering) {
      return { success: false, error: 'No offerings available' };
    }

    const pkg = offering.availablePackages.find(
      (p: any) => p.product.identifier === productId
    );

    if (!pkg) {
      return { success: false, error: `Product ${productId} not found` };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    console.log('[PaymentService] Native purchase complete:', customerInfo.activeSubscriptions);
    return { success: true };
  } catch (error: any) {
    if (error.userCancelled) {
      return { success: false, error: 'Purchase cancelled' };
    }
    console.error('[PaymentService] Native purchase error:', error);
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

/**
 * Restore purchases (native only).
 * On web, redirect to Stripe customer portal.
 */
export async function restorePurchases(
  getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    // Could redirect to Stripe billing portal — for now just inform user
    return { success: false, error: 'To manage your subscription on web, visit your account settings.' };
  }

  if (!Purchases) {
    return { success: false, error: 'In-app purchases not available' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPro = Object.keys(customerInfo.entitlements.active).length > 0;
    return { success: hasPro };
  } catch (error: any) {
    return { success: false, error: error.message || 'Restore failed' };
  }
}

/**
 * Get subscription status from backend.
 */
export async function getSubscriptionStatus(
  getToken: () => Promise<string | null>
): Promise<any> {
  try {
    const token = await getToken();
    if (!token) return null;

    const response = await axios.get(`${BASE_URL}/api/payments/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error('[PaymentService] Error fetching subscription status:', error);
    return null;
  }
}
