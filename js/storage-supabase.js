// ============================================================
// IMPLÉMENTATION SUPABASE (mode en ligne)
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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
  // 1. Courses
  const { data: courses, error: errC } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (errC) console.error('Erreur chargement courses:', errC);

  state.events = (courses || []).map(row => ({
    id: row.id,
    name: row.name,
    gameId: row.game_id,
    duration: row.duration,
    circuit: row.circuit,
    eventType: row.event_type,
    categories: row.categories || [],
    departures: row.departures || [],
    setups: row.setups || {},
    createdBy: row.created_by
  }));

  // 2. Profils
  const { data: profiles, error: errP } = await supabase
    .from('profiles')
    .select('*');

  if (errP) console.error('Erreur chargement profils:', errP);

  state.users = (profiles || []).map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    auth: p.discord_id ? 'discord' : 'local',
    discordId: p.discord_id,
    discordUsername: p.discord_username,
    discordAvatar: p.discord_avatar
  }));

  // 3. User connecté
  const { data: { user: authUser } } = await supabase.auth.getUser();
  state.user = authUser ? (state.users.find(u => u.id === authUser.id) || null) : null;

  // 4. Configs jeux depuis Supabase
  const { data: gameConfigs, error: errG } = await supabase
    .from('game_configs')
    .select('game_id, data');

  if (errG) console.error('Erreur chargement game_configs:', errG);

  if (gameConfigs && gameConfigs.length > 0) {
    state.gameConfigs = {};
    state.gameIds = [];
    gameConfigs.forEach(row => {
      state.gameConfigs[row.game_id] = row.data;
      state.gameIds.push(row.game_id);
    });
  } else {
    // Fallback : localStorage (mode hors-ligne)
    const cfgRaw = localStorage.getItem('endurance_game_configs');
    if (cfgRaw) {
      try {
        const cfg = JSON.parse(cfgRaw);
        state.gameConfigs = cfg.configs || {};
        state.gameIds = cfg.ids || [];
      } catch (e) {}
    }
  }

  return { ...state };
}

// ============================================================
// AUTH DISCORD
// ============================================================
export async function loginDiscord() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
  state.user = null;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  const u = {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    auth: 'discord',
    discordUsername: profile.discord_username,
    discordAvatar: profile.discord_avatar
  };
  state.user = u;
  return u;
}

// ============================================================
// COURSES
// ============================================================
export async function saveEvent(event) {
  const isNew = !event.id || event.id.startsWith('id-') || event.id.length < 20;

  const row = {
    name: event.name,
    game_id: event.gameId || 'lmu',
    duration: event.duration,
    circuit: event.circuit,
    event_type: event.eventType || 'private',
    categories: event.categories || [],
    departures: event.departures || [],
    setups: event.setups || {}
  };

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser) row.created_by = authUser.id;

  let result;
  if (isNew) {
    const { data, error } = await supabase
      .from('courses')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await supabase
      .from('courses')
      .update(row)
      .eq('id', event.id)
      .select()
      .single();
    if (error) throw error;
    result = data;
  }

  const saved = {
    id: result.id,
    name: result.name,
    gameId: result.game_id,
    duration: result.duration,
    circuit: result.circuit,
    eventType: result.event_type,
    categories: result.categories || [],
    departures: result.departures || [],
    setups: result.setups || {},
    createdBy: result.created_by
  };

  const idx = state.events.findIndex(e => e.id === saved.id);
  if (idx > -1) state.events[idx] = saved;
  else state.events.push(saved);

  return saved;
}

export async function deleteEvent(eventId) {
  const { error } = await supabase.from('courses').delete().eq('id', eventId);
  if (error) throw error;
  state.events = state.events.filter(e => e.id !== eventId);
}

// ============================================================
// USERS
// ============================================================
export async function saveUser(user) {
  const row = {
    id: user.id,
    name: user.name,
    role: user.role,
    discord_id: user.discordId || null,
    discord_username: user.discordUsername || null,
    discord_avatar: user.discordAvatar || null
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;

  const idx = state.users.findIndex(u => u.id === user.id);
  if (idx > -1) state.users[idx] = user;
  else state.users.push(user);

  return user;
}

export async function deleteUser(userId) {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
  state.users = state.users.filter(u => u.id !== userId);
}

// ============================================================
// CONFIG JEUX (localStorage uniquement en cache)
// ============================================================
export async function saveGameConfigs(gameConfigs, gameIds) {
  state.gameConfigs = gameConfigs;
  state.gameIds = gameIds;
  localStorage.setItem('endurance_game_configs', JSON.stringify({
    configs: gameConfigs,
    ids: gameIds
  }));
}

// ============================================================
// REALTIME
// ============================================================
export function subscribe(callback) {
  const channel = supabase
    .channel('courses-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'courses' },
      async () => {
        await loadAll();
        callback();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_configs' },
      async () => {
        await loadAll();
        callback();
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}