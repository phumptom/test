// Auto-generated in modularization step: enemies AI & spawns
import * as THREE from 'three';
export function installEnemies(game) {
  // Ensure arrays exist
  if (!game.enemies) game.enemies = [];
  function createCandleEnemyModel() {
      const group = new THREE.Group();
      const bodyGeom = new THREE.BoxGeometry(0.8, 2.0, 0.6);
      const mat = new THREE.MeshStandardMaterial({ color: 0xfa0037, roughness: 0.6, metalness: 0.05 });
      const body = new THREE.Mesh(bodyGeom, mat); body.position.y = 1.0;
      const capGeom = new THREE.BoxGeometry(0.12, 0.4, 0.12);
      const cap = new THREE.Mesh(capGeom, mat); cap.position.y = 2.2;
      group.add(body); group.add(cap);
      return { group, body, cap };
    }
  game.createCandleEnemyModel = createCandleEnemyModel.bind(game);

  function createThinShooterModel() {
      const group = new THREE.Group();
      const bodyGeom = new THREE.BoxGeometry(0.45, 2.8, 0.45);
      const mat = new THREE.MeshStandardMaterial({ color: 0xfa0037, roughness: 0.55, metalness: 0.08 });
      const body = new THREE.Mesh(bodyGeom, mat); body.position.y = 1.4;
      const capGeom = new THREE.BoxGeometry(0.10, 0.5, 0.10);
      const cap = new THREE.Mesh(capGeom, mat); cap.position.y = 2.9;
      group.add(body); group.add(cap);
      return { group, body, cap };
    }
  game.createThinShooterModel = createThinShooterModel.bind(game);

  function createBossModel(scale = 1.9) {
      const { group, body, cap } = this.createCandleEnemyModel();
      group.scale.set(scale, scale*1.15, scale);
      body.material = new THREE.MeshStandardMaterial({ color: 0xfa0037, roughness: 0.5, metalness: 0.08 });
      cap.material = body.material;
      return { group, body, cap };
    }
  game.createBossModel = createBossModel.bind(game);

  function createHealthBar3D(enemy) {
      const box = new THREE.Box3().setFromObject(enemy.model);
      const height = (box.max.y - box.min.y);
      const yOffset = box.max.y + Math.max(0.4, height * 0.08);
      const width = Math.max(2.4, height * 0.9);
      const heightPx = Math.max(0.20, height * 0.08);
      const barGroup = new THREE.Group();
      const back = new THREE.Mesh(new THREE.PlaneGeometry(width, heightPx), new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }));
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(width, heightPx), new THREE.MeshBasicMaterial({ color: 0xdd3333, side: THREE.DoubleSide }));
      fill.position.x = -width/2;
      fill.scale.x = Math.max(0, enemy.health/enemy.maxHealth);
      barGroup.add(back); barGroup.add(fill);
      barGroup.position.set(enemy.position.x, yOffset, enemy.position.z);
      this.scene.add(barGroup);
      enemy.healthBar = barGroup; enemy.healthBarFill = fill; enemy.healthBarWidth = width; enemy.healthBarYOffset = yOffset;
    }
  game.createHealthBar3D = createHealthBar3D.bind(game);

  function isPositionFreeOfEnemies(position, radius, ignoreIndex = -1) {
      for (let i=0;i<this.enemies.length;i++) {
        if (i===ignoreIndex) continue;
        const other = this.enemies[i];
        if (!other.alive) continue;
        const dx = position.x - other.position.x; const dz = position.z - other.position.z;
        const distSq = dx*dx + dz*dz; const minDist = radius + other.radius + 0.05;
        if (distSq < minDist*minDist) return false;
      }
      return true;
    }
  game.isPositionFreeOfEnemies = isPositionFreeOfEnemies.bind(game);

  function applyEnemySeparation(index, desiredPos, radius, fallbackPos) {
      let pos = desiredPos.clone();
      for (let j=0;j<this.enemies.length;j++) {
        if (j===index) continue;
        const other = this.enemies[j]; if (!other.alive) continue;
        const dx = pos.x - other.position.x; const dz = pos.z - other.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz); const minDist = radius + other.radius + 0.05;
        if (dist > 0 && dist < minDist) { const push = (minDist - dist)*0.5; pos.x += (dx/dist)*push; pos.z += (dz/dist)*push; }
      }
      if (!this.isWithinFieldBounds(pos, radius) || this.checkObstacleCollision(pos, radius)) return fallbackPos.clone();
      return pos;
    }
  game.applyEnemySeparation = applyEnemySeparation.bind(game);

  function separateEnemyFromPlayer(enemy) {
      const minDist = this.playerRadius + enemy.radius;
      const toEnemy = enemy.position.clone().sub(this.playerPosition); toEnemy.y = 0;
      const dist = Math.max(1e-6, toEnemy.length());
      if (dist < minDist) {
        const n = toEnemy.multiplyScalar(1/dist);
        const targetPos = this.playerPosition.clone().add(n.multiplyScalar(minDist + 0.001));
        if (this.isWithinFieldBounds(targetPos, enemy.radius) && !this.checkObstacleCollision(targetPos, enemy.radius)) {
          enemy.position.copy(targetPos);
          enemy.model.position.copy(enemy.position);
        }
      }
    }
  game.separateEnemyFromPlayer = separateEnemyFromPlayer.bind(game);

  function countSnipers() { let c = 0; for (const e of this.enemies) if (e.alive && e.type === 'sniper') c++; return c; }
  game.countSnipers = countSnipers.bind(game);

  function spawnEnemyOfType(type='normal') {
      const isSniper = (type === 'sniper');
      const enemyRadius = isSniper ? 0.45 : 0.55;
      if (!this.fieldBounds) return;
      const padding = enemyRadius + 0.6;
      const minX = this.fieldBounds.minX + padding, maxX = this.fieldBounds.maxX - padding;
      const minZ = this.fieldBounds.minZ + padding, maxZ = this.fieldBounds.maxZ - padding;
      const maxAttempts = 80; let attempts = 0; let pos = new THREE.Vector3();
      while (attempts < maxAttempts) {
        pos.set(THREE.MathUtils.lerp(minX, maxX, Math.random()), 1, THREE.MathUtils.lerp(minZ, maxZ, Math.random()));
        const far = this.playerPosition.distanceTo(pos) >= 6;
        const freeOb = !this.checkObstacleCollision(pos, enemyRadius);
        const freeEn = this.isPositionFreeOfEnemies(pos, enemyRadius, -1);
        if (far && freeOb && freeEn) break;
        attempts++;
      }
      if (attempts >= maxAttempts) return;
      const mdl = isSniper ? this.createThinShooterModel() : this.createCandleEnemyModel();
      mdl.group.position.copy(pos);
      const enemy = {
        model: mdl.group, body: mdl.body, cap: mdl.cap,
        position: pos.clone(), radius: enemyRadius,
        health: isSniper ? 4 : 3, maxHealth: isSniper ? 4 : 3,
        alive: true, isBoss: false,
        speed: isSniper ? this.enemySpeed * 0.9 : this.enemySpeed,
        damage: this.enemyDamage,
        type: isSniper ? 'sniper' : 'normal',
        lastShotTime: 0
      };
      this.scene.add(mdl.group); this.enemies.push(enemy);
    }
  game.spawnEnemyOfType = spawnEnemyOfType.bind(game);

  function spawnEnemy() {
      if (this.enemies.filter(e => e.alive).length >= this.maxConcurrentEnemies) return;
      const canSpawnSniper = this.countSnipers() < 2;
      const spawnSniper = canSpawnSniper && Math.random() < 0.18;
      this.spawnEnemyOfType(spawnSniper ? 'sniper' : 'normal');
    }
  game.spawnEnemy = spawnEnemy.bind(game);

  function spawnBoss() {
      if (!this.fieldBounds) return;
      const minutes = (this._now - this.gameStartTime)/60000;
      const enemyRadius = 1.25;
      const padding = enemyRadius + 1.0;
      const minX = this.fieldBounds.minX + padding, maxX = this.fieldBounds.maxX - padding;
      const minZ = this.fieldBounds.minZ + padding, maxZ = this.fieldBounds.maxZ - padding;
      const maxAttempts = 80; let attempts = 0; const pos = new THREE.Vector3();
      while (attempts < maxAttempts) {
        pos.set(THREE.MathUtils.lerp(minX, maxX, Math.random()), 1, THREE.MathUtils.lerp(minZ, maxZ, Math.random()));
        const far = this.playerPosition.distanceTo(pos) >= 10;
        const freeOb = !this.checkObstacleCollision(pos, enemyRadius);
        if (far && freeOb) break; attempts++;
      }
      if (attempts >= maxAttempts) return;
      const { group, body, cap } = this.createBossModel(2.0);
      group.position.copy(pos);
      const hp = Math.round(this.bossConfig.baseHealth + minutes * this.bossConfig.healthPerMinute);
      const enemy = {
        model: group, body, cap,
        position: pos.clone(), radius: enemyRadius,
        health: hp, maxHealth: hp, alive: true,
        speed: Math.max(1.8, this.enemySpeed * this.bossConfig.speedFactor),
        damage: Math.round(this.enemyDamage * this.bossConfig.damageFactor),
        isBoss: true, type: 'boss'
      };
      this.scene.add(group);
      this.enemies.push(enemy);
      this.createHealthBar3D(enemy);
    }
  game.spawnBoss = spawnBoss.bind(game);

  function removeEnemyAtIndex(index) {
      const enemy = this.enemies[index];
      if (!enemy) return;
      enemy.alive = false;
      if (enemy.model) { this.scene.remove(enemy.model); this.disposeObject3D(enemy.model); }
      if (enemy.healthBar) { this.scene.remove(enemy.healthBar); this.disposeObject3D(enemy.healthBar); }
      this.enemies.splice(index, 1);
    }
  game.removeEnemyAtIndex = removeEnemyAtIndex.bind(game);

  function registerKill(enemy) {
      const prev = this.killStreak;
      this.killStreak++;
      this.lastKillTime = this._now || Date.now();
      this.checkStreakMilestone(prev, this.killStreak);

      if (this.killStreak >= 5) this.currentMultiplier = Math.min(this.maxMultiplier, 2.0 + (this.killStreak - 5) * 0.1);
      else if (this.killStreak >= 3) this.currentMultiplier = 1.5;
      else if (this.killStreak >= 2) this.currentMultiplier = 1.2;

      const bonus = Math.floor(this.pointsPerKill * this.currentMultiplier);
      this.enemyKills++; this.score += bonus;

      this.addXP(enemy && enemy.isBoss ? this.xpPerKillBoss : this.xpPerKillNormal);
      if (enemy && enemy.position) {
        this.maybeDropHealthPickup(enemy.position, !!enemy.isBoss);
        this.maybeDropCoinPickup(enemy.position, !!enemy.isBoss);
      }

      const md = document.getElementById('multiplierDisplay');
      if (md && this.currentMultiplier > 1.0) { md.classList.add('active'); setTimeout(()=>md.classList.remove('active'), 500); }
      this.updateUI();
    }
  game.registerKill = registerKill.bind(game);

}