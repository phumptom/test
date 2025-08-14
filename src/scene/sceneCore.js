// Step 1 extracted visual helpers from game.js
// Attaches camera, lights, sky and world construction to SurvivorGame.prototype
import * as THREE from 'three';

export function attachSceneCore(SurvivorGame) {
  // ---------- Camera & lights ----------
  SurvivorGame.prototype.setupCamera = function () { this.updateCameraPosition(); };
  SurvivorGame.prototype.updateCameraPosition = function () {
    const target = this.playerPosition.clone();
    const h = this.cameraControls.zoomDistance * Math.cos(this.cameraControls.tiltAngle);
    const v = this.cameraControls.zoomDistance * Math.sin(this.cameraControls.tiltAngle);
    const ox = h * Math.sin(this.cameraControls.rotationAngle);
    const oz = h * Math.cos(this.cameraControls.rotationAngle);
    this.camera.position.set(target.x + ox, target.y + v, target.z + oz);
    this.camera.lookAt(target);
    if (this.skySphere) this.skySphere.position.copy(this.camera.position);
  };

  SurvivorGame.prototype.setupLights = function () {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.45);
    this.scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(15, 20, 10);
    this.scene.add(dir);
    const overhead = new THREE.DirectionalLight(0xffffff, 1.35);
    overhead.position.set(0, 45, 0);
    overhead.target.position.set(0, 0, 0);
    this.scene.add(overhead); this.scene.add(overhead.target);
    const corners = [[-70,20,-70],[70,20,-70],[-70,20,70],[70,20,70]];
    for (const [x,y,z] of corners) { const p = new THREE.PointLight(0xffffff, 0.35, 160); p.position.set(x,y,z); this.scene.add(p); }
    this.playerPointLight = new THREE.PointLight(0xffffff, 7.5, 40);
    this.playerPointLight.position.copy(this.playerPosition); this.playerPointLight.position.y = 10;
    this.scene.add(this.playerPointLight);
  };

  // ---------- World ----------
  SurvivorGame.prototype.createGround = function () {
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
  };

  SurvivorGame.prototype.createSkySphere = function () {
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
  };

  SurvivorGame.prototype.createBoundaryWalls = function (fieldSize) {
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
  };

  // Banners: 4 per side (16 total) — evenly spaced, with edge margins
  SurvivorGame.prototype.createBannerFrames = function (fieldSize) {
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
  };

  SurvivorGame.prototype.setBannerImage = function (id, url) {
    const banner = this.banners.find(b => b.id === id);
    if (!banner) return;
    const loader = this.textureLoader;
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      banner.canvas.material.map = tex;
      banner.canvas.material.needsUpdate = true;
    });
  };

  // Obstacles
  SurvivorGame.prototype.createChartCandlesAndWalls = function (fieldSize) {
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
  };
}
