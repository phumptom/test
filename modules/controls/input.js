// modules/controls/input.js
// Packs keyboard/mouse/touch controls into an installer. Methods are attached to the
// game instance and used by game.init() (which calls setupControls/Mouse/Touch).
export function installControls(game) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  game.onWindowResize = function onWindowResize() {
    const w = window.innerWidth, h = window.innerHeight || 1;
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  game.setupControls = function setupControls() {
    this.keys = this.keys || { w:false, a:false, s:false, d:false };

    const onKeyDown = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'w' || k === 'arrowup')    this.keys.w = true;
      if (k === 'a' || k === 'arrowleft')  this.keys.a = true;
      if (k === 's' || k === 'arrowdown')  this.keys.s = true;
      if (k === 'd' || k === 'arrowright') this.keys.d = true;

      if (k === 'p' || k === 'escape') { if (this.togglePause) this.togglePause(); }

      // Inventory hotkeys (do nothing if feature not installed yet)
      if (k === '1' && this.useRapidFire)  this.useRapidFire();
      if (k === '2' && this.useShockwave)  this.useShockwave();
      if (k === '3' && this.useHeal100)    this.useHeal100();
      if (k === '4' && this.useHeal50)     this.useHeal50();
    };

    const onKeyUp = (e) => {
      const k = (e.key || '').toLowerCase();
      if (k === 'w' || k === 'arrowup')    this.keys.w = false;
      if (k === 'a' || k === 'arrowleft')  this.keys.a = false;
      if (k === 's' || k === 'arrowdown')  this.keys.s = false;
      if (k === 'd' || k === 'arrowright') this.keys.d = false;
    };

    // Store to remove later if needed
    this._keyHandlers = { onKeyDown, onKeyUp };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  };

  game.setupMouseControls = function setupMouseControls() {
    const el = this.renderer && this.renderer.domElement;
    if (!el || !this.cameraControls) return;

    const cc = this.cameraControls;

    const onDown = (e) => {
      cc.mouseDown = true;
      cc.mouseX = e.clientX; cc.mouseY = e.clientY;
    };
    const onMove = (e) => {
      if (!cc.mouseDown) return;
      const dx = e.clientX - cc.mouseX;
      const dy = e.clientY - cc.mouseY;
      cc.rotationAngle -= dx * (cc.rotateSensitivity || 0.004);
      cc.tiltAngle     -= dy * (cc.tiltSensitivity   || 0.003);
      // Clamp tilt to a sane range
      cc.tiltAngle = clamp(cc.tiltAngle, 0.1, 1.45);
      cc.mouseX = e.clientX; cc.mouseY = e.clientY;
      if (this.updateCameraPosition) this.updateCameraPosition();
    };
    const onUp = () => { cc.mouseDown = false; };
    const onWheel = (e) => {
      const dir = e.deltaY > 0 ? 1 : -1;
      cc.zoomDistance = clamp(cc.zoomDistance + dir * 1.2, cc.minZoom || 10, cc.maxZoom || 60);
      if (this.updateCameraPosition) this.updateCameraPosition();
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('wheel', onWheel, { passive: true });

    this._mouseHandlers = { onDown, onMove, onUp, onWheel };
  };

  game.setupTouchControls = function setupTouchControls() {
    const el = this.renderer && this.renderer.domElement;
    if (!el || !this.cameraControls) return;
    const cc = this.cameraControls;

    let lastX = 0, lastY = 0, lastDist = 0, twoFinger = false;

    const distance = (t0, t1) => {
      const dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
      return Math.sqrt(dx*dx + dy*dy);
    };

    const onStart = (e) => {
      if (e.touches.length === 1) {
        twoFinger = false;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length >= 2) {
        twoFinger = true;
        lastDist = distance(e.touches[0], e.touches[1]);
      }
    };

    const onMove = (e) => {
      if (twoFinger && e.touches.length >= 2) {
        const d = distance(e.touches[0], e.touches[1]);
        const delta = (lastDist - d) * 0.02;
        cc.zoomDistance = clamp(cc.zoomDistance + delta, cc.minZoom || 10, cc.maxZoom || 60);
        lastDist = d;
        if (this.updateCameraPosition) this.updateCameraPosition();
        e.preventDefault();
        return;
      }
      if (!twoFinger && e.touches.length === 1) {
        const x = e.touches[0].clientX, y = e.touches[0].clientY;
        const dx = x - lastX, dy = y - lastY;
        cc.rotationAngle -= dx * (cc.rotateSensitivity || 0.004);
        cc.tiltAngle     -= dy * (cc.tiltSensitivity   || 0.003);
        cc.tiltAngle = clamp(cc.tiltAngle, 0.1, 1.45);
        lastX = x; lastY = y;
        if (this.updateCameraPosition) this.updateCameraPosition();
        e.preventDefault();
      }
    };

    const onEnd = () => { twoFinger = false; };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove,   { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);

    this._touchHandlers = { onStart, onMove, onEnd };
  };
}
