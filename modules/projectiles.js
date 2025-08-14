// Auto-extracted projectile and explosion systems from game.js — step 8
import * as THREE from 'three';
export function installProjectiles(game) {
  game.getProjectileFromPool = function getProjectileFromPool() {
   return Combat.getProjectileFromPool(this); 
  };

  game.releaseProjectileToPool = function releaseProjectileToPool(p) {
   return Combat.releaseProjectileToPool(this, p); 
  };

  game.getEnemyProjectileFromPool = function getEnemyProjectileFromPool() {
   return Combat.getEnemyProjectileFromPool(this); 
  };

  game.releaseEnemyProjectileToPool = function releaseEnemyProjectileToPool(p) {
   return Combat.releaseEnemyProjectileToPool(this, p); 
  };

  game.createProjectile = function createProjectile(targetPosition) {
   return Combat.createProjectile(this, targetPosition); 
  };

  game.getEffectiveShootingInterval = function getEffectiveShootingInterval() {
   return Combat.getEffectiveShootingInterval(this); 
  };

  game.updateShooting = function updateShooting() {
   return Combat.updateShooting(this); 
  };

  game.updateProjectiles = function updateProjectiles(delta) {
   return Combat.updateProjectiles(this, delta); 
  };

  game.createEnemyProjectile = function createEnemyProjectile(startPos, targetPos, damage) {
   return Combat.createEnemyProjectile(this, startPos, targetPos, damage); 
  };

  game.updateEnemyProjectiles = function updateEnemyProjectiles(delta) {
   return Combat.updateEnemyProjectiles(this, delta); 
  };

  game.createExplosion = function createExplosion(position) {
   return FX.createExplosion(this, position); 
  };

  game.updateExplosions = function updateExplosions(delta) {
   return FX.updateExplosions(this, delta); 
  };

}
