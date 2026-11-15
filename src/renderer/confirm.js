import { el } from './dom.js';

/**
 * In-app confirmation. A native confirm() would blur the window and the pop-up
 * would hide itself ("close when clicking outside"), so deletes never went through.
 * Resolves true on Confirm, false on Cancel/Esc. Cancel has focus, so Enter cancels.
 */
export function confirmAction(message, confirmLabel = 'Delete') {
  const container = document.getElementById('confirm');
  return new Promise((resolve) => {
    const finish = (answer) => {
      document.removeEventListener('keydown', onKeyDown, true);
      container.replaceChildren();
      container.hidden = true;
      resolve(answer);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(false);
      else if (event.key === 'Tab') {
        // Keep focus inside the dialog.
        event.preventDefault();
        (document.activeElement === cancelButton ? confirmButton : cancelButton).focus();
      // Enter/Space keep their normal effect on the focused button; every other key is swallowed.
      } else if (!['Enter', ' '].includes(event.key)) event.preventDefault();
      event.stopPropagation();
    };
    const confirmButton = el('button', { className: 'primary', text: confirmLabel, on: { click: () => finish(true) } });
    const cancelButton = el('button', { text: 'Cancel', on: { click: () => finish(false) } });
    container.replaceChildren(el('div', { className: 'confirm-box' },
      el('p', { text: message }),
      el('div', { className: 'form-actions' }, cancelButton, confirmButton)));
    container.hidden = false;
    document.addEventListener('keydown', onKeyDown, true);
    cancelButton.focus();
  });
}
