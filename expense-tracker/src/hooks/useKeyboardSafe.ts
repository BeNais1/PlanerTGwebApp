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

    // Set CSS variables for viewport-aware layout
    document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    document.documentElement.style.setProperty('--viewport-offset', `${viewport.offsetTop}px`);

    if (keyboardHeight > 100) {
      document.documentElement.classList.add('keyboard-open');
    } else {
      document.documentElement.classList.remove('keyboard-open');
    }
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    // Initial set
    updateViewport();

    // Track viewport changes continuously
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);

    // On focus — scroll the active input into view WITHIN the modal scroll container
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;

      // Wait for keyboard to fully animate open
      setTimeout(() => {
        updateViewport();

        // Find the scrollable modal parent
        const modal = target.closest('.modal-content') as HTMLElement;
        if (modal) {
          // Calculate where the input is relative to the modal
          const inputRect = target.getBoundingClientRect();
          const modalRect = modal.getBoundingClientRect();
          const viewportH = window.visualViewport?.height || window.innerHeight;

          // If input is below visible area, scroll modal
          if (inputRect.bottom > viewportH - 20) {
            const scrollBy = inputRect.bottom - viewportH + 80;
            modal.scrollBy({ top: scrollBy, behavior: 'smooth' });
          }
          // If input is above visible area, also scroll
          else if (inputRect.top < modalRect.top) {
            const scrollBy = inputRect.top - modalRect.top - 20;
            modal.scrollBy({ top: scrollBy, behavior: 'smooth' });
          }
        } else {
          // Fallback: generic scrollIntoView
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    };

    document.addEventListener('focusin', onFocusIn);

    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
      document.removeEventListener('focusin', onFocusIn);
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      document.documentElement.style.setProperty('--viewport-offset', '0px');
      document.documentElement.classList.remove('keyboard-open');
    };
  }, [updateViewport]);
}
