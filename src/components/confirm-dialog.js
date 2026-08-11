// ============================================
// SKYLAND ENERGY — Confirm Dialog
// ============================================
import { createIcon } from './icons.js';

export function showConfirm({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  type = 'danger', // danger | warning
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const iconName = type === 'danger' ? 'alert-circle' : 'alert-triangle';

    overlay.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-body" style="padding: 2rem;">
          <div class="confirm-icon confirm-icon-${type}">
            ${createIcon(iconName, 24)}
          </div>
          <h3 class="confirm-title">${title}</h3>
          <p class="confirm-text">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
          <button class="btn btn-${type}" id="confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      document.body.style.overflow = '';
      resolve(result);
    };

    overlay.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}
