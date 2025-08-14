export function installLeaderboardUI(game) {
  const modal = document.createElement('div'); modal.id = 'leaderboardModal'; modal.className = 'shop-modal hidden'; // reuse styles
  const panel = document.createElement('div'); panel.className = 'shop-content';
  panel.innerHTML = `
      <div class="shop-header">
        <div class="shop-title">LEADERBOARD</div>
        <div class="shop-sub">Local demo board (connect wallet to attribute scores). Close with <b>L</b> or <b>Esc</b>.</div>
      </div>
      <div id="leaderboardTable" class="leaderboard-table"></div>
      <div class="shop-footer">API hook is ready: set <code>leaderboardApiBase</code> to push and fetch global records.</div>
    `;
  modal.appendChild(panel);
  document.body.appendChild(modal);
  game.leaderboardModal = modal;
  modal.addEventListener('click', (e) => { if (e.target === modal) game.toggleLeaderboard(); });
}
