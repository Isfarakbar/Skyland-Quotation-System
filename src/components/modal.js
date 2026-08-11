// ============================================
// SKYLAND ENERGY — Modal Component
// ============================================
import { createIcon } from './icons.js';

let currentModal = null;

export function openModal({ title, content, size = 'md', onClose }) {
  closeModal(); // Close any existing modal

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  const sizeClass = `modal-${size}`;

  overlay.innerHTML = `
    <div class="modal ${sizeClass}">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" id="modal-close-btn" aria-label="Close">
          ${createIcon('x')}
        </button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  `;

  // Prevent background scroll
  document.body.style.overflow = 'hidden';

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
      if (onClose) onClose();
    }
  });

  // Close button
  overlay.querySelector('#modal-close-btn').addEventListener('click', () => {
    closeModal();
    if (onClose) onClose();
  });

  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      if (onClose) onClose();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
  currentModal = overlay;

  // Insert content
  const body = overlay.querySelector('#modal-body');
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }

  return { overlay, body };
}

export function closeModal() {
  if (currentModal) {
    currentModal.remove();
    currentModal = null;
    document.body.style.overflow = '';
  }
}

export function getModalBody() {
  return document.getElementById('modal-body');
}
