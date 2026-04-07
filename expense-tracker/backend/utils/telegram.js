import crypto from 'crypto';

/**
 * Валидация данных от Telegram Web App
 * @param {string} initData - строка initData от Telegram
 * @param {string} botToken - токен бота
 * @returns {boolean} - валидны ли данные
 */
export function validateTelegramWebAppData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
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
    
    // Сравниваем хеши
    return calculatedHash === hash;
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
    const params = new URLSearchParams(initData);
    const userParam = params.get('user');
    
    if (!userParam) {
      return null;
    }
    
    const user = JSON.parse(userParam);
    
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name || '',
      username: user.username || '',
      photoUrl: user.photo_url || '',
      languageCode: user.language_code || 'en',
    };
  } catch (error) {
    console.error('Parse initData error:', error);
    return null;
  }
}
