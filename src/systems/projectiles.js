// Step 4 extract — Shooting & Projectiles system
// Sourced from game.js (methods: findNearestEnemy, getProjectileFromPool, releaseProjectileToPool,
// getEnemyProjectileFromPool, releaseEnemyProjectileToPool, createProjectile, getEffectiveShootingInterval,
// updateShooting, updateProjectiles, createEnemyProjectile, updateEnemyProjectiles, checkProjectileCollisions)
// All `this.` references were adapted to `game.` so you can use: import * as Projectiles from './systems/projectiles.js'
// and call e.g. Projectiles.updateProjectiles(game, delta).

import * as THREE from 'three';

/** Find nearest enemy within shooting range with line-of-sight */
export function findNearestEnemy(game) {
  let nearest = null, nearestDist2 = Infinity;
  const range2 = game.shootingRange * game.shootingRange;
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    const dx = game.playerPosition.x - enemy.position.x;
    const dz = game.playerPosition.z - enemy.position.z;
    const d2 = dx*dx + dz*dz;
    if (d2 <= range2 && d2 < nearestDist2) {
      if (game.hasLineOfSight(game.playerPosition, enemy.position)) {
        nearest = enemy; nearestDist2 = d2;
      }
    }
  }
  return nearest;
}

// --- Object pools for projectiles ---
export function getProjectileFromPool(game) {
  let p = game.projectilePool.pop();
  if (!p) {
    const mesh = new THREE.Mesh(game.bulletGeometry, game.bulletMaterial);
    game.projectilesGroup.add(mesh);
    p = { mesh, direction: new THREE.Vector3(), startTime: 0, maxLifetime: 3000 };
  }
  p.mesh.visible = true;
  return p;
}
export function releaseProjectileToPool(game, p) {
  if (!p) return;
  p.mesh.visible = false;
  game.projectilePool.push(p);
}
export function getEnemyProjectileFromPool(game) {
  let p = game.enemyProjectilePool.pop();
  if (!p) {
    const mesh = new THREE.Mesh(game.enemyBulletGeometry, game.enemyBulletMaterial);
    game.enemyProjectilesGroup.add(mesh);
    p = { mesh, direction: new THREE.Vector3(), startTime: 0, maxLifetime: 4000, damage: 0 };
  }
  p.mesh.visible = true;
  return p;
}
export function releaseEnemyProjectileToPool(game, p) {
  if (!p) return;
  p.mesh.visible = false;
  game.enemyProjectilePool.push(p);
}

export function createProjectile(game, targetPosition) {
  const p = getProjectileFromPool(game);
  const startPosition = game._tmpV1.copy(game.playerPosition); startPosition.y += 0.5;
  p.mesh.position.copy(startPosition);
  p.direction.subVectors(targetPosition, startPosition); p.direction.y = 0;
  if (p.direction.lengthSq() === 0) p.direction.set(0,0,1);
  p.direction.normalize();
  game._tmpQ.setFromUnitVectors(game._fwd, p.direction);
  p.mesh.quaternion.copy(game._tmpQ);
  p.startTime = game._now;
  p.maxLifetime = 3000;
  game.projectiles.push(p);
}

export function getEffectiveShootingInterval(game) {
  let interval = game.shootingInterval;
  if (game._now < game.fireRateBoostUntil) interval = Math.max(60, Math.floor(interval / 3));
  return interval;
}

export function updateShooting(game) {
  const now = game._now;
  const interval = getEffectiveShootingInterval(game);
  if (now - game.lastShotTime >= interval) {
    const target = findNearestEnemy(game);
    if (target) { createProjectile(game, target.position); game.lastShotTime = now; }
  }
}

export function updateProjectiles(game, delta) {
  const now = game._now;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    if (now - p.startTime >= p.maxLifetime) { releaseProjectileToPool(game, p); game.projectiles.splice(i,1); continue; }

    const start = p.mesh.position;
    const movement = game._tmpV1.copy(p.direction).multiplyScalar(game.projectileSpeed * delta);
    const next = game._tmpV2.copy(start).add(movement);

    if (game.pathHitsObstacle(start, next, 0.08)) {
      releaseProjectileToPool(game, p); game.projectiles.splice(i,1); continue;
    }

    p.mesh.position.copy(next);

    const maxDistSq = 30*30;
    const dx = game.playerPosition.x - p.mesh.position.x;
    const dz = game.playerPosition.z - p.mesh.position.z;
    if ((dx*dx + dz*dz) > maxDistSq) { releaseProjectileToPool(game, p); game.projectiles.splice(i,1); }
  }
}

export function createEnemyProjectile(game, startPos, targetPos, damage) {
  const proj = getEnemyProjectileFromPool(game);
  const startPosition = game._tmpV1.copy(startPos); startPosition.y += 0.6;
  proj.mesh.position.copy(startPosition);
  proj.direction.subVectors(game._tmpV2.copy(targetPos).setY(startPosition.y), startPosition);
  proj.direction.y = 0;
  if (proj.direction.lengthSq() === 0) proj.direction.set(0,0,1);
  proj.direction.normalize();
  proj.startTime = game._now;
  proj.maxLifetime = 4000;
  proj.damage = damage;
  game.enemyProjectiles.push(proj);
}

export function updateEnemyProjectiles(game, delta) {
  const now = game._now;
  for (let i = game.enemyProjectiles.length - 1; i >= 0; i--) {
    const p = game.enemyProjectiles[i];
    if (now - p.startTime >= p.maxLifetime) { releaseEnemyProjectileToPool(game, p); game.enemyProjectiles.splice(i,1); continue; }

    const start = p.mesh.position;
    const movement = game._tmpV1.copy(p.direction).multiplyScalar(game.sniperProjectileSpeed * delta);
    const next = game._tmpV2.copy(start).add(movement);

    if (game.pathHitsObstacle(start, next, 0.05)) {
      releaseEnemyProjectileToPool(game, p); game.enemyProjectiles.splice(i,1); continue;
    }

    p.mesh.position.copy(next);

    const r = game.playerRadius + 0.25;
    const dx = game.playerPosition.x - p.mesh.position.x;
    const dz = game.playerPosition.z - p.mesh.position.z;
    if ((dx*dx + dz*dz) <= r*r) {
      releaseEnemyProjectileToPool(game, p); game.enemyProjectiles.splice(i,1);
      game.takeDamage(Math.max(1, Math.round(game.enemyDamage * 0.3)), p.mesh.position);
    }
  }
}

/** Bullet–enemy collisions & damage + kill accounting */
export function checkProjectileCollisions(game) {
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    const px = p.mesh.position.x, pz = p.mesh.position.z;
    let hitIndex = -1;
    for (let j = game.enemies.length - 1; j >= 0; j--) {
      const enemy = game.enemies[j];
      if (!enemy.alive) continue;
      const dx = px - enemy.position.x, dz = pz - enemy.position.z;
      const minDist2 = Math.pow((game.bulletRadius || 0.45) + (enemy.radius || 0.6), 2);
      if ((dx*dx + dz*dz) <= minDist2) { hitIndex = j; break; }
    }
    if (hitIndex !== -1) {
      const enemy = game.enemies[hitIndex];
      releaseProjectileToPool(game, p); 
      game.projectiles.splice(i,1);
      enemy.health -= 1;
      const ratio = enemy.health / enemy.maxHealth;
      if (ratio <= 0.33) enemy.body.material.color.setHex(0x660000);
      else if (ratio <= 0.66) enemy.body.material.color.setHex(0xaa0000);
      if (enemy.health <= 0) {
        game.createExplosion(enemy.position.clone());
        if (typeof game.registerKill === 'function') game.registerKill(enemy);
        if (typeof game.removeEnemyAtIndex === 'function') game.removeEnemyAtIndex(hitIndex);
        else {
          enemy.alive = false;
          if (enemy.model) game.scene.remove(enemy.model);
          if (enemy.healthBar) game.scene.remove(enemy.healthBar);
          game.enemies.splice(hitIndex,1);
        }
      }
      game.updateUI && game.updateUI();
    }
  }
}

export default {
  findNearestEnemy,
  getProjectileFromPool, releaseProjectileToPool,
  getEnemyProjectileFromPool, releaseEnemyProjectileToPool,
  createProjectile, getEffectiveShootingInterval, updateShooting, updateProjectiles,
  createEnemyProjectile, updateEnemyProjectiles,
  checkProjectileCollisions
};
