// ============================================================
// RENDER-USERS — Page "Gestion des comptes"
// ============================================================
import { escapeHtml, formatDateTime } from './ui.js';
import * as app from './app.js';

export function renderUsers() {
  if (!app.isAdmin()) return;

  app.state.page = 'users';
  app.state.currentEventId = null;

  const main = document.getElementById('mainContent');
  if (!main) return;

  const users = app.state.users;
  const currentUserId = app.state.user?.id;
  const search = (app.state.userSearch || '').toLowerCase();

  // Filtrer
  const filtered = users.filter(u => {
    if (!search) return true;
    return (u.name || '').toLowerCase().includes(search)
      || (u.discordUsername || '').toLowerCase().includes(search);
  });

  // Trier : admin d'abord, puis organizer, puis pilot
  const roleOrder = { admin: 0, organizer: 1, pilot: 2 };
  filtered.sort((a, b) => {
    const ra = roleOrder[a.role] ?? 99;
    const rb = roleOrder[b.role] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });

  const adminCount = users.filter(u => u.role === 'admin').length;
  const organizerCount = users.filter(u => u.role === 'organizer').length;
  const pilotCount = users.filter(u => u.role === 'pilot').length;

  // Compter les inscriptions par user
  const regCounts = {};
  app.state.events.forEach(ev => {
    (ev.departures || []).forEach(dep => {
      (dep.availability || []).forEach(r => {
        if (r.userId) regCounts[r.userId] = (regCounts[r.userId] || 0) + 1;
      });
    });
  });

  let html = `
    <div class="fade-in">
      <div class="flex-between mb-16">
        <div>
          <h1 style="font-size:2rem;font-weight:800;letter-spacing:-0.5px;">👥 Gestion des comptes</h1>
          <p class="text-secondary" style="font-size:0.95rem;">
            ${users.length} utilisateur${users.length > 1 ? 's' : ''} ·
            ${adminCount} admin${adminCount > 1 ? 's' : ''} ·
            ${organizerCount} organizer${organizerCount > 1 ? 's' : ''} ·
            ${pilotCount} pilote${pilotCount > 1 ? 's' : ''}
          </p>
        </div>
        <button class="btn btn-outline btn-sm" data-action="home">← Retour au calendrier</button>
      </div>

      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" id="userSearchInput" placeholder="Rechercher par pseudo Discord..."
               value="${escapeHtml(app.state.userSearch || '')}">
      </div>

      <div class="users-list">
  `;

  if (filtered.length === 0) {
    html += `
      <div class="empty">
        <span class="big-icon">👥</span>
        <h3>Aucun utilisateur</h3>
        <p class="text-dim">Aucun résultat pour cette recherche.</p>
      </div>
    `;
  } else {
    filtered.forEach(u => {
      html += renderUserCard(u, currentUserId, regCounts[u.id] || 0);
    });
  }

  html += `</div></div>`;
  main.innerHTML = html;
  app.renderNav();

  // Écouteur recherche
  document.getElementById('userSearchInput')?.addEventListener('input', (e) => {
    app.state.userSearch = e.target.value;
    // Re-render uniquement la liste (pour éviter de perdre le focus)
    const input = document.getElementById('userSearchInput');
    const val = input.value;
    renderUsers();
    document.getElementById('userSearchInput').value = val;
    document.getElementById('userSearchInput').focus();
  });
}

function renderUserCard(u, currentUserId, regCount) {
  const isMe = u.id === currentUserId;
  const avatar = u.discordAvatar
    || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(u.name)}`;
  const authLabel = u.auth === 'discord' ? 'Discord' : 'Local';
  const discordTag = u.discordUsername ? `@${u.discordUsername}` : '';

  return `
    <div class="user-card-admin ${isMe ? 'is-me' : ''}">
      <div class="user-card-avatar">
        <img src="${escapeHtml(avatar)}" alt="">
      </div>

      <div class="user-card-info">
        <div class="user-card-name">
          ${escapeHtml(u.name)}
          ${isMe ? '<span class="user-me-badge">TOI</span>' : ''}
        </div>
        <div class="user-card-meta">
          ${discordTag ? `<span class="user-discord">${escapeHtml(discordTag)}</span>` : ''}
          <span class="user-auth">${authLabel}</span>
        </div>
        <div class="user-card-stats">
          📋 ${regCount} inscription${regCount > 1 ? 's' : ''}
        </div>
      </div>

      <div class="user-card-actions">
        <select class="role-select ${isMe ? 'disabled' : ''}"
                data-user-id="${u.id}"
                ${isMe ? 'disabled' : ''}>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>🛡️ Admin</option>
          <option value="organizer" ${u.role === 'organizer' ? 'selected' : ''}>⚙️ Organizer</option>
          <option value="pilot" ${u.role === 'pilot' ? 'selected' : ''}>👤 Pilote</option>
        </select>
        ${!isMe ? `
          <button type="button" class="btn-icon-danger" data-action="adminDeleteUser" data-user="${u.id}" title="Supprimer">🗑</button>
        ` : '<span style="width:32px;display:inline-block;"></span>'}
      </div>
    </div>
  `;
}

// Écouteur global pour les selects de rôle
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('role-select')) {
    const userId = e.target.dataset.userId;
    const newRole = e.target.value;
    if (typeof app.state !== 'undefined' && window.actions.adminChangeRole) {
      window.actions.adminChangeRole(userId, newRole);
    }
  }
});