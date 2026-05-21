import { useEffect, useCallback } from 'react';

/**
 * Fixes the Telegram WebApp keyboard issue:
 * When the virtual keyboard opens, the viewport shrinks and inputs
 * can scroll out of view. This hook uses the VisualViewport API
 * to track viewport height and position modals correctly.
 */
export function useKeyboardSafe() {
  const updateViewport = useCallback(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const fullHeight = window.innerHeight;
    const viewportHeight = viewport.height;
    const keyboardHeight = Math.max(0, fullHeight - viewportHeight);

    document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

    if (keyboardHeight > 100) {
      document.documentElement.classList.add('keyboard-open');
    } else {
      document.documentElement.classList.remove('keyboard-open');
    }
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    updateViewport();

    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;

      setTimeout(() => {
        updateViewport();
        const modal = target.closest('.modal-content') as HTMLElement;
        if (modal) {
          const inputRect = target.getBoundingClientRect();
          const modalRect = modal.getBoundingClientRect();
          const viewportH = window.visualViewport?.height || window.innerHeight;
          if (inputRect.bottom > viewportH - 20) {
            modal.scrollBy({ top: inputRect.bottom - viewportH + 80, behavior: 'smooth' });
          } else if (inputRect.top < modalRect.top) {
            modal.scrollBy({ top: inputRect.top - modalRect.top - 20, behavior: 'smooth' });
          }
        }
      }, 350);
    };

    document.addEventListener('focusin', onFocusIn);

    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
      document.removeEventListener('focusin', onFocusIn);
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.classList.remove('keyboard-open');
    };
  }, [updateViewport]);
}
