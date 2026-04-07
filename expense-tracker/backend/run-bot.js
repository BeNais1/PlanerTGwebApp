import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('Привет! Я твой Трекер Расходов 💰\n\nНажми кнопку ниже, чтобы открыть приложение.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Открыть Трекер 🚀", web_app: { url: "https://planer-app-3a0f2.web.app" } }]
      ]
    }
  });
});

console.log('Запуск бота...');
bot.launch().then(() => {
  console.log('Бот успешно запущен и работает в режиме Polling!');
}).catch((err) => {
  console.error('Ошибка при запуске бота:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
