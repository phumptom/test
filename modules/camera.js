// modules/camera.js
// Split from game.js — Camera controls & positioning
export class CameraSystem {
  /**
   * @param {any} game - the SurvivorGame instance
   */
  constructor(game) {
    this.game = game;
  }

  setup() {
    // initial positioning
    this.update();
  }

  update() {
    const g = this.game;
    const target = g.playerPosition.clone();
    const h = g.cameraControls.zoomDistance * Math.cos(g.cameraControls.tiltAngle);
    const v = g.cameraControls.zoomDistance * Math.sin(g.cameraControls.tiltAngle);
    const ox = h * Math.sin(g.cameraControls.rotationAngle);
    const oz = h * Math.cos(g.cameraControls.rotationAngle);
    g.camera.position.set(target.x + ox, target.y + v, target.z + oz);
    g.camera.lookAt(target);
    if (g.skySphere) g.skySphere.position.copy(g.camera.position);
  }

  attachMouseControls(target = document) {
    const g = this.game;
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        g.cameraControls.mouseDown = true;
        g.cameraControls.mouseX = e.clientX;
        g.cameraControls.mouseY = e.clientY;
        e.preventDefault();
      }
    });

    target.addEventListener('mousemove', (e) => {
      if (g.cameraControls.mouseDown) {
        const dx = e.clientX - g.cameraControls.mouseX;
        const dy = e.clientY - g.cameraControls.mouseY;
        g.cameraControls.rotationAngle -= dx * g.cameraControls.rotateSensitivity;
        g.cameraControls.tiltAngle += dy * g.cameraControls.tiltSensitivity;
        g.cameraControls.tiltAngle = Math.max(0.1, Math.min(Math.PI * 0.45, g.cameraControls.tiltAngle));
        g.cameraControls.mouseX = e.clientX;
        g.cameraControls.mouseY = e.clientY;
        e.preventDefault();
      }
    });

    target.addEventListener('mouseup', (e) => {
      if (e.button === 0) g.cameraControls.mouseDown = false;
    });

    target.addEventListener('wheel', (e) => {
      e.preventDefault();
      const s = 1.5;
      if (e.deltaY > 0) {
        g.cameraControls.zoomDistance = Math.min(g.cameraControls.maxZoom, g.cameraControls.zoomDistance + s);
      } else {
        g.cameraControls.zoomDistance = Math.max(g.cameraControls.minZoom, g.cameraControls.zoomDistance - s);
      }
    }, { passive: false });
  }
}
