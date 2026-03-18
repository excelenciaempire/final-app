import { Platform } from 'react-native';

// ── RevenueCat API keys — set in Render / EAS env vars ────────────────────────
// iOS:     appl_...   (from RevenueCat dashboard → iOS app)
// Android: goog_...   (from RevenueCat dashboard → Android app)
// Web:     rcb_...    (from RevenueCat dashboard → Web app, requires Stripe connected)
const RC_API_KEY_IOS     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     || '';
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';
const RC_API_KEY_WEB     = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY     || '';

// Entitlement identifier — must match RevenueCat dashboard exactly
const RC_ENTITLEMENT_PRO = 'Spediak  Pro'; // double space is intentional

// ── Load SDK on ALL platforms ──────────────────────────────────────────────────
// react-native-purchases detects Platform.OS === 'web' automatically and
// delegates to @revenuecat/purchases-js (web SDK) under the hood.
let Purchases: any    = null;
let LOG_LEVEL: any    = null;
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = null;

try {
  const rcModule = require('react-native-purchases');
  Purchases  = rcModule.default;
  LOG_LEVEL  = rcModule.LOG_LEVEL;
} catch {
  console.warn('[PaymentService] react-native-purchases not available');
}

try {
  const rcUIModule = require('react-native-purchases-ui');
  RevenueCatUI   = rcUIModule.default;
  PAYWALL_RESULT = rcUIModule.PAYWALL_RESULT;
} catch {
  console.warn('[PaymentService] react-native-purchases-ui not available');
}

export type PlanId = 'pro' | 'platinum';

// ─────────────────────────────────────────────────────────────────────────────
// initializePayments — call once at app startup (App.tsx)
// Works on iOS, Android, and Web (browser mode via purchases-js)
// ─────────────────────────────────────────────────────────────────────────────
export function initializePayments(): void {
  if (!Purchases) return;

  try {
    // Verbose logging on native only (web SDK has its own logging)
    if (Platform.OS !== 'web' && LOG_LEVEL) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    const apiKey =
      Platform.OS === 'ios'     ? RC_API_KEY_IOS     :
      Platform.OS === 'android' ? RC_API_KEY_ANDROID :
                                  RC_API_KEY_WEB;

    if (!apiKey) {
      console.warn('[PaymentService] RevenueCat API key not set for platform:', Platform.OS);
      return;
    }

    Purchases.configure({ apiKey });
    console.log('[PaymentService] RevenueCat initialized for', Platform.OS);
  } catch (error) {
    console.error('[PaymentService] Failed to initialize RevenueCat:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// loginToRevenueCat — link the signed-in Clerk user ID to RevenueCat
// Call after user signs in so purchases are tied to their account on all platforms
// ─────────────────────────────────────────────────────────────────────────────
export async function loginToRevenueCat(clerkUserId: string): Promise<void> {
  if (!Purchases) return;

  try {
    await Purchases.logIn(clerkUserId);
    console.log('[PaymentService] RevenueCat logIn:', clerkUserId);
  } catch (error) {
    console.error('[PaymentService] RevenueCat logIn error:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// logoutFromRevenueCat — call when user signs out
// ─────────────────────────────────────────────────────────────────────────────
export async function logoutFromRevenueCat(): Promise<void> {
  if (!Purchases) return;

  try {
    await Purchases.logOut();
    console.log('[PaymentService] RevenueCat logOut');
  } catch (error) {
    // logOut throws if already anonymous — safe to ignore
    console.warn('[PaymentService] RevenueCat logOut:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// purchaseSubscription — present RevenueCat paywall on all platforms
// iOS/Android: native IAP paywall
// Web: RevenueCat web paywall (powered by Stripe, configured in RC dashboard)
// ─────────────────────────────────────────────────────────────────────────────
export async function purchaseSubscription(
  _planId: PlanId,
  _getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  return presentPaywall();
}

async function presentPaywall(): Promise<{ success: boolean; error?: string }> {
  if (!RevenueCatUI || !PAYWALL_RESULT) {
    return { success: false, error: 'Paywall not available' };
  }

  try {
    const result = await RevenueCatUI.presentPaywall();

    switch (result) {
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
    console.error('[PaymentService] Paywall error:', error);
    return { success: false, error: error.message || 'Purchase failed' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// hasProEntitlement — check active subscription (all platforms)
// ─────────────────────────────────────────────────────────────────────────────
export async function hasProEntitlement(): Promise<boolean> {
  if (!Purchases) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[RC_ENTITLEMENT_PRO] !== 'undefined';
  } catch (e) {
    console.error('[PaymentService] Error fetching customer info:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// restorePurchases — all platforms
// ─────────────────────────────────────────────────────────────────────────────
export async function restorePurchases(): Promise<{ success: boolean; error?: string }> {
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
