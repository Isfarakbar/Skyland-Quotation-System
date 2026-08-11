// ============================================
// SKYLAND ENERGY — Utility Helpers
// ============================================

// Format currency in PKR with commas
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return 'PKR 0';
  const num = Math.round(Number(amount));
  return 'PKR ' + num.toLocaleString('en-PK');
}

// Short format: "1.2M", "450K"
export function formatCurrencyShort(amount) {
  if (amount >= 1000000) return 'PKR ' + (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return 'PKR ' + (amount / 1000).toFixed(0) + 'K';
  return formatCurrency(amount);
}

// Format number with commas
export function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-PK');
}

// Format date: "Aug 11, 2026"
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format date: "11-08-2026"
export function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

// Relative time: "2 days ago"
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Generate a human-readable quotation number with second-level uniqueness.
export function generateQuotationNumber(customerName = '') {
  const initials = customerName
    .split(' ')
    .map(word => word.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .map(word => word[0].toUpperCase())
    .slice(0, 2)
    .join('');
  const prefix = initials || 'XX';
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  return `${prefix}-SLE-${yy}${mm}${dd}-${hh}${min}${sec}`;
}

// Get customer initials for avatar
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

// Format phone for WhatsApp (Pakistan)
export function formatWhatsAppNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('92')) {
    cleaned = '92' + cleaned;
  }
  return cleaned;
}

// Debounce function
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Escape HTML special characters
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Compress image to max width/height and quality
export function compressImage(file, maxSize = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = (err) => reject(err);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Search filter: check if item matches query
export function matchesSearch(item, query, fields) {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some(field => {
    const val = item[field];
    return val && String(val).toLowerCase().includes(q);
  });
}

// Generate unique ID
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Category display names
export const CATEGORY_LABELS = {
  'solar-panel': 'Solar Panel',
  'inverter': 'Inverter',
  'battery': 'Battery',
  'structure': 'Structure',
  'cable': 'Cable',
  'accessory': 'Accessory',
  'service': 'Service',
};

// Status display config
export const STATUS_CONFIG = {
  draft: { label: 'Draft', class: 'badge-draft' },
  sent: { label: 'Sent', class: 'badge-sent' },
  accepted: { label: 'Accepted', class: 'badge-accepted' },
  rejected: { label: 'Rejected', class: 'badge-rejected' },
  expired: { label: 'Expired', class: 'badge-expired' },
};

// System type labels
export const SYSTEM_TYPES = {
  ongrid: 'On-Grid',
  hybrid: 'Hybrid',
  offgrid: 'Off-Grid',
};
