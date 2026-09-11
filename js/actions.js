// ============================================================
// ACTIONS — Toutes les actions déclenchées par data-action
// ============================================================
import { storage } from './storage.js';
import { showToast, openModal, closeModal, showLoader,
         escapeHtml, generateId, formatDate, formatTime } from './ui.js';
import { startCountdowns } from './countdown.js';
import * as app from './app.js';
import * as re from './render-event.js';

const state = new Proxy({}, {
  get(_, prop) { return app.state[prop]; },
  set(_, prop, value) { app.state[prop] = value; return true; }
});

// ============================================================
// NAVIGATION
// ============================================================
export function home() {
  app.state.crewForm = null;
  app.renderHome();
}

export function openLogin() { openModal('loginModal'); }
export function closeLogin() { closeModal('loginModal'); }

// ============================================================
// AUTH
// ============================================================
export async function discordLogin() {
  closeModal('loginModal');
  showLoader(true, 'Redirection vers Discord…');
  try {
    await storage.loginDiscord();
  } catch (err) {
    showLoader(false);
    showToast('Erreur : ' + err.message, 'error');
  }
}

export async function logout() {
  if (!confirm('Se déconnecter ?')) return;
  await storage.logout();
  app.state.user = null;
  app.renderNav();
  app.renderHome();
  showToast('Déconnecté', 'info');
}

// ============================================================
// FILTRES
// ============================================================
export function filterUpcoming() { app.state.eventFilter = 'upcoming'; app.renderHome(); }
export function filterArchived() { app.state.eventFilter = 'archived'; app.renderHome(); }

// ============================================================
// CRÉATION / ÉDITION COURSE
// ============================================================
export function create() {
  if (!app.canManage()) return showToast('Réservé aux organisateurs', 'error');
  app.state.editingEvent = null;
  document.getElementById('courseModalTitle').textContent = '➕ Nouvelle course';
  document.getElementById('courseSubmitBtn').textContent = '🚀 Créer';
  populateCourseForm(null);
  openModal('courseModal');
}

export function closeCourse() { closeModal('courseModal'); }

function populateCourseForm(event) {
  const gameSelect = document.getElementById('fGame');
  gameSelect.innerHTML = app.getGames().map(g =>
    `<option value="${g.id}" ${event?.gameId === g.id ? 'selected' : ''}>${g.icon} ${g.name}</option>`
  ).join('');

  const gameId = event?.gameId || app.state.gameIds[0] || 'lmu';
  const catPicker = document.getElementById('categoryPicker');
  catPicker.innerHTML = app.getCategoriesForGame(gameId).map(c =>
    `<button type="button" class="opt ${event?.categories?.includes(c) ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
  ).join('');
  updateCatHidden();
  updateCircuitSelect(gameId, event?.circuit);

  document.getElementById('fName').value = event?.name || '';
  document.getElementById('fDuration').value = event?.duration || 6;
  document.getElementById('fType').value = event?.eventType || 'private';

  const depList = document.getElementById('departureList');
  depList.innerHTML = '';
  const deps = event?.departures?.length ? event.departures : [{ date: '', time: '' }];
  deps.forEach(d => addDepartureRow(d.date || '', d.time || ''));
}

function updateCircuitSelect(gameId, selectedCircuit) {
  const sel = document.getElementById('fCircuit');
  sel.innerHTML = '<option value="">Sélectionner</option>' +
    app.getCircuitsForGame(gameId).map(c =>
      `<option value="${c.id}" ${selectedCircuit === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
}

function updateCatHidden() {
  const cats = [];
  document.querySelectorAll('#categoryPicker .opt.active').forEach(b => cats.push(b.dataset.cat));
  document.getElementById('fCats').value = cats.join(',');
}

function addDepartureRow(date = '', time = '') {
  const list = document.getElementById('departureList');
  const div = document.createElement('div');
  div.className = 'flex gap-8';
  div.style.marginBottom = '8px';
  div.style.alignItems = 'center';
  div.innerHTML = `
    <input type="date" class="depDate" value="${date}" style="flex:1;padding:9px 14px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);">
    <input type="time" class="depTime" value="${time}" style="flex:1;padding:9px 14px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);">
    <button type="button" class="btn btn-danger btn-sm" data-action="removeDep">✕</button>
  `;
  list.appendChild(div);
}

export function addDep() { addDepartureRow(); }
export function removeDep(target) {
  const row = target.closest('.flex');
  const list = document.getElementById('departureList');
  if (list && list.children.length > 1) row.remove();
  else showToast('Au moins un départ requis', 'error');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#categoryPicker .opt');
  if (btn) { btn.classList.toggle('active'); updateCatHidden(); }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'fGame') {
    const gameId = e.target.value;
    updateCircuitSelect(gameId);
    const catPicker = document.getElementById('categoryPicker');
    catPicker.innerHTML = app.getCategoriesForGame(gameId).map(c =>
      `<button type="button" class="opt" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join('');
    updateCatHidden();
  }
});

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'courseForm') {
    e.preventDefault();
    await submitCourseForm();
  }
});

async function submitCourseForm() {
  if (!app.canManage()) return;

  const gameId = document.getElementById('fGame').value;
  const name = document.getElementById('fName').value.trim();
  const duration = parseInt(document.getElementById('fDuration').value, 10);
  const circuit = document.getElementById('fCircuit').value;
  const eventType = document.getElementById('fType').value;
  const cats = document.getElementById('fCats').value.split(',').filter(Boolean);

  const dates = document.querySelectorAll('.depDate');
  const times = document.querySelectorAll('.depTime');
  const departures = [];
  dates.forEach((d, i) => {
    if (d.value && times[i]?.value) {
      const ts = new Date(d.value + 'T' + times[i].value + ':00').getTime();
      if (!isNaN(ts)) {
        departures.push({
          id: generateId(), date: d.value, time: times[i].value,
          startsAt: ts, availability: [], crews: []
        });
      }
    }
  });

  if (!name) return showToast('Nom obligatoire', 'error');
  if (!circuit) return showToast('Choisis un circuit', 'error');
  if (!cats.length) return showToast('Choisis au moins une catégorie', 'error');
  if (!departures.length) return showToast('Ajoute au moins un départ', 'error');

  if (app.state.editingEvent) {
    const existing = app.state.editingEvent.departures || [];
    departures.forEach((d, i) => {
      if (existing[i]) {
        d.availability = existing[i].availability || [];
        d.crews = existing[i].crews || [];
      }
    });
  }

  const eventData = {
    id: app.state.editingEvent?.id || generateId(),
    name, gameId, duration, circuit, eventType,
    categories: cats,
    departures,
    setups: app.state.editingEvent?.setups || {}
  };

  showLoader(true, 'Sauvegarde…');
  try {
    const saved = await storage.saveEvent(eventData);
    const idx = app.state.events.findIndex(e => e.id === saved.id);
    if (idx > -1) app.state.events[idx] = saved;
    else app.state.events.unshift(saved);
    app.state.editingEvent = null;
    closeModal('courseModal');
    showLoader(false);
    showToast(`✅ Course "${name}" sauvegardée`, 'success');
    app.renderHome();
  } catch (err) {
    showLoader(false);
    console.error(err);
    showToast('Erreur : ' + err.message, 'error');
  }
}

// ============================================================
// DÉTAIL COURSE
// ============================================================
export function open(target) {
  app.state.currentEventId = target.dataset.id;
  app.state.crewForm = null;
  const depId = target.dataset.dep;
  if (depId) {
    const e = app.getEvent(app.state.currentEventId);
    if (e) {
      e.departures.forEach(d => { app.state.openDepartures[d.id] = d.id === depId; });
    }
  }
  re.renderEventDetail();
}

export function editEvent() {
  if (!app.canManage()) return;
  const e = app.getEvent(app.state.currentEventId);
  if (!e) return;
  app.state.editingEvent = JSON.parse(JSON.stringify(e));
  document.getElementById('courseModalTitle').textContent = '✏️ Modifier la course';
  document.getElementById('courseSubmitBtn').textContent = '💾 Mettre à jour';
  populateCourseForm(app.state.editingEvent);
  openModal('courseModal');
}

export async function deleteEvent() {
  if (!app.isAdmin()) return showToast('Réservé aux admins', 'error');
  if (!confirm('⚠️ Supprimer cette course ?')) return;
  try {
    await storage.deleteEvent(app.state.currentEventId);
    app.state.events = app.state.events.filter(e => e.id !== app.state.currentEventId);
    app.state.currentEventId = null;
    showToast('Course supprimée', 'info');
    app.renderHome();
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

// ============================================================
// INSCRIPTIONS
// ============================================================
function getDep(target) {
  return app.getDeparture(app.state.currentEventId, target.dataset.dep);
}

async function saveEventToStorage() {
  const event = app.getEvent(app.state.currentEventId);
  if (!event) return;
  try {
    await storage.saveEvent(event);
  } catch (err) {
    console.error('Erreur save:', err);
    showToast('Erreur de sauvegarde : ' + err.message, 'error');
  }
}

export function pickCat(target) {
  if (!app.state.user) return showToast('Connecte-toi', 'error');
  const dep = getDep(target);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  draft.category = target.dataset.cat;
  draft.cars = [];
  draft.carAny = false;
  re.renderEventDetail();
}

export function toggleCar(target) {
  const dep = getDep(target);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  if (draft.carAny) draft.carAny = false;
  const car = target.dataset.car;
  const idx = draft.cars.indexOf(car);
  if (idx > -1) draft.cars.splice(idx, 1);
  else draft.cars.push(car);
  re.renderEventDetail();
}

export function anyCar(target) {
  const dep = getDep(target);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  draft.carAny = !draft.carAny;
  if (draft.carAny) draft.cars = [];
  re.renderEventDetail();
}

export function toggleHour(target) {
  const dep = getDep(target);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  if (draft.status === 'unavailable') draft.status = '';
  let parts = draft.status === 'whole' ? [] : (draft.status || '').split(',').filter(Boolean);
  if (draft.status === 'whole') draft.status = '';
  const hour = target.dataset.hour;
  const idx = parts.indexOf(hour);
  if (idx > -1) parts.splice(idx, 1);
  else parts.push(hour);
  draft.status = parts.join(',');
  re.renderEventDetail();
}

export function setWhole(target) {
  const dep = getDep(target);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  draft.status = 'whole';
  re.renderEventDetail();
}

export function setUnavailable(target) {
  const dep = getDep(target);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  draft.status = 'unavailable';
  draft.cars = [];
  draft.carAny = false;
  re.renderEventDetail();
}

export function clearStatus(target) {
  const dep = getDep(target);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  draft.status = '';
  re.renderEventDetail();
}

export async function saveReg(target) {
  if (!app.state.user) return showToast('Connecte-toi', 'error');
  const depId = target.dataset.dep;
  const dep = app.getDeparture(app.state.currentEventId, depId);
  if (!dep) return;
  const draft = re.getDraftFor(dep);
  const nameInput = document.getElementById(`regName_${depId}`);
  if (nameInput) draft.name = nameInput.value.trim();

  if (!draft.name) return showToast('Indique ton pseudo', 'error');
  if (!draft.status) return showToast('Choisis ta disponibilité', 'error');
  if (draft.status !== 'unavailable' && !draft.category) return showToast('Choisis ta catégorie', 'error');

  const existing = (dep.availability || []).find(r => r.id === draft.id);
  if (existing) {
    Object.assign(existing, {
      name: draft.name, category: draft.category,
      cars: draft.carAny ? [] : draft.cars,
      status: draft.status, userId: app.state.user.id
    });
  } else {
    const newReg = {
      id: generateId(), name: draft.name, category: draft.category,
      cars: draft.carAny ? [] : draft.cars,
      status: draft.status, userId: app.state.user.id
    };
    dep.availability.push(newReg);
    draft.id = newReg.id;
  }

  delete app.state.drafts[depId];
  app.state.openDepartures[depId] = true;
  await saveEventToStorage();
  re.renderEventDetail();
  showToast('✅ Inscription enregistrée', 'success');
}

export async function deleteReg(target) {
  const depId = target.dataset.dep;
  const regId = target.dataset.reg;
  if (!confirm('Se désinscrire ?')) return;
  const dep = app.getDeparture(app.state.currentEventId, depId);
  if (!dep) return;
  dep.availability = dep.availability.filter(r => r.id !== regId);
  delete app.state.drafts[depId];
  app.state.openDepartures[depId] = true;
  await saveEventToStorage();
  re.renderEventDetail();
  showToast('Désinscription effectuée', 'info');
}

export function editReg(target) {
  const depId = target.dataset.dep;
  const regId = target.dataset.reg;
  const dep = app.getDeparture(app.state.currentEventId, depId);
  if (!dep) return;
  const reg = dep.availability.find(r => r.id === regId);
  if (!reg) return;
  app.state.drafts[depId] = {
    id: reg.id, name: reg.name, category: reg.category,
    cars: reg.cars || [], carAny: (reg.cars || []).length === 0,
    status: reg.status, userId: app.state.user.id
  };
  app.state.openDepartures[depId] = true;
  re.renderEventDetail();
}

// ============================================================
// ÉQUIPAGES
// ============================================================
export function addCrew(target) {
  if (!app.canManage()) return;
  const dep = getDep(target);
  if (!dep) return;
  const event = app.getEvent(app.state.currentEventId);
  const categories = event.categories || [];
  app.state.crewForm = {
    departureId: dep.id,
    category: categories[0] || '',
    name: '',
    car: '',
    selectedPilots: [],
    crewId: null
  };
  app.state.openDepartures[dep.id] = true;
  re.renderEventDetail();
}

export function editCrew(target) {
  if (!app.canManage()) return;
  const dep = getDep(target);
  if (!dep) return;
  const crew = (dep.crews || []).find(c => c.id === target.dataset.crew);
  if (!crew) return;
  app.state.crewForm = {
    departureId: dep.id, category: crew.category, name: crew.name,
    car: crew.car || '', selectedPilots: [...(crew.registrationIds || [])],
    crewId: crew.id
  };
  app.state.openDepartures[dep.id] = true;
  re.renderEventDetail();
}

export async function deleteCrew(target) {
  if (!app.canManage()) return;
  if (!confirm('Supprimer cet équipage ?')) return;
  const dep = getDep(target);
  if (!dep) return;
  dep.crews = (dep.crews || []).filter(c => c.id !== target.dataset.crew);
  app.state.openDepartures[dep.id] = true;
  await saveEventToStorage();
  re.renderEventDetail();
  showToast('Équipage supprimé', 'info');
}

export async function autoAssign(target) {
  if (!app.canManage()) return;
  const dep = getDep(target);
  if (!dep) return;
  const event = app.getEvent(app.state.currentEventId);
  re.autoAssignCrews(dep, event);
  app.state.openDepartures[dep.id] = true;
  await saveEventToStorage();
  re.renderEventDetail();
  showToast(`Équipages créés automatiquement`, 'success');
}

export function toggleCrewPilot(target) {
  const pilotId = target.dataset.pilot;
  const cf = app.state.crewForm;
  if (!cf) return;
  const idx = cf.selectedPilots.indexOf(pilotId);
  if (idx > -1) cf.selectedPilots.splice(idx, 1);
  else cf.selectedPilots.push(pilotId);
  re.renderEventDetail();
}

export async function saveCrew(target) {
  const dep = getDep(target);
  if (!dep) return;
  const cf = app.state.crewForm;
  if (!cf) return;

  const name = document.getElementById('crewNameInput')?.value.trim() || cf.name;
  const category = document.getElementById('crewCategorySelect')?.value || cf.category;
  const car = document.getElementById('crewCarSelect')?.value || cf.car || '';

  if (!category) return showToast('Choisis une catégorie', 'error');
  if (!name) return showToast('Donne un nom', 'error');
  if (cf.selectedPilots.length < 2) return showToast('Minimum 2 pilotes', 'error');

  if (cf.crewId) {
    const crew = dep.crews.find(c => c.id === cf.crewId);
    if (crew) Object.assign(crew, { name, category, car, registrationIds: cf.selectedPilots });
  } else {
    dep.crews.push({
      id: generateId(), name, category, car,
      registrationIds: [...cf.selectedPilots]
    });
  }

  app.state.crewForm = null;
  app.state.openDepartures[dep.id] = true;
  await saveEventToStorage();
  re.renderEventDetail();
  showToast('✅ Équipage enregistré', 'success');
}

export function cancelCrewForm() {
  app.state.crewForm = null;
  re.renderEventDetail();
}

// ============================================================
// SETUPS
// ============================================================
const SETUP_EXTENSIONS = ['.txt', '.json', '.xml', '.ini', '.cfg', '.svm'];

export function uploadSetup(target) {
  if (!app.canManage()) return;
  const eventId = target.dataset.event;
  const category = target.dataset.category;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = SETUP_EXTENSIONS.join(',');
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!SETUP_EXTENSIONS.includes(ext)) {
      showToast(`Format non supporté : ${ext}`, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const event = app.getEvent(eventId);
        if (!event) return;
        if (!event.setups) event.setups = {};
        if (!event.setups[category]) event.setups[category] = [];

        const binary = new Uint8Array(reader.result);
        let b64 = '';
        for (let i = 0; i < binary.length; i++) {
          b64 += String.fromCharCode(binary[i]);
        }
        b64 = btoa(b64);

        event.setups[category].push({
          id: generateId(),
          name: file.name,
          content: 'BASE64:' + b64,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploadedAt: Date.now(),
          uploadedBy: app.state.user.name
        });

        await saveEventToStorage();
        re.renderEventDetail();
        showToast(`✅ Setup "${file.name}" ajouté`, 'success');
      } catch (err) {
        showToast('Erreur : ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

export async function removeSetup(target) {
  if (!app.canManage()) return;
  if (!confirm('Supprimer ce setup ?')) return;
  const event = app.getEvent(target.dataset.event);
  const category = target.dataset.category;
  const setupId = target.dataset.setup;
  if (!event?.setups?.[category]) return;
  event.setups[category] = event.setups[category].filter(s => s.id !== setupId);
  if (event.setups[category].length === 0) delete event.setups[category];
  await saveEventToStorage();
  re.renderEventDetail();
  showToast('Setup supprimé', 'info');
}

export function downloadSetup(target) {
  const event = app.getEvent(target.dataset.event);
  const category = target.dataset.category;
  const setupId = target.dataset.setup;
  const setup = event?.setups?.[category]?.find(s => s.id === setupId);
  if (!setup) return showToast('Setup introuvable', 'error');

  try {
    let content = setup.content;
    let isBase64 = false;
    if (typeof content === 'string' && content.startsWith('BASE64:')) {
      content = content.substring(7);
      isBase64 = true;
    }

    let blob;
    if (isBase64) {
      const bin = atob(content);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: setup.type || 'application/octet-stream' });
    } else {
      blob = new Blob([content], { type: 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = setup.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

export function downloadSetupFromTile(target) {
  const eventId = target.dataset.event;
  const category = target.dataset.category;
  const setupId = target.dataset.setup;

  const event = app.getEvent(eventId);
  if (!event) return showToast('Course introuvable', 'error');

  const files = event.setups?.[category];
  if (!files || files.length === 0) return showToast('Aucun setup pour cette catégorie', 'error');

  const setup = files.find(s => s.id === setupId) || files[0];
  if (!setup) return showToast('Setup introuvable', 'error');

  downloadSetup({
    dataset: { event: eventId, category: category, setup: setup.id }
  });

  showToast(`📥 Téléchargement de "${setup.name}"`, 'info');
}