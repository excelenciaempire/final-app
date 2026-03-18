import { Platform } from 'react-native';

// ── RevenueCat API key (same for iOS and Android) ────────────────────────────
const RC_API_KEY = 'test_bGkjpmqYvnNwpOUAEsWhnZnbHvC';

// Entitlement identifier — must match RevenueCat dashboard exactly
const RC_ENTITLEMENT_PRO = 'Spediak  Pro'; // double space is intentional

// ── Native-only SDK (react-native-purchases) ─────────────────────────────────
let Purchases: any    = null;
let LOG_LEVEL: any    = null;
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
    RevenueCatUI  = rcUIModule.default;
    PAYWALL_RESULT = rcUIModule.PAYWALL_RESULT;
  } catch {
    console.warn('[PaymentService] react-native-purchases-ui not available');
  }
}

export type PlanId = 'pro' | 'platinum';

// ─────────────────────────────────────────────────────────────────────────────
// initializePayments — call once at app startup (App.tsx)
// Native only; no-op on web
// ─────────────────────────────────────────────────────────────────────────────
export function initializePayments(): void {
  if (Platform.OS === 'web' || !Purchases) return;

  try {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

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

// ─────────────────────────────────────────────────────────────────────────────
// purchaseSubscription — present RevenueCat paywall on native
// Web: not supported via RevenueCat native SDK — inform user
// ─────────────────────────────────────────────────────────────────────────────
export async function purchaseSubscription(
  _planId: PlanId,
  _getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    // RevenueCat native SDK is not available on web.
    // Purchases are handled through the iOS/Android apps.
    if (typeof window !== 'undefined') {
      window.alert(
        'Subscriptions are managed through our mobile app.\n\nDownload Spediak on the App Store or Google Play to subscribe.'
      );
    }
    return { success: false, error: 'Use mobile app to subscribe' };
  }

  return presentNativePaywall();
}

// ─────────────────────────────────────────────────────────────────────────────
// presentNativePaywall — shows RevenueCat paywall UI
// ─────────────────────────────────────────────────────────────────────────────
async function presentNativePaywall(): Promise<{ success: boolean; error?: string }> {
  if (!RevenueCatUI || !PAYWALL_RESULT) {
    return { success: false, error: 'Paywall UI not available on this platform' };
  }

  try {
    const paywallResult: typeof PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return { success: true };
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
      default:
        return { success: false, error: 'Purchase cancelled' };
    }
  } catch (error: any) {
    console.error('[PaymentService] Native paywall error:', error);
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// hasProEntitlement — check active subscription (native only)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// restorePurchases — native only
// ─────────────────────────────────────────────────────────────────────────────
export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Restore purchases is available on the mobile app.' };
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
