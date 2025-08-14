import * as THREE from 'three';

/**
 * Collision & geometry helpers extracted from game.js.
 * Usage: installCollisionAPI(gameInstance);
 * It attaches methods onto the instance so existing call-sites continue to work.
 */
export function installCollisionAPI(game) {

  game.computeObstacleAABBs = function computeObstacleAABBs() {
    for (const ob of this.obstacles) {
      if (!ob || ob.type !== 'box' || !ob.position) continue;
      const halfW = (ob.width || 0) / 2;
      const halfD = (ob.depth || 0) / 2;
      const x = ob.position.x, z = ob.position.z;
      ob.aabb = { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
    }
  };

  game.segmentIntersectsBox = function segmentIntersectsBox(p0, p1, box, expand = 0) {
    const hasAABB = box.aabb && typeof box.aabb.minX === 'number';
    const minX = hasAABB ? box.aabb.minX - expand : (box.position.x - box.width/2 - expand);
    const maxX = hasAABB ? box.aabb.maxX + expand : (box.position.x + box.width/2 + expand);
    const minZ = hasAABB ? box.aabb.minZ - expand : (box.position.z - box.depth/2 - expand);
    const maxZ = hasAABB ? box.aabb.maxZ + expand : (box.position.z + box.depth/2 + expand);

    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;

    let tmin = 0, tmax = 1;

    if (Math.abs(dx) < 1e-8) {
      if (p0.x < minX || p0.x > maxX) return false;
    } else {
      const tx1 = (minX - p0.x) / dx;
      const tx2 = (maxX - p0.x) / dx;
      const tminx = Math.min(tx1, tx2);
      const tmaxx = Math.max(tx1, tx2);
      tmin = Math.max(tmin, tminx);
      tmax = Math.min(tmax, tmaxx);
      if (tmax < tmin) return false;
    }

    if (Math.abs(dz) < 1e-8) {
      if (p0.z < minZ || p0.z > maxZ) return false;
    } else {
      const tz1 = (minZ - p0.z) / dz;
      const tz2 = (maxZ - p0.z) / dz;
      const tminz = Math.min(tz1, tz2);
      const tmaxz = Math.max(tz1, tz2);
      tmin = Math.max(tmin, tminz);
      tmax = Math.min(tmax, tmaxz);
      if (tmax < tmin) return false;
    }
    return tmax >= 0 && tmin <= 1;
  };

  game.hasLineOfSight = function hasLineOfSight(start, end) {
    for (const ob of this.obstacles) {
      if (ob.type !== 'box') continue;
      if (this.segmentIntersectsBox(start, end, ob, 0.02)) return false;
    }
    return true;
  };

  game.pathHitsObstacle = function pathHitsObstacle(p0, p1, radius = 0.05) {
    for (const ob of this.obstacles) {
      if (ob.type !== 'box') continue;
      if (this.segmentIntersectsBox(p0, p1, ob, radius)) return true;
    }
    return false;
  };

  game.checkObstacleCollision = function checkObstacleCollision(position, radius = 1) {
    for (const obstacle of this.obstacles) {
      if (obstacle.type !== 'box') continue;
      if (obstacle.aabb) {
        const coll = (
          position.x >= obstacle.aabb.minX - radius &&
          position.x <= obstacle.aabb.maxX + radius &&
          position.z >= obstacle.aabb.minZ - radius &&
          position.z <= obstacle.aabb.maxZ + radius
        );
        if (coll) return true;
      } else {
        const halfW = obstacle.width / 2;
        const halfD = obstacle.depth / 2;
        const minX = obstacle.position.x - halfW - radius;
        const maxX = obstacle.position.x + halfW + radius;
        const minZ = obstacle.position.z - halfD - radius;
        const maxZ = obstacle.position.z + halfD + radius;
        const coll = position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ;
        if (coll) return true;
      }
    }
    return false;
  };

  game.isWithinFieldBounds = function isWithinFieldBounds(position, radius = 0) {
    if (!this.fieldBounds) return true;
    return (
      position.x >= this.fieldBounds.minX + radius &&
      position.x <= this.fieldBounds.maxX - radius &&
      position.z >= this.fieldBounds.minZ + radius &&
      position.z <= this.fieldBounds.maxZ - radius
    );
  };

  game.collidesWithEnemies = function collidesWithEnemies(position, radius) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const minDist = radius + enemy.radius;
      const dx = position.x - enemy.position.x;
      const dz = position.z - enemy.position.z;
      if ((dx*dx + dz*dz) < minDist*minDist) return true;
    }
    return false;
  };

  // Player move helper (AABB walls + obstacles + enemies)
  game.tryMovePlayer = function tryMovePlayer(deltaVec) {
    const radius = this.playerRadius;
    const base = this.playerPosition.clone();
    const proposed = base.clone().add(deltaVec);
    if (this.isWithinFieldBounds(proposed, radius) &&
        !this.checkObstacleCollision(proposed, radius) &&
        !this.collidesWithEnemies(proposed, radius)) {
      this.playerPosition.copy(proposed); return;
    }
    const onlyX = base.clone().add(new THREE.Vector3(deltaVec.x,0,0));
    if (this.isWithinFieldBounds(onlyX, radius) &&
        !this.checkObstacleCollision(onlyX, radius) &&
        !this.collidesWithEnemies(onlyX, radius)) {
      this.playerPosition.copy(onlyX); return;
    }
    const onlyZ = base.clone().add(new THREE.Vector3(0,0,deltaVec.z));
    if (this.isWithinFieldBounds(onlyZ, radius) &&
        !this.checkObstacleCollision(onlyZ, radius) &&
        !this.collidesWithEnemies(onlyZ, radius)) {
      this.playerPosition.copy(onlyZ); return;
    }
  };
}
