// modules/combat/projectiles.js
import * as THREE from 'three';

/**
 * Combat (projectiles & enemy bullets) extracted from game.js.
 * All functions are pure and expect the game instance as the first arg.
 */
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
  const startPosition = game._tmpV1.copy(game.playerPosition);
  startPosition.y += 0.5;
  p.mesh.position.copy(startPosition);
  p.direction.subVectors(targetPosition, startPosition);
  p.direction.y = 0;
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
    const target = game.findNearestEnemy && game.findNearestEnemy();
    if (target) {
      createProjectile(game, target.position);
      game.lastShotTime = now;
    }
  }
}

export function updateProjectiles(game, delta) {
  const now = game._now;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    if (now - p.startTime >= p.maxLifetime) {
      releaseProjectileToPool(game, p);
      game.projectiles.splice(i,1);
      continue;
    }
    const start = p.mesh.position;
    const movement = game._tmpV1.copy(p.direction).multiplyScalar(game.projectileSpeed * delta);
    const next = game._tmpV2.copy(start).add(movement);
    if (game.pathHitsObstacle && game.pathHitsObstacle(start, next, 0.08)) {
      releaseProjectileToPool(game, p);
      game.projectiles.splice(i,1);
      continue;
    }
    p.mesh.position.copy(next);
    const maxDistSq = 30 * 30;
    const dx = game.playerPosition.x - p.mesh.position.x;
    const dz = game.playerPosition.z - p.mesh.position.z;
    if ((dx*dx + dz*dz) > maxDistSq) {
      releaseProjectileToPool(game, p);
      game.projectiles.splice(i,1);
    }
  }
}

// Enemy projectiles

export function createEnemyProjectile(game, startPos, targetPos, damage) {
  const proj = getEnemyProjectileFromPool(game);
  const startPosition = game._tmpV1.copy(startPos);
  startPosition.y += 0.6;
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
    if (now - p.startTime >= p.maxLifetime) {
      releaseEnemyProjectileToPool(game, p);
      game.enemyProjectiles.splice(i,1);
      continue;
    }
    const start = p.mesh.position;
    const movement = game._tmpV1.copy(p.direction).multiplyScalar(game.sniperProjectileSpeed * delta);
    const next = game._tmpV2.copy(start).add(movement);
    if (game.pathHitsObstacle && game.pathHitsObstacle(start, next, 0.05)) {
      releaseEnemyProjectileToPool(game, p);
      game.enemyProjectiles.splice(i,1);
      continue;
    }
    p.mesh.position.copy(next);
    const r = (game.playerRadius || 0.9) + 0.25;
    const dx = game.playerPosition.x - p.mesh.position.x;
    const dz = game.playerPosition.z - p.mesh.position.z;
    if ((dx*dx + dz*dz) <= r*r) {
      releaseEnemyProjectileToPool(game, p);
      game.enemyProjectiles.splice(i,1);
      if (typeof game.takeDamage === 'function') {
        game.takeDamage(Math.max(1, Math.round(game.enemyDamage * 0.3)), p.mesh.position);
      }
    }
  }
}
