// ============================================================
// MOTEUR DE COUNTDOWN LIVE
// ============================================================
import { calculateCountdown } from './ui.js';

let intervalId = null;

/**
 * Démarre le rafraîchissement des countdowns.
 * Cherche tous les éléments [data-countdown="timestamp"] dans la page.
 */
export function startCountdowns() {
  if (intervalId) clearInterval(intervalId);
  updateAllCountdowns();
  intervalId = setInterval(updateAllCountdowns, 1000);
}

export function stopCountdowns() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function updateAllCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach(el => {
    const ts = parseInt(el.dataset.countdown, 10);
    if (isNaN(ts)) return;

    const now = Date.now();
    const c = calculateCountdown(ts);

    // Cas : dans le passé
    if (c.isPast) {
      // Vérifier si "live" (dans la fenêtre de la course)
      const duration = parseInt(el.dataset.duration || '6', 10);
      const liveUntil = ts + duration * 3600000;

      if (now < liveUntil) {
        el.innerHTML = '<span class="cd-live"><span class="cd-dot"></span> EN COURS</span>';
      } else {
        el.innerHTML = '<span class="cd-past">🏁 Départ passé</span>';
      }
      return;
    }

    // Cas : à venir
    el.innerHTML = `
      <div class="cd-block"><span class="cd-value">${pad(c.days)}</span><span class="cd-label">Jours</span></div>
      <span class="cd-sep">:</span>
      <div class="cd-block"><span class="cd-value">${pad(c.hours)}</span><span class="cd-label">Heures</span></div>
      <span class="cd-sep">:</span>
      <div class="cd-block"><span class="cd-value">${pad(c.minutes)}</span><span class="cd-label">Minutes</span></div>
      <span class="cd-sep">:</span>
      <div class="cd-block"><span class="cd-value">${pad(c.seconds)}</span><span class="cd-label">Secondes</span></div>
    `;
  });
}

function pad(n) {
  return String(n).padStart(2, '0');
}