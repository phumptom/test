// Step 4 extract — Enemies & Boss system
// Sourced from game.js (methods: createCandleEnemyModel, createThinShooterModel, createBossModel,
// createHealthBar3D, isPositionFreeOfEnemies, applyEnemySeparation, separateEnemyFromPlayer, countSnipers,
// spawnEnemyOfType, spawnEnemy, spawnBoss, updateEnemies, disposeObject3D, removeEnemyAtIndex)
// All `this.` references were adapted to `game.` and THREE is imported locally.

import * as THREE from 'three';

export function createCandleEnemyModel() {
  const group = new THREE.Group();
  const bodyGeom = new THREE.BoxGeometry(0.8, 2.0, 0.6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xfa0037, roughness: 0.6, metalness: 0.05 });
  const body = new THREE.Mesh(bodyGeom, mat); body.position.y = 1.0;
  const capGeom = new THREE.BoxGeometry(0.12, 0.4, 0.12);
  const cap = new THREE.Mesh(capGeom, mat); cap.position.y = 2.2;
  group.add(body); group.add(cap);
  return { group, body, cap };
}

export function createThinShooterModel() {
  const group = new THREE.Group();
  const bodyGeom = new THREE.BoxGeometry(0.45, 2.8, 0.45);
  const mat = new THREE.MeshStandardMaterial({ color: 0xfa0037, roughness: 0.55, metalness: 0.08 });
  const body = new THREE.Mesh(bodyGeom, mat); body.position.y = 1.4;
  const capGeom = new THREE.BoxGeometry(0.10, 0.5, 0.10);
  const cap = new THREE.Mesh(capGeom, mat); cap.position.y = 2.9;
  group.add(body); group.add(cap);
  return { group, body, cap };
}

export function createBossModel(scale = 1.9) {
  const { group, body, cap } = createCandleEnemyModel();
  group.scale.set(scale, scale*1.15, scale);
  body.material = new THREE.MeshStandardMaterial({ color: 0xfa0037, roughness: 0.5, metalness: 0.08 });
  cap.material = body.material;
  return { group, body, cap };
}

export function createHealthBar3D(game, enemy) {
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
  game.scene.add(barGroup);
  enemy.healthBar = barGroup; enemy.healthBarFill = fill; enemy.healthBarWidth = width; enemy.healthBarYOffset = yOffset;
}

export function isPositionFreeOfEnemies(game, position, radius, ignoreIndex = -1) {
  for (let i=0;i<game.enemies.length;i++) {
    if (i===ignoreIndex) continue;
    const other = game.enemies[i];
    if (!other.alive) continue;
    const dx = position.x - other.position.x; const dz = position.z - other.position.z;
    const distSq = dx*dx + dz*dz; const minDist = radius + other.radius + 0.05;
    if (distSq < minDist*minDist) return false;
  }
  return true;
}

export function applyEnemySeparation(game, index, desiredPos, radius, fallbackPos) {
  let pos = desiredPos.clone();
  for (let j=0;j<game.enemies.length;j++) {
    if (j===index) continue;
    const other = game.enemies[j]; if (!other.alive) continue;
    const dx = pos.x - other.position.x; const dz = pos.z - other.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz); const minDist = radius + other.radius + 0.05;
    if (dist > 0 && dist < minDist) { const push = (minDist - dist)*0.5; pos.x += (dx/dist)*push; pos.z += (dz/dist)*push; }
  }
  if (!game.isWithinFieldBounds(pos, radius) || game.checkObstacleCollision(pos, radius)) return fallbackPos.clone();
  return pos;
}

export function separateEnemyFromPlayer(game, enemy) {
  const minDist = game.playerRadius + enemy.radius;
  const toEnemy = enemy.position.clone().sub(game.playerPosition); toEnemy.y = 0;
  const dist = Math.max(1e-6, toEnemy.length());
  if (dist < minDist) {
    const n = toEnemy.multiplyScalar(1/dist);
    const targetPos = game.playerPosition.clone().add(n.multiplyScalar(minDist + 0.001));
    if (game.isWithinFieldBounds(targetPos, enemy.radius) && !game.checkObstacleCollision(targetPos, enemy.radius)) {
      enemy.position.copy(targetPos);
      enemy.model.position.copy(enemy.position);
    }
  }
}

export function countSnipers(game) { let c = 0; for (const e of game.enemies) if (e.alive && e.type === 'sniper') c++; return c; }

export function spawnEnemyOfType(game, type='normal') {
  const isSniper = (type === 'sniper');
  const enemyRadius = isSniper ? 0.45 : 0.55;
  if (!game.fieldBounds) return;
  const padding = enemyRadius + 0.6;
  const minX = game.fieldBounds.minX + padding, maxX = game.fieldBounds.maxX - padding;
  const minZ = game.fieldBounds.minZ + padding, maxZ = game.fieldBounds.maxZ - padding;
  const maxAttempts = 80; let attempts = 0; let pos = new THREE.Vector3();
  while (attempts < maxAttempts) {
    pos.set(THREE.MathUtils.lerp(minX, maxX, Math.random()), 1, THREE.MathUtils.lerp(minZ, maxZ, Math.random()));
    const far = game.playerPosition.distanceTo(pos) >= 6;
    const freeOb = !game.checkObstacleCollision(pos, enemyRadius);
    const freeEn = isPositionFreeOfEnemies(game, pos, enemyRadius, -1);
    if (far && freeOb && freeEn) break;
    attempts++;
  }
  if (attempts >= maxAttempts) return;
  const mdl = isSniper ? createThinShooterModel() : createCandleEnemyModel();
  mdl.group.position.copy(pos);
  const enemy = {
    model: mdl.group, body: mdl.body, cap: mdl.cap,
    position: pos.clone(), radius: enemyRadius,
    health: isSniper ? 4 : 3, maxHealth: isSniper ? 4 : 3,
    alive: true, isBoss: false,
    speed: isSniper ? game.enemySpeed * 0.9 : game.enemySpeed,
    damage: game.enemyDamage,
    type: isSniper ? 'sniper' : 'normal',
    lastShotTime: 0
  };
  game.scene.add(mdl.group); game.enemies.push(enemy);
}

export function spawnEnemy(game) {
  if (game.enemies.filter(e => e.alive).length >= game.maxConcurrentEnemies) return;
  const canSpawnSniper = countSnipers(game) < 2;
  const spawnSniper = canSpawnSniper && Math.random() < 0.18;
  spawnEnemyOfType(game, spawnSniper ? 'sniper' : 'normal');
}

export function spawnBoss(game) {
  if (!game.fieldBounds) return;
  const minutes = (game._now - game.gameStartTime)/60000;
  const enemyRadius = 1.25;
  const padding = enemyRadius + 1.0;
  const minX = game.fieldBounds.minX + padding, maxX = game.fieldBounds.maxX - padding;
  const minZ = game.fieldBounds.minZ + padding, maxZ = game.fieldBounds.maxZ - padding;
  const maxAttempts = 80; let attempts = 0; const pos = new THREE.Vector3();
  while (attempts < maxAttempts) {
    pos.set(THREE.MathUtils.lerp(minX, maxX, Math.random()), 1, THREE.MathUtils.lerp(minZ, maxZ, Math.random()));
    const far = game.playerPosition.distanceTo(pos) >= 10;
    const freeOb = !game.checkObstacleCollision(pos, enemyRadius);
    if (far && freeOb) break; attempts++;
  }
  if (attempts >= maxAttempts) return;
  const { group, body, cap } = createBossModel(2.0);
  group.position.copy(pos);
  const hp = Math.round(game.bossConfig.baseHealth + minutes * game.bossConfig.healthPerMinute);
  const enemy = {
    model: group, body, cap,
    position: pos.clone(), radius: enemyRadius,
    health: hp, maxHealth: hp, alive: true,
    speed: Math.max(1.8, game.enemySpeed * game.bossConfig.speedFactor),
    damage: Math.round(game.enemyDamage * game.bossConfig.damageFactor),
    isBoss: true, type: 'boss'
  };
  game.scene.add(group);
  game.enemies.push(enemy);
  createHealthBar3D(game, enemy);
}

export function updateEnemies(game, delta) {
  for (let i=game.enemies.length-1;i>=0;i--) {
    const enemy = game.enemies[i];
    if (!enemy.alive) { removeEnemyAtIndex(game, i); continue; }
    const dirToPlayer = new THREE.Vector3().subVectors(game.playerPosition, enemy.position); dirToPlayer.y = 0;
    if (dirToPlayer.length()>0) {
      dirToPlayer.normalize();
      const speed = enemy.speed != null ? enemy.speed : game.enemySpeed;

      const proposed = enemy.position.clone().add(dirToPlayer.clone().multiplyScalar(speed*delta));
      let newPos = proposed;
      const valid = (pos) => game.isWithinFieldBounds(pos, enemy.radius) && !game.checkObstacleCollision(pos, enemy.radius);
      if (!valid(proposed)) {
        const angles = [Math.PI/6, -Math.PI/6, Math.PI/3, -Math.PI/3];
        let best = null; let bestDist = Infinity;
        for (const a of angles) {
          const altDir = dirToPlayer.clone().applyAxisAngle(new THREE.Vector3(0,1,0), a);
          const alt = enemy.position.clone().add(altDir.multiplyScalar(speed*delta));
          if (valid(alt)) {
            const d = alt.distanceTo(game.playerPosition);
            if (d < bestDist) { bestDist = d; best = alt; }
          }
        }
        if (best) newPos = best;
        else {
          const stepX = enemy.position.clone().add(new THREE.Vector3(dirToPlayer.x,0,0).multiplyScalar(speed*delta));
          const stepZ = enemy.position.clone().add(new THREE.Vector3(0,0,dirToPlayer.z).multiplyScalar(speed*delta));
          const options = [];
          if (valid(stepX)) options.push(stepX);
          if (valid(stepZ)) options.push(stepZ);
          if (options.length>0) {
            options.sort((a,b)=> a.distanceTo(game.playerPosition) - b.distanceTo(game.playerPosition));
            newPos = options[0];
          } else {
            newPos = enemy.position.clone();
          }
        }
      }
      newPos = applyEnemySeparation(game, i, newPos, enemy.radius, enemy.position);
      enemy.position.copy(newPos);
      enemy.model.position.copy(enemy.position);

      const angle = Math.atan2(dirToPlayer.x, dirToPlayer.z); enemy.model.rotation.y = angle;

      separateEnemyFromPlayer(game, enemy);

      if (enemy.type === 'sniper') {
        const now = game._now;
        if (now - enemy.lastShotTime >= game.sniperShootInterval) {
          if (game.hasLineOfSight(enemy.position, game.playerPosition)) {
            // Uses projectile system (still available on game instance)
            game.createEnemyProjectile
              ? game.createEnemyProjectile(enemy.position, game.playerPosition, Math.max(1, Math.round(game.enemyDamage * 0.3)))
              : null;
            enemy.lastShotTime = now;
          }
        }
      }

      if (enemy.isBoss && enemy.healthBar && enemy.healthBarFill) {
        const ratio = Math.max(0, enemy.health / enemy.maxHealth);
        enemy.healthBar.position.set(enemy.position.x, enemy.healthBarYOffset, enemy.position.z);
        enemy.healthBar.quaternion.copy(game.camera.quaternion);
        enemy.healthBarFill.scale.x = ratio;
        enemy.healthBarFill.position.x = -enemy.healthBarWidth/2 + (enemy.healthBarWidth * ratio)/2;
      }
    }
  }
}

// --- Utilities ---
export function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse(n => {
    if (n.isMesh) {
      if (n.geometry && typeof n.geometry.dispose === 'function') n.geometry.dispose();
      const mat = n.material;
      if (Array.isArray(mat)) mat.forEach(m => { if (m && typeof m.dispose === 'function') m.dispose(); });
      else if (mat && typeof mat.dispose === 'function') mat.dispose();
    }
  });
}

export function removeEnemyAtIndex(game, index) {
  const enemy = game.enemies[index];
  if (!enemy) return;
  enemy.alive = false;
  if (enemy.model) { game.scene.remove(enemy.model); disposeObject3D(enemy.model); }
  if (enemy.healthBar) { game.scene.remove(enemy.healthBar); disposeObject3D(enemy.healthBar); }
  game.enemies.splice(index, 1);
}

export default {
  createCandleEnemyModel, createThinShooterModel, createBossModel,
  createHealthBar3D,
  isPositionFreeOfEnemies, applyEnemySeparation, separateEnemyFromPlayer,
  countSnipers, spawnEnemyOfType, spawnEnemy, spawnBoss, updateEnemies,
  disposeObject3D, removeEnemyAtIndex
};
