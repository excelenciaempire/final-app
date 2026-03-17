import { Platform } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../config/api';

// RevenueCat API key (same for iOS and Android in test mode)
const RC_API_KEY = 'test_bGkjpmqYvnNwpOUAEsWhnZnbHvC';

// Entitlement identifier — must match exactly what's in RevenueCat dashboard
const RC_ENTITLEMENT_PRO = 'Spediak  Pro'; // double space is intentional

// Native-only imports — guarded so web bundle doesn't break
let Purchases: any = null;
let LOG_LEVEL: any = null;
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = null;

if (Platform.OS !== 'web') {
  try {
    const rcModule = require('react-native-purchases');
    Purchases = rcModule.default;
    LOG_LEVEL = rcModule.LOG_LEVEL;
  } catch {
    console.warn('[PaymentService] react-native-purchases not available');
  }

  try {
    const rcUIModule = require('react-native-purchases-ui');
    RevenueCatUI = rcUIModule.default;
    PAYWALL_RESULT = rcUIModule.PAYWALL_RESULT;
  } catch {
    console.warn('[PaymentService] react-native-purchases-ui not available');
  }
}

export type PlanId = 'pro' | 'platinum';

/**
 * Initialize RevenueCat on native platforms.
 * Call once at app startup in App.tsx.
 */
export function initializePayments(): void {
  if (Platform.OS === 'web' || !Purchases) return;

  try {
    if (LOG_LEVEL) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: RC_API_KEY });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: RC_API_KEY });
    }

    console.log('[PaymentService] RevenueCat initialized');
  } catch (error) {
    console.error('[PaymentService] Failed to initialize RevenueCat:', error);
  }
}

/**
 * Check if the user has an active Pro entitlement (native only).
 */
export async function hasProEntitlement(): Promise<boolean> {
  if (Platform.OS === 'web' || !Purchases) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[RC_ENTITLEMENT_PRO] !== 'undefined';
  } catch (e) {
    console.error('[PaymentService] Error fetching customer info:', e);
    return false;
  }
}

/**
 * Purchase a subscription plan.
 * - Web: creates a Stripe Checkout session and redirects
 * - Native: shows RevenueCat native paywall UI
 */
export async function purchaseSubscription(
  planId: PlanId,
  getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    return purchaseWeb(planId, getToken);
  }
  return presentNativePaywall();
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

    window.location.href = url;
    return { success: true };
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || 'Failed to start checkout';
    console.error('[PaymentService] Web purchase error:', msg);
    return { success: false, error: msg };
  }
}

async function presentNativePaywall(): Promise<{ success: boolean; error?: string }> {
  if (!RevenueCatUI || !PAYWALL_RESULT) {
    return { success: false, error: 'Paywall UI not available on this platform' };
  }

  try {
    const result = await RevenueCatUI.presentPaywall();

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return { success: true };
      case PAYWALL_RESULT.CANCELLED:
        return { success: false, error: 'Purchase cancelled' };
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      default:
        return { success: false, error: 'Paywall could not be presented. Check RevenueCat dashboard configuration.' };
    }
  } catch (error: any) {
    console.error('[PaymentService] Native paywall error:', error);
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

/**
 * Restore purchases (native only).
 */
export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'To manage your subscription on web, visit your account settings.' };
  }

  if (!Purchases) {
    return { success: false, error: 'In-app purchases not available' };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPro = typeof customerInfo.entitlements.active[RC_ENTITLEMENT_PRO] !== 'undefined';
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
