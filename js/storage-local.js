// ============================================================
// IMPLÉMENTATION LOCALSTORAGE (mode démo hors-ligne)
// ============================================================

const STORAGE_KEY = 'endurance_hub_v12';

let state = {
  events: [],
  users: [],
  user: null,
  gameConfigs: {},
  gameIds: []
};

// ============================================================
// CHARGEMENT
// ============================================================
export async function loadAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      state.events = data.events || [];
      state.users = data.users || [];
      state.user = data.user || null;
      state.gameConfigs = data.gameConfigs || {};
      state.gameIds = data.gameIds || [];
    } catch (e) {
      console.error('Erreur parsing local:', e);
    }
  }
  return { ...state };
}

// ============================================================
// AUTH (simulation locale)
// ============================================================
export async function loginDiscord() {
  const fakeUser = {
    id: 'discord-' + Date.now(),
    name: 'DiscordUser_' + Math.random().toString(36).slice(2, 6),
    role: 'pilot',
    auth: 'discord'
  };
  state.user = fakeUser;
  if (!state.users.find(u => u.id === fakeUser.id)) {
    state.users.push(fakeUser);
  }
  persist();
  return fakeUser;
}

export async function logout() {
  state.user = null;
  persist();
}

export async function getCurrentUser() {
  return state.user;
}

// ============================================================
// COURSES
// ============================================================
export async function saveEvent(event) {
  const idx = state.events.findIndex(e => e.id === event.id);
  if (idx > -1) state.events[idx] = event;
  else state.events.push(event);
  persist();
  return event;
}

export async function deleteEvent(eventId) {
  state.events = state.events.filter(e => e.id !== eventId);
  persist();
}

// ============================================================
// USERS
// ============================================================
export async function saveUser(user) {
  const idx = state.users.findIndex(u => u.id === user.id);
  if (idx > -1) state.users[idx] = user;
  else state.users.push(user);
  persist();
  return user;
}

export async function deleteUser(userId) {
  state.users = state.users.filter(u => u.id !== userId);
  persist();
}

// ============================================================
// CONFIG JEUX
// ============================================================
export async function saveGameConfigs(gameConfigs, gameIds) {
  state.gameConfigs = gameConfigs;
  state.gameIds = gameIds;
  persist();
}

// ============================================================
// REALTIME (no-op en local)
// ============================================================
export function subscribe(callback) {
  return () => {}; // unsubscribe no-op
}

// ============================================================
// PERSIST
// ============================================================
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Erreur persistance locale:', e);
  }
}