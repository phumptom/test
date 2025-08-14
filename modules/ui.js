// Auto-extracted UI & HUD utilities from game.js — step 8
export function installUI(game) {
  game.setupStartScreen = function setupStartScreen() {
      const btn = document.getElementById('startGameButton');
      if (btn) {
        const start = () => this.startGame();
        btn.addEventListener('click', start);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); }, { passive: false });
      }
  
  };

  game.showPauseOverlay = function showPauseOverlay() {
      const el = document.createElement('div');
      el.className = 'pause-screen';
      const inner = document.createElement('div');
      inner.className = 'pause-content';
      inner.innerHTML = `<div class="pause-title">PAUSED</div><div class="pause-sub">Press <b>P</b> or <b>Esc</b> to resume</div>`;
      el.appendChild(inner);
      document.body.appendChild(el);
      this.pauseOverlay = el;
  
  };

  game.hidePauseOverlay = function hidePauseOverlay() {
      if (this.pauseOverlay && this.pauseOverlay.parentElement) {
        this.pauseOverlay.parentElement.removeChild(this.pauseOverlay);
      }
      this.pauseOverlay = null;
  
  };

  game.updatePauseHUD = function updatePauseHUD() {
      const btn = document.getElementById('pauseToggleButton');
      if (!btn) return;
      if (this.paused) btn.textContent = '▶ Resume (P / Esc)';
      else btn.textContent = '⏸ Pause (P / Esc)';
  
  };

  game.createUI = function createUI() {
      // Health
      const hc = document.createElement('div'); hc.className = 'health-container';
      const hbc = document.createElement('div'); hbc.className = 'health-bar-container';
      const hb = document.createElement('div'); hb.id = 'healthBar'; hb.className = 'health-bar';
      hbc.appendChild(hb);
      const ht = document.createElement('div'); ht.id = 'healthText'; ht.className = 'health-text';
      ht.textContent = `Health ${this.playerHealth}/${this.playerMaxHealth}`;
      hc.appendChild(hbc); hc.appendChild(ht); document.body.appendChild(hc);

      // Wallet bar (top-left below health)
      const wallet = document.createElement('div'); wallet.className = 'wallet-bar';
      wallet.id = 'walletBar';
      wallet.innerHTML = `<button id="walletConnectBtn" class="wallet-btn">🪪 Connect Wallet</button>
                          <button id="walletDisconnectBtn" class="wallet-btn secondary hidden">Disconnect</button>
                          <span id="walletAddr" class="wallet-addr hidden"></span>`;
      document.body.appendChild(wallet);
      this.walletBar = wallet;
      const cBtn = document.getElementById('walletConnectBtn');
      const dBtn = document.getElementById('walletDisconnectBtn');
      cBtn.addEventListener('click', () => this.connectWallet());
      dBtn.addEventListener('click', () => this.disconnectWallet());

      // Right-top stats
      const stats = document.createElement('div'); stats.className = 'stats-container';
      const s = document.createElement('div'); s.id = 'scoreDisplay'; s.className = 'stat-item score-item'; s.textContent = `Score ${this.score}`;
      const k = document.createElement('div'); k.id = 'killsDisplay'; k.className = 'stat-item kills-item'; k.textContent = `Kills ${this.enemyKills}`;
      const m = document.createElement('div'); m.id = 'multiplierDisplay'; m.className = 'stat-item multiplier-item'; m.textContent = `x${this.currentMultiplier.toFixed(1)}`;
      const st= document.createElement('div'); st.id = 'streakDisplay'; st.className = 'stat-item streak-item'; st.textContent = `Streak ${this.killStreak}`;
      const d = document.createElement('div'); d.id = 'difficultyDisplay'; d.className = 'stat-item difficulty-item'; d.textContent = 'Level 1';
      const prog = document.createElement('div'); prog.className = 'difficulty-progress-bar';
      const fill = document.createElement('div'); fill.id = 'difficultyProgressFill'; fill.className = 'difficulty-progress-fill'; fill.style.width = '0%';
      prog.appendChild(fill); d.appendChild(prog);

      const pauseBtn = document.createElement('button');
      pauseBtn.id = 'pauseToggleButton';
      pauseBtn.className = 'stat-item';
      pauseBtn.style.cursor = 'pointer';
      pauseBtn.textContent = '⏸ Pause (P / Esc)';
      pauseBtn.addEventListener('click', () => this.togglePause());

      stats.appendChild(s); stats.appendChild(k); stats.appendChild(m); stats.appendChild(st); stats.appendChild(d); stats.appendChild(pauseBtn);
      document.body.appendChild(stats);

      // Boost bar (top center)
      const boostWrap = document.createElement('div');
      boostWrap.id = 'boostBar'; boostWrap.className = 'boost-bar hidden';
      boostWrap.innerHTML = `<div class="boost-label">RAPID FIRE</div><div class="boost-progress"><div id="boostFill" class="boost-fill"></div></div>`;
      document.body.appendChild(boostWrap);

      // Inventory quickbar (bottom-left) + hint
      const inv = document.createElement('div');
      inv.id = 'inventoryBar'; inv.className = 'inventory-bar';
      document.body.appendChild(inv);
      const invHint = document.createElement('div');
      invHint.id = 'inventoryHint';
      invHint.className = 'inventory-hint hidden';
      invHint.textContent = 'Активация: ⚡1  🟢2  ➕3  ❤️4  (или клик по иконке)';
      document.body.appendChild(invHint);
      this.inventoryHintEl = invHint;
  
  };

  game.createShopUI = function createShopUI() {
      // Bottom bar: shop + coins + leaderboard
      const bottom = document.createElement('div'); bottom.id = 'bottomBar'; bottom.className = 'bottom-bar';
      const shopBtn = document.createElement('button'); shopBtn.id = 'shopToggleButton'; shopBtn.className = 'shop-toggle-button'; shopBtn.textContent = '🛒 Shop (B)';
      shopBtn.title = 'Open shop (B)'; shopBtn.addEventListener('click', () => this.toggleShop());
      const leaderBtn = document.createElement('button'); leaderBtn.id = 'leaderToggleButton'; leaderBtn.className = 'shop-toggle-button secondary'; leaderBtn.textContent = '🏆 Top (L)';
      leaderBtn.title = 'Leaderboard (L)'; leaderBtn.addEventListener('click', () => this.toggleLeaderboard());
      const coins = document.createElement('div'); coins.className = 'coins-slot'; coins.innerHTML = `🪙 <span id="coinsDisplay">${this.coins}</span>`;
      bottom.appendChild(shopBtn); bottom.appendChild(leaderBtn); bottom.appendChild(coins);
      document.body.appendChild(bottom);
      this.shopToggleBtn = shopBtn;

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
            <button class="shop-buy" data-item="rapidFire">Buy — ${this.shopPrices.rapidFire} 🪙</button>
          </div>
          <div class="shop-card" data-item="shockwave">
            <div class="shop-icon">🟢</div>
            <div class="shop-name">Shockwave</div>
            <div class="shop-desc">Expanding wave that destroys enemies as it reaches them.</div>
            <button class="shop-buy" data-item="shockwave">Buy — ${this.shopPrices.shockwave} 🪙</button>
          </div>
          <div class="shop-card" data-item="heal50">
            <div class="shop-icon">➕</div>
            <div class="shop-name">Heal 50%</div>
            <div class="shop-desc">Adds 50% of max HP.</div>
            <button class="shop-buy" data-item="heal50">Buy — ${this.shopPrices.heal50} 🪙</button>
          </div>
          <div class="shop-card" data-item="heal100">
            <div class="shop-icon">❤️</div>
            <div class="shop-name">Heal 100%</div>
            <div class="shop-desc">Restores all HP.</div>
            <button class="shop-buy" data-item="heal100">Buy — ${this.shopPrices.heal100} 🪙</button>
          </div>
        </div>
        <div class="shop-footer">Покупки попадают в инвентарь. Активируй из панели внизу слева или клавишами <b>1–4</b>.</div>
      `;
      modal.appendChild(panel);
      document.body.appendChild(modal);
      this.shopModal = modal;

      modal.addEventListener('click', (e) => { if (e.target === modal) this.toggleShop(); });
      modal.querySelectorAll('.shop-buy').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const key = e.currentTarget.getAttribute('data-item');
          this.buyItem(key);
        });
      });
  
  };

  game.createLeaderboardUI = function createLeaderboardUI() {
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
      modal.appendChild(panel); document.body.appendChild(modal); this.leaderboardModal = modal;
      modal.addEventListener('click', (e) => { if (e.target === modal) this.toggleLeaderboard(); });
  
  };

  game.openShop = function openShop() {
      if (this.inShop) return;
      this.inShop = true;
      if (this.shopModal) this.shopModal.classList.remove('hidden');
      this.setPaused(true);
      if (this.pauseOverlay) this.hidePauseOverlay();
  
  };

  game.closeShop = function closeShop() {
      if (!this.inShop) return;
      this.inShop = false;
      if (this.shopModal) this.shopModal.classList.add('hidden');
      this.setPaused(false);
  
  };

  game.toggleShop = function toggleShop() {
   this.inShop ? this.closeShop() : this.openShop(); 
  };

  game.openLeaderboard = function openLeaderboard() {
      if (this.inLeaderboard) return;
      this.inLeaderboard = true;
      this.refreshLeaderboardUI();
      if (this.leaderboardModal) this.leaderboardModal.classList.remove('hidden');
      this.setPaused(true);
      if (this.pauseOverlay) this.hidePauseOverlay();
  
  };

  game.closeLeaderboard = function closeLeaderboard() {
      if (!this.inLeaderboard) return;
      this.inLeaderboard = false;
      if (this.leaderboardModal) this.leaderboardModal.classList.add('hidden');
      this.setPaused(false);
  
  };

  game.toggleLeaderboard = function toggleLeaderboard() {
   this.inLeaderboard ? this.closeLeaderboard() : this.openLeaderboard(); 
  };

  game.updateUI = function updateUI() {
      const hb = document.getElementById('healthBar');
      const ht = document.getElementById('healthText');
      const sd = document.getElementById('scoreDisplay');
      const kd = document.getElementById('killsDisplay');
      const md = document.getElementById('multiplierDisplay');
      const st = document.getElementById('streakDisplay');
      const dd = document.getElementById('difficultyDisplay');
      const dpf = document.getElementById('difficultyProgressFill');
      const cd = document.getElementById('coinsDisplay');

      if (hb) hb.style.width = `${Math.max(0, Math.min(100, (this.playerHealth/this.playerMaxHealth)*100)).toFixed(1)}%`;
      if (ht) ht.textContent = `Health ${Math.max(0, this.playerHealth)}/${this.playerMaxHealth}`;
      if (sd) sd.textContent = `Score ${this.score}`;
      if (kd) kd.textContent = `Kills ${this.enemyKills}`;
      if (md) md.textContent = `x${this.currentMultiplier.toFixed(1)}`;
      if (st) st.textContent = `Streak ${this.killStreak}`;
      if (cd) cd.textContent = `${this.coins}`;

      if (dd) {
        dd.textContent = `Level ${this.playerLevel}`;
        const pct = Math.max(0, Math.min(100, (this.playerXP/this.xpToNext)*100));
        if (dpf) { dpf.style.width = `${pct.toFixed(1)}%`; dpf.classList.toggle('near-level-up', pct >= 80); dpf.parentElement.style.display = 'block'; }
        dd.classList.toggle('scaling', pct >= 50);
      }

      this.updatePauseHUD();
      if (this._invDirty) { this.renderInventory(); this._invDirty = false; }
  
  };

  game.updateUIThrottled = function updateUIThrottled(force=false) {
      const now = this._now || Date.now();
      if (force || now - this._uiLast >= this._uiInterval) {
        this._uiLast = now;
        this.updateUI();
      }
  
  };

  game.renderInventory = function renderInventory() {
      const bar = document.getElementById('inventoryBar');
      if (!bar) return;
      bar.innerHTML = '';

      const addItem = (key, label, hint, icon) => {
        const count = this.inventory[key];
        if (!count) return;
        const el = document.createElement('div');
        el.className = 'inv-item';
        el.innerHTML = `<div class="inv-icon">${icon}</div><div class="inv-hint">${hint}</div><div class="inv-count">${count}</div>`;
        el.title = `${label} — press ${hint} to activate`;
        el.addEventListener('click', () => this.activateItemByKey(key));
        bar.appendChild(el);
      };

      addItem('rapidFire', 'Rapid Fire ×3 (10s)', '1', '⚡');
      addItem('shockwave', 'Shockwave', '2', '🟢');
      addItem('heal50', 'Heal 50%', '3', '➕');
      addItem('heal100', 'Heal 100%', '4', '❤️');

      const hasAny = bar.children.length > 0;
      bar.style.display = hasAny ? 'flex' : 'none';
      if (this.inventoryHintEl) this.inventoryHintEl.classList.toggle('hidden', !hasAny);
  
  };

  game.buyItem = function buyItem(key) {
      const price = this.shopPrices[key];
      if (price == null) return;
      if (this.coins < price) return;
      this.coins -= price;
      this.inventory[key] = (this.inventory[key] || 0) + 1;
      this._invDirty = true; this.updateUI();
      this.createFloatingText(`+${key.toUpperCase()}`, this.playerPosition.clone(), '#4caf50');
  
  };

  game.activateItemByKey = function activateItemByKey(key) {
      if (!this.inventory[key]) return;
      if (key === 'rapidFire') {
        this.inventory[key]--;
        this.activateRapidFire();
      } else if (key === 'shockwave') {
        this.inventory[key]--;
        this.activateShockwave();
      } else if (key === 'heal50') {
        this.inventory[key]--;
        this.activateHealPercent(0.5);
      } else if (key === 'heal100') {
        this.inventory[key]--;
        this.activateHealPercent(1.0);
      }
      this._invDirty = true; this.updateUI();
  
  };

}
