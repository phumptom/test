// modules/lights.js
// Split from game.js — Scene lighting setup and per-frame player light update
import * as THREE from 'three';

export class LightsSystem {
  /**
   * @param {any} game - the SurvivorGame instance
   */
  constructor(game) {
    this.game = game;
  }

  setup() {
    const g = this.game;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.45);
    g.scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    g.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(15, 20, 10);
    g.scene.add(dir);
    const overhead = new THREE.DirectionalLight(0xffffff, 1.35);
    overhead.position.set(0, 45, 0);
    overhead.target.position.set(0, 0, 0);
    g.scene.add(overhead); g.scene.add(overhead.target);
    const corners = [[-70,20,-70],[70,20,-70],[-70,20,70],[70,20,70]];
    for (const [x,y,z] of corners) {
      const p = new THREE.PointLight(0xffffff, 0.35, 160);
      p.position.set(x,y,z);
      g.scene.add(p);
    }
    g.playerPointLight = new THREE.PointLight(0xffffff, 7.5, 40);
    g.playerPointLight.position.copy(g.playerPosition);
    g.playerPointLight.position.y = 10;
    g.scene.add(g.playerPointLight);
  }

  updatePlayerLight() {
    const g = this.game;
    if (g.playerPointLight) {
      g.playerPointLight.position.set(g.playerPosition.x, 10, g.playerPosition.z);
    }
  }
}
