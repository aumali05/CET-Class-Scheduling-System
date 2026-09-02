import { useEffect } from 'react';

/**
 * Debug hook to monitor and detect when input fields become unclickable.
 * Logs issues to console and provides visual feedback.
 *
 * Issue: After 1-3 actions in the app, input fields become unclickable
 * Root Cause: Modal overlay event handling with `onMouseDown` interferes with React's event delegation
 *
 * This hook helps detect if the issue persists or returns.
 */
export function useInputClickabilityMonitor() {
  useEffect(() => {
    let failedClickAttempts = 0;
    let lastFailureTime = 0;
    const THRESHOLD = 3; // Number of failed clicks to trigger alert

    const handleInputInteraction = (e) => {
      const target = e.target;

      // Only monitor input fields and select elements
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      // Check if overlay is blocking
      const overlaysPresent = document.querySelectorAll('[class*="fixed"][class*="inset-0"]');
      const isModalOpen = overlaysPresent.length > 0;

      // If click failed to reach input (element not focused after click)
      if (isModalOpen && !target.matches(':focus')) {
        failedClickAttempts++;
        lastFailureTime = Date.now();

        if (failedClickAttempts === 1) {
          console.warn(
            '[Input Clickability Issue] Input field click detected but focus not acquired. ' +
            `Modal overlays present: ${overlaysPresent.length}`
          );
        }

        if (failedClickAttempts >= THRESHOLD) {
          console.error(
            `[CRITICAL] Input fields becoming unclickable! ${failedClickAttempts} failed click attempts detected. ` +
            `This suggests modal overlay event handling is broken.`
          );

          // Log diagnostic info
          console.log('Diagnostic Information:');
          console.log('- Overlays present:', overlaysPresent.length);
          overlaysPresent.forEach((overlay, idx) => {
            const pointerEvents = window.getComputedStyle(overlay).pointerEvents;
            console.log(`  Overlay ${idx}: pointer-events=${pointerEvents}, z-index=${window.getComputedStyle(overlay).zIndex}`);
          });

          // Reset counter after logging
          failedClickAttempts = 0;
        }
      } else if (target.matches(':focus') && Date.now() - lastFailureTime > 3000) {
        // Reset counter if input works again
        failedClickAttempts = 0;
      }
    };

    // Monitor click events on all inputs
    document.addEventListener('click', handleInputInteraction, true);

    // Also monitor focus events
    const handleFocusAttempt = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        console.debug('[Input Focus Event]', {
          element: e.target.tagName,
          type: e.target.type,
          id: e.target.id,
          class: e.target.className,
        });
      }
    };

    document.addEventListener('focusin', handleFocusAttempt, true);

    return () => {
      document.removeEventListener('click', handleInputInteraction, true);
      document.removeEventListener('focusin', handleFocusAttempt, true);
    };
  }, []);
}

/**
 * Alternative debug function - can be called manually in browser console
 * Usage: window.debugInputIssue()
 */
export function setupInputDebugConsoleCommand() {
  window.debugInputIssue = () => {
    console.log('=== Input Clickability Debug Report ===');

    const inputs = document.querySelectorAll('input, textarea, select');
    const overlays = document.querySelectorAll('[class*="fixed"][class*="inset-0"]');

    console.log(`\n1. Input Elements Found: ${inputs.length}`);
    inputs.forEach((input, idx) => {
      const isClickable = !window.getComputedStyle(input).pointerEvents.includes('none');
      const isVisible = input.offsetHeight > 0 && input.offsetWidth > 0;
      console.log(`   Input ${idx}: ${input.tagName}, pointer-events:${window.getComputedStyle(input).pointerEvents}, visible: ${isVisible}, clickable: ${isClickable}`);
    });

    console.log(`\n2. Modal Overlays Found: ${overlays.length}`);
    overlays.forEach((overlay, idx) => {
      const pointerEvents = window.getComputedStyle(overlay).pointerEvents;
      const zIndex = window.getComputedStyle(overlay).zIndex;
      const isBlocking = pointerEvents !== 'none';
      console.log(`   Overlay ${idx}: pointer-events:${pointerEvents}, z-index:${zIndex}, blocking:${isBlocking}`);

      // Check children
      const children = overlay.querySelectorAll('*');
      console.log(`      └─ Children count: ${children.length}`);
    });

    console.log('\n3. Event Listener Info:');
    console.log('   onClick vs onMouseDown: Check for improper event delegation');

    console.log('\n4. Suggestions:');
    if (overlays.length > 0) {
      const hasPointerEventsNone = Array.from(overlays).some(o =>
        window.getComputedStyle(o).pointerEvents === 'none'
      );
      console.log(`   - Overlays using pointer-events-none: ${hasPointerEventsNone ? 'YES ✓' : 'NO ✗ - May be blocking inputs'}`);
    }
  };

  console.log('Debug command available: window.debugInputIssue()');
}
