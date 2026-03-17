const Stripe = require('stripe');
const pool = require('../db');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const STRIPE_PLANS = {
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
    name: 'Pro',
  },
  platinum: {
    priceId: process.env.STRIPE_PLATINUM_PRICE_ID || 'price_platinum_monthly',
    name: 'Platinum',
  },
};

/**
 * POST /api/payments/create-checkout-session
 * Creates a Stripe Checkout session and returns the URL
 */
const createCheckoutSession = async (req, res) => {
  const clerkId = req.auth?.userId;
  const { planId } = req.body;

  if (!clerkId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!planId || !STRIPE_PLANS[planId]) {
    return res.status(400).json({ message: 'Invalid plan. Must be "pro" or "platinum".' });
  }

  const plan = STRIPE_PLANS[planId];

  try {
    // Look up user email from DB
    const userResult = await pool.query('SELECT email FROM users WHERE clerk_id = $1', [clerkId]);
    const userEmail = userResult.rows[0]?.email;

    const successUrl = `${process.env.FRONTEND_URL || 'https://app.spediak.com'}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'https://app.spediak.com'}/plans`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      customer_email: userEmail || undefined,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          clerk_id: clerkId,
          plan_id: planId,
        },
      },
      metadata: {
        clerk_id: clerkId,
        plan_id: planId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log(`[Payment] Created Stripe checkout session ${session.id} for user ${clerkId} (${planId})`);
    res.json({ url: session.url });
  } catch (error) {
    console.error('[Payment] Error creating checkout session:', error);
    res.status(500).json({ message: 'Failed to create checkout session', error: error.message });
  }
};

/**
 * POST /api/payments/webhook
 * Handles Stripe webhook events — must use express.raw() middleware
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Payment] Webhook signature verification failed:', err.message);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  console.log(`[Payment] Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const clerkId = session.metadata?.clerk_id;
        const planId = session.metadata?.plan_id;

        if (clerkId && planId) {
          await pool.query(`
            UPDATE user_subscriptions
            SET plan_type = $1, subscription_status = 'active',
                stripe_customer_id = $2, stripe_subscription_id = $3,
                updated_at = NOW()
            WHERE clerk_id = $4
          `, [planId, session.customer, session.subscription, clerkId]);
          console.log(`[Payment] Activated ${planId} for user ${clerkId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const clerkId = subscription.metadata?.clerk_id;

        if (clerkId) {
          const status = subscription.status === 'active' ? 'active' : subscription.status;
          await pool.query(`
            UPDATE user_subscriptions
            SET subscription_status = $1, updated_at = NOW()
            WHERE clerk_id = $2
          `, [status, clerkId]);
          console.log(`[Payment] Updated subscription status to ${status} for user ${clerkId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const clerkId = subscription.metadata?.clerk_id;

        if (clerkId) {
          await pool.query(`
            UPDATE user_subscriptions
            SET plan_type = 'free', subscription_status = 'cancelled',
                stripe_subscription_id = NULL, updated_at = NOW()
            WHERE clerk_id = $1
          `, [clerkId]);
          console.log(`[Payment] Downgraded user ${clerkId} to free after subscription deletion`);
        }
        break;
      }

      default:
        console.log(`[Payment] Unhandled webhook event type: ${event.type}`);
    }
  } catch (error) {
    console.error('[Payment] Error processing webhook:', error);
    return res.status(500).json({ message: 'Error processing webhook' });
  }

  res.json({ received: true });
};

/**
 * GET /api/payments/subscription-status
 * Returns the current subscription for the authenticated user
 */
const getSubscriptionStatus = async (req, res) => {
  const clerkId = req.auth?.userId;

  if (!clerkId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      'SELECT plan_type, subscription_status, stripe_customer_id, stripe_subscription_id, statements_used, statements_limit FROM user_subscriptions WHERE clerk_id = $1',
      [clerkId]
    );

    if (result.rows.length === 0) {
      return res.json({ plan_type: 'free', subscription_status: 'none' });
    }

    const sub = result.rows[0];

    // Optionally enrich with live Stripe data for active paid plans
    let stripeDetails = null;
    if (sub.stripe_subscription_id && sub.plan_type !== 'free') {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        stripeDetails = {
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          trial_end: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
        };
      } catch (stripeError) {
        console.warn('[Payment] Could not fetch Stripe subscription details:', stripeError.message);
      }
    }

    res.json({ ...sub, stripe: stripeDetails });
  } catch (error) {
    console.error('[Payment] Error fetching subscription status:', error);
    res.status(500).json({ message: 'Failed to fetch subscription status', error: error.message });
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
};
