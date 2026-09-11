// ============================================================
// RENDER-EVENT — Page détail d'une course
// ============================================================
import { escapeHtml, formatDate, formatTime, formatDateTime, getHourLabel, getRealHourRange, generateId } from './ui.js';
import { startCountdowns } from './countdown.js';
import * as app from './app.js';

// ============================================================
// POINT D'ENTRÉE
// ============================================================
export function renderEventDetail() {
  const event = app.getEvent(app.state.currentEventId);
  if (!event) {
    app.renderHome();
    return;
  }

  app.state.page = 'event';
  const main = document.getElementById('mainContent');
  if (!main) return;

  const totalPilots = new Set(
    (event.departures || []).flatMap(d =>
      (d.availability || []).filter(r => r.status !== 'unavailable').map(r => r.id)
    )
  ).size;
  const totalCrews = (event.departures || []).reduce((sum, d) => sum + (d.crews || []).length, 0);
  const config = app.getGameConfig(event.gameId);
  const gameBadge = config ? 'badge-game-' + event.gameId : 'badge-private';

  let html = `
    <div class="fade-in">
      <div class="flex-between mb-16">
        <button class="btn btn-outline btn-sm" data-action="home">← Retour au calendrier</button>
        <div class="flex gap-8">
          ${app.canManage() ? `<button class="btn btn-primary btn-sm" data-action="editEvent">✏️ Modifier</button>` : ''}
          ${app.isAdmin() ? `<button class="btn btn-danger btn-sm" data-action="deleteEvent">🗑 Supprimer</button>` : ''}
        </div>
      </div>

      <div class="detail-header">
        <div>
          <h1>${escapeHtml(event.name)}</h1>
          <div class="sub">
            <span class="badge ${gameBadge}" style="font-size:0.75rem;">${config ? config.icon + ' ' + config.name : '🎮 Inconnu'}</span>
            <span class="badge badge-${event.eventType === 'private' ? 'private' : 'special'}" style="font-size:0.75rem;">${escapeHtml(event.eventType || 'Privé')}</span>
            · ${event.duration}h · ${(event.departures || []).length} départ${(event.departures || []).length > 1 ? 's' : ''}
            · ${escapeHtml(app.getCircuitName(event.gameId, event.circuit))}
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat"><strong>${event.duration}</strong><small>Heures</small></div>
        <div class="stat"><strong>${(event.departures || []).length}</strong><small>Départs</small></div>
        <div class="stat"><strong>${totalPilots}</strong><small>Pilotes</small></div>
        <div class="stat"><strong>${totalCrews}</strong><small>Équipages</small></div>
      </div>

      <div class="badges mb-16" style="gap:8px;">
        ${(event.categories || []).map(c => `<span class="badge badge-${app.badgeClass(c)}" style="font-size:0.85rem;padding:6px 18px;">${escapeHtml(c)}</span>`).join('')}
      </div>

      ${renderSetupSection(event)}

      <div class="section-divider">🏎 Départs</div>
  `;

  (event.departures || []).forEach((departure, idx) => {
    html += renderDepartureAccordion(event, departure, idx);
  });

  html += `</div>`;
  main.innerHTML = html;
  app.renderNav();
  startCountdowns();
}

// ============================================================
// ACCORDÉON DÉPART
// ============================================================
function renderDepartureAccordion(event, departure, idx) {
  const isDepPast = departure.startsAt < Date.now();
  const isDepLive = departure.startsAt <= Date.now()
    && departure.startsAt + (event.duration || 6) * 3600000 > Date.now();
  const avail = departure.availability || [];
  const crews = departure.crews || [];
  const isOpen = app.state.openDepartures[departure.id]
    || (idx === 0 && Object.keys(app.state.openDepartures).length === 0);

  return `
    <details class="departure" ${isOpen ? 'open' : ''} id="dep-${departure.id}">
      <summary>
        <span>
          <strong>🏎 Départ ${idx + 1}</strong>
          <span class="departure-date">· ${escapeHtml(formatDate(departure.startsAt))}</span>
          <span class="departure-meta">· ${escapeHtml(formatTime(departure.startsAt))}</span>
        </span>
        <span class="flex-center">
          <span class="departure-meta">${avail.filter(r => r.status !== 'unavailable').length} inscrit${avail.filter(r => r.status !== 'unavailable').length > 1 ? 's' : ''} · ${crews.length} équipage${crews.length > 1 ? 's' : ''}</span>
          ${isDepLive ? '<span class="status-live" style="font-size:0.7rem;">🔴 EN COURS</span>' : ''}
          <span class="arrow">▼</span>
        </span>
      </summary>
      <div class="body">
        ${!isDepPast ? renderRegistrationForm(event, departure) : '<p class="text-dim" style="margin-bottom:14px;">🔒 Inscriptions verrouillées</p>'}
        ${!isDepPast && app.canManage() ? renderCrewManagement(event, departure) : ''}
        <div class="section-divider">👥 Pilotes inscrits · ${avail.filter(r => r.status !== 'unavailable').length}</div>
        ${renderPilotsList(event, departure, avail)}
      </div>
    </details>
  `;
}

// ============================================================
// FORMULAIRE D'INSCRIPTION
// ============================================================
function renderRegistrationForm(event, departure) {
  if (!app.state.user) {
    return `<p class="text-dim" style="margin-bottom:14px;">Connecte-toi pour t'inscrire.</p>`;
  }

  const draft = getDraftFor(departure);
  const duration = event.duration || 6;
  const startTs = departure.startsAt;
  const hours = Array.from({ length: duration }, (_, i) => `h${i + 1}`);
  const activeHours = draft.status === 'whole' ? hours : (draft.status || '').split(',').filter(Boolean);
  const isWhole = draft.status === 'whole';
  const isUnavailable = draft.status === 'unavailable';
  const carsForCategory = draft.category ? app.getCarsForGame(event.gameId, draft.category) : [];

  return `
    <div class="registration-panel">
      <div class="flex-between" style="margin-bottom:14px;">
        <h4 style="font-weight:700;">📝 Mon inscription</h4>
        <span class="status-indicator ${draft.id ? 'saved' : 'draft'}">${draft.id ? '✅ Enregistré' : '📝 Brouillon'}</span>
      </div>

      <div class="form-group">
        <label>👤 Pseudo</label>
        <input id="regName_${departure.id}" value="${escapeHtml(draft.name || app.state.user.name)}" placeholder="Ton pseudo" data-dep="${departure.id}">
      </div>

      <div class="form-group">
        <label>🏎 Catégorie</label>
        <div class="category-picker">
          ${(event.categories || []).map(c => `
            <button type="button" class="opt ${draft.category === c ? 'active' : ''}" data-action="pickCat" data-dep="${departure.id}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>
          `).join('')}
        </div>
      </div>

      ${draft.category && draft.status !== 'unavailable' ? `
        <div class="form-group">
          <label>🚗 Voiture(s) souhaitée(s)</label>
          <div class="car-picker">
            ${carsForCategory.map(car => `
              <button type="button" class="car-opt ${draft.cars?.includes(car) && !draft.carAny ? 'active' : ''}"
                      data-action="toggleCar" data-dep="${departure.id}" data-car="${escapeHtml(car)}">${escapeHtml(car)}</button>
            `).join('')}
            <button type="button" class="car-opt any-car ${draft.carAny ? 'active' : ''}"
                    data-action="anyCar" data-dep="${departure.id}">🔀 Peu importe</button>
          </div>
        </div>
      ` : ''}

      <div class="form-group">
        <label>⏱ Disponibilité (${duration}h)
          <span class="text-dim" style="font-weight:400;text-transform:none;font-size:0.75rem;">
            ${isWhole ? '🏁 Toute la course' : isUnavailable ? '❌ Indisponible' : `${activeHours.length}/${duration} heures`}
          </span>
        </label>
        <div class="hour-grid">
          ${hours.map((h, i) => {
            const isActive = activeHours.includes(h);
            const realHour = getHourLabel(startTs, i);
            const realRange = getRealHourRange(startTs, i);
            let cls = 'hour';
            if (isWhole && isActive) cls += ' whole-active';
            else if (isActive) cls += ' active';
            if (isUnavailable) cls += ' unavailable-active';
            return `
              <button type="button" class="${cls}" data-action="toggleHour" data-dep="${departure.id}" data-hour="${h}"
                      ${isUnavailable ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}
                      title="${realRange}">
                ${realHour}
              </button>
            `;
          }).join('')}
        </div>
        <div class="flex gap-8" style="margin-top:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-sm ${isWhole ? 'btn-primary' : 'btn-outline'}" data-action="setWhole" data-dep="${departure.id}">🏁 Toute la course</button>
          <button type="button" class="btn btn-sm ${isUnavailable ? 'btn-danger' : 'btn-outline'}" data-action="setUnavailable" data-dep="${departure.id}">❌ Indisponible</button>
          ${isUnavailable ? `<button type="button" class="btn btn-sm btn-outline" data-action="clearStatus" data-dep="${departure.id}">↩ Rétablir</button>` : ''}
        </div>
      </div>

      <div class="flex gap-8" style="margin-top:16px;">
        <button type="button" class="btn btn-primary" data-action="saveReg" data-dep="${departure.id}">💾 Enregistrer</button>
        ${draft.id ? `<button type="button" class="btn btn-danger" data-action="deleteReg" data-dep="${departure.id}" data-reg="${draft.id}">🗑 Se désinscrire</button>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// GESTION ÉQUIPAGES
// ============================================================
function renderCrewManagement(event, departure) {
  const crews = departure.crews || [];

  if (app.state.crewForm && app.state.crewForm.departureId === departure.id) {
    return renderCrewForm(event, departure);
  }

  return `
    <div class="crew-section">
      <div class="crew-header">
        <h3>🏎 Équipages (${crews.length})</h3>
        <div class="flex gap-8">
          <button type="button" class="btn btn-success btn-sm" data-action="autoAssign" data-dep="${departure.id}">🎯 Assignation auto</button>
          <button type="button" class="btn btn-primary btn-sm" data-action="addCrew" data-dep="${departure.id}">+ Équipage</button>
        </div>
      </div>

      ${crews.length === 0 ? '<p class="text-dim">Aucun équipage. Utilise "Assignation auto" ou crée-les manuellement.</p>' : ''}

      <div class="crew-grid">
        ${crews.map((crew, idx) => {
          const pilots = getPilotsForCrew(departure, crew);
          const colors = ['var(--accent-gold)', 'var(--accent-blue)', 'var(--accent-green)', 'var(--accent-red)', 'var(--accent-purple)'];
          return `
            <div class="crew-card" style="border-left-color: ${colors[idx % colors.length]};">
              <div class="crew-name">
                ${escapeHtml(crew.name)}
                <span class="crew-index">#${idx + 1}</span>
                <span class="badge badge-${app.badgeClass(crew.category)}" style="font-size:0.5rem;">${escapeHtml(crew.category)}</span>
                ${crew.locked ? '<span style="color:var(--accent-gold);font-size:0.8rem;">🔒 Verrouillé</span>' : ''}
              </div>
              <div class="crew-meta">
                ${crew.car ? `🚗 ${escapeHtml(crew.car)}` : '🚗 Voiture à définir'}
                · ${pilots.length} pilote${pilots.length > 1 ? 's' : ''}
              </div>
              <div class="crew-pilots">
                ${pilots.map(p => `
                  <span class="pilot-chip">
                    ${escapeHtml(p.name)}
                    ${p.userId === app.state.user?.id ? '⭐' : ''}
                  </span>
                `).join('')}
                ${pilots.length === 0 ? '<span class="text-dim" style="font-size:0.8rem;">Aucun pilote</span>' : ''}
              </div>
              <div class="crew-actions">
                <button type="button" class="btn btn-outline btn-sm" data-action="editCrew" data-dep="${departure.id}" data-crew="${crew.id}" title="Modifier">✏️</button>
                <button type="button" class="btn ${crew.locked ? 'btn-success' : 'btn-outline'} btn-sm"
                        data-action="toggleCrewLock"
                        data-dep="${departure.id}"
                        data-crew="${crew.id}"
                        title="${crew.locked ? 'Déverrouiller' : 'Verrouiller'}">
                  ${crew.locked ? '🔒' : '🔓'}
                </button>
                <button type="button" class="btn btn-danger btn-sm" data-action="deleteCrew" data-dep="${departure.id}" data-crew="${crew.id}" title="Supprimer">🗑</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderCrewForm(event, departure) {
  const cf = app.state.crewForm;
  if (!cf) return '';

  const availablePilots = getAvailablePilots(departure, cf.category);
  const isEdit = !!cf.crewId;

  return `
    <div class="crew-form-panel">
      <div class="form-title">
        ${isEdit ? '✏️ Modifier l\'équipage' : '➕ Nouvel équipage'}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Catégorie</label>
          <select id="crewCategorySelect">
            <option value="">-- Choisir --</option>
            ${(event.categories || []).map(c => `<option value="${escapeHtml(c)}" ${cf.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Nom de l'équipage</label>
          <input id="crewNameInput" value="${escapeHtml(cf.name || '')}" placeholder="Ex: Team Porsche #1">
        </div>
      </div>

      <div class="form-group">
        <label>Voiture</label>
        <select id="crewCarSelect">
          <option value="">-- Choisir --</option>
          ${(cf.category && app.getCarsForGame(event.gameId, cf.category) || []).map(car => `
            <option value="${escapeHtml(car)}" ${cf.car === car ? 'selected' : ''}>${escapeHtml(car)}</option>
          `).join('')}
        </select>
      </div>

      ${cf.category ? `
        <div class="form-group">
          <label>Pilotes disponibles (${availablePilots.length}) — ${cf.selectedPilots.length} sélectionné${cf.selectedPilots.length > 1 ? 's' : ''}</label>
          <div class="pilot-select-grid" id="pilotSelectGrid">
            ${availablePilots.map(p => {
              const isSelected = cf.selectedPilots.includes(p.id);
              return `
                <div class="pilot-option ${isSelected ? 'selected' : ''}"
                     onclick="window.actions.toggleCrewPilotClick(event, '${p.id}')">
                  <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1">
                  <span class="pilot-check-label">${escapeHtml(p.name)} ${p.userId === app.state.user?.id ? '⭐' : ''}</span>
                </div>
              `;
            }).join('')}
            ${availablePilots.length === 0 ? '<span class="text-dim" style="font-size:0.75rem;">Aucun pilote disponible dans cette catégorie</span>' : ''}
          </div>
        </div>
      ` : ''}

      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="saveCrew" data-dep="${departure.id}">
          ${isEdit ? '💾 Mettre à jour' : '✅ Créer'}
        </button>
        <button type="button" class="btn btn-outline btn-sm" data-action="cancelCrewForm">Annuler</button>
      </div>
    </div>
  `;
}

// ============================================================
// LISTE DES PILOTES
// ============================================================
function renderPilotsList(event, departure, avail) {
  const inscrits = avail.filter(r => r.status !== 'unavailable');
  if (inscrits.length === 0) {
    return '<p class="text-dim">Aucun pilote pour ce départ.</p>';
  }
  return inscrits.map(r => {
    const isAssigned = (departure.crews || []).some(c => c.registrationIds.includes(r.id));
    const isMine = r.userId === app.state.user?.id;
    const hoursText = app.getPilotHoursText(r, departure.startsAt);
    const carText = app.getPilotCarText(r);
    return `
      <div class="pilot-item" style="${isAssigned ? 'border-left-color:var(--accent-blue);' : isMine ? 'border-left-color:var(--accent-gold);' : ''}">
        <span class="name">${escapeHtml(r.name)} ${isMine ? '<span class="mine-star">⭐</span>' : ''}</span>
        <span class="badge badge-${app.badgeClass(r.category)}" style="font-size:0.7rem;">${escapeHtml(r.category)}</span>
        <span class="car">${escapeHtml(carText)}</span>
        <span class="hours" title="${escapeHtml(hoursText)}" style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(hoursText)}</span>
        ${isAssigned ? '<span class="text-gold" style="font-size:0.65rem;">📌 assigné</span>' : ''}
      </div>
    `;
  }).join('');
}

// ============================================================
// SETUPS
// ============================================================
function renderSetupSection(event) {
  const setups = event.setups || {};
  const categories = event.categories || [];
  const hasSetups = Object.keys(setups).length > 0;

  return `
    <div class="setup-section">
      <div class="setup-header">
        <h4>📁 Setups de course</h4>
        <span class="text-dim" style="font-size:0.8rem;">${hasSetups ? Object.values(setups).reduce((a, arr) => a + arr.length, 0) : 0} fichier(s)</span>
      </div>

      <div class="setup-grid">
        ${categories.map(cat => {
          const files = setups[cat] || [];
          return `
            <div class="setup-item">
              <div class="setup-info">
                <span class="setup-name">${escapeHtml(cat)}</span>
                <span class="setup-meta">${files.length} fichier(s)</span>
              </div>
              <div class="setup-actions">
                ${files.map(f => `
                  <button type="button" class="btn btn-outline btn-sm" data-action="downloadSetup" data-event="${event.id}" data-category="${escapeHtml(cat)}" data-setup="${f.id}">📥</button>
                  ${app.canManage() ? `<button type="button" class="btn btn-danger btn-sm" data-action="removeSetup" data-event="${event.id}" data-category="${escapeHtml(cat)}" data-setup="${f.id}">✕</button>` : ''}
                `).join('')}
                ${app.canManage() ? `<button type="button" class="btn btn-success btn-sm" data-action="uploadSetup" data-event="${event.id}" data-category="${escapeHtml(cat)}">📤</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
        ${categories.length === 0 ? '<p class="text-dim">Aucune catégorie</p>' : ''}
      </div>
    </div>
  `;
}

// ============================================================
// DRAFTS & HELPERS
// ============================================================
export function getDraftFor(departure) {
  if (!app.state.user) return null;
  if (!app.state.drafts[departure.id]) {
    const mine = (departure.availability || []).find(r => r.userId === app.state.user.id);
    app.state.drafts[departure.id] = {
      name: mine?.name || app.state.user.name || '',
      category: mine?.category || '',
      cars: mine?.cars || [],
      status: mine?.status || '',
      id: mine?.id || null,
      carAny: mine?.cars?.length === 0 || false,
      userId: app.state.user.id
    };
  }
  return app.state.drafts[departure.id];
}

export function getAvailablePilots(departure, category) {
  const assignedIds = new Set();
  (departure.crews || []).forEach(c => {
    if (c.category === category) {
      (c.registrationIds || []).forEach(id => assignedIds.add(id));
    }
  });
  return (departure.availability || []).filter(r =>
    r.category === category
    && r.status !== 'unavailable'
    && !assignedIds.has(r.id)
  );
}

export function getPilotsForCrew(departure, crew) {
  return (crew.registrationIds || [])
    .map(id => (departure.availability || []).find(r => r.id === id))
    .filter(Boolean);
}

export function autoAssignCrews(departure, event) {
  const duration = event.duration || 6;
  const categories = event.categories || [];
  const crews = departure.crews || [];

  categories.forEach(category => {
    const available = getAvailablePilots(departure, category);
    if (available.length < 2) return;

    const sorted = [...available].sort((a, b) => {
      const aH = a.status === 'whole' ? duration : (a.status || '').split(',').length;
      const bH = b.status === 'whole' ? duration : (b.status || '').split(',').length;
      return bH - aH;
    });

    const crewSize = sorted.length >= 6 ? 3 : 2;

    for (let i = 0; i < sorted.length; i += crewSize) {
      const chunk = sorted.slice(i, i + crewSize);
      if (chunk.length < 2) break;

      crews.push({
        id: generateId(),
        name: `${category} #${crews.length + 1}`,
        category,
        car: '',
        registrationIds: chunk.map(p => p.id),
        locked: false
      });
    }
  });

  departure.crews = crews;
  return crews;
}