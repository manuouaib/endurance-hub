// ============================================================
// RENDER-MY-ENTRIES — Page "Mes inscriptions"
// ============================================================
import { escapeHtml, formatDate, formatTime } from './ui.js';
import { startCountdowns } from './countdown.js';
import * as app from './app.js';

export function renderMyEntries() {
  app.state.page = 'myEntries';
  app.state.currentEventId = null;

  const main = document.getElementById('mainContent');
  if (!main) return;

  if (!app.state.user) {
    main.innerHTML = `
      <div class="fade-in">
        <div class="empty">
          <span class="big-icon">🔑</span>
          <h3>Connecte-toi</h3>
          <p class="text-dim">Tu dois être connecté pour voir tes inscriptions.</p>
          <button class="btn btn-discord mt-16" data-action="openLogin">💜 Se connecter</button>
        </div>
      </div>
    `;
    app.renderNav();
    return;
  }

  const user = app.state.user;
  const now = Date.now();

  const entries = [];

  app.state.events.forEach(event => {
    (event.departures || []).forEach(departure => {
      const reg = (departure.availability || []).find(r => r.userId === user.id);
      if (!reg) return;

      const crew = (departure.crews || []).find(c =>
        (c.registrationIds || []).includes(reg.id)
      );

      entries.push({ event, departure, reg, crew });
    });
  });

  entries.sort((a, b) => {
    const aFuture = a.departure.startsAt >= now;
    const bFuture = b.departure.startsAt >= now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return a.departure.startsAt - b.departure.startsAt;
  });

  const futureCount = entries.filter(e => e.departure.startsAt >= now).length;
  const crewCount = entries.filter(e => e.crew).length;

  let html = `
    <div class="fade-in">
      <div class="flex-between mb-16">
        <div>
          <h1 style="font-size:2rem;font-weight:800;letter-spacing:-0.5px;">📋 Mes inscriptions</h1>
          <p class="text-secondary" style="font-size:0.95rem;">
            ${entries.length} inscription${entries.length > 1 ? 's' : ''} ·
            ${futureCount} à venir ·
            ${crewCount} en équipage
          </p>
        </div>
        <button class="btn btn-outline btn-sm" data-action="home">← Retour au calendrier</button>
      </div>
  `;

  if (entries.length === 0) {
    html += `
      <div class="empty">
        <span class="big-icon">📋</span>
        <h3>Aucune inscription</h3>
        <p class="text-dim">Tu n'es inscrit à aucune course pour le moment.</p>
        <button class="btn btn-primary mt-16" data-action="home">🏁 Voir les courses</button>
      </div>
    `;
  } else {
    html += `<div class="my-entries-grid">`;
    entries.forEach(entry => {
      html += renderEntryCard(entry, now);
    });
    html += `</div>`;
  }

  html += `</div>`;
  main.innerHTML = html;
  app.renderNav();
  startCountdowns();
}

function renderEntryCard({ event, departure, reg, crew }, now) {
  const config = app.getGameConfig(event.gameId);
  const gameBadge = config ? 'badge-game-' + event.gameId : 'badge-private';
  const isPast = departure.startsAt < now;
  const isLive = departure.startsAt <= now && departure.startsAt + event.duration * 3600000 > now;

  let statusIcon = '⏳';
  let statusText = 'À venir';
  let statusClass = 'upcoming';
  if (isPast) {
    statusIcon = '✅';
    statusText = 'Passé';
    statusClass = 'past';
  } else if (isLive) {
    statusIcon = '🔴';
    statusText = 'EN COURS';
    statusClass = 'live';
  }

  const hoursText = app.getPilotHoursText(reg, departure.startsAt);
  const carText = app.getPilotCarText(reg);

  const diff = departure.startsAt - now;
  const daysLeft = Math.floor(diff / 86400000);
  const hoursLeft = Math.floor((diff % 86400000) / 3600000);
  const minutesLeft = Math.floor((diff % 3600000) / 60000);

  const canEdit = !isPast;

  return `
    <div class="entry-card ${statusClass}">
      <div class="entry-header">
        <div class="entry-title">
          <span class="entry-status-icon">${statusIcon}</span>
          <h3>${escapeHtml(event.name)}</h3>
          <span class="entry-status-label ${statusClass}">${statusText}</span>
        </div>
        ${!isPast && !isLive ? `<span class="entry-days-left">J-${daysLeft}</span>` : ''}
      </div>

      <div class="entry-meta">
        <span class="badge ${gameBadge}">${config ? config.icon + ' ' + config.name : '🎮'}</span>
        <span class="badge badge-${app.badgeClass(reg.category)}">${escapeHtml(reg.category)}</span>
        <span class="entry-meta-item">📍 ${escapeHtml(app.getCircuitName(event.gameId, event.circuit))}</span>
        <span class="entry-meta-item">⏱ ${event.duration}h</span>
      </div>

      <div class="entry-datetime">
        📅 ${escapeHtml(formatDate(departure.startsAt))} à ${escapeHtml(formatTime(departure.startsAt))}
      </div>

      ${!isPast && !isLive ? `
        <div class="entry-countdown-inline">
          <span class="entry-countdown-label">Départ dans</span>
          <span class="entry-countdown-value">
            ${daysLeft > 0 ? `<strong>${daysLeft}</strong>j ` : ''}
            <strong>${String(hoursLeft).padStart(2, '0')}</strong>h
            <strong>${String(minutesLeft).padStart(2, '0')}</strong>min
          </span>
        </div>
      ` : isLive ? `
        <div class="entry-countdown-inline live">
          <span class="cd-dot"></span>
          <span>EN COURS</span>
        </div>
      ` : ''}

      <div class="entry-details">
        <div class="entry-detail-row">
          <span class="entry-label">🏎 Voiture</span>
          <span class="entry-value">${escapeHtml(carText)}</span>
        </div>
        <div class="entry-detail-row">
          <span class="entry-label">⏱ Créneaux</span>
          <span class="entry-value">${escapeHtml(hoursText)}</span>
        </div>
        ${crew ? `
          <div class="entry-detail-row">
            <span class="entry-label">📌 Équipage</span>
            <span class="entry-value entry-crew-name">
              ${escapeHtml(crew.name)}
              ${crew.car ? `· ${escapeHtml(crew.car)}` : ''}
            </span>
          </div>
        ` : ''}
      </div>

      <div class="entry-actions">
        <button type="button" class="btn btn-primary btn-sm"
                data-action="open" data-id="${event.id}" data-dep="${departure.id}">
          🔗 Voir la course
        </button>
        ${canEdit ? `
          <button type="button" class="btn btn-outline btn-sm"
                  data-action="open" data-id="${event.id}" data-dep="${departure.id}">
            ✏️ Modifier
          </button>
        ` : ''}
      </div>
    </div>
  `;
}