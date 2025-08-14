// Auto-generated in modularization step: pickups & items
import * as THREE from 'three';
export function installPickups(game) {
  if (!game.pickups) game.pickups = [];
  function createHealthPickup(position, count = 1) {
      for (let i=0;i<count;i++) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0x220000, roughness: 0.35, metalness: 0.1 });
        const barV = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.18), mat);
        const barH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.18), mat);
        barV.position.y = 0.35; barH.position.y = 0.35;
        g.add(barV); g.add(barH);
        g.position.copy(position.clone().add(new THREE.Vector3((Math.random()-0.5)*0.6, 0, (Math.random()-0.5)*0.6)));
        this.scene.add(g);
        this.pickups.push({ group: g, type: 'health', rot: Math.random()*Math.PI*2, bob: Math.random()*Math.PI*2 });
      }
    }
  game.createHealthPickup = createHealthPickup.bind(game);

  function createCoinPickup(position) {
      const g = new THREE.Group();
      if (this.coinTexture) { this.coinFaceMat.map = this.coinTexture; this.coinFaceMat.needsUpdate = true; }
      const coin = new THREE.Mesh(this.coinGeometry, [this.coinSideMat, this.coinFaceMat, this.coinFaceMat]);
      coin.rotation.x = Math.PI/2;
      coin.position.y = 0.40;
      g.add(coin);
      const jitter = this._tmpV1.set((Math.random()-0.5)*0.6, 0, (Math.random()-0.5)*0.6);
      g.position.copy(position).add(jitter);
      this.scene.add(g);
      this.pickups.push({ group: g, type: 'coin', rot: Math.random()*Math.PI*2, bob: Math.random()*Math.PI*2 });
    }
  game.createCoinPickup = createCoinPickup.bind(game);

  function maybeDropHealthPickup(pos, isBoss) {
      if (isBoss) { this.createHealthPickup(pos, 1); return; }
      if (Math.random() < this.healthPickupChance) this.createHealthPickup(pos, 1);
    }
  game.maybeDropHealthPickup = maybeDropHealthPickup.bind(game);

  function maybeDropCoinPickup(pos, isBoss) {
      const chance = isBoss ? Math.min(1, this.coinDropChance + 0.2) : this.coinDropChance;
      if (Math.random() < chance) this.createCoinPickup(pos);
    }
  game.maybeDropCoinPickup = maybeDropCoinPickup.bind(game);

  function updatePickups(delta) {
      for (let i=this.pickups.length-1;i>=0;i--) {
        const p = this.pickups[i];
        p.rot += 1.8*delta; p.bob += 2.6*delta;
        p.group.rotation.y = p.rot;
        const baseY = (p.type === 'coin') ? 0.45 : 0.20;
        p.group.position.y = baseY + Math.sin(p.bob)*0.15;
        const dx = this.playerPosition.x - p.group.position.x;
        const dz = this.playerPosition.z - p.group.position.z;
        if ((dx*dx + dz*dz) <= (this.playerRadius + 0.9) * (this.playerRadius + 0.9)) {
          if (p.type === 'health') {
            const healAmt = Math.round(this.enemyDamage * this.healthPickupHealFactor);
            this.heal(healAmt);
          } else if (p.type === 'coin') {
            this.addCoins(1);
          }
          this.scene.remove(p.group); this.pickups.splice(i,1);
        }
      }
    }
  game.updatePickups = updatePickups.bind(game);

  function heal(amount) {
      if (this.playerHealth <= 0) return;
      const before = this.playerHealth;
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + amount);
      if (this.playerHealth > before) {
        this.updateUI();
        this.createFloatingText(`+${this.playerHealth - before} HP`, this.playerPosition.clone(), '#ff6666');
      }
    }
  game.heal = heal.bind(game);

  function activateHealPercent(p) {
      const amount = Math.round(this.playerMaxHealth * p);
      this.heal(amount);
    }
  game.activateHealPercent = activateHealPercent.bind(game);

  function addCoins(n) {
      this.coins += n;
      this.updateUI();
      this.createFloatingText(`+${n} 🪙`, this.playerPosition.clone(), '#FFD700');
    }
  game.addCoins = addCoins.bind(game);

  function createFloatingText(text, pos, color = '#ff6666') {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
        fontSize:'20px', fontWeight:'bold', color: color,
        textShadow:'2px 2px 4px rgba(0,0,0,0.6)', zIndex:'9999', pointerEvents:'none',
        fontFamily:'Arial, sans-serif'
      });
      el.textContent = text; document.body.appendChild(el);
      const start = performance.now(), duration = 800;
      const animate = (t) => {
        const k = Math.min(1, (t-start)/duration);
        el.style.opacity = String(1-k);
        el.style.transform = `translate(-50%, calc(-50% - ${k*40}px))`;
        if (k<1) requestAnimationFrame(animate); else el.remove();
      };
      requestAnimationFrame(animate);
    }
  game.createFloatingText = createFloatingText.bind(game);

}