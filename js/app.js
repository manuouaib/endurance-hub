// ============================================================
// APP.JS — Point d'entrée, state global, render
// ============================================================
import { storage } from './storage.js';
import { showToast, openModal, closeModal, showLoader, escapeHtml,
         generateId, formatDate, formatTime, formatDateTime,
         getHourLabel, getRealHourRange } from './ui.js';
import { startCountdowns } from './countdown.js';
import * as actions from './actions.js';
import * as re from './render-event.js';

// ============================================================
// STATE GLOBAL
// ============================================================
export const state = {
  events: [],
  users: [],
  user: null,
  gameConfigs: {},
  gameIds: [],
  page: 'home',
  currentEventId: null,
  editingEvent: null,
  eventFilter: 'upcoming',
  searchQuery: '',
  openDepartures: {},
  crewForm: null,
  drafts: {},
  adminSelectedGame: null,
  userSearch: ''
};

window.actions = actions;
window.state = state;
window.renderEvent = re.renderEventDetail;

// ============================================================
// CONFIG JEUX PAR DÉFAUT
// ============================================================
export const DEFAULT_GAME_CONFIGS = {
  lmu: {
    name: 'LMU',
    icon: '🏎️',
    circuits: [
      { id: 'lemans', name: '🏁 Circuit de la Sarthe' },
      { id: 'spa', name: '🇧🇪 Spa-Francorchamps' },
      { id: 'monza', name: '🇮🇹 Monza' },
      { id: 'silverstone', name: '🇬🇧 Silverstone' },
      { id: 'sebring', name: '🇺🇸 Sebring' },
      { id: 'fuji', name: '🇯🇵 Fuji Speedway' },
      { id: 'bahrain', name: '🇧🇭 Bahrain' },
      { id: 'imola', name: '🇮🇹 Imola' },
      { id: 'portimao', name: '🇵🇹 Portimão' },
      { id: 'interlagos', name: '🇧🇷 Interlagos' }
    ],
    categories: ['Hypercar', 'LMP2', 'LMP3', 'GT3', 'GTE'],
    cars: {
      'Hypercar': ['Porsche 963', 'Toyota GR010', 'Ferrari 499P', 'Peugeot 9X8', 'BMW M Hybrid V8', 'Cadillac V-Series.R', 'Alpine A424'],
      'LMP2': ['Oreca 07 Gibson', 'Ligier JS P217'],
      'LMP3': ['Ligier JS P325', 'Duqueine D09'],
      'GT3': ['Porsche 911 GT3 R', 'Ferrari 296 GT3', 'BMW M4 GT3', 'Aston Martin Vantage GT3', 'Mercedes-AMG GT3', 'McLaren 720S GT3'],
      'GTE': ['Porsche 911 RSR-19', 'Ferrari 488 GTE', 'Aston Martin Vantage GTE']
    }
  },
  iracing: {
    name: 'iRacing',
    icon: '🏁',
    circuits: [
      { id: 'lemans', name: '🏁 Circuit de la Sarthe' },
      { id: 'spa', name: '🇧🇪 Spa-Francorchamps' },
      { id: 'monza', name: '🇮🇹 Monza' },
      { id: 'daytona', name: '🇺🇸 Daytona' },
      { id: 'sebring', name: '🇺🇸 Sebring' },
      { id: 'watkins', name: '🇺🇸 Watkins Glen' },
      { id: 'roadatlanta', name: '🇺🇸 Road Atlanta' }
    ],
    categories: ['LMP2', 'GT3', 'GTE', 'GT4'],
    cars: {
      'LMP2': ['Dallara P217', 'Oreca 07'],
      'GT3': ['Porsche 911 GT3 R', 'Ferrari 296 GT3', 'BMW M4 GT3', 'Mercedes-AMG GT3'],
      'GTE': ['Porsche 911 RSR', 'Ferrari 488 GTE', 'BMW M8 GTE', 'Corvette C8.R'],
      'GT4': ['Porsche Cayman GT4', 'BMW M4 GT4']
    }
  },
  acc: {
    name: 'ACC',
    icon: '🏎️',
    circuits: [
      { id: 'monza', name: '🇮🇹 Monza' },
      { id: 'spa', name: '🇧🇪 Spa-Francorchamps' },
      { id: 'silverstone', name: '🇬🇧 Silverstone' },
      { id: 'nurburgring', name: '🇩🇪 Nürburgring' },
      { id: 'imola', name: '🇮🇹 Imola' }
    ],
    categories: ['GT3', 'GT4'],
    cars: {
      'GT3': ['Porsche 911 GT3 R', 'Ferrari 296 GT3', 'BMW M4 GT3', 'Mercedes-AMG GT3', 'Audi R8 GT3'],
      'GT4': ['Porsche Cayman GT4', 'BMW M4 GT4', 'Aston Martin Vantage GT4']
    }
  }
};

const DEFAULT_GAME_IDS = ['lmu', 'iracing', 'acc'];

export const CATEGORY_COLORS = {
  Hypercar: 'hyper', LMP2: 'lmp2', LMP3: 'lmp3',
  GT3: 'gt3', GTE: 'gte', GT4: 'gt3', TCR: 'gt3', 'Porsche Cup': 'special'
};

const CATEGORY_DOT = {
  Hypercar: 'hyper', LMP2: 'lmp2', LMP3: 'lmp3',
  GT3: 'gt3', GTE: 'gte', GT4: 'gt3', TCR: 'gt3', 'Porsche Cup': 'gt3'
};

export const ROLES = ['admin', 'organizer', 'pilot'];
export const SETUP_EXTENSIONS = ['.txt', '.json', '.xml', '.ini', '.cfg', '.svm'];

// ============================================================
// HELPERS
// ============================================================
export function badgeClass(cat) {
  return CATEGORY_COLORS[cat] || 'private';
}

export function canManage() {
  return ['admin', 'organizer'].includes(state.user?.role);
}

export function isAdmin() {
  return state.user?.role === 'admin';
}

export function getGameConfig(gameId) {
  return state.gameConfigs[gameId] || null;
}

export function getGames() {
  return state.gameIds.map(id => ({ id, ...state.gameConfigs[id] })).filter(g => g.name);
}

export function getCircuitsForGame(gameId) {
  return getGameConfig(gameId)?.circuits || [];
}

export function getCircuitName(gameId, circuitId) {
  if (!circuitId) return 'Circuit';
  const circuits = getCircuitsForGame(gameId);
  const found = circuits.find(c => c.id === circuitId);
  return found?.name || circuitId;
}

export function getCategoriesForGame(gameId) {
  return getGameConfig(gameId)?.categories || [];
}

export function getCarsForGame(gameId, category) {
  const config = getGameConfig(gameId);
  return config?.cars?.[category] || [];
}

export function getEvent(id) {
  return state.events.find(e => e.id === id);
}

export function getDeparture(eventId, depId) {
  return getEvent(eventId)?.departures?.find(d => d.id === depId);
}

export function getPilotHoursText(pilot, startTs) {
  if (pilot.status === 'whole') return '🏁 Toute la course';
  if (pilot.status === 'unavailable') return '❌ Indisponible';
  return pilot.status.split(',').filter(Boolean).map(h => {
    const idx = parseInt(h.replace('h', ''), 10) - 1;
    return getHourLabel(startTs, idx);
  }).join(' · ');
}

export function getPilotCarText(pilot) {
  if (pilot.carAny || (pilot.cars && pilot.cars.length === 0)) return '🔀 Peu importe';
  if (pilot.cars && pilot.cars.length > 0) return pilot.cars.join(' · ');
  return '🚗 À définir';
}

// ============================================================
// RENDER — NAV
// ============================================================
export function renderNav() {
  const nav = document.getElementById('navActions');
  if (!nav) return;

  let html = `<button class="btn btn-outline btn-sm" data-action="home">🏠 Accueil</button>`;

  if (canManage()) {
    html += `<button class="btn btn-primary btn-sm" data-action="create">➕ Nouvelle course</button>`;
  }

  if (isAdmin()) {
    html += `<button class="btn btn-outline btn-sm" data-action="adminPanel">⚙️ Admin</button>`;
    html += `<button class="btn btn-outline btn-sm" data-action="adminUsers">👥 Comptes</button>`;
    html += `<button class="btn btn-outline btn-sm" data-action="adminCleanup" title="Supprimer les événements passés">🧹 Clean</button>`;
  }

  if (state.user) {
    html += `<button class="btn btn-outline btn-sm" data-action="myEntries">📋 Mes inscriptions</button>`;
  }

  if (state.user) {
    const avatar = state.user.discordAvatar
      || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(state.user.name)}`;
    html += `
      <div class="user-chip">
        <img src="${escapeHtml(avatar)}" alt="">
        <div>
          <div class="user-name">${escapeHtml(state.user.name)}</div>
          <div class="user-role">${escapeHtml(state.user.role)}</div>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" data-action="logout">🚪</button>
    `;
  } else {
    html += `<button class="btn btn-discord btn-sm" data-action="openLogin">💜 Connexion</button>`;
  }

  nav.innerHTML = html;
}

// ============================================================
// RENDER — HOME
// ============================================================
export function renderHome() {
  state.page = 'home';
  state.currentEventId = null;
  const main = document.getElementById('mainContent');
  if (!main) return;

  const now = Date.now();

  const allDepartures = [];
  state.events.forEach(event => {
    (event.departures || []).forEach(dep => {
      allDepartures.push({
        ...dep,
        event,
        eventId: event.id,
        eventName: event.name,
        eventType: event.eventType || 'private',
        eventCategories: event.categories || [],
        eventDuration: event.duration || 6,
        eventCircuit: event.circuit,
        eventSetups: event.setups || {},
        gameId: event.gameId || 'lmu'
      });
    });
  });

  let filtered = allDepartures.filter(d => {
    const matchesFilter = state.eventFilter === 'archived'
      ? d.startsAt < now
      : d.startsAt >= now;
    if (!matchesFilter) return false;
    if (!state.searchQuery) return true;

    const q = state.searchQuery.toLowerCase();
    return d.eventName.toLowerCase().includes(q)
      || (d.eventCircuit || '').toLowerCase().includes(q)
      || d.eventCategories.some(c => c.toLowerCase().includes(q))
      || d.availability.some(p => (p.name || '').toLowerCase().includes(q));
  });

  filtered.sort((a, b) => a.startsAt - b.startsAt);

  const totalEvents = state.events.length;
  const totalPilots = new Set(state.events.flatMap(e =>
    (e.departures || []).flatMap(d =>
      (d.availability || []).filter(r => r.status !== 'unavailable').map(r => r.userId)
    )
  )).size;
  const totalHours = state.events.reduce((acc, e) => acc + (e.duration || 0) * (e.departures?.length || 0), 0);

  let html = `
    <div class="fade-in">
      <div class="flex-between mb-8">
        <div>
          <h1 style="font-size:2rem;font-weight:800;letter-spacing:-0.5px;">🏁 Calendrier</h1>
          <p class="text-secondary" style="font-size:0.95rem;">
            ${state.events.length} course${state.events.length > 1 ? 's' : ''} ·
            ${filtered.filter(d => d.startsAt >= now).length} départ${filtered.filter(d => d.startsAt >= now).length > 1 ? 's' : ''} à venir
          </p>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-sm ${state.eventFilter === 'upcoming' ? 'btn-primary' : 'btn-outline'}" data-action="filterUpcoming">📅 À venir</button>
          <button class="btn btn-sm ${state.eventFilter === 'archived' ? 'btn-primary' : 'btn-outline'}" data-action="filterArchived">📦 Archivées</button>
        </div>
      </div>

      <div class="stats-dashboard">
        <div class="stat-card">
          <div class="stat-number">${totalEvents}</div>
          <div class="stat-label">🏁 Courses</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalPilots}</div>
          <div class="stat-label">👥 Pilotes</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalHours}</div>
          <div class="stat-label">⏱ Heures totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${state.gameIds.length}</div>
          <div class="stat-label">🎮 Jeux</div>
        </div>
      </div>

      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="searchInput" placeholder="Rechercher une course, un circuit, un pilote..."
               value="${escapeHtml(state.searchQuery)}">
      </div>
  `;

  if (filtered.length === 0) {
    html += `
      <div class="empty">
        <span class="big-icon">🏁</span>
        <h3>Aucun départ ${state.eventFilter === 'archived' ? 'archivé' : 'à venir'}</h3>
        <p class="text-dim">${canManage() ? 'Crée ta première course !' : 'Les courses apparaîtront ici.'}</p>
        ${canManage() ? `<button class="btn btn-primary mt-16" data-action="create">➕ Créer une course</button>` : ''}
      </div>
    `;
  } else {
    html += `<div class="departures-grid">`;
    filtered.forEach(dep => {
      html += renderDepartureTile(dep, now);
    });
    html += `</div>`;
  }

  html += `</div>`;
  main.innerHTML = html;
  renderNav();
  startCountdowns();

  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderHome();
  });
}

// ============================================================
// RENDER — TUILE DE DÉPART
// ============================================================
function renderDepartureTile(dep, now) {
  const ts = dep.startsAt;
  const isPast = ts < now;
  const isLive = ts <= now && ts + dep.eventDuration * 3600000 > now;

  const config = getGameConfig(dep.gameId);
  const gameBadge = config ? 'badge-game-' + dep.gameId : 'badge-private';

  const allPilots = dep.availability || [];
  const totalPilots = allPilots.filter(p => p.status !== 'unavailable').length;
  const totalCrews = (dep.crews || []).length;
  const duration = dep.eventDuration || 6;

  const categories = dep.eventCategories || [];
  let availHtml = '';

  categories.forEach(cat => {
    const pilotsInCat = allPilots.filter(p => p.category === cat && p.status !== 'unavailable');
    if (pilotsInCat.length === 0) return;

    const pilotsWithAvail = pilotsInCat.map(p => {
      const hours = new Set();
      if (p.status === 'whole') {
        for (let i = 0; i < duration; i++) hours.add(i);
      } else {
        (p.status || '').split(',').forEach(h => {
          const idx = parseInt(h.replace('h', ''), 10) - 1;
          if (idx >= 0 && idx < duration) hours.add(idx);
        });
      }
      return { ...p, hourSet: hours };
    });

    const hourCounts = new Array(duration).fill(0);
    pilotsWithAvail.forEach(p => {
      p.hourSet.forEach(idx => { hourCounts[idx]++; });
    });

    const catColorClass = badgeClass(cat);
    const dotCls = CATEGORY_DOT[cat] || 'gt3';

    availHtml += `
      <div class="avail-section">
        <div class="avail-category-header">
          <span class="cat-badge badge-${catColorClass}">
            <span class="cat-dot ${dotCls}"></span>
            ${escapeHtml(cat)}
          </span>
          <span>${pilotsInCat.length} pilote${pilotsInCat.length > 1 ? 's' : ''}</span>
        </div>
        <div class="avail-grid">
          ${pilotsWithAvail.slice(0, 5).map(p => {
            const isMine = p.userId === state.user?.id;
            const carText = getPilotCarText(p);
            return `
              <div class="avail-row">
                <div class="pilot-info">
                  <span class="pilot-name" title="${escapeHtml(p.name)}">
                    ${escapeHtml(p.name)} ${isMine ? '<span class="mine-star">⭐</span>' : ''}
                  </span>
                  <span class="pilot-car" title="${escapeHtml(carText)}">${escapeHtml(carText)}</span>
                </div>
                <div class="avail-cells">
                  ${Array.from({ length: duration }, (_, idx) => {
                    const isPresent = p.hourSet.has(idx);
                    const count = hourCounts[idx] || 0;
                    const realHour = getHourLabel(ts, idx);
                    let cls = 'hour-slot';
                    if (isPresent) {
                      cls += count > 1 ? ' present-multiple' : ' present';
                      if (isMine) cls += ' present-highlight';
                    } else {
                      cls += ' absent';
                    }
                    const hourLabel = realHour.replace(':00', '');
                    return `
                      <div class="avail-cell">
                        <div class="${cls}" title="${escapeHtml(p.name)} · ${realHour} · ${isPresent ? '✅' : '❌'} (${count} pilote${count > 1 ? 's' : ''})"><span class="slot-tooltip">${realHour}</span></div>
                        <span class="cell-label ${isPresent ? 'active-label' : ''}">${hourLabel}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
          ${pilotsWithAvail.length > 5 ? `
            <div class="avail-row" style="opacity:0.6;">
              <div class="pilot-info">
                <span class="pilot-name" style="font-style:italic;">+${pilotsWithAvail.length - 5} autre${pilotsWithAvail.length - 5 > 1 ? 's' : ''}</span>
              </div>
              <div class="avail-cells">
                ${Array.from({ length: duration }, () => '<div class="avail-cell"><div class="hour-slot absent"></div><span class="cell-label"></span></div>').join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  return `
    <div class="departure-tile">
      <div class="tile-header">
        <span class="event-name">${escapeHtml(dep.eventName)}</span>
        <span class="departure-number">Départ #${(dep.event.departures || []).findIndex(d => d.id === dep.id) + 1}</span>
      </div>
      <div class="meta">
        <span>📍 ${escapeHtml(getCircuitName(dep.gameId, dep.eventCircuit))}</span>
        <span>⏱ ${dep.eventDuration}h</span>
        <span>👥 ${totalPilots} pilote${totalPilots > 1 ? 's' : ''}</span>
        <span>🏎 ${totalCrews} équipage${totalCrews > 1 ? 's' : ''}</span>
      </div>
      <div class="badges">
        <span class="badge ${gameBadge}">${config ? config.icon + ' ' + config.name : '🎮'}</span>
        <span class="badge badge-${dep.eventType === 'private' ? 'private' : 'special'}">${escapeHtml(dep.eventType)}</span>
        ${dep.eventCategories.map(c => `<span class="badge badge-${badgeClass(c)}">${escapeHtml(c)}</span>`).join('')}
      </div>

      ${availHtml}

      ${renderTileSetups(dep)}

      <div class="countdown-section">
        <div class="departure-datetime">
          📅 <strong>${escapeHtml(formatDate(ts))}</strong> à <strong>${escapeHtml(formatTime(ts))}</strong>
        </div>
        <div class="countdown-display" data-countdown="${ts}" data-duration="${dep.eventDuration}">
          <div class="cd-block"><span class="cd-value">--</span><span class="cd-label">J</span></div>
        </div>
      </div>

      <div class="tile-footer">
        <button class="btn btn-primary btn-sm" data-action="open" data-id="${dep.eventId}" data-dep="${dep.id}">
          🔗 Voir la course →
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// RENDER — BOUTONS SETUPS SUR LA TUILE
// ============================================================
function renderTileSetups(dep) {
  const setups = dep.eventSetups || {};
  const categories = dep.eventCategories || [];

  const catsWithSetups = categories.filter(cat => {
    const files = setups[cat];
    return files && files.length > 0;
  });

  if (catsWithSetups.length === 0) return '';

  return `
    <div class="tile-setups">
      <span class="tile-setups-label">📁 Setups :</span>
      ${catsWithSetups.map(cat => {
        const files = setups[cat] || [];
        const latest = files.reduce((a, b) =>
          (a.uploadedAt || 0) > (b.uploadedAt || 0) ? a : b
        );
        return `
          <button type="button" class="setup-btn"
                  data-action="downloadSetupFromTile"
                  data-event="${dep.eventId}"
                  data-category="${escapeHtml(cat)}"
                  data-setup="${latest.id}"
                  title="Télécharger le dernier setup ${escapeHtml(cat)} (${escapeHtml(latest.name)})">
            📥 ${escapeHtml(cat)}
            ${files.length > 1 ? `<span class="setup-count">${files.length}</span>` : ''}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// ============================================================
// EXPORT — RENDER EVENT DETAIL
// ============================================================
export function renderEventDetail() {
  re.renderEventDetail();
}

// ============================================================
// INIT
// ============================================================
async function init() {
  showLoader(true, 'Connexion à Supabase…');

  try {
    const data = await storage.loadAll();
    state.events = data.events || [];
    state.users = data.users || [];
    state.user = data.user || null;

    state.gameConfigs = Object.keys(data.gameConfigs || {}).length
      ? data.gameConfigs
      : DEFAULT_GAME_CONFIGS;
    state.gameIds = (data.gameIds && data.gameIds.length)
      ? data.gameIds
      : DEFAULT_GAME_IDS;

    if (!data.gameConfigs || !Object.keys(data.gameConfigs).length) {
      await storage.saveGameConfigs(state.gameConfigs, state.gameIds);
    }

    showLoader(false);
    renderHome();

    // ✅ Auto-suppression des événements passés
    try {
      await actions.autoDeletePastEvents();
    } catch (err) {
      console.error('Erreur autoDeletePastEvents:', err);
    }

    storage.subscribe(() => {
      storage.loadAll().then(d => {
        state.events = d.events;
        state.users = d.users;
        state.user = d.user;
        state.gameConfigs = Object.keys(d.gameConfigs || {}).length ? d.gameConfigs : state.gameConfigs;
        state.gameIds = (d.gameIds && d.gameIds.length) ? d.gameIds : state.gameIds;

        if (state.page === 'home') renderHome();
        else if (state.page === 'event') re.renderEventDetail();
        else if (state.page === 'admin') import('./render-admin.js').then(m => m.renderAdmin());
        showToast('🔄 Données mises à jour', 'info');
      });
    });

    if (state.user) {
      showToast(`👋 Bienvenue ${state.user.name} !`, 'success');
    }

  } catch (err) {
    console.error('Erreur init:', err);
    showLoader(false);
    showToast('Erreur de connexion : ' + err.message, 'error');
    document.getElementById('mainContent').innerHTML = `
      <div class="empty">
        <span class="big-icon">⚠️</span>
        <h3>Erreur de connexion</h3>
        <p class="text-dim">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// ============================================================
// ÉCOUTEURS GLOBAUX
// ============================================================
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  if (target.tagName === 'INPUT') return;
  e.preventDefault();
  const action = target.dataset.action;
  if (typeof actions[action] === 'function') {
    actions[action](target);
  } else {
    console.warn('Action inconnue:', action);
  }
});

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', (e) => {
    if (e.target === m) m.classList.remove('active');
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

init();