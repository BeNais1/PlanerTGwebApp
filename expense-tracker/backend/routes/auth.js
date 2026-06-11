import express from 'express';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { validateTelegramWebAppData, parseTelegramInitData } from '../utils/telegram.js';

const router = express.Router();

function getAdminTelegramId() {
  return (process.env.ADMIN_TELEGRAM_ID || '7801680802').trim();
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured and at least 32 characters long.');
  }
  return secret;
}

function signApiToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      uid: user.uid,
      username: user.username,
      firstName: user.firstName,
    },
    getJwtSecret(),
    {
      expiresIn: '2h',
      issuer: 'expense-tracker-api',
      audience: 'expense-tracker-web',
    }
  );
}

/**
 * POST /api/auth/telegram
 * Авторизация через Telegram Web App
 */
router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body || {};
    
    if (!initData) {
      return res.status(400).json({ error: 'initData is required' });
    }

    if (!admin.apps.length) {
      return res.status(503).json({ error: 'Authentication service is not configured' });
    }
    
    // Валидируем данные от Telegram
    const isValid = validateTelegramWebAppData(initData, process.env.BOT_TOKEN);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid Telegram data' });
    }
    
    // Парсим данные пользователя
    const user = parseTelegramInitData(initData);
    
    if (!user) {
      return res.status(400).json({ error: 'Failed to parse user data' });
    }
    
    const isAdmin = user.uid === getAdminTelegramId();
    const [token, firebaseToken] = await Promise.all([
      Promise.resolve(signApiToken(user)),
      admin.auth().createCustomToken(user.uid, {
        telegramId: user.uid,
        admin: isAdmin,
      }),
    ]);
    
    // Возвращаем токен и данные пользователя
    res.json({
      success: true,
      token,
      firebaseToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.photoUrl,
        languageCode: user.languageCode,
      },
    });
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/verify
 * Проверка валидности токена
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'expense-tracker-api',
      audience: 'expense-tracker-web',
    });
    
    res.json({
      success: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        firstName: decoded.firstName,
      },
    });
    
  } catch (error) {
    console.error('Verify error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
