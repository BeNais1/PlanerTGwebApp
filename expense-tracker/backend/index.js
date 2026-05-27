import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { createVaultRoutes, registerVaultPaymentHandlers } from './routes/vault.js';
import { Telegraf } from 'telegraf';
import admin from 'firebase-admin';

dotenv.config();

// Firebase Admin
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (rawServiceAccount) {
  try {
    const serviceAccount = JSON.parse(rawServiceAccount.trim());
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.DATABASE_URL || "https://planer-app-3a0f2-default-rtdb.europe-west1.firebasedatabase.app"
    });
    console.log('✅ Firebase Admin ініціалізовано');
  } catch (err) {
    console.error('❌ Помилка парсингу FIREBASE_SERVICE_ACCOUNT:', err.message);
  }
} else {
  console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT не встановлено.');
}

const db = admin.apps.length ? admin.database() : null;

const app = express();
const PORT = process.env.PORT || 3000;

const token = (process.env.BOT_TOKEN || "").trim();
const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
const bot = new Telegraf(token);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = { EUR: '€', USD: '$', UAH: '₴' };

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getSymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}

function calculateNextDate(currentTimestamp, period) {
  const d = new Date(currentTimestamp);
  switch (period) {
    case 'daily':   d.setDate(d.getDate() + 1); break;
    case 'weekly':  d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.getTime();
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Bot handlers ─────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  const { id, first_name, last_name, username } = ctx.from;
  const payload = ctx.startPayload;
  console.log(`Користувач ${id} запустив бота. Payload: ${payload || 'немає'}`);

  if (db) {
    try {
      const userRef = db.ref(`users/${id}`);
      const snapshot = await userRef.get();
      if (!snapshot.exists()) {
        await userRef.set({
          firstName: first_name,
          lastName: last_name || "",
          username: username || "",
          registeredAt: Date.now(),
        });
        console.log(`Користувач ${id} зареєстрований через бота`);
      }
    } catch (err) {
      console.error('❌ Помилка реєстрації користувача:', err);
    }
  }

  // Deep link — чек
  if (payload && payload.startsWith('receipt_')) {
    const shareCode = payload.replace('receipt_', '');
    let shareActive = true;

    if (db) {
      try {
        const shareSnap = await db.ref(`shared_receipts/${shareCode}`).get();
        if (shareSnap.exists()) {
          shareActive = shareSnap.val().isActive !== false;
        } else {
          return ctx.reply('❌ Чек не знайдено. Посилання застаріло.');
        }
      } catch (err) {
        console.error('Помилка перевірки чека:', err);
      }
    }

    if (!shareActive) {
      return ctx.reply('🔒 Автор вимкнув це посилання на чек.');
    }

    return ctx.reply('🧾 Вам надіслали чек!\nНатисніть кнопку нижче, щоб переглянути деталі.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📄 Переглянути чек', web_app: { url: `https://planer-app-3a0f2.web.app/?receipt=${shareCode}` } }]
        ]
      }
    });
  }

  return ctx.reply(
    `Привіт, ${first_name}! 👋\n\nЯ твій трекер витрат 💰\nВідстежуй витрати, підписки та повторні платежі прямо в Telegram.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Відкрити застосунок', web_app: { url: 'https://planer-app-3a0f2.web.app' } }]
        ]
      }
    }
  );
});

// Callback — підтвердити платіж
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data || '';
  const userId = String(ctx.from.id);

  if (!db) {
    return ctx.answerCbQuery('Помилка: база даних недоступна');
  }

  // ── Підтвердити оплату ──────────────────────────────────────────────────────
  if (data.startsWith('confirm:')) {
    const subId = data.replace('confirm:', '');

    try {
      const subRef = db.ref(`users/${userId}/subscriptions/${subId}`);
      const subSnap = await subRef.get();

      if (!subSnap.exists()) {
        await ctx.answerCbQuery('Платіж не знайдено');
        return ctx.editMessageText('❌ Платіж не знайдено або вже видалено.');
      }

      const sub = subSnap.val();
      const now = Date.now();
      const date = new Date(now);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Lookup wallet to get real currency
      let confirmCurrency = sub.currency || 'UAH';
      let confirmSymbol = getSymbol(confirmCurrency);
      if (sub.walletId) {
        const wSnap = await db.ref(`users/${userId}/wallets/${sub.walletId}`).get();
        if (wSnap.exists()) {
          confirmCurrency = wSnap.val().currency || confirmCurrency;
          confirmSymbol = getSymbol(confirmCurrency);
        }
      }

      // Додаємо транзакцію
      await db.ref(`users/${userId}/transactions`).push({
        type: 'expense',
        amount: sub.amount,
        currency: confirmCurrency,
        walletId: sub.walletId || null,
        category: sub.category || 'subscriptions',
        description: sub.name,
        date: now,
        month,
      });

      // Оновлюємо наступну дату
      const nextDate = calculateNextDate(sub.nextDate, sub.period);
      await subRef.update({ nextDate });

      // Видаляємо pending-нотифікацію
      await db.ref(`users/${userId}/pendingNotifications/${subId}`).remove();

      await ctx.answerCbQuery('✅ Платіж додано!');
      await ctx.editMessageText(
        `✅ <b>${escHtml(sub.icon)} ${escHtml(sub.name)}</b> — платіж підтверджено!\n\n` +
        `Сума: <b>${escHtml(sub.amount)} ${escHtml(confirmSymbol)}</b>\n` +
        `Наступне списання: <b>${escHtml(formatDate(nextDate))}</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (err) {
      console.error('Помилка підтвердження платежу:', err);
      await ctx.answerCbQuery('Помилка. Спробуйте пізніше.');
    }
    return;
  }

  // ── Відкласти на годину ─────────────────────────────────────────────────────
  if (data.startsWith('snooze:')) {
    const subId = data.replace('snooze:', '');
    const snoozedUntil = Date.now() + 60 * 60 * 1000;

    try {
      await db.ref(`users/${userId}/pendingNotifications/${subId}`).update({ snoozedUntil });
      await ctx.answerCbQuery('Нагадаю через годину ⏳');
      await ctx.editMessageText('⏳ Зрозумів! Нагадаю через годину.');
    } catch (err) {
      console.error('Помилка відкладання:', err);
      await ctx.answerCbQuery('Помилка. Спробуйте пізніше.');
    }
    return;
  }

  await ctx.answerCbQuery();
});

registerVaultPaymentHandlers({ bot, db });

// ─── Express Middleware ────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://planer-app-3a0f2.web.app',
    'https://planer-app-3a0f2.firebaseapp.com',
  ],
  credentials: true,
}));

// Webhook — перед express.json (Telegraf сам парсить body)
app.use(bot.webhookCallback('/api/webhook', webhookSecret ? { secretToken: webhookSecret } : {}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/vault', createVaultRoutes({ db, bot }));

// Webhook setup
function requireAdminSecret(req, res, next) {
  const secret = req.query.secret || req.headers['x-admin-secret'];
  const isValidSecret = secret
    && (secret === process.env.CRON_SECRET || secret === webhookSecret);

  if (!isValidSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

app.get('/api/set-webhook', requireAdminSecret, async (req, res) => {
  try {
    if (!webhookSecret) {
      return res.status(503).json({ error: 'TELEGRAM_WEBHOOK_SECRET is not configured' });
    }

    const url = `https://${req.headers.host}/api/webhook`;
    await bot.telegram.setWebhook(url, { secret_token: webhookSecret });
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ error: 'Не вдалося встановити webhook' });
  }
});

app.get('/api/del-webhook', requireAdminSecret, async (req, res) => {
  try {
    await bot.telegram.deleteWebhook();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Не вдалося видалити webhook' });
  }
});

// ─── Cron endpoint ─────────────────────────────────────────────────────────────
// Викликати кожну годину через cron-job.org:
//   GET https://<your-vercel-url>/api/cron?secret=<CRON_SECRET>
app.get('/api/cron', async (req, res) => {
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!db) {
    return res.status(500).json({ error: 'База даних недоступна' });
  }

  const now = Date.now();
  let notified = 0;
  let skipped = 0;
  const errors = [];

  try {
    const usersSnap = await db.ref('users').get();
    if (!usersSnap.exists()) {
      return res.json({ notified: 0, skipped: 0, message: 'Користувачів немає' });
    }

    const users = usersSnap.val();

    for (const [userId, userData] of Object.entries(users)) {
      const subscriptions = userData.subscriptions;
      if (!subscriptions) continue;

      for (const [subId, sub] of Object.entries(subscriptions)) {
        if (!sub.isActive) continue;
        if (sub.nextDate > now) continue;

        // Перевіряємо pending-нотифікацію
        const pendingRef = db.ref(`users/${userId}/pendingNotifications/${subId}`);
        const pendingSnap = await pendingRef.get();

        if (pendingSnap.exists()) {
          const pending = pendingSnap.val();
          if (pending.snoozedUntil && pending.snoozedUntil > now) {
            skipped++;
            continue;
          }
        }

        // Надсилаємо повідомлення
        try {
          // Lookup wallet for name + currency
          let symbol = getSymbol(sub.currency);
          let walletLabel = '';
          if (sub.walletId) {
            const walletSnap = await db.ref(`users/${userId}/wallets/${sub.walletId}`).get();
            if (walletSnap.exists()) {
              const wallet = walletSnap.val();
              symbol = getSymbol(wallet.currency);
              walletLabel = ` · ${wallet.name}`;
            }
          }

          const msg = await bot.telegram.sendMessage(
            parseInt(userId),
            `💳 <b>${escHtml(sub.icon)} ${escHtml(sub.name)}</b>\n\n` +
            `Сума: <b>${escHtml(sub.amount)} ${escHtml(symbol)}</b>${escHtml(walletLabel)}\n` +
            `Платіж пройшов?`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Так, оплачено', callback_data: `confirm:${subId}` },
                  { text: '⏳ Поки ні', callback_data: `snooze:${subId}` },
                ]],
              },
            }
          );

          await pendingRef.set({
            subId,
            sentAt: now,
            messageId: msg.message_id,
            snoozedUntil: null,
          });

          notified++;
        } catch (err) {
          console.error(`Помилка сповіщення користувача ${userId}:`, err.message);
          errors.push({ userId, subId, error: err.message });
        }
      }
    }

    res.json({
      notified,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Помилка cron:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Expense Tracker API',
    version: '1.1.0',
    endpoints: {
      auth: '/api/auth/telegram',
      verify: '/api/auth/verify',
      cron: '/api/cron?secret=<CRON_SECRET>',
      health: '/health',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порту ${PORT}`);
  console.log(`📱 Bot Token: ${process.env.BOT_TOKEN ? '✓' : '✗'}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✓' : '✗'}`);
  console.log(`⏰ Cron Secret: ${process.env.CRON_SECRET ? '✓' : '✗'}`);
});

export default app;
