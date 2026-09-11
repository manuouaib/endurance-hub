// ============================================================
// UI HELPERS : Toasts, Modals, Formatage
// ============================================================

// ============================================================
// TOASTS
// ============================================================
export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
    <span class="toast-close">✕</span>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// ============================================================
// MODALS
// ============================================================
export function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m => {
    m.classList.remove('active');
  });
}

// ============================================================
// LOADER
// ============================================================
export function showLoader(active, text = 'Chargement…') {
  const overlay = document.getElementById('loaderOverlay');
  const textEl = document.getElementById('loaderText');
  if (overlay) overlay.classList.toggle('active', active);
  if (textEl && text) textEl.textContent = text;
}

// ============================================================
// HELPERS
// ============================================================
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

export function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// FORMATAGE DATE / HEURE (Europe/Paris)
// ============================================================
export function formatDate(ts) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeZone: 'Europe/Paris'
  }).format(new Date(ts));
}

export function formatTime(ts) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeStyle: 'short',
    timeZone: 'Europe/Paris'
  }).format(new Date(ts));
}

export function formatDateTime(ts) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris'
  }).format(new Date(ts));
}

// ============================================================
// COUNTDOWN (calcul pur)
// ============================================================
export function calculateCountdown(targetTs) {
  const diff = targetTs - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, isLive: false };
  }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, isPast: false, isLive: false };
}

// ============================================================
// HEURE RÉELLE (décalage depuis le début de la course)
// ============================================================
export function getHourLabel(startTs, slotIndex) {
  const date = new Date(startTs);
  date.setHours(date.getHours() + slotIndex);
  return date.getHours().toString().padStart(2, '0') + ':00';
}

export function getRealHourRange(startTs, slotIndex) {
  const date = new Date(startTs);
  const startHour = date.getHours() + slotIndex;
  const endHour = startHour + 1;
  return startHour.toString().padStart(2, '0') + 'h - ' + endHour.toString().padStart(2, '0') + 'h';
}