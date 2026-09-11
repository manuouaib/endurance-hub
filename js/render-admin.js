// ============================================================
// RENDER-ADMIN — Page "Admin · Configuration des jeux"
// ============================================================
import { escapeHtml } from './ui.js';
import * as app from './app.js';

export function renderAdmin() {
  if (!app.isAdmin()) return;

  app.state.page = 'admin';
  app.state.currentEventId = null;

  const main = document.getElementById('mainContent');
  if (!main) return;

  const games = app.getGames();
  const selectedGameId = app.state.adminSelectedGame || app.state.gameIds[0];

  let html = `
    <div class="fade-in">
      <div class="flex-between mb-16">
        <div>
          <h1 style="font-size:2rem;font-weight:800;letter-spacing:-0.5px;">⚙️ Admin · Configuration des jeux</h1>
          <p class="text-secondary" style="font-size:0.95rem;">
            Gère les jeux, circuits, catégories et voitures
          </p>
        </div>
        <button class="btn btn-outline btn-sm" data-action="home">← Retour au calendrier</button>
      </div>

      <div class="admin-panel">
        <div class="admin-panel-header">
          <h3>🎮 Jeux disponibles (${games.length})</h3>
          <button class="btn btn-primary btn-sm" data-action="adminAddGame">+ Nouveau jeu</button>
        </div>

        <div class="game-list">
          ${games.map(game => {
            const cats = game.categories || [];
            const circuits = game.circuits || [];
            const cars = Object.values(game.cars || {}).reduce((a, arr) => a + arr.length, 0);
            const isSelected = game.id === selectedGameId;
            return `
              <div class="game-card ${isSelected ? 'selected' : ''}" data-action="adminSelectGame" data-game="${game.id}">
                <div class="game-card-header">
                  <span class="game-name">${game.icon || '🎮'} ${escapeHtml(game.name)}</span>
                  <button type="button" class="btn-icon" data-action="adminDeleteGame" data-game="${game.id}" title="Supprimer ce jeu">🗑</button>
                </div>
                <div class="game-stats">
                  <span>🏁 ${circuits.length} circuits</span>
                  <span>🏎 ${cats.length} catégories</span>
                  <span>🚗 ${cars} voitures</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
  `;

  if (selectedGameId && app.getGameConfig(selectedGameId)) {
    html += renderGameConfig(selectedGameId);
  }

  html += `</div>`;
  main.innerHTML = html;
  app.renderNav();
}

function renderGameConfig(gameId) {
  const config = app.getGameConfig(gameId);
  if (!config) return '';

  const circuits = config.circuits || [];
  const categories = config.categories || [];
  const cars = config.cars || {};

  return `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <h3>${config.icon || '🎮'} Configuration : ${escapeHtml(config.name)}</h3>
        <span class="text-dim" style="font-size:0.8rem;">ID : ${gameId}</span>
      </div>

      <!-- CIRCUITS -->
      <div class="admin-section">
        <div class="admin-section-header">
          <h4>🏁 Circuits (${circuits.length})</h4>
          <button type="button" class="btn btn-primary btn-sm" data-action="adminAddCircuit" data-game="${gameId}">+ Ajouter</button>
        </div>
        <div class="chip-list">
          ${circuits.map(c => `
            <span class="chip">
              ${escapeHtml(c.name)}
              <button type="button" class="chip-remove" data-action="adminDeleteCircuit" data-game="${gameId}" data-id="${c.id}" title="Supprimer">✕</button>
            </span>
          `).join('')}
          ${circuits.length === 0 ? '<span class="text-dim">Aucun circuit</span>' : ''}
        </div>
      </div>

      <!-- CATÉGORIES -->
      <div class="admin-section">
        <div class="admin-section-header">
          <h4>🏎 Catégories (${categories.length})</h4>
          <button type="button" class="btn btn-primary btn-sm" data-action="adminAddCategory" data-game="${gameId}">+ Ajouter</button>
        </div>

        <div class="category-admin-list">
          ${categories.map(cat => {
            const catCars = cars[cat] || [];
            return `
              <div class="category-admin-card">
                <div class="category-admin-header">
                  <span class="badge badge-${app.badgeClass(cat)}">${escapeHtml(cat)}</span>
                  <span class="text-dim">${catCars.length} voiture${catCars.length > 1 ? 's' : ''}</span>
                  <button type="button" class="btn-icon" data-action="adminDeleteCategory" data-game="${gameId}" data-category="${escapeHtml(cat)}" title="Supprimer cette catégorie">🗑</button>
                </div>
                <div class="chip-list">
                  ${catCars.map(car => `
                    <span class="chip">
                      ${escapeHtml(car)}
                      <button type="button" class="chip-remove" data-action="adminDeleteCar" data-game="${gameId}" data-category="${escapeHtml(cat)}" data-car="${escapeHtml(car)}" title="Supprimer">✕</button>
                    </span>
                  `).join('')}
                </div>
                <button type="button" class="btn btn-outline btn-xs" data-action="adminAddCar" data-game="${gameId}" data-category="${escapeHtml(cat)}">+ Ajouter une voiture</button>
              </div>
            `;
          }).join('')}
          ${categories.length === 0 ? '<p class="text-dim">Aucune catégorie</p>' : ''}
        </div>
      </div>
    </div>
  `;
}