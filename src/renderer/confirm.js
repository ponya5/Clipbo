import { el } from './dom.js';

/**
 * In-app confirmation. A native confirm() would blur the window and the pop-up
 * would hide itself ("close when clicking outside"), so deletes never went through.
 * Resolves true on Confirm/Enter, false on Cancel/Esc.
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
      if (event.key !== 'Escape' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      finish(event.key === 'Enter');
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
