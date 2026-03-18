import { Platform } from 'react-native';

// ── RevenueCat API keys ─────────────────────────────────────────────────────
const RC_API_KEY_IOS     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     || 'appl_placeholder';
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || 'goog_placeholder';
const RC_API_KEY_WEB     = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY     || 'rcb_placeholder';

// Entitlement identifiers — must match RevenueCat dashboard exactly
const RC_ENTITLEMENT_PRO      = 'Spediak  Pro';       // double space intentional
const RC_ENTITLEMENT_PLATINUM = 'Spediak Platinum';

// ── Native-only SDK (react-native-purchases) ─────────────────────────────────
let Purchases: any   = null;
let LOG_LEVEL: any   = null;
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = null;

if (Platform.OS !== 'web') {
  try {
    const rcModule = require('react-native-purchases');
    Purchases  = rcModule.default;
    LOG_LEVEL  = rcModule.LOG_LEVEL;
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

// ── Web SDK (@revenuecat/purchases-js) ───────────────────────────────────────
// Loaded lazily to avoid bundling issues when RC_API_KEY_WEB is not yet set.
let webPurchasesInstance: any = null;

async function getWebPurchases(appUserId: string): Promise<any> {
  if (webPurchasesInstance) return webPurchasesInstance;
  try {
    const { Purchases: RCWeb } = await import('@revenuecat/purchases-js');
    webPurchasesInstance = RCWeb.configure(RC_API_KEY_WEB, appUserId);
    return webPurchasesInstance;
  } catch (e) {
    console.error('[PaymentService] Failed to load RevenueCat web SDK:', e);
    return null;
  }
}

export type PlanId = 'pro' | 'platinum';

// ─────────────────────────────────────────────────────────────────────────────
// initializePayments — call once in App.tsx on native only
// ─────────────────────────────────────────────────────────────────────────────
export function initializePayments(): void {
  if (Platform.OS === 'web' || !Purchases) return;

  try {
    if (LOG_LEVEL) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    Purchases.configure({ apiKey });
    console.log('[PaymentService] RevenueCat native SDK initialized');
  } catch (error) {
    console.error('[PaymentService] Failed to initialize RevenueCat:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// purchaseSubscription — RevenueCat on ALL platforms
// ─────────────────────────────────────────────────────────────────────────────
export async function purchaseSubscription(
  planId: PlanId,
  getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    return purchaseWeb(planId, getToken);
  }
  return presentNativePaywall();
}

// Web: use @revenuecat/purchases-js
async function purchaseWeb(
  planId: PlanId,
  getToken: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use the Clerk token as the app user ID so RevenueCat ties purchases to users
    const token = await getToken();
    const appUserId = token ? `clerk_${token.split('.')[1]?.slice(0, 16) || 'user'}` : 'anonymous';

    const purchases = await getWebPurchases(appUserId);
    if (!purchases) {
      return { success: false, error: 'RevenueCat web SDK could not be loaded.' };
    }

    // Fetch offerings and find the right package
    const offerings = await purchases.getOfferings();
    const current = offerings?.current;
    if (!current) {
      return { success: false, error: 'No offerings available. Please try again later.' };
    }

    // Match package by plan ID — looks for 'pro' or 'platinum' in package identifier
    const pkg = current.availablePackages.find((p: any) => {
      const id = (p.identifier || p.packageType || '').toLowerCase();
      return id.includes(planId);
    }) || current.availablePackages[0];

    if (!pkg) {
      return { success: false, error: 'Plan not available. Please try again later.' };
    }

    await purchases.purchase({ rcPackage: pkg });
    return { success: true };
  } catch (error: any) {
    if (error?.userCancelled || error?.message?.toLowerCase().includes('cancel')) {
      return { success: false, error: 'Purchase cancelled' };
    }
    console.error('[PaymentService] Web purchase error:', error);
    return { success: false, error: error.message || 'Purchase failed. Please try again.' };
  }
}

// Native: show RevenueCat paywall UI
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
      default:
        return { success: false, error: 'Paywall could not be presented. Check RevenueCat dashboard configuration.' };
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
    return (
      typeof customerInfo.entitlements.active[RC_ENTITLEMENT_PRO] !== 'undefined' ||
      typeof customerInfo.entitlements.active[RC_ENTITLEMENT_PLATINUM] !== 'undefined'
    );
  } catch (e) {
    console.error('[PaymentService] Error fetching customer info:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// restorePurchases
// ─────────────────────────────────────────────────────────────────────────────
export async function restorePurchases(
  getToken?: () => Promise<string | null>
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    // Web: re-fetch offerings; RevenueCat JS SDK handles restore automatically on configure
    if (getToken) {
      const token = await getToken();
      const appUserId = token ? `clerk_${token.split('.')[1]?.slice(0, 16) || 'user'}` : 'anonymous';
      const purchases = await getWebPurchases(appUserId);
      if (purchases) {
        try {
          const info = await purchases.getCustomerInfo();
          const active = info?.entitlements?.active || {};
          const hasSub = Object.keys(active).length > 0;
          return { success: hasSub };
        } catch {
          return { success: false, error: 'Could not retrieve subscription info.' };
        }
      }
    }
    return { success: false, error: 'To manage your subscription on web, refresh the page.' };
  }

  if (!Purchases) return { success: false, error: 'In-app purchases not available' };

  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPro =
      typeof customerInfo.entitlements.active[RC_ENTITLEMENT_PRO] !== 'undefined' ||
      typeof customerInfo.entitlements.active[RC_ENTITLEMENT_PLATINUM] !== 'undefined';
    return { success: hasPro };
  } catch (error: any) {
    return { success: false, error: error.message || 'Restore failed' };
  }
}
