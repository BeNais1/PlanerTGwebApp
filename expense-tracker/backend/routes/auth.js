import express from 'express';
import jwt from 'jsonwebtoken';
import { validateTelegramWebAppData, parseTelegramInitData } from '../utils/telegram.js';

const router = express.Router();

/**
 * POST /api/auth/telegram
 * Авторизация через Telegram Web App
 */
router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'initData is required' });
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
    
    // Создаем JWT токен
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Возвращаем токен и данные пользователя
    res.json({
      success: true,
      token,
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
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
