// modules/fx/particles.js
import * as THREE from 'three';

/**
 * FX: explosion particles extracted from game.js
 */
export function createExplosion(game, position) {
  const particleCount = 8;
  const particles = [];
  for (let i=0;i<particleCount;i++) {
    const geom = game.explosionGeometry;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random()*0.1+0.05,1,0.5), transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    mesh.position.y += 0.5;
    const velocity = new THREE.Vector3((Math.random()-0.5)*8, Math.random()*6+2, (Math.random()-0.5)*8);
    const particle = { mesh, velocity, life: 1.0, decay: Math.random()*0.02+0.01, gravity: -15 };
    particles.push(particle);
    game.explosionsGroup.add(mesh);
  }
  game.explosions.push({ particles, startTime: Date.now() });
}

export function updateExplosions(game, delta) {
  for (let i = game.explosions.length - 1; i >= 0; i--) {
    const ex = game.explosions[i];
    let alive = 0;
    for (let j = ex.particles.length - 1; j >= 0; j--) {
      const p = ex.particles[j];
      if (p.life <= 0) {
        if (p.mesh && p.mesh.parent === game.explosionsGroup) {
          game.explosionsGroup.remove(p.mesh);
        }
        if (p.mesh && p.mesh.material && p.mesh.material.dispose) {
          p.mesh.material.dispose();
        }
        ex.particles.splice(j,1);
        continue;
      }
      p.velocity.y += p.gravity * delta;
      const m = p.mesh;
      m.position.x += p.velocity.x * delta;
      m.position.y += p.velocity.y * delta;
      m.position.z += p.velocity.z * delta;
      p.life -= p.decay;
      p.mesh.material.opacity = Math.max(0, p.life);
      const s = Math.max(0.001, p.life);
      p.mesh.scale.set(s,s,s);
      alive++;
    }
    if (alive === 0) {
      game.explosions.splice(i,1);
    }
  }
}
