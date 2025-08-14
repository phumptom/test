export function installShopUI(game) {
  // Bottom bar: shop + coins + leaderboard
  const bottom = document.createElement('div'); bottom.id = 'bottomBar'; bottom.className = 'bottom-bar';
  const shopBtn = document.createElement('button'); shopBtn.id = 'shopToggleButton'; shopBtn.className = 'shop-toggle-button'; shopBtn.textContent = '🛒 Shop (B)';
  shopBtn.title = 'Open shop (B)'; shopBtn.addEventListener('click', () => game.toggleShop());
  const leaderBtn = document.createElement('button'); leaderBtn.id = 'leaderToggleButton'; leaderBtn.className = 'shop-toggle-button secondary'; leaderBtn.textContent = '🏆 Top (L)';
  leaderBtn.title = 'Leaderboard (L)'; leaderBtn.addEventListener('click', () => game.toggleLeaderboard());
  const coins = document.createElement('div'); coins.className = 'coins-slot'; coins.innerHTML = `🪙 <span id="coinsDisplay">${game.coins}</span>`;
  bottom.appendChild(shopBtn); bottom.appendChild(leaderBtn); bottom.appendChild(coins);
  document.body.appendChild(bottom);
  game.shopToggleBtn = shopBtn;

  // Modal shop
  const modal = document.createElement('div'); modal.id = 'shopModal'; modal.className = 'shop-modal hidden';
  const panel = document.createElement('div'); panel.className = 'shop-content';
  panel.innerHTML = `
      <div class="shop-header">
        <div class="shop-title">SHOP</div>
        <div class="shop-sub">Game is paused while shop is open. Close with <b>B</b> or <b>Esc</b>.</div>
      </div>
      <div class="shop-grid">
        <div class="shop-card" data-item="rapidFire">
          <div class="shop-icon">⚡</div>
          <div class="shop-name">Rapid Fire ×3 (10s)</div>
          <div class="shop-desc">Triples your current rate of fire for 10 seconds.</div>
          <button class="shop-buy" data-item="rapidFire">Buy — ${game.shopPrices.rapidFire} 🪙</button>
        </div>
        <div class="shop-card" data-item="shockwave">
          <div class="shop-icon">🟢</div>
          <div class="shop-name">Shockwave</div>
          <div class="shop-desc">Expanding wave that destroys enemies as it reaches them.</div>
          <button class="shop-buy" data-item="shockwave">Buy — ${game.shopPrices.shockwave} 🪙</button>
        </div>
        <div class="shop-card" data-item="heal50">
          <div class="shop-icon">➕</div>
          <div class="shop-name">Heal 50%</div>
          <div class="shop-desc">Adds 50% of max HP.</div>
          <button class="shop-buy" data-item="heal50">Buy — ${game.shopPrices.heal50} 🪙</button>
        </div>
        <div class="shop-card" data-item="heal100">
          <div class="shop-icon">❤️</div>
          <div class="shop-name">Heal 100%</div>
          <div class="shop-desc">Restores all HP.</div>
          <button class="shop-buy" data-item="heal100">Buy — ${game.shopPrices.heal100} 🪙</button>
        </div>
      </div>
      <div class="shop-footer">Покупки попадают в инвентарь. Активируй из панели внизу слева или клавишами <b>1–4</b>.</div>
    `;
  modal.appendChild(panel);
  document.body.appendChild(modal);
  game.shopModal = modal;

  modal.addEventListener('click', (e) => { if (e.target === modal) game.toggleShop(); });
  modal.querySelectorAll('.shop-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.getAttribute('data-item');
      game.buyItem(key);
    });
  });
}
