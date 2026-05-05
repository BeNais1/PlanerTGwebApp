import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { Telegraf } from 'telegraf';

import admin from 'firebase-admin';

// Загружаем переменные окружения
dotenv.config();

// Инициализация Firebase Admin
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (rawServiceAccount) {
  try {
    const serviceAccount = JSON.parse(rawServiceAccount.trim());
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.DATABASE_URL || "https://planer-app-3a0f2-default-rtdb.europe-west1.firebasedatabase.app"
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
    console.error('Raw string length:', rawServiceAccount?.length);
  }
} else {
  console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not set. User registration in bot will fail.');
}

const db = admin.apps.length ? admin.database() : null;

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация Telegram Бота
const token = (process.env.BOT_TOKEN || "").trim();
const bot = new Telegraf(token);

bot.start(async (ctx) => {
  const { id, first_name, last_name, username } = ctx.from;
  const payload = ctx.startPayload; // Получаем параметр из ссылки (например, receipt_-O12345)
  console.log(`User ${id} started the bot with payload: ${payload || 'none'}`);

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
        console.log(`User ${id} registered successfully via Bot`);
      }
    } catch (err) {
      console.error('❌ Error registering user via bot:', err);
    }
  } else {
    console.error('❌ Database not initialized - registration skipped');
  }

  // Если пользователь перешел по ссылке чека
  if (payload && payload.startsWith('receipt_')) {
    const shareCode = payload.replace('receipt_', '');
    
    // Check if share exists and is active
    let shareActive = true;
    if (db) {
      try {
        const shareSnap = await db.ref(`shared_receipts/${shareCode}`).get();
        if (shareSnap.exists()) {
          const shareData = shareSnap.val();
          shareActive = shareData.isActive !== false;
        }
        // Also check legacy shared_receipts if not found
        if (!shareSnap.exists()) {
          const legacySnap = await db.ref(`shared_receipts/${shareCode}`).get();
          if (!legacySnap.exists()) {
            return ctx.reply('❌ Чек не знайдено. Можливо, посилання застаріло.');
          }
        }
      } catch (err) {
        console.error('Error checking receipt share:', err);
      }
    }
    
    if (!shareActive) {
      return ctx.reply('🔒 Автор вимкнув це посилання на чек.');
    }
    
    return ctx.reply(`🧾 Вам прислали чек!\nНажмите кнопку ниже, чтобы посмотреть детали.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Посмотреть чек 🧾", web_app: { url: `https://planer-app-3a0f2.web.app/?receipt=${shareCode}` } }]
        ]
      }
    });
  }

  // Обычный запуск бота
  ctx.reply(`Привет, ${first_name}! Я твой Трекер Расходов 💰\n\nНажми кнопку ниже, чтобы открыть приложение.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть Трекер 🚀", web_app: { url: "https://planer-app-3a0f2.web.app" } }]
      ]
    }
  });
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://planer-app-3a0f2.web.app',
    'https://planer-app-3a0f2.firebaseapp.com'
  ],
  credentials: true
}));

// Telegram Webhook (должен быть ПЕРЕД express.json, так как Telegraf сам парсит body)
app.use(bot.webhookCallback('/api/webhook'));

app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Установка Webhook для Telegram (нужно дернуть 1 раз в браузере после деплоя на Vercel)
app.get('/api/set-webhook', async (req, res) => {
  try {
    const url = `https://${req.headers.host}/api/webhook`;
    await bot.telegram.setWebhook(url);
    res.json({ success: true, message: 'Webhook set successfully', url });
  } catch (error) {
    console.error('Webhook set error:', error);
    res.status(500).json({ error: 'Failed to set webhook' });
  }
});

// Устанавливаем удаление Webhook для локальной разработки
app.get('/api/del-webhook', async (req, res) => {
  try {
    await bot.telegram.deleteWebhook();
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'expense-tracker-api'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Expense Tracker API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/telegram',
      verify: '/api/auth/verify',
      health: '/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Telegram Bot Token: ${process.env.BOT_TOKEN ? '✓ Set' : '✗ Not set'}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✓ Set' : '✗ Not set'}`);
});

export default app;
