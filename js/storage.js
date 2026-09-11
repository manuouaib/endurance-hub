// ============================================================
// COUCHE D'ABSTACTION STOCKAGE
// ============================================================
// Bascule entre localStorage (démo) et Supabase (en ligne)

import * as local from './storage-local.js';
import * as supa from './storage-supabase.js';

// ⬇️ CHANGEZ CETTE LIGNE POUR BASCULER
// 'supabase' = en ligne | 'local' = démo hors-ligne
const MODE = 'supabase';

const impl = MODE === 'supabase' ? supa : local;

// ============================================================
// API PUBLIQUE (identique pour les 2 modes)
// ============================================================
export const storage = {
  mode: MODE,

  // Charge tout au démarrage
  async loadAll() {
    return impl.loadAll();
  },

  // Auth
  async loginDiscord() {
    return impl.loginDiscord();
  },
  async logout() {
    return impl.logout();
  },
  async getCurrentUser() {
    return impl.getCurrentUser();
  },

  // Courses
  async saveEvent(event) {
    return impl.saveEvent(event);
  },
  async deleteEvent(eventId) {
    return impl.deleteEvent(eventId);
  },

  // Users
  async saveUser(user) {
    return impl.saveUser(user);
  },
  async deleteUser(userId) {
    return impl.deleteUser(userId);
  },

  // Config jeux
  async saveGameConfigs(gameConfigs, gameIds) {
    return impl.saveGameConfigs(gameConfigs, gameIds);
  },

  // Realtime
  subscribe(callback) {
    return impl.subscribe(callback);
  }
};

// Exposer le client supabase directement pour usage avancé
export { supabase } from './storage-supabase.js';