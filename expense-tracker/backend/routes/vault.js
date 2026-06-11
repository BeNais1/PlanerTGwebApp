import express from 'express';
import crypto from 'crypto';
import { parseTelegramInitData, validateTelegramWebAppData } from '../utils/telegram.js';

const VAULT_PLAN = 'vault_monthly';
const VAULT_SUBSCRIPTION_PERIOD = 30 * 24 * 60 * 60;
const DEFAULT_VAULT_PRICE_STARS = 250;

function getVaultPriceStars() {
  const configuredPrice = Number(process.env.VAULT_PRICE_STARS || DEFAULT_VAULT_PRICE_STARS);

  if (!Number.isInteger(configuredPrice) || configuredPrice < 1 || configuredPrice > 10000) {
    throw new Error('VAULT_PRICE_STARS must be an integer between 1 and 10000.');
  }

  return configuredPrice;
}

function getAdminTelegramId() {
  return (process.env.ADMIN_TELEGRAM_ID || '7801680802').trim();
}

function requireAdmin(req, res, next) {
  const { initData } = req.body || {};

  if (!initData || !validateTelegramWebAppData(initData, process.env.BOT_TOKEN)) {
    return res.status(401).json({ error: 'Відкрийте оплату всередині Telegram Mini App.' });
  }

  const user = parseTelegramInitData(initData);

  if (!user || String(user.id) !== getAdminTelegramId()) {
    return res.status(403).json({ error: 'Підписка Vault поки доступна лише адміністратору.' });
  }

  req.vaultUser = user;
  return next();
}

function createOrderNumber() {
  const suffix = crypto.randomInt(0, 100).toString().padStart(2, '0');
  return `${Date.now()}${suffix}`;
}

function createPayload(order, userId) {
  return `${VAULT_PLAN}:${order}:${userId}`;
}

function isEnabledSubscription(subscription) {
  return subscription?.status === 'active' || subscription?.status === 'demo_active';
}

function formatSubscriptionStatus(subscription) {
  const isDemo = subscription?.status === 'demo_active';
  const isActive = isEnabledSubscription(subscription);

  return {
    status: subscription?.status || 'inactive',
    isActive,
    isDemo,
    amountStars: isDemo ? 0 : (subscription?.amountStars || getVaultPriceStars()),
    displayPriceStars: getVaultPriceStars(),
    periodDays: 30,
    activatedAt: subscription?.activatedAt || subscription?.firstPaidAt || null,
  };
}

function parsePayload(payload) {
  const match = /^vault_monthly:(\d{15}):(\d+)$/.exec(String(payload || ''));

  if (!match) return null;

  return {
    order: match[1],
    userId: match[2],
  };
}

async function findOrder(db, parsedPayload) {
  if (!db || !parsedPayload) return null;

  const snapshot = await db.ref(`vault_payments/${parsedPayload.order}`).get();
  const order = snapshot.val();

  if (!order || order.userId !== parsedPayload.userId) return null;
  return order;
}

export function registerVaultPaymentHandlers({ bot, db }) {
  bot.on('pre_checkout_query', async (ctx) => {
    const query = ctx.preCheckoutQuery;
    const parsedPayload = parsePayload(query.invoice_payload);

    try {
      const order = await findOrder(db, parsedPayload);
      const activeSubscription = parsedPayload && db
        ? (await db.ref(`vault_subscriptions/${parsedPayload.userId}`).get()).val()
        : null;
      const isDuplicateFirstPayment = activeSubscription?.status === 'active' && order?.status === 'pending';
      const hasDemoSubscription = activeSubscription?.status === 'demo_active';
      const isValid = parsedPayload
        && parsedPayload.userId === String(query.from.id)
        && parsedPayload.userId === getAdminTelegramId()
        && query.currency === 'XTR'
        && query.total_amount === getVaultPriceStars()
        && order
        && !isDuplicateFirstPayment
        && !hasDemoSubscription;

      if (!isValid) {
        return ctx.answerPreCheckoutQuery(false, 'Не вдалося перевірити платіж Vault. Відкрийте підписку ще раз.');
      }

      return ctx.answerPreCheckoutQuery(true);
    } catch (error) {
      console.error('Vault pre-checkout error:', error.message);
      return ctx.answerPreCheckoutQuery(false, 'Сталася помилка під час перевірки платежу.');
    }
  });

  bot.on('message', async (ctx, next) => {
    const payment = ctx.message?.successful_payment;

    if (!payment) return next();

    const parsedPayload = parsePayload(payment.invoice_payload);

    if (
      !db
      || !parsedPayload
      || parsedPayload.userId !== String(ctx.from.id)
      || parsedPayload.userId !== getAdminTelegramId()
      || payment.currency !== 'XTR'
      || payment.total_amount !== getVaultPriceStars()
    ) {
      console.error('Received an invalid Vault successful payment update.');
      return;
    }

    try {
      const orderRef = db.ref(`vault_payments/${parsedPayload.order}`);
      const orderSnapshot = await orderRef.get();

      if (!orderSnapshot.exists() || orderSnapshot.val().userId !== parsedPayload.userId) {
        console.error('Received Vault payment for an unknown order.');
        return;
      }

      if (orderSnapshot.val().latestTelegramPaymentChargeId === payment.telegram_payment_charge_id) {
        return;
      }

      const subscriptionRef = db.ref(`vault_subscriptions/${parsedPayload.userId}`);
      const subscriptionSnapshot = await subscriptionRef.get();
      const previousSubscription = subscriptionSnapshot.val() || {};
      const now = Date.now();

      await orderRef.update({
        status: 'paid',
        paidAt: now,
        latestTelegramPaymentChargeId: payment.telegram_payment_charge_id,
      });

      await db.ref(`vault_payment_events/${parsedPayload.userId}`).push({
        order: parsedPayload.order,
        amountStars: payment.total_amount,
        currency: payment.currency,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        providerPaymentChargeId: payment.provider_payment_charge_id || null,
        isRecurring: payment.is_recurring === true,
        isFirstRecurring: payment.is_first_recurring === true,
        subscriptionExpirationDate: payment.subscription_expiration_date || null,
        paidAt: now,
      });

      await subscriptionRef.set({
        plan: VAULT_PLAN,
        status: 'active',
        amountStars: payment.total_amount,
        currency: payment.currency,
        subscriptionPeriod: VAULT_SUBSCRIPTION_PERIOD,
        firstTelegramPaymentChargeId:
          previousSubscription.firstTelegramPaymentChargeId || payment.telegram_payment_charge_id,
        latestTelegramPaymentChargeId: payment.telegram_payment_charge_id,
        subscriptionExpirationDate: payment.subscription_expiration_date || null,
        firstPaidAt: previousSubscription.firstPaidAt || now,
        updatedAt: now,
      });

      if (payment.is_first_recurring === true) {
        await ctx.reply('Оплату Vault у Telegram Stars підтверджено. Функції підписки поки не активуються.');
      }
    } catch (error) {
      console.error('Vault successful payment storage error:', error.message);
    }
  });

  bot.command('paysupport', (ctx) => ctx.reply(
    'Підписка Vault зараз тестується лише адміністратором. Якщо виникла проблема з оплатою Stars, напишіть у підтримку про платіж Vault.',
  ));

  bot.command('terms', (ctx) => ctx.reply(
    'Vault - щомісячна підписка через Telegram Stars. На етапі тестування вона не відкриває додаткові функції. Автосписання можна скасувати в керуванні підписками Telegram.',
  ));
}

export function createVaultRoutes({ db, bot }) {
  const router = express.Router();

  router.post('/checkout', requireAdmin, async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Сховище платежів тимчасово недоступне.' });
      }

      const userId = String(req.vaultUser.id);
      const activeSubscription = (await db.ref(`vault_subscriptions/${userId}`).get()).val();

      if (isEnabledSubscription(activeSubscription)) {
        return res.status(409).json({ error: 'Підписка Vault вже активна у Telegram Stars.' });
      }

      const amountStars = getVaultPriceStars();
      const order = createOrderNumber();
      const payload = createPayload(order, userId);
      const invoiceUrl = await bot.telegram.createInvoiceLink({
        title: 'Vault',
        description: 'Щомісячна підписка Vault. Функції ще не активовані.',
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: 'Vault - 30 днів', amount: amountStars }],
        subscription_period: VAULT_SUBSCRIPTION_PERIOD,
      });

      await db.ref(`vault_payments/${order}`).set({
        userId,
        plan: VAULT_PLAN,
        amountStars,
        currency: 'XTR',
        subscriptionPeriod: VAULT_SUBSCRIPTION_PERIOD,
        status: 'pending',
        createdAt: Date.now(),
      });

      return res.json({
        invoiceUrl,
        order,
        amountStars,
        currency: 'XTR',
        periodDays: 30,
      });
    } catch (error) {
      console.error('Vault checkout error:', error.message);
      return res.status(503).json({ error: 'Не вдалося створити інвойс Telegram Stars.' });
    }
  });

  router.post('/subscription', requireAdmin, async (req, res) => {
    if (!db) {
      return res.status(503).json({ error: 'Сховище підписок тимчасово недоступне.' });
    }

    const userId = String(req.vaultUser.id);
    const subscription = (await db.ref(`vault_subscriptions/${userId}`).get()).val();

    return res.json(formatSubscriptionStatus(subscription));
  });

  router.post('/demo-activate', requireAdmin, async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ error: 'Сховище підписок тимчасово недоступне.' });
      }

      const userId = String(req.vaultUser.id);
      const subscriptionRef = db.ref(`vault_subscriptions/${userId}`);
      const currentSubscription = (await subscriptionRef.get()).val();

      if (isEnabledSubscription(currentSubscription)) {
        return res.json(formatSubscriptionStatus(currentSubscription));
      }

      const now = Date.now();
      const demoSubscription = {
        plan: VAULT_PLAN,
        status: 'demo_active',
        mode: 'admin_demo',
        amountStars: 0,
        displayPriceStars: getVaultPriceStars(),
        currency: 'XTR',
        subscriptionPeriod: VAULT_SUBSCRIPTION_PERIOD,
        activatedAt: now,
        updatedAt: now,
      };

      await subscriptionRef.set(demoSubscription);
      await db.ref(`vault_demo_events/${userId}`).push({
        event: 'activated',
        plan: VAULT_PLAN,
        amountStars: 0,
        createdAt: now,
      });

      return res.json(formatSubscriptionStatus(demoSubscription));
    } catch (error) {
      console.error('Vault demo activation error:', error.message);
      return res.status(503).json({ error: 'Не вдалося активувати demo-підписку Vault.' });
    }
  });

  router.post('/status', requireAdmin, async (req, res) => {
    const order = String(req.body?.order || '');

    if (!/^\d{15}$/.test(order) || !db) {
      return res.status(404).json({ error: 'Платіж не знайдено.' });
    }

    const snapshot = await db.ref(`vault_payments/${order}`).get();
    const payment = snapshot.val();

    if (!payment || payment.userId !== String(req.vaultUser.id)) {
      return res.status(404).json({ error: 'Платіж не знайдено.' });
    }

    return res.json({ status: payment.status });
  });

  return router;
}
