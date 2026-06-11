import crypto from 'crypto';

const MAX_INIT_DATA_LENGTH = 4096;
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;
const TELEGRAM_HASH_RE = /^[a-f0-9]{64}$/i;

function safeString(value, maxLength = 128) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

function safeTelegramUserId(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const id = String(value);
  return /^\d{1,20}$/.test(id) ? id : null;
}

/**
 * Валидация данных от Telegram Web App
 * @param {string} initData - строка initData от Telegram
 * @param {string} botToken - токен бота
 * @param {{ maxAgeSeconds?: number }} options
 * @returns {boolean} - валидны ли данные
 */
export function validateTelegramWebAppData(initData, botToken, options = {}) {
  try {
    if (
      typeof initData !== 'string'
      || initData.length === 0
      || initData.length > MAX_INIT_DATA_LENGTH
      || typeof botToken !== 'string'
      || botToken.trim().length === 0
    ) {
      return false;
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash || !TELEGRAM_HASH_RE.test(hash)) {
      return false;
    }

    const authDate = Number(params.get('auth_date'));
    const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      !Number.isInteger(authDate)
      || authDate <= 0
      || authDate > nowSeconds + 60
      || nowSeconds - authDate > maxAgeSeconds
    ) {
      return false;
    }
    
    params.delete('hash');
    
    // Создаем data-check-string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Вычисляем secret_key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Вычисляем hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Сравниваем хеши за постоянное время.
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    const providedBuffer = Buffer.from(hash, 'hex');
    return calculatedBuffer.length === providedBuffer.length
      && crypto.timingSafeEqual(calculatedBuffer, providedBuffer);
  } catch (error) {
    console.error('Telegram validation error:', error);
    return false;
  }
}

/**
 * Парсинг данных пользователя из initData
 * @param {string} initData - строка initData от Telegram
 * @returns {object|null} - данные пользователя
 */
export function parseTelegramInitData(initData) {
  try {
    if (typeof initData !== 'string' || initData.length > MAX_INIT_DATA_LENGTH) {
      return null;
    }

    const params = new URLSearchParams(initData);
    const userParam = params.get('user');
    
    if (!userParam) {
      return null;
    }
    
    const user = JSON.parse(userParam);
    const id = safeTelegramUserId(user.id);

    if (!id) {
      return null;
    }
    
    return {
      id: Number(id),
      uid: id,
      firstName: safeString(user.first_name, 128),
      lastName: safeString(user.last_name, 128),
      username: safeString(user.username, 64),
      photoUrl: safeString(user.photo_url, 512),
      languageCode: safeString(user.language_code, 16) || 'en',
    };
  } catch (error) {
    console.error('Parse initData error:', error);
    return null;
  }
}

export function isValidTelegramUserId(value) {
  return safeTelegramUserId(value) !== null;
}
