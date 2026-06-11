(function () {
  function markTelegramReady() {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        if (window.Telegram.WebApp.expand) {
          window.Telegram.WebApp.expand();
        }
        return true;
      }
    } catch (error) {
      console.error('Telegram boot ready failed:', error);
    }

    return false;
  }

  if (markTelegramReady()) return;

  var attempts = 0;
  var intervalId = window.setInterval(function () {
    attempts += 1;
    if (markTelegramReady() || attempts >= 300) {
      window.clearInterval(intervalId);
    }
  }, 100);

  window.addEventListener('load', markTelegramReady, { once: true });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      markTelegramReady();
    }
  });
})();
