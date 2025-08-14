import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { installUI } from './modules/ui.js';
import { installProjectiles } from './modules/projectiles.js';
import * as Combat from './modules/combat/projectiles.js';
import * as FX from './modules/fx/particles.js';
import { installCollisionAPI } from './modules/collision.js';
import { installWorld } from './modules/world.js';
import { installFX } from './modules/fx/particles.js';
import { installUI } from './modules/ui/ui.js';
import { CameraSystem } from './modules/camera.js';
import { LightsSystem } from './modules/lights.js';

import { installUIProgress } from './modules/ui/progress.js';
import { installHUD } from './modules/ui/hud.js';
import { installShopUI } from './modules/ui/shop.js';
import { installLeaderboardUI } from './modules/ui/leaderboard.js';
import { installCamera } from './modules/camera.js';
import { installControls } from './modules/controls/input.js';
import { installEnemies } from './modules/ai/enemies.js';
import { installPickups } from './modules/items/pickups.js';
import { installCamera } from './modules/camera/camera.js';
/**
 * 3D Survivor — enhanced build (fixed start & particle cleanup)
 * - Fix: define coinImageURL *before* TextureLoader.load
 * - Fix: remove explosion particles from the correct parent group (no leaks)
 * - Minor: small safety guards added
 */

class SurvivorGame {
  constructor() {
    // --- Core ---
    this.scene = new THREE.Scene();
    // Render groups for pooled objects
    this.projectilesGroup = new THREE.Group();
    this.enemyProjectilesGroup = new THREE.Group();
    this.explosionsGroup = new THREE.Group();
    this.scene.add(this.projectilesGroup, this.enemyProjectilesGroup, this.explosionsGroup);
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer
    // Camera & lighting systems (modularized in step 6)
    this._camera = new CameraSystem(this);
    this._lights = new LightsSystem(this);
({ antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x00171d); // outside arena color
    this.clock = new THREE.Clock();
    // --- Perf caches & pools ---
    this._tmpV1 = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpV3 = new THREE.Vector3();
    this._tmpQ  = new THREE.Quaternion();
    this._fwd   = new THREE.Vector3(0,0,1);
    this._now   = 0;

    // UI throttle
    this._uiLast = 0;
    this._uiInterval = 120; // ms
    this._invDirty = true;

    // Visual/model settings — MUST be before loaders that use them
    this.modelFacingOffset = -Math.PI/2; // GLB face forward (+Z)
    this.playerHoverOffset = 0.6;       // player floats above ground
    this.coinImageURL = 'coin-face.png'; // used by TextureLoader below
    
    // Texture loader & coin texture cache
    this.textureLoader = new THREE.TextureLoader();
    this.coinTexture = null;
    // If image not found, we keep fallback; but URL must be a string
    try {
      this.textureLoader.load(this.coinImageURL, (t)=>{
        t.colorSpace = THREE.SRGBColorSpace;
        this.coinTexture = t;
      });
    } catch (e) {
      console.warn('Coin texture load failed, using fallback', e);
    }

    // Shared geometries & materials
    this.bulletGeometry = new THREE.BoxGeometry(0.15, 0.15, 0.9);
    this.bulletMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x002200, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.4 });
    this.enemyBulletGeometry = new THREE.SphereGeometry(0.14, 18, 18);
    this.enemyBulletMaterial = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0x330000, metalness: 0.15, roughness: 0.5 });
    this.explosionGeometry = new THREE.SphereGeometry(0.08, 4, 4);
    this.coinGeometry  = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 32);
    this.coinSideMat   = new THREE.MeshStandardMaterial({ color: 0x00cc66, emissive: 0x004422, roughness: 0.35, metalness: 0.4 });
    this.coinFaceMat   = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
    
    // Pools
    this.projectilePool = [];
    this.enemyProjectilePool = [];


    // --- Player & progression ---
    this.player = null;
    this.playerPosition = new THREE.Vector3(0, 0, 0);
    this.basePlayerSpeed = 18.0;
    this.playerSpeed = this.basePlayerSpeed;
    this.playerHealth = 150;
    this.playerMaxHealth = 150;
    this.lastDamageTime = 0;
    this.invincibilityDuration = 900; // ms
    this.playerRadius = 0.9;

    // Knockback
    this.knockbackVelocity = new THREE.Vector3(0,0,0);
    this.knockbackDecay = 8.5;
    this.knockbackStrength = 12.0;

    // XP / Level
    this.playerLevel = 1;
    this.playerXP = 0;
    this.xpToNext = 100;
    this.xpPerSecond = 1.0;
    this.xpPerKillNormal = 15;
    this.xpPerKillBoss = 80;
    this.levelSpeedBonus = 0.07;
    this.levelFireRateBonus = 0.08;

    // Coins & shop / inventory
    this.coins = 0;
    this.coinDropChance = 0.35;
    this.shopPrices = { rapidFire: 10, shockwave: 20, heal100: 12, heal50: 6 };
    this.inventory = { rapidFire: 0, shockwave: 0, heal100: 0, heal50: 0 };
    this.inShop = false;
    this.inLeaderboard = false;
    this.shopModal = null;
    this.leaderboardModal = null;
    this.shopToggleBtn = null;
    this.inventoryHintEl = null;

    // Wallet / leaderboard
    this.walletPublicKey = null;     // base58 string or null
    this.leaderboardApiBase = null;  // e.g. 'https://your.api/leaderboard' (optional)
    this.walletBar = null;

    // Active boosts
    this.fireRateBoostUntil = 0;
    this.boostDurationMs = 10000; // Rapid Fire duration
    this.shockwaves = []; // sweeping waves

    // --- Game state ---
    this.gameStarted = false;
    this.paused = false;
    this.pauseOverlay = null;
    this.pauseStartTime = 0;
    this.gameStartTime = 0;

    // --- Enemies ---
    this.enemies = [];
    this.baseEnemySpeed = 2.8;
    this.enemySpeed = this.baseEnemySpeed;
    this.baseEnemyDamage = 20;
    this.enemyDamage = this.baseEnemyDamage;
    this.lastSpawnTime = 0;
    this.maxConcurrentEnemies = 18;

    // Enemy projectiles (snipers)
    this.enemyProjectiles = [];
    this.sniperShootInterval = 1400; // ms
    this.sniperProjectileSpeed = 16.0;

    // Spawn model
    this.baseSpawnInterval = 1300;
    this.spawnInterval = this.baseSpawnInterval;
    this.collisionRadius = 1.5;

    // Difficulty scaling
    this.difficultyScaling = {
      maxEnemySpeed: 8.5,
      minSpawnInterval: 260,
      difficultyUpdateInterval: 1600,
      lastDifficultyUpdate: 0
    };

    // Boss / super-enemy
    this.lastBossSpawnTime = 0;
    this.bossConfig = {
      baseInterval: 60000,
      minInterval: 25000,
      intervalDecreasePerMinute: 4000,
      baseHealth: 40,
      healthPerMinute: 12,
      speedFactor: 0.72,
      damageFactor: 2.0
    };

    // --- World ---
    this.obstacles = [];
    this.fieldBounds = null;
    this.banners = [];
    this.bannerImageURLs = [];
    this.skySphere = null;

    // --- Shooting ---
    this.projectiles = [];
    this.projectileSpeed = 19.0;
    this.shootingRange = 10.8;
    this.lastShotTime = 0;
    this.baseShootingInterval = 450;
    this.shootingInterval = this.baseShootingInterval;
    this.shootingRangeIndicator = null;

    // Collision radius approximation for bullets (XZ)
    this.bulletRadius = 0.45;

    // --- Particles ---
    this.explosions = [];

    // --- Pickups ---
    this.pickups = [];
    this.healthPickupChance = 0.18;
    this.healthPickupHealFactor = 0.75;

    // --- Scoring ---
    this.score = 0;
    this.enemyKills = 0;
    this.pointsPerKill = 100;
    this.killStreak = 0;
    this.currentMultiplier = 1.0;
    this.maxMultiplier = 5.0;
    this.multiplierDecayTime = 3000;
    this.lastKillTime = 0;

    // --- Input ---
    this.keys = { w: false, a: false, s: false, d: false };

    // --- Camera controls ---
    this.cameraControls = {
      mouseDown: false,
      mouseX: 0, mouseY: 0,
      tiltAngle: 0.5,
      rotationAngle: 0,
      zoomDistance: 25,
      minZoom: 10, maxZoom: 60,
      tiltSensitivity: 0.003, rotateSensitivity: 0.004
    };

    this.animate = this.animate.bind(this);
    installCollisionAPI(this);
    installWorld(this);
    
    installFX(this);
    installUI(this);
    installHUD(this);
    installUIProgress(this);
        installCamera(this);
    installControls(this);
    // Bind extracted systems
    installPickups(this);
    installEnemies(this);

this.init();
  }

  init() {
    this.renderer.domElement.tabIndex = 1;
    document.body.appendChild(this.renderer.domElement);

    this.setupCamera();
    this.setupLights();
    this.createGround();
    this.createSkySphere();
    this.loadPlayer();

    this.setupControls();
    this.setupMouseControls();
    this.setupTouchControls();
    this.createUI();
    installShopUI(this);
    installLeaderboardUI(this);
    this.setupStartScreen();

    // Auto-start fallback if no start button is present
    if (!document.getElementById('startGameButton')) {
      this.startGame();
    }

    // Default banner image
    this.defaultBannerURL = 'https://static.tildacdn.com/tild3336-3133-4562-b661-633232613264/Group_6_2-min.png';

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.animate();
    requestAnimat
  /* moved to modules/ui.js: setupStartScreen */
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); }, { passive: false });
    }
  }

  startGame() {
    this.gameStarted = true;
    const startScreen = document.getElementById('gameStartScreen');
    if (startScreen) startScreen.style.display = 'none';

    this.clock.start();
    const now = Date.now();
    this.gameStartTime = now;
    this.lastSpawnTime = now;
    this.difficultyScaling.lastDifficultyUpdate = now;
    this.lastBossSpawnTime = now;

    if (this.renderer.domElement) this.renderer.domElement.focus();

    // Populate banners
    if (this.banners.length > 0) {
      for (let i = 0; i < this.banners.length; i++) {
        const url = this.bannerImageURLs[i] || this.defaultBannerURL;
        this.setBannerImage(i, url);
      }
    }
  }

  // ---------- Pause ----------
  setPaused(flag) {
    if (this.paused === flag) return;
    this.paused = flag;
    this.updatePauseHUD();
    if (flag) {
      this.pauseStartTime = Date.now();
      this.keys.w = this.keys.a = this.keys.s = this.keys.d = false;
      this.clock.stop();
      if (!this.inShop && !this.inLeaderboard) this.showPauseOverlay();
    } else {
      const dt = Date.now() - this.pauseStartTime;
      this.lastSpawnTime += dt;
      this.difficultyScaling.lastDifficultyUpdate += dt;
      this.lastShotTime += dt;
      this.lastBossSpawnTime += dt;
      this.gameStartTime += dt;
      this.lastKillTime += dt;
      this.lastDamageTime += dt;
      this.fireRateBoostUntil += dt;
      // Shift shockwave timers so waves don't elapse during pause
      for (const sw of this.shockwaves) { sw.start += dt; }
      this.clock.start();
      this.clock.getDelta();
     
  /* moved to modules/ui.js: showPauseOverlay */

  /* moved to modules/ui.js: hidePauseOverlay */
     this.pauseOverlay.parentElement.removeChild(this.pauseOverlay);
    }
    this.pauseOverlay = null;
  }

  // ---------- Camera & lights ----------
  setupCamera() { this.updateCameraPosition(); }
  updateCameraPosition() { this._camera.update(); }
  setupLights() { this._lights.setup(); }


  // ---------- World ----------
  createGround() {
    const groundSize = 180;
    const ggeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const gmat = new THREE.MeshStandardMaterial({ color: 0x001c1d, roughness: 1.0, metalness: 0.0 });
    const ground = new THREE.Mesh(ggeo, gmat);
    ground.rotation.x = -Math.PI/2; ground.position.y = -0.1; this.scene.add(ground);
    ground.updateMatrix(); ground.matrixAutoUpdate = false;

    const grid = new THREE.GridHelper(groundSize, 36, 0x014724, 0x014724);
    grid.material.transparent = true; grid.material.opacity = 0.5; grid.position.y = -0.05;
    this.scene.add(grid);
    grid.updateMatrix(); grid.matrixAutoUpdate = false;

    this.createBoundaryWalls(groundSize);
    this.createBannerFrames(groundSize);
    this.createChartCandlesAndWalls(groundSize);
    this.computeObstacleAABBs();
  }

  createSkySphere() {
    const geo = new THREE.SphereGeometry(2000, 96, 64);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x00171d) },
        bottomColor: { value: new THREE.Color(0x007055) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition - cameraPosition);
          float h = smoothstep(-0.15, 0.85, dir.y);
          vec3 col = mix(bottomColor, topColor, h);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.skySphere = new THREE.Mesh(geo, mat);
    this.skySphere.frustumCulled = false;
    this.skySphere.renderOrder = -9999;
    this.skySphere.position.copy(this.camera.position);
    this.scene.add(this.skySphere);
  }

  createBoundaryWalls(fieldSize) {
    const wallHeight = 4, wallThickness = 1.5, half = fieldSize/2;
    const mat = new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.9, metalness: 0.0 });

    const north = new THREE.Mesh(new THREE.BoxGeometry(fieldSize+wallThickness*2, wallHeight, wallThickness), mat);
    north.position.set(0, wallHeight/2, half + wallThickness/2); this.scene.add(north);
    north.updateMatrix(); north.matrixAutoUpdate = false;
    const south = new THREE.Mesh(new THREE.BoxGeometry(fieldSize+wallThickness*2, wallHeight, wallThickness), mat);
    south.position.set(0, wallHeight/2, -half - wallThickness/2); this.scene.add(south);
    south.updateMatrix(); south.matrixAutoUpdate = false;
    const east  = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, fieldSize), mat);
    east.position.set( half + wallThickness/2, wallHeight/2, 0); this.scene.add(east);
    east.updateMatrix(); east.matrixAutoUpdate = false;
    const west  = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, fieldSize), mat);
    west.position.set(-half - wallThickness/2, wallHeight/2, 0); this.scene.add(west);
    west.updateMatrix(); west.matrixAutoUpdate = false;

    const margin = 2.0;
    this.fieldBounds = { minX: -half+margin, maxX: half-margin, minZ: -half+margin, maxZ: half-margin };

    // add walls to obstacles for LOS
    const full = fieldSize + wallThickness * 2;
    this.obstacles.push(
      { type:'box', position:new THREE.Vector3(0,0,  half + wallThickness/2), width: full, depth: wallThickness, height: wallHeight, mesh: north },
      { type:'box', position:new THREE.Vector3(0,0, -half - wallThickness/2), width: full, depth: wallThickness, height: wallHeight, mesh: south },
      { type:'box', position:new THREE.Vector3( half + wallThickness/2,0,0),  width: wallThickness, depth: fieldSize, height: wallHeight, mesh: east  },
      { type:'box', position:new THREE.Vector3(-half - wallThickness/2,0,0),  width: wallThickness, depth: fieldSize, height: wallHeight, mesh: west  },
    );
  }

  // Banners: 4 per side (16 total) — evenly spaced, with edge margins
  createBannerFrames(fieldSize) {
    const half = fieldSize/2;
    const size = 12;
    const y = 7.5;
    const offset = 1.0; // distance from wall
    const perSide = 4;
    const t = 0.35;
    const edgeMargin = 12; // keep away from corners
    const matCanvas = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
    const matFrame  = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.85, metalness: 0.1 });

    const make = () => {
      const g = new THREE.Group();
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(size, size), matCanvas.clone());
      canvas.position.z = 0.03; g.add(canvas);
      const barH = new THREE.BoxGeometry(size+t, t, t);
      const barV = new THREE.BoxGeometry(t, size+t, t);
      const top=new THREE.Mesh(barH, matFrame.clone());
      const bot=new THREE.Mesh(barH, matFrame.clone());
      const left=new THREE.Mesh(barV, matFrame.clone());
      const right=new THREE.Mesh(barV, matFrame.clone());
      top.position.set(0, size/2 + t/2, 0);
      bot.position.set(0,-size/2 - t/2, 0);
      left.position.set(-size/2 - t/2, 0, 0);
      right.position.set( size/2 + t/2, 0, 0);
      g.add(top,bot,left,right);
      return {group:g, canvas};
    };

    const positions = (side) => {
      const arr = [];
      const span = fieldSize - 2*edgeMargin;
      for (let i=0;i<perSide;i++) {
        const t = (i + 1) / (perSide + 1); // excludes corners
        if (side==='N') arr.push({x:-span/2 + span*t, z: half-offset, rot: Math.PI});
        if (side==='S') arr.push({x:-span/2 + span*t, z:-half+offset, rot: 0});
        if (side==='E') arr.push({x: half-offset, z:-span/2 + span*t, rot:-Math.PI/2});
        if (side==='W') arr.push({x:-half+offset, z:-span/2 + span*t, rot: Math.PI/2});
      }
      return arr;
    };

    let id = 0;
    ['N','S','E','W'].forEach(side => {
      positions(side).forEach(p => {
        const {group, canvas} = make();
        group.position.set(p.x,y,p.z); group.rotation.y = p.rot;
        this.scene.add(group);
        group.updateMatrix(); group.matrixAutoUpdate = false;
        this.banners.push({id, group, canvas});
        id++;
      });
    });
  }

  setBannerImage(id, url) {
    const banner = this.banners.find(b => b.id === id);
    if (!banner) return;
    const loader = this.textureLoader;
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      banner.canvas.material.map = tex;
      banner.canvas.material.needsUpdate = true;
    });
  }

  // Obstacles
  createChartCandlesAndWalls(fieldSize) {
    const color = 0x5AAEA6;
    const candleHeight = 2.2;
    const candleDepth = 0.9;
    const half = fieldSize/2 - 4;

    const addBoxObstacle = (x,z,w,d,h=candleHeight) => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
      mesh.position.set(x,h/2,z);
      this.scene.add(mesh);
      this.obstacles.push({ type:'box', position:new THREE.Vector3(x,0,z), width:w, height:h, depth:d, mesh });
    };

    const candlesCount = 16;
    const xStart = -58, xEnd = 58;
    const dx = (xEnd-xStart)/(candlesCount-1);
    const zStart = -36, stepZ = 4.2;

    for (let i=0;i<candlesCount;i++) {
      const x = xStart + i*dx;
      const z = zStart + i*stepZ + Math.sin(i*0.7)*1.2;
      const w = THREE.MathUtils.clamp(0.9 + (Math.sin(i*0.33)+1)*0.3, 0.9, 1.6);
      const d = candleDepth;
      if (x>-half && x<half && z>-half && z<half) addBoxObstacle(x,z,w,d);
    }

    const wallH = 2.0;
    const long = [
      { x:-30, z:44, w:28, d:1.1 },
      { x: 18, z:12, w:26, d:1.1 },
      { x:-14, z:-10, w:22, d:1.1 },
      { x: 36, z:-34, w:30, d:1.1 },
      { x:-22, z:28, w:1.1, d:12 },
      { x: 54, z:20, w:1.1, d:14 },
      { x:-46, z:-26, w:1.1, d:12 }
    ];
    for (const seg of long) if (seg.x>-half && seg.x<half && seg.z>-half && seg.z<half) addBoxObstacle(seg.x,seg.z,seg.w,seg.d,wallH);
  }

  // ---------- Geometry helpers ----------

  computeObstacleAABBs() {
    for (const ob of this.obstacles) {
      if (!ob || ob.type !== 'box' || !ob.position) continue;
      const halfW = (ob.width || 0) / 2;
      const halfD = (ob.depth || 0) / 2;
      const x = ob.position.x, z = ob.position.z;
      ob.aabb = { minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD };
    }
  }
  segmentIntersectsBox(p0, p1, box, expand = 0) {
    const hasAABB = box.aabb && typeof box.aabb.minX === 'number';
    const minX = hasAABB ? box.aabb.minX - expand : (box.position.x - box.width/2 - expand);
    const maxX = hasAABB ? box.aabb.maxX + expand : (box.position.x + box.width/2 + expand);
    const minZ = hasAABB ? box.aabb.minZ - expand : (box.position.z - box.depth/2 - expand);
    const maxZ = hasAABB ? box.aabb.maxZ + expand : (box.position.z + box.depth/2 + expand);

    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;

    let tmin = 0, tmax = 1;

    if (Math.abs(dx) < 1e-8) { if (p0.x < minX || p0.x > maxX) return false; }
    else {
      const tx1 = (minX - p0.x) / dx;
      const tx2 = (maxX - p0.x) / dx;
      const tminx = Math.min(tx1, tx2);
      const tmaxx = Math.max(tx1, tx2);
      tmin = Math.max(tmin, tminx);
      tmax = Math.min(tmax, tmaxx);
      if (tmax < tmin) return false;
    }

    if (Math.abs(dz) < 1e-8) { if (p0.z < minZ || p0.z > maxZ) return false; }
    else {
      const tz1 = (minZ - p0.z) / dz;
      const tz2 = (maxZ - p0.z) / dz;
      const tminz = Math.min(tz1, tz2);
      const tmaxz = Math.max(tz1, tz2);
      tmin = Math.max(tmin, tminz);
      tmax = Math.min(tmax, tmaxz);
      if (tmax < tmin) return false;
    }
    return tmax >= 0 && tmin <= 1;
  }


  hasLineOfSight(start, end) {
    for (const ob of this.obstacles) {
      if (ob.type !== 'box') continue;
      if (this.segmentIntersectsBox(start, end, ob, 0.02)) return false;
    }
    return true;
  }

  pathHitsObstacle(p0, p1, radius = 0.05) {
    for (const ob of this.obstacles) {
      if (ob.type !== 'box') continue;
      if (this.segmentIntersectsBox(p0, p1, ob, radius)) return true;
    }
    return false;
  }
  checkObstacleCollision(position, radius = 1) {
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
  }


  isWithinFieldBounds(position, radius = 0) {
    if (!this.fieldBounds) return true;
    return (
      position.x >= this.fieldBounds.minX + radius &&
      position.x <= this.fieldBounds.maxX - radius &&
      position.z >= this.fieldBounds.minZ + radius &&
      position.z <= this.fieldBounds.maxZ - radius
    );
  }
  collidesWithEnemies(position, radius) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const minDist = radius + enemy.radius;
      const dx = position.x - enemy.position.x;
      const dz = position.z - enemy.position.z;
      if ((dx*dx + dz*dz) < minDist*minDist) return true;
    }
    return false;
  }


  tryMovePlayer(deltaVec) {
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
  }

  // ---------- Player ----------
  
  loadPlayer() {
    // Root as group; attach GLB/capsule under it
    this.player = new THREE.Group();
    this.playerPosition.set(0, 1, 0);
    const pp = this.playerPosition.clone(); pp.y = 1 + (this.playerHoverOffset || 0);
    this.player.position.copy(pp);
    this.scene.add(this.player);
    this.createShootingRangeIndicator();

    const loader = new GLTFLoader();
    loader.load('phumptom.glb', (gltf) => {
      const model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      if (!model) return;
      // Normalize height to ~2.6 (old capsule height)
      const targetHeight = 2.6;
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      if (size.y > 0) model.scale.setScalar(targetHeight / size.y);
      // Center pivot
      const b2 = new THREE.Box3().setFromObject(model); const c = new THREE.Vector3(); b2.getCenter(c); model.position.sub(c);
      // Face forward
      if (this.modelFacingOffset) model.rotation.y += this.modelFacingOffset;
      this.player.add(model);
      this.playerModel = model;
    }, undefined, (err) => {
      console.warn('GLB load failed — using capsule fallback', err);
      const geometry = new THREE.CapsuleGeometry(0.55, 1.5, 4, 8);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x001100 });
      const capsule = new THREE.Mesh(geometry, material);
      this.player.add(capsule);
    });
  }


  createShootingRangeIndicator() {
    // Dashed shooting radius with subtle glow
    const radius = this.shootingRange;
    const group = new THREE.Group();

    // Dotted (dashed) circle
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(256);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const dashedMat = new THREE.LineDashedMaterial({
      color: 0x05e49f,
      dashSize: 1.5,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.9,
      toneMapped: false
    });
    const line = new THREE.Line(geom, dashedMat);
    line.computeLineDistances();
    group.add(line);

    // Soft glow ring (very thin, additive)
    const glowGeom = new THREE.RingGeometry(radius - 0.12, radius + 0.12, 128);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x05e49f,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    group.add(glow);

    group.rotation.x = -Math.PI / 2;
    group.position.set(this.playerPosition.x, 0.05, this.playerPositio
  /* moved to modules/ui.js: createUI */

  /* moved to modules/ui.js: createShopUI */

  /* moved to modules/ui.js: createLeaderboardUI */
odal;
    modal.addEventListener('click', (e) => { if (e.ta
  /* moved to modules/ui.js: openShop */

  /* moved to modules/ui.js: closeShop */

  /* moved to modules/ui.js: toggleShop */

  /* moved to modules/ui.js: openLeaderboard */

  /* moved to modules/ui.js: closeLeaderboard */

  /* moved to modules/ui.js: toggleLeaderboard */
false);
  }
  toggleLeaderboard() { this.inLe
  /* moved to modules/ui.js: updatePauseHUD */
if (this.paused) btn.textContent = '▶ R
  /* moved to modules/ui.js: updateUI */

  /* moved to modules/ui.js: updateUIThrottled */
orce || now - this._uiLast >= this._uiI
  /* moved to modules/ui.js: renderInventory */

  /* moved to modules/ui.js: buyItem */

  /* moved to modules/ui.js: activateItemByKey */
inventory[key]--;
      this.activateHealPercent(1.0);
    }
    this._invDirty = true; this.updateUI();
  }

  // ---------- Damage / Game over ----------
  applyKnockback(fromPosition, strength = this.knockbackStrength) {
    const dir = this.playerPosition.clone().sub(fromPosition);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) { dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); }
    dir.normalize();
    this.knockbackVelocity.add(dir.multiplyScalar(strength));
  }

  takeDamage(amount, sourcePosition) {
    const now = Date.now();
    if (now - this.lastDamageTime < this.invincibilityDuration) return;
    this.playerHealth -= amount;
    this.lastDamageTime = now;
    this.applyKnockback(sourcePosition || this.playerPosition, this.knockbackStrength * (1 + (amount/30)));
    this.updateUI();
    if (this.playerHealth <= 0) { this.playerHealth = 0; this.gameOver(); return; }
    this.flashDamage();
  }

  

  checkCollisions() {
    const now = this._now;
    if (now - this.lastDamageTime < this.invincibilityDuration) return;
    const eps = 0.01;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = this.playerPosition.x - enemy.position.x;
      const dz = this.playerPosition.z - enemy.position.z;
      const hitDist = (this.playerRadius || 0.9) + (enemy.radius || 0.6);
      if ((dx*dx + dz*dz) <= (hitDist + eps) * (hitDist + eps)) {
        const dmg = (enemy.damage != null ? enemy.damage : this.enemyDamage);
        this.takeDamage(dmg, enemy.position);
        break;
      }
    }
  }



  
  flashDamage() {
    if (!this.player) return;
    const originals = [];
    this.player.traverse((node) => {
      if (!node.isMesh) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((m) => { if (m && m.emissive) { originals.push([m, m.emissive.clone()]); m.emissive.set(0xff0000); } });
    });
    setTimeout(() => { originals.forEach(([m, col]) => { if (m && m.emissive) m.emissive.copy(col); }); }, 200);
  }


  gameOver() {
    this.submitScore(this.score, this.enemyKills, this.playerLevel);
    const screen = document.createElement('div'); screen.className = 'game-over-screen';
    const content = document.createElement('div'); content.className = 'game-over-content';
    const title = document.createElement('div'); title.className = 'game-over-title'; title.textContent = 'GAME OVER';
    const subtitle = document.createElement('div'); subtitle.className = 'game-over-subtitle'; subtitle.textContent = `Final Score ${this.score}  Enemies Defeated ${this.enemyKills}`;
    const btn = document.createElement('button'); btn.className = 'play-again-button'; btn.textContent = 'Play Again';
    btn.addEventListener('click', () => window.location.reload());
    const hint = document.createElement('div'); hint.className = 'restart-hint'; hint.textContent = 'Tip: P / Esc to pause/resume, B — shop, L — top';
    content.appendChild(title); content.appendChild(subtitle); content.appendChild(btn); content.appendChild(hint);
    screen.appendChild(content);
    document.body.appendChild(screen);
    this.playerHealth = -1;
  }

  // ---------- Shooting ----------
  findNearestEnemy() {
    let nearest = null, nearestDist2 = Infinity;
    const range2 = this.shootingRange * this.shootingRange;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = this.playerPosition.x - enemy.position.x;
      const dz = this.playerPosition.z - enemy.position.z;
      const d2 = dx*dx + dz*dz;
      if (d2 <= range2 && d2 < nearestDist2) {
        if (this.hasLineOfSight(this.playerPosition, enemy.position)) {
          nearest = enemy; nearestDist2 = d2;
        }
      }
    }
    return nearest;
  }


  
  // --- Object pools for projectiles ---
  // --- Combat (projectiles & enemy bullets) — delegated to modules/combat/projectiles.js
getProjectileFromPool() { return Combat.getProjectileFromPool(this); }
releaseProjectileToPool(p) { return Combat.releaseProjectileToPool(this, p); }
getEnemyProjectileFromPool() { return Combat.getEnemyProjectileFromPool(this); }
releaseEnemyProjectileToPool(p) { return Combat.releaseEnemyProjectileToPool(this, p); }

createProjectile(targetPosition) { return Combat.createProjectile(this, targetPosition); }
getEffectiveShootingInterval() { return Combat.getEffectiveShootingInterval(this); }
updateShooting() { return Combat.updateShooting(this); }
updateProjectiles(delta) { return Combat.updateProjectiles(this, delta); }

// Enemy projectiles
createEnemyProjectile(startPos, targetPos, damage) { return Combat.createEnemyProjectile(this, startPos, targetPos, damage); }
updateEnemyProjectiles(delta) { return Combat.updateEnemyProjectiles(this, delta); }

// --- FX (explosions) — delegated to modules/fx/particles.js
createExplosion(position) { return FX.createExplosion(this, position); }
updateExplosions(delta) { return FX.updateExplosions(this, delta); }

// --- Utilities: object disposal (kept local)
disposeObject3D(obj) {
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

  /* moved to modules/ai/enemies.js: removeEnemyAtIndex */


  // Unified kill handling: streak, multiplier, score, XP, drops, and UI
  /* moved to modules/ai/enemies.js: registerKill */


  checkProjectileCollisions() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const px = p.mesh.position.x, pz = p.mesh.position.z;
      let hitIndex = -1;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (!enemy.alive) continue;
        const dx = px - enemy.position.x, dz = pz - enemy.position.z;
        const minDist2 = Math.pow((this.bulletRadius || 0.45) + (enemy.radius || 0.6), 2);
        if ((dx*dx + dz*dz) <= minDist2) { hitIndex = j; break; }
      }
      if (hitIndex !== -1) {
        const enemy = this.enemies[hitIndex];
        this.releaseProjectileToPool(p); 
        this.projectiles.splice(i,1);
        enemy.health -= 1;
        const ratio = enemy.health / enemy.maxHealth;
        if (ratio <= 0.33) enemy.body.material.color.setHex(0x660000);
        else if (ratio <= 0.66) enemy.body.material.color.setHex(0xaa0000);
        if (enemy.health <= 0) {
          this.createExplosion(enemy.position.clone());
          if (typeof this.registerKill === 'function') this.registerKill(enemy);
          if (typeof this.removeEnemyAtIndex === 'function') this.removeEnemyAtIndex(hitIndex);
          else { // fallback
            enemy.alive = false;
            if (enemy.model) this.scene.remove(enemy.model);
            if (enemy.healthBar) this.scene.remove(enemy.healthBar);
            this.enemies.splice(hitIndex,1);
          }
        }
        this.updateUI();
      }
    }
  }



  // ---------- Enemies ----------
  /* moved to modules/ai/enemies.js: createCandleEnemyModel */


  /* moved to modules/ai/enemies.js: createThinShooterModel */


  /* moved to modules/ai/enemies.js: createBossModel */


  /* moved to modules/ai/enemies.js: createHealthBar3D */


  /* moved to modules/ai/enemies.js: isPositionFreeOfEnemies */


  /* moved to modules/ai/enemies.js: applyEnemySeparation */


  /* moved to modules/ai/enemies.js: separateEnemyFromPlayer */


  /* moved to modules/ai/enemies.js: countSnipers */


  /* moved to modules/ai/enemies.js: spawnEnemyOfType */


  /* moved to modules/ai/enemies.js: spawnEnemy */


  /* moved to modules/ai/enemies.js: spawnBoss */


  updateEnemies(delta) {
    for (let i=this.enemies.length-1;i>=0;i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive) { this.removeEnemyAtIndex(i); continue; }
      const dirToPlayer = new THREE.Vector3().subVectors(this.playerPosition, enemy.position); dirToPlayer.y = 0;
      if (dirToPlayer.length()>0) {
        dirToPlayer.normalize();
        const speed = enemy.speed != null ? enemy.speed : this.enemySpeed;
        
const proposed = enemy.position.clone().add(dirToPlayer.clone().multiplyScalar(speed*delta));
let newPos = proposed;
const valid = (pos) => this.isWithinFieldBounds(pos, enemy.radius) && !this.checkObstacleCollision(pos, enemy.radius);
if (!valid(proposed)) {
  const angles = [Math.PI/6, -Math.PI/6, Math.PI/3, -Math.PI/3];
  let best = null; let bestDist = Infinity;
  for (const a of angles) {
    const altDir = dirToPlayer.clone().applyAxisAngle(new 
  /* moved to modules/projectiles.js: getProjectileFromPool */

  /* moved to modules/projectiles.js: releaseProjectileToPool */

  /* moved to modules/projectiles.js: getEnemyProjectileFromPool */

  /* moved to modules/projectiles.js: releaseEnemyProjectileToPool */

  /* moved to modules/projectiles.js: createProjectile */

  /* moved to modules/projectiles.js: getEffectiveShootingInterval */

  /* moved to modules/projectiles.js: updateShooting */

  /* moved to modules/projectiles.js: updateProjectiles */
s.length>0) {
      op
  /* moved to modules/projectiles.js: createEnemyProjectile */

  /* moved to modules/projectiles.js: updateEnemyProjectiles */
tion(i, newPos, enemy.radius, enemy.position);
enemy.position.c
  /* moved to modules/projectiles.js: createExplosion */

  /* moved to modules/projectiles.js: updateExplosions */
y = angle;

        this.separateEnemyFromPlayer(enemy);

        if (enemy.type === 'sniper') {
          const now = this._now;
          if (now - enemy.lastShotTime >= this.sniperShootInterval) {
            if (this.hasLineOfSight(enemy.position, this.playerPosition)) {
              this.createEnemyProjectile(enemy.position, this.playerPosition, Math.max(1, Math.round(this.enemyDamage * 0.3)));
              enemy.lastShotTime = now;
            }
          }
        }

        if (enemy.isBoss && enemy.healthBar && enemy.healthBarFill) {
          const ratio = Math.max(0, enemy.health / enemy.maxHealth);
          enemy.healthBar.position.set(enemy.position.x, enemy.healthBarYOffset, enemy.position.z);
          enemy.healthBar.quaternion.copy(this.camera.quaternion);
          enemy.healthBarFill.scale.x = ratio;
          enemy.healthBarFill.position.x = -enemy.healthBarWidth/2 + (enemy.healthBarWidth * ratio)/2;
        }
      }
    }
  }

  // ---------- Input ----------
  
  setupControls() {
    const handleKeyDown = (e) => {
      if (e.code === 'KeyP') { this.togglePause(); e.preventDefault(); return; }
      if (e.code === 'Escape') {
        if (this.inShop) { this.toggleShop(); e.preventDefault(); return; }
        if (this.inLeaderboard) { this.toggleLeaderboard(); e.preventDefault(); return; }
        this.togglePause(); e.preventDefault(); return;
      }
      if (e.code === 'KeyB') { this.toggleShop(); e.preventDefault(); return; }
      if (e.code === 'KeyL') { this.toggleLeaderboard(); e.preventDefault(); return; }
      if (!this.gameStarted || this.paused) return;
      switch (e.code) {
        case 'KeyW': this.keys.w = true; e.preventDefault(); break;
        case 'KeyA': this.keys.a = true; e.preventDefault(); break;
        case 'KeyS': this.keys.s = true; e.preventDefault(); break;
        case 'KeyD': this.keys.d = true; e.preventDefault(); break;
        case 'Digit1': this.activateItemByKey('rapidFire'); e.preventDefault(); break;
        case 'Digit2': this.activateItemByKey('shockwave'); e.preventDefault(); break;
        case 'Digit3': this.activateItemByKey('heal50'); e.preventDefault(); break;
        case 'Digit4': this.activateItemByKey('heal100'); e.preventDefault(); break;
      }
    };
    const handleKeyUp = (e) => {
      if (!this.gameStarted || this.paused) return;
      switch (e.code) {
        case 'KeyW': this.keys.w = false; break;
        case 'KeyA': this.keys.a = false; break;
        case 'KeyS': this.keys.s = false; break;
        case 'KeyD': this.keys.d = false; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }
  setupMouseControls() { this._camera.attachMouseControls(document); }


  setupTouchControls() {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e) => { e.preventDefault(); this.keys[key] = true; el.classList.add('active'); };
      const up   = (e) => { e.preventDefault(); this.keys[key] = false; el.classList.remove('active'); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
    };
    bind('btnUp','w'); bind('btnDown','s'); bind('btnLeft','a'); bind('btnRight','d');
  }

  // ---------- Player tick ----------
  
  updatePlayer(delta) {
    let moveForward=0, moveRight=0;
    const cf = new THREE.Vector3(), cr = new THREE.Vector3();
    cf.copy(this.playerPosition).sub(this.camera.position).normalize(); cf.y=0; cf.normalize();
    cr.crossVectors(cf, new THREE.Vector3(0,1,0)).normalize();
    if (this.keys.w) moveForward += 1;
    if (this.keys.s) moveForward -= 1;
    if (this.keys.a) moveRight -= 1;
    if (this.keys.d) moveRight += 1;

    const mv = new THREE.Vector3();
    if (moveForward!==0 || moveRight!==0) {
      mv.add(cf.clone().multiplyScalar(moveForward));
      mv.add(cr.clone().multiplyScalar(moveRight));
      if (mv.length()>0) mv.normalize().multiplyScalar(this.playerSpeed*delta);
    }

    // Knockback
    if (this.knockbackVelocity.lengthSq() > 1e-6) {
      const kbStep = this.knockbackVelocity.clone().multiplyScalar(delta);
      this.tryMovePlayer(kbStep);
      const decay = Math.exp(-this.knockbackDecay*delta);
      this.knockbackVelocity.multiplyScalar(decay);
    }

    // Input move
    if (mv.lengthSq() > 0) {
      this.tryMovePlayer(mv);
      if (this.player && (mv.x !== 0 || mv.z !== 0)) this.player.rotation.y = Math.atan2(mv.x, mv.z);
    }

    if (this.player) { const pp = this.playerPosition.clone(); pp.y = 1 + (this.playerHoverOffset || 0); this.player.position.copy(pp); }
    this.updateCameraPosition(); this.updatePlayerLighting(); this.updateShootingRangeIndicator();
  }
  updatePlayerLighting() { this._lights.updatePlayerLight(); }

  updateShootingRangeIndicator() { if (this.shootingRangeIndicator) this.shootingRangeIndicator.position.set(this.playerPosition.x, 0.05, this.playerPosition.z); }

  // ---------- Multiplier / streak ----------
  
  updateMultiplier() {
    const now = this._now;
    if (now - this.lastKillTime > this.multiplierDecayTime) {
      if (this.currentMultiplier > 1.0 || this.killStreak > 0) { this.currentMultiplier = 1.0; this.killStreak = 0; this.updateUI(); }
    }
  }


  checkStreakMilestone(previousStreak, currentStreak) {
    const milestones = [5, 10, 15, 20, 25, 30, 40, 50];
    for (const m of milestones) { if (previousStreak < m && currentStreak >= m) { this.celebrateMilestone(m); break; } }
  }

  celebrateMilestone(milestone) {
    let bonus = 0;
    if (milestone >= 50) bonus = 2000; else if (milestone >= 25) bonus = 1000; else if (milestone >= 10) bonus = 500; else bonus = 200;
    this.score += bonus;
    this.createMilestoneText(milestone, bonus);
    this.updateUI();
    const streakDisplay = document.getElementById('streakDisplay'); if (streakDisplay) { streakDisplay.classList.add('milestone'); setTimeout(()=>streakDisplay.classList.remove('milestone'),1000); }
  }

  createMilestoneText(milestone, bonusPoints=0) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position:'fixed', top:'50%', left:'50%', transform:'translate(-50%, -50%)',
      fontSize:'clamp(24px, 6vw, 48px)', fontWeight:'bold', color:'#FFD700',
      textShadow:'2px 2px 4px rgba(0,0,0,0.7)', zIndex:'10000', pointerEvents:'none',
      fontFamily:'Arial, sans-serif', willChange:'transform, opacity'
    });
    const text = (typeof milestone === 'string')
      ? milestone
      : `${milestone} KILL STREAK! +${bonusPoints} BONUS!`;
    el.textContent = text;
    document.body.appendChild(el);
    const duration = 1200;
    let start = null;
    const animate = (t) => {
      if (!start) start = t;
      const k = Math.min(1, (t - start) / duration);
      const opacity = 1 - k;
      const y = -30 * k;
      el.style.opacity = String(opacity);
      el.style.transform = `translate(-50%, calc(-50% + ${y}px))`;
      if (k < 1) requestAnimationFrame(animate);
      else if (el.parentElement) el.parentElement.removeChild(el);
    };
    requestAnimationFrame(animate);
  }

  // ---------- Difficulty & spawns ----------
  recomputePlayerStatsFromLevel() {
    const speedMult = 1 + this.levelSpeedBonus * (this.playerLevel - 1);
    this.playerSpeed = this.basePlayerSpeed * speedMult;
    const rateMult = Math.pow(1 - this.levelFireRateBonus, (this.playerLevel - 1));
    this.shootingInterval = Math.max(100, Math.round(this.baseShootingInterval * rateMult));
  }

  computePlayerDPS() {
    const shotsPerSecond = 1000 / this.getEffectiveShootingInterval();
    return shotsPerSecond;
  }

  computeMaxEnemies() {
    const now = this._now;
    const minutes = Math.max(0, (now - this.gameStartTime) / 60000);
    const k = this.enemyKills;
    const lvl = this.playerLevel;
    let max = 10 + Math.floor(3.0 * minutes + 1.3 * Math.sqrt(k) + 0.8 * Math.max(0, lvl-1));
    return THREE.MathUtils.clamp(max, 12, 80);
  }

  computePackSize() {
    const now = this._now;
    const minutes = Math.max(0, (now - this.gameStartTime)/60000);
    const k = this.enemyKills;
    const dps = this.computePlayerDPS();
    let packs = 1 + Math.floor(minutes * 0.6) + Math.floor(Math.sqrt(Math.max(0,k))/6);
    if (dps > 3.0) packs += 1;
    return THREE.MathUtils.clamp(packs, 1, 6);
  }

  updateDifficulty() {
    const now = this._now;
    if (now - this.difficultyScaling.lastDifficultyUpdate < this.difficultyScaling.difficultyUpdateInterval) return;

    const minutes = (now - this.gameStartTime) / 60000;
    const lvl = this.playerLevel;
    const dps = this.computePlayerDPS();
    const k = this.enemyKills;

    let speed = this.baseEnemySpeed
              + minutes * 0.55
              + (lvl - 1) * 0.28
              + Math.max(0, (dps / 2.2) - 1) * 0.9;
    this.enemySpeed = Math.min(this.difficultyScaling.maxEnemySpeed, speed);

    this.enemyDamage = Math.max(5, Math.round(this.baseEnemyDamage * (1 + 0.10 * minutes + 0.03 * (lvl-1))));

    const denom = 1 + minutes * 0.35 + Math.sqrt(k) * 0.12 + (lvl - 1) * 0.25 + Math.max(0, (dps/2.2) - 1) * 0.4;
    const interval = this.baseSpawnInterval / denom;
    this.spawnInterval = Math.max(this.difficultyScaling.minSpawnInterval, Math.round(interval));

    this.maxConcurrentEnemies = this.computeMaxEnemies();

    this.difficultyScaling.lastDifficultyUpdate = now;
  }

  // ---------- XP / Level ----------
  addXP(amount) {
    this.playerXP += amount;
    while (this.playerXP >= this.xpToNext) {
      this.playerXP -= this.xpToNext;
      this.playerLevel++;
      this.xpToNext = Math.round(this.xpToNext * 1.25 + 25);
      this.recomputePlayerStatsFromLevel();
      this.updateUI();
      this.createMilestoneText(`LEVEL ${this.playerLevel}`);
      this.saveProgress(); // persist level
    }
  }
  updateXP(delta) { this.addXP(this.xpPerSecond * delta); }

  // ---------- Pickups ----------
  /* moved to modules/items/pickups.js: createHealthPickup */


  

  /* moved to modules/items/pickups.js: createCoinPickup */




  /* moved to modules/items/pickups.js: maybeDropHealthPickup */


  /* moved to modules/items/pickups.js: maybeDropCoinPickup */


  /* moved to modules/items/pickups.js: heal */


  /* moved to modules/items/pickups.js: activateHealPercent */


  /* moved to modules/items/pickups.js: addCoins */


  /* moved to modules/items/pickups.js: createFloatingText */


  
  /* moved to modules/items/pickups.js: updatePickups */



  // ---------- Shop / Boosters ----------
  activateRapidFire() {
    this.fireRateBoostUntil = Date.now() + this.boostDurationMs;
    const bar = document.getElementById('boostBar');
    if (bar) bar.classList.remove('hidden');
  }

  updateBoostBar() {
    const bar = document.getElementById('boostBar');
    const fill = document.getElementById('boostFill');
    if (!bar || !fill) return;
    const remaining = this.fireRateBoostUntil - (this._now || Date.now());
    if (remaining > 0) {
      const pct = Math.max(0, Math.min(1, remaining / this.boostDurationMs));
      fill.style.width = `${pct*100}%`;
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  // Slower, sweeping shockwave — kills when the wave front reaches enemies
  
  activateShockwave() {
    const radius = this.shootingRange * 5;
    const origin = this.playerPosition.clone();
    const ringG = new THREE.RingGeometry(0.98, 1.0, 64); // unit ring
    const ringM = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringG, ringM);
    ring.rotation.x = -Math.PI/2;
    ring.position.set(origin.x, 0.06, origin.z);
    ring.scale.set(0.05, 1, 0.05);
    this.scene.add(ring);
    this.shockwaves.push({
      mesh: ring, origin,
      start: Date.now(),
      duration: 1800,
      lastRadius: 0.05,
      endRadius: radius
    });
  }


  
  updateShockwaves(delta) {
    for (let i=this.shockwaves.length-1;i>=0;i--) {
      const sw = this.shockwaves[i];
      const t = THREE.MathUtils.clamp(((this._now || Date.now()) - sw.start) / sw.duration, 0, 1);
      const tt = 1 - Math.pow(1 - t, 2);
      const r = THREE.MathUtils.lerp(0, sw.endRadius, tt);

      // Sweep kill
      for (let j=this.enemies.length-1;j>=0;j--) {
        const enemy = this.enemies[j];
        if (!enemy.alive) continue;
        const d = enemy.position.distanceTo(sw.origin);
                if (d <= r && d > sw.lastRadius) {
          this.createExplosion(enemy.position.clone());
          this.registerKill(enemy);
          this.removeEnemyAtIndex(j);
        }
      }
      sw.lastRadius = r;

      // Visual scaling
      const s = Math.max(0.001, r);
      sw.mesh.scale.set(s, 1, s);
      sw.mesh.material.opacity = 1 - t;
      sw.mesh.position.set(sw.origin.x, 0.06, sw.origin.z);

      if (t >= 1) {
      this.scene.remove(sw.mesh);
      if (sw.mesh.geometry && typeof sw.mesh.geometry.dispose === 'function') sw.mesh.geometry.dispose();
      if (sw.mesh.material) {
        if (Array.isArray(sw.mesh.material)) sw.mesh.material.forEach(m => { if (m && typeof m.dispose === 'function') m.dispose(); });
        else if (typeof sw.mesh.material.dispose === 'function') sw.mesh.material.dispose();
      }
      this.shockwaves.splice(i,1);
    }
    }
  }


  // ---------- Window ----------
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- Wallet / Leaderboard (local demo with API hooks) ----------
  shortAddress(addr) { return addr ? addr.slice(0,4) + '…' + addr.slice(-4) : ''; }

  async connectWallet() {
    try {
      const provider = window.solana;
      if (!provider || !provider.isPhantom) {
        alert('Phantom wallet not found. Install Phantom or use Guest mode.');
        return;
      }
      const res = await provider.connect();
      this.walletPublicKey = res.publicKey?.toString() || null;
      this.updateWalletUI();
      this.loadProgress(); // try to restore progress for this wallet
      this.createFloatingText(`Wallet: ${this.shortAddress(this.walletPublicKey)}`, this.playerPosition.clone(), '#00e676');
    } catch (e) {
      console.warn('Wallet connect failed', e);
    }
  }

  disconnectWallet() {
    this.walletPublicKey = null;
    this.updateWalletUI();
  }

  updateWalletUI() {
    const addrEl = document.getElementById('walletAddr');
    const cBtn = document.getElementById('walletConnectBtn');
    const dBtn = document.getElementById('walletDisconnectBtn');
    if (!addrEl || !cBtn || !dBtn) return;
    if (this.walletPublicKey) {
      addrEl.textContent = this.shortAddress(this.walletPublicKey);
      addrEl.classList.remove('hidden');
      dBtn.classList.remove('hidden');
      cBtn.classList.add('hidden');
    } else {
      addrEl.classList.add('hidden');
      dBtn.classList.add('hidden');
      cBtn.classList.remove('hidden');
    }
  }

  progressKey() {
    const id = this.walletPublicKey || 'guest';
    return `sg_progress_${id}`;
  }

  saveProgress() {
    const data = {
      level: this.playerLevel,
      xp: this.playerXP,
      xpToNext: this.xpToNext,
      coins: this.coins,
      timestamp: Date.now()
    };
    try { localStorage.setItem(this.progressKey(), JSON.stringify(data)); } catch(e){}
  }

  loadProgress() {
    try {
      const raw = localStorage.getItem(this.progressKey());
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.level === 'number') {
        this.playerLevel = Math.max(1, data.level|0);
        this.playerXP = Math.max(0, Number(data.xp) || 0);
        this.xpToNext = Math.max(1, Number(data.xpToNext) || this.xpToNext);
        this.coins = Math.max(0, Number(data.coins) || this.coins);
        this.recomputePlayerStatsFromLevel();
        this.updateUI();
        this.createMilestoneText(`PROGRESS LOADED — LVL ${this.playerLevel}`);
      }
    } catch(e){ console.warn('Load progress failed', e); }
  }

  submitScore(score, kills, level) {
    const record = {
      addr: this.walletPublicKey || 'guest',
      score: Math.round(score||0),
      kills: Math.round(kills||0),
      level: Math.round(level||1),
      ts: Date.now()
    };
    // local
    try {
      const key = 'sg_leaderboard_local';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push(record);
      arr.sort((a,b)=> b.score - a.score);
      localStorage.setItem(key, JSON.stringify(arr.slice(0,50)));
    } catch(e){}

    // optional remote
    if (this.leaderboardApiBase) {
      fetch(this.leaderboardApiBase + '/submit', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(record)
      }).catch(()=>{});
    }
  }

  refreshLeaderboardUI() {
    const wrap = document.getElementById('leaderboardTable');
    if (!wrap) return;
    const local = JSON.parse(localStorage.getItem('sg_leaderboard_local') || '[]');
    let rows = local.map((r,i) => `
      <div class="row">
        <div class="c rank">${i+1}</div>
        <div class="c addr">${this.shortAddress(r.addr)}</div>
        <div class="c score">${r.score}</div>
        <div class="c kills">${r.kills}</div>
        <div class="c level">Lv ${r.level}</div>
      </div>`).join('');
    if (!rows) rows = '<div class="row empty">No records yet — play a round!</div>';
    wrap.innerHTML = `
      <div class="head row">
        <div class="c rank">#</div>
        <div class="c addr">Player</div>
        <div class="c score">Score</div>
        <div class="c kills">Kills</div>
        <div class="c level">Level</div>
      </div>${rows}`;
  }

  // ---------- Main loop ----------
  animate() {
    requestAnimationFrame(this.animate);
    if (this.gameStarted && !this.paused) {
      const rawDelta = this.clock.getDelta();
      const delta = Math.min(0.05, rawDelta);
      const now = Date.now();
      this._now = now;

      if (now - this.lastSpawnTime >= this.spawnInterval &&
          this.enemies.filter(e => e.alive).length < this.maxConcurrentEnemies) {
        const capacity = this.maxConcurrentEnemies - this.enemies.filter(e => e.alive).length;
        const count = Math.min(capacity, this.computePackSize());
        for (let k=0;k<count;k++) this.spawnEnemy();
        this.lastSpawnTime = now;
      }

      {
        const minutes = Math.max(0, (now - this.gameStartTime)/60000);
        const bossInterval = Math.max(this.bossConfig.minInterval, this.bossConfig.baseInterval - minutes * this.bossConfig.intervalDecreasePerMinute);
        if (now - this.lastBossSpawnTime >= bossInterval) { this.spawnBoss(); this.lastBossSpawnTime = now; }
      }

      if (this.playerHealth > 0) {
        this.updatePlayer(delta);
        this.updateEnemies(delta);
        this.updateShooting();
        this.updateProjectiles(delta);
        this.updateEnemyProjectiles(delta);
        this.checkProjectileCollisions();
        this.updateExplosions(delta);
        this.checkCollisions();
        this.updateMultiplier();
        this.updatePickups(delta);
        this.updateXP(delta);
        this.updateShockwaves(delta);
        this.updateDifficulty();
        this.updateUIThrottled();
        this.updateBoostBar();
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}

new SurvivorGame();