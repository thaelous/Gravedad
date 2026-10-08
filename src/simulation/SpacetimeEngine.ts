import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';
import { BodyType, CelestialBodyData, SimulationConfig } from './types';
import { CelestialTextureFactory } from './CelestialTextures';
import { CosmicAudioEngine } from './CosmicAudioEngine';

export interface CollisionEvent {
  position: THREE.Vector3;
  color: string;
  size: number;
}

export interface BodyInternal {
  id: string;
  name: string;
  type: BodyType;
  mass: number;
  radius: number;
  color: string;
  glowColor: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  isFixed: boolean;
  mesh: THREE.Group;
  trailLine: THREE.Line;
  trailPositions: Float32Array;
  trailCount: number;
  trailMax: number;
  trailIndex: number;
  lastTrailPos: THREE.Vector3;
  lastDistToClosestMass?: number;
  distTrend?: 'increasing' | 'decreasing';
  lastPerihelionTime?: number;
}

interface ShockwaveParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ExpandingRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  growthRate: number;
}

export interface GravitationalWaveBurst {
  x: number;
  z: number;
  time: number;
  amplitude: number;
  wavelength: number;
  speed: number;
  duration: number;
}

export class SpacetimeEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  // Grid
  private gridSegments = 88;
  private gridSize = 140;
  private gridLineGeometry!: THREE.BufferGeometry;
  private gridLineMesh!: THREE.LineSegments;
  private gridSurfaceGeometry!: THREE.PlaneGeometry;
  private gridSurfaceMesh!: THREE.Mesh;
  private gridVerticesTotal = 0;
  private originalGridCoords!: Float32Array;

  // Simulation state
  public audio: CosmicAudioEngine = new CosmicAudioEngine();
  public config: SimulationConfig = {
    G: 1.0,
    timeScale: 1.0,
    deformationScale: 1.0,
    softening: 1.5,
    trailLength: 220,
    showTrails: true,
    showGrid: true,
    gridResolution: 88,
    bodyOnWell: true,
    isPaused: false,
    showVectors: false,
    showGravitationalWaves: true,
    waveIntensity: 1.0,
    bloomEnabled: false,
    bloomStrength: 1.35,
  };

  public bodies: BodyInternal[] = [];
  public waveBursts: GravitationalWaveBurst[] = [];
  public currentWaveStrain = 0; // 0 to 1 for HUD detector meter
  private shockwaves: ShockwaveParticle[] = [];
  private expandingRings: ExpandingRing[] = [];

  // Post-processing & Bloom
  public composer!: EffectComposer;
  public renderPass!: RenderPass;
  public bloomPass!: UnrealBloomPass;

  // Starfield & Parallax layers
  private starsFieldFar!: THREE.Points;
  private starsFieldMid!: THREE.Points;
  private cosmicDustNear!: THREE.Points;
  private selectionRing!: THREE.Mesh;
  public selectedBodyId: string | null = null;
  private ambientLight!: THREE.AmbientLight;
  private mainLight!: THREE.DirectionalLight;

  // Placement / Launcher
  public placementMode = false;
  public placementType: BodyType = 'planet';
  public placementFixed = false;
  private isAiming = false;
  private aimStartPoint = new THREE.Vector3();
  private aimEndPoint = new THREE.Vector3();
  private aimArrowMesh!: THREE.ArrowHelper;
  private aimTrajectoryLine!: THREE.Line;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private invisiblePlane!: THREE.Mesh;

  // Tracking
  public trackedBodyId: string | null = null;
  public onBodySelected?: (id: string | null) => void;
  public onBodySpawned?: () => void;
  public isCinematicCamera: boolean = false;
  public onCinematicCameraChange?: (active: boolean) => void;
  private cinematicAngle: number = 0;

  // Bound event listeners for proper teardown
  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerUp = this.onPointerUp.bind(this);
  private boundOnPointerCancel = this.onPointerCancel.bind(this);
  private boundOnResize = this.onWindowResize.bind(this);
  private resizeObserver: ResizeObserver | null = null;
  private aimPointerId: number | null = null;
  private activeCameraTween: gsap.core.Tween | null = null;
  public onStatsUpdate?: (stats: {
    activeBodies: number;
    fps: number;
    kineticEnergy: number;
    potentialEnergy: number;
    totalEnergy: number;
    barycenter: THREE.Vector3;
    waveStrain: number;
    activeBursts: number;
  }) => void;

  // Render loop tracking
  private isDestroyed = false;
  private lastTime = performance.now();
  private frameCount = 0;
  private fpsLastTime = performance.now();
  private currentFps = 60;

  constructor(container: HTMLElement) {
    this.container = container;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020611);
    this.scene.fog = new THREE.FogExp2(0x020611, 0.0035);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1500);
    this.camera.position.set(0, 52, 75);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.touchAction = 'none';
    container.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 350;
    this.controls.minDistance = 6;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.15;
    this.controls.target.set(0, -2, 0);
    // Explicit touch configuration: 1 finger rotate camera, 2 fingers pinch zoom
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.initLights();
    this.initStars();
    this.initSpacetimeGrid();
    this.initLauncherUI();
    this.initPostProcessing();
    this.initEventListeners();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  private initPostProcessing() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // UnrealBloomPass configuration: resolution, strength, radius, threshold
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      this.config.bloomStrength, // strength
      0.45,                      // radius
      0.18                       // threshold (glows stars, accretion disk, pulse waves and hot cores)
    );
    this.bloomPass.enabled = this.config.bloomEnabled;
    this.composer.addPass(this.bloomPass);
  }

  private initLights() {
    this.ambientLight = new THREE.AmbientLight(0x38bdf8, 0.35);
    this.scene.add(this.ambientLight);

    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.mainLight.position.set(30, 60, 40);
    this.scene.add(this.mainLight);

    const secondaryLight = new THREE.DirectionalLight(0x0284c7, 0.6);
    secondaryLight.position.set(-40, -20, -30);
    this.scene.add(secondaryLight);
  }

  // Genera un mapa de textura circular difuminado en Canvas2D en memoria para evitar estrellas cuadradas
  private createStarDotTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private initStars() {
    const starTexture = this.createStarDotTexture();

    // 1. Capa Distante (Fondo cósmico profundo): muchas estrellas tenues
    const farCount = 2800;
    const farGeo = new THREE.BufferGeometry();
    const farPos = new Float32Array(farCount * 3);
    const farCol = new Float32Array(farCount * 3);

    for (let i = 0; i < farCount; i++) {
      const r = 320 + Math.random() * 480;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      farPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      farPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      farPos[i * 3 + 2] = r * Math.cos(phi);

      const colorTier = Math.random();
      if (colorTier > 0.8) {
        farCol[i * 3] = 1.0; farCol[i * 3 + 1] = 0.85; farCol[i * 3 + 2] = 0.65;
      } else if (colorTier > 0.4) {
        farCol[i * 3] = 0.55; farCol[i * 3 + 1] = 0.8; farCol[i * 3 + 2] = 1.0;
      } else {
        const b = 0.45 + Math.random() * 0.4;
        farCol[i * 3] = b; farCol[i * 3 + 1] = b; farCol[i * 3 + 2] = b;
      }
    }
    farGeo.setAttribute('position', new THREE.BufferAttribute(farPos, 3));
    farGeo.setAttribute('color', new THREE.BufferAttribute(farCol, 3));
    this.starsFieldFar = new THREE.Points(
      farGeo,
      new THREE.PointsMaterial({
        size: 0.85,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(this.starsFieldFar);

    // 2. Capa Intermedia (Estrellas medianas brillantes con paralaje activo)
    const midCount = 1400;
    const midGeo = new THREE.BufferGeometry();
    const midPos = new Float32Array(midCount * 3);
    const midCol = new Float32Array(midCount * 3);

    for (let i = 0; i < midCount; i++) {
      const r = 140 + Math.random() * 180;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      midPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      midPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      midPos[i * 3 + 2] = r * Math.cos(phi);

      const tier = Math.random();
      if (tier > 0.7) {
        midCol[i * 3] = 0.95; midCol[i * 3 + 1] = 0.75; midCol[i * 3 + 2] = 0.35; // ámbar
      } else {
        midCol[i * 3] = 0.45; midCol[i * 3 + 1] = 0.85; midCol[i * 3 + 2] = 1.0; // cian
      }
    }
    midGeo.setAttribute('position', new THREE.BufferAttribute(midPos, 3));
    midGeo.setAttribute('color', new THREE.BufferAttribute(midCol, 3));
    this.starsFieldMid = new THREE.Points(
      midGeo,
      new THREE.PointsMaterial({
        size: 1.15,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(this.starsFieldMid);

    // 3. Capa Cercana (Polvo cósmico / Micropartículas con fuerte paralaje estereoscópico)
    const nearCount = 750;
    const nearGeo = new THREE.BufferGeometry();
    const nearPos = new Float32Array(nearCount * 3);
    const nearCol = new Float32Array(nearCount * 3);

    for (let i = 0; i < nearCount; i++) {
      const r = 35 + Math.random() * 110;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 60; // distribución más planar sobre la órbita

      nearPos[i * 3] = Math.cos(theta) * r;
      nearPos[i * 3 + 1] = y;
      nearPos[i * 3 + 2] = Math.sin(theta) * r;

      nearCol[i * 3] = 0.3 + Math.random() * 0.4;
      nearCol[i * 3 + 1] = 0.75 + Math.random() * 0.25;
      nearCol[i * 3 + 2] = 1.0;
    }
    nearGeo.setAttribute('position', new THREE.BufferAttribute(nearPos, 3));
    nearGeo.setAttribute('color', new THREE.BufferAttribute(nearCol, 3));
    this.cosmicDustNear = new THREE.Points(
      nearGeo,
      new THREE.PointsMaterial({
        size: 1.05,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(this.cosmicDustNear);

    // Anillo de selección visual para cuerpos activos
    const selRingGeo = new THREE.RingGeometry(1.6, 2.1, 36);
    selRingGeo.rotateX(-Math.PI / 2);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    this.selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
  }

  private initSpacetimeGrid() {
    const N = this.gridSegments;
    const size = this.gridSize;
    const step = size / N;
    const half = size / 2;

    // We build an orthogonal grid composed of line segments
    // Total segments: (N+1) lines along X, each with N segments => (N+1)*N segments
    // Plus (N+1) lines along Z, each with N segments => (N+1)*N segments
    // Each segment has 2 vertices.
    const segmentsPerDir = (N + 1) * N;
    const totalSegments = segmentsPerDir * 2;
    const vertexCount = totalSegments * 2;
    this.gridVerticesTotal = vertexCount;

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    this.originalGridCoords = new Float32Array(vertexCount * 2); // stores original (x, z)

    let vIdx = 0;
    let coordIdx = 0;

    // Horizontal lines parallel to X (along row, changing x for fixed z)
    for (let r = 0; r <= N; r++) {
      const z = -half + r * step;
      for (let c = 0; c < N; c++) {
        const x1 = -half + c * step;
        const x2 = -half + (c + 1) * step;

        // Vertex 1
        positions[vIdx * 3] = x1;
        positions[vIdx * 3 + 1] = 0;
        positions[vIdx * 3 + 2] = z;
        this.originalGridCoords[coordIdx++] = x1;
        this.originalGridCoords[coordIdx++] = z;
        vIdx++;

        // Vertex 2
        positions[vIdx * 3] = x2;
        positions[vIdx * 3 + 1] = 0;
        positions[vIdx * 3 + 2] = z;
        this.originalGridCoords[coordIdx++] = x2;
        this.originalGridCoords[coordIdx++] = z;
        vIdx++;
      }
    }

    // Vertical lines parallel to Z (along col, changing z for fixed x)
    for (let c = 0; c <= N; c++) {
      const x = -half + c * step;
      for (let r = 0; r < N; r++) {
        const z1 = -half + r * step;
        const z2 = -half + (r + 1) * step;

        // Vertex 1
        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = 0;
        positions[vIdx * 3 + 2] = z1;
        this.originalGridCoords[coordIdx++] = x;
        this.originalGridCoords[coordIdx++] = z1;
        vIdx++;

        // Vertex 2
        positions[vIdx * 3] = x;
        positions[vIdx * 3 + 1] = 0;
        positions[vIdx * 3 + 2] = z2;
        this.originalGridCoords[coordIdx++] = x;
        this.originalGridCoords[coordIdx++] = z2;
        vIdx++;
      }
    }

    // Initial default colors (deep cosmic cyan)
    for (let i = 0; i < vertexCount; i++) {
      colors[i * 3] = 0.05;
      colors[i * 3 + 1] = 0.55;
      colors[i * 3 + 2] = 0.95;
    }

    this.gridLineGeometry = new THREE.BufferGeometry();
    this.gridLineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.gridLineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      linewidth: 1,
    });

    this.gridLineMesh = new THREE.LineSegments(this.gridLineGeometry, lineMaterial);
    this.scene.add(this.gridLineMesh);

    // Complementary semi-translucent elastic sheet underneath to give physical volume
    this.gridSurfaceGeometry = new THREE.PlaneGeometry(size, size, N, N);
    this.gridSurfaceGeometry.rotateX(-Math.PI / 2);

    const surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x030a1c,
      roughness: 0.6,
      metalness: 0.4,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.gridSurfaceMesh = new THREE.Mesh(this.gridSurfaceGeometry, surfaceMaterial);
    this.gridSurfaceMesh.position.y = -0.05;
    this.scene.add(this.gridSurfaceMesh);

    // Invisible intersection plane for raycasting
    const planeGeo = new THREE.PlaneGeometry(300, 300);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    this.invisiblePlane = new THREE.Mesh(planeGeo, planeMat);
    this.scene.add(this.invisiblePlane);
  }

  private initLauncherUI() {
    // Arrow helper for launch vector
    const dir = new THREE.Vector3(1, 0, 0);
    this.aimArrowMesh = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 1, 0x38bdf8, 1.2, 0.7);
    this.aimArrowMesh.visible = false;
    this.scene.add(this.aimArrowMesh);

    // Dotted trajectory preview
    const trajPoints = new Float32Array(50 * 3);
    const trajGeo = new THREE.BufferGeometry();
    trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPoints, 3));
    const trajMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.8,
      gapSize: 0.4,
      transparent: true,
      opacity: 0.9,
    });
    this.aimTrajectoryLine = new THREE.Line(trajGeo, trajMat);
    this.aimTrajectoryLine.computeLineDistances();
    this.aimTrajectoryLine.visible = false;
    this.scene.add(this.aimTrajectoryLine);
  }

  private initEventListeners() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
    window.addEventListener('pointercancel', this.boundOnPointerCancel);
    window.addEventListener('resize', this.boundOnResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(this.boundOnResize, 120);
    });

    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.onWindowResize();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private getPlaneIntersection(e: MouseEvent | PointerEvent): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.invisiblePlane);

    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Multi-touch handling: secondary finger touches down (e.g. pinch to zoom)
    // Abort aiming cleanly so OrbitControls takes over zooming!
    if (!e.isPrimary) {
      if (this.isAiming) {
        this.isAiming = false;
        this.aimPointerId = null;
        this.controls.enabled = true;
        this.aimArrowMesh.visible = false;
        this.aimTrajectoryLine.visible = false;
      }
      return;
    }

    if (!this.placementMode) {
      // Raycast against bodies to select one
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshes: THREE.Object3D[] = [];
      for (const b of this.bodies) {
        meshes.push(b.mesh);
      }
      const intersects = this.raycaster.intersectObjects(meshes, true);
      if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        while (hitObj.parent && !this.bodies.some((b) => b.mesh === hitObj)) {
          hitObj = hitObj.parent;
        }
        const hitBody = this.bodies.find((b) => b.mesh === hitObj);
        if (hitBody) {
          this.selectBody(hitBody.id);
          if (this.onBodySelected) {
            this.onBodySelected(hitBody.id);
          }
        }
      }
      return;
    }

    const hit = this.getPlaneIntersection(e);
    if (!hit) return;

    this.isAiming = true;
    this.aimPointerId = e.pointerId;
    this.aimStartPoint.copy(hit);
    this.aimStartPoint.y = 0;
    this.aimEndPoint.copy(this.aimStartPoint);

    // Disable OrbitControls while aiming so camera does not drift
    this.controls.enabled = false;

    this.aimArrowMesh.position.copy(this.aimStartPoint);
    this.aimArrowMesh.setLength(0.01, 0.001, 0.001);
    this.aimArrowMesh.visible = true;
    this.aimTrajectoryLine.visible = true;
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.isAiming) return;
    if (this.aimPointerId !== null && e.pointerId !== this.aimPointerId) return;

    const hit = this.getPlaneIntersection(e);
    if (!hit) return;

    this.aimEndPoint.copy(hit);
    this.aimEndPoint.y = 0;

    // Vector from start to current drag point represents initial velocity
    const dragVec = new THREE.Vector3().subVectors(this.aimEndPoint, this.aimStartPoint);
    const len = dragVec.length();

    if (len > 0.3) {
      const dir = dragVec.clone().normalize();
      this.aimArrowMesh.position.copy(this.aimStartPoint);
      this.aimArrowMesh.setDirection(dir);
      this.aimArrowMesh.setLength(Math.min(len, 25), 1.2, 0.6);

      // Trajectory preview
      this.updateTrajectoryPreview(this.aimStartPoint, dragVec.clone().multiplyScalar(0.28));
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.isAiming) return;
    if (this.aimPointerId !== null && e.pointerId !== this.aimPointerId) return;

    this.isAiming = false;
    this.aimPointerId = null;
    this.controls.enabled = true;
    this.aimArrowMesh.visible = false;
    this.aimTrajectoryLine.visible = false;

    const hit = this.getPlaneIntersection(e);
    const end = hit ? hit.clone() : this.aimEndPoint.clone();
    end.y = 0;

    const dragVec = new THREE.Vector3().subVectors(end, this.aimStartPoint);
    const speedScale = 0.28;
    const initialVelocity = dragVec.length() > 0.5 ? dragVec.multiplyScalar(speedScale) : new THREE.Vector3(0, 0, 0);

    // Spawn the new body
    this.spawnBodyFromPlacement(this.aimStartPoint, initialVelocity);
    if (this.onBodySpawned) {
      this.onBodySpawned();
    }
  }

  private onPointerCancel(e: PointerEvent) {
    if (this.isAiming && (this.aimPointerId === null || e.pointerId === this.aimPointerId)) {
      this.isAiming = false;
      this.aimPointerId = null;
      this.controls.enabled = true;
      this.aimArrowMesh.visible = false;
      this.aimTrajectoryLine.visible = false;
    }
  }

  public setPlacementMode(enabled: boolean) {
    this.placementMode = enabled;
    if (!enabled && this.isAiming) {
      this.isAiming = false;
      this.aimPointerId = null;
      this.controls.enabled = true;
      this.aimArrowMesh.visible = false;
      this.aimTrajectoryLine.visible = false;
    }
  }

  public onWindowResize() {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  private updateTrajectoryPreview(startPos: THREE.Vector3, initialVel: THREE.Vector3) {
    const positions = (this.aimTrajectoryLine.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    let simPos = startPos.clone();
    let simVel = initialVel.clone();
    const dt = 0.12;
    const steps = 50;

    for (let step = 0; step < steps; step++) {
      positions[step * 3] = simPos.x;
      positions[step * 3 + 1] = this.config.bodyOnWell ? this.calculatePotential(simPos.x, simPos.z) : 0;
      positions[step * 3 + 2] = simPos.z;

      // Compute gravitational acceleration at simPos
      const acc = new THREE.Vector3();
      for (const b of this.bodies) {
        const diff = new THREE.Vector3().subVectors(b.position, simPos);
        const rSq = diff.lengthSq() + this.config.softening * this.config.softening;
        const r = Math.sqrt(rSq);
        const force = (this.config.G * b.mass) / (rSq * r);
        acc.add(diff.multiplyScalar(force));
      }

      simVel.add(acc.multiplyScalar(dt));
      simPos.add(simVel.clone().multiplyScalar(dt));
    }

    this.aimTrajectoryLine.geometry.attributes.position.needsUpdate = true;
    this.aimTrajectoryLine.computeLineDistances();
  }

  // Toggles or adjusts spacetime grid visibility immediately
  public setGridVisible(visible: boolean) {
    this.config.showGrid = visible;
    if (this.gridLineMesh) {
      this.gridLineMesh.visible = visible;
    }
    if (this.gridSurfaceMesh) {
      this.gridSurfaceMesh.visible = visible;
    }
  }

  // Toggles or adjusts Unreal Bloom effect
  public setBloom(enabled: boolean, strength?: number) {
    this.config.bloomEnabled = enabled;
    if (strength !== undefined) {
      this.config.bloomStrength = strength;
    }
    if (this.bloomPass) {
      this.bloomPass.enabled = enabled;
      if (strength !== undefined) {
        this.bloomPass.strength = strength;
      }
    }
  }

  // Visual potential calculation (depth y)
  public calculatePotential(x: number, z: number): number {
    let totalDepth = 0;
    const kVis = 0.038 * this.config.deformationScale;
    const softeningGridSq = 2.8 * 2.8;

    for (const b of this.bodies) {
      const dx = x - b.position.x;
      const dz = z - b.position.z;
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq + softeningGridSq);
      totalDepth += (this.config.G * b.mass) / dist;
    }

    return -totalDepth * kVis;
  }

  // Triggers an expanding gravitational wave burst (e.g. from collisions or manual pulse)
  public triggerGravitationalBurst(x: number, z: number, amplitude: number = 3.5) {
    if (!this.config.showGravitationalWaves) return;
    this.waveBursts.push({
      x,
      z,
      time: 0,
      amplitude: Math.max(amplitude, 1.2),
      wavelength: 8.5,
      speed: 26.0,
      duration: 6.5,
    });
  }

  // Deforms the spacetime grid in real-time with General Relativity Potential & Gravitational Waves
  private updateGridDeformation(dt: number = 0.016) {
    if (!this.config.showGrid) {
      this.gridLineMesh.visible = false;
      this.gridSurfaceMesh.visible = false;
      return;
    }
    this.gridLineMesh.visible = true;
    this.gridSurfaceMesh.visible = true;

    const linePos = (this.gridLineGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const lineCol = (this.gridLineGeometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
    const origCoords = this.originalGridCoords;
    const vertexCount = this.gridVerticesTotal;

    const kVis = 0.038 * this.config.deformationScale;
    const softeningGridSq = 2.8 * 2.8;
    const bodies = this.bodies;
    const bodyCount = bodies.length;

    // Cache body positions and masses for speed
    const bx = new Float32Array(bodyCount);
    const bz = new Float32Array(bodyCount);
    const bG_m = new Float32Array(bodyCount);
    for (let i = 0; i < bodyCount; i++) {
      bx[i] = bodies[i].position.x;
      bz[i] = bodies[i].position.z;
      bG_m[i] = this.config.G * bodies[i].mass;
    }

    // 1. Update active gravitational wave bursts
    const effectiveDt = dt * this.config.timeScale;
    let totalMass = 0;
    let maxCurvatureDepth = 0;
    for (let i = 0; i < bodyCount; i++) {
      totalMass += bodies[i].mass;
    }
    if (bodyCount > 0) {
      maxCurvatureDepth = -this.calculatePotential(bx[0], bz[0]);
    }
    this.audio.updateCurvatureModulation(totalMass, maxCurvatureDepth);
    for (let i = this.waveBursts.length - 1; i >= 0; i--) {
      this.waveBursts[i].time += effectiveDt;
      if (this.waveBursts[i].time >= this.waveBursts[i].duration) {
        this.waveBursts.splice(i, 1);
      }
    }

    // 2. Detect close orbiting binary pairs for continuous quadrupole spiral waves
    interface BinaryEmitter {
      bx: number;
      bz: number;
      phi: number;
      omega: number;
      amplitude: number;
    }
    const binaryEmitters: BinaryEmitter[] = [];
    let detectedPeakStrain = 0;

    if (this.config.showGravitationalWaves) {
      for (let i = 0; i < bodyCount; i++) {
        for (let j = i + 1; j < bodyCount; j++) {
          const b1 = bodies[i];
          const b2 = bodies[j];
          if (b1.mass >= 35 && b2.mass >= 35) {
            const dx = b2.position.x - b1.position.x;
            const dz = b2.position.z - b1.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 46 && dist > 1.2) {
              const totM = b1.mass + b2.mass;
              const barX = (b1.mass * b1.position.x + b2.mass * b2.position.x) / totM;
              const barZ = (b1.mass * b1.position.z + b2.mass * b2.position.z) / totM;
              const phi = Math.atan2(dz, dx);
              // Relative velocity / angular velocity
              const rvx = b2.velocity.x - b1.velocity.x;
              const rvz = b2.velocity.z - b1.velocity.z;
              const vTangential = (dx * rvz - dz * rvx) / dist;
              const omega = vTangential / dist;
              // Quadrupole radiation amplitude
              const amp = Math.min(((b1.mass * b2.mass) / Math.pow(dist, 1.35)) * 0.0022 * this.config.waveIntensity, 3.8);
              if (amp > 0.04) {
                binaryEmitters.push({ bx: barX, bz: barZ, phi, omega, amplitude: amp });
                detectedPeakStrain = Math.max(detectedPeakStrain, Math.min(amp / 2.0, 1.0));
              }
            }
          }
        }
      }

      // Add burst peak to strain meter
      for (const burst of this.waveBursts) {
        const remaining = 1.0 - burst.time / burst.duration;
        detectedPeakStrain = Math.max(detectedPeakStrain, remaining * Math.min(burst.amplitude / 3.0, 1.0));
      }
    }

    this.currentWaveStrain = THREE.MathUtils.lerp(this.currentWaveStrain, detectedPeakStrain, 0.15);

    const hasWaves = this.config.showGravitationalWaves && (binaryEmitters.length > 0 || this.waveBursts.length > 0);
    const waveCount = this.waveBursts.length;
    const binaryCount = binaryEmitters.length;

    for (let v = 0; v < vertexCount; v++) {
      const gx = origCoords[v * 2];
      const gz = origCoords[v * 2 + 1];

      let potential = 0;
      for (let b = 0; b < bodyCount; b++) {
        const dx = gx - bx[b];
        const dz = gz - bz[b];
        const dSq = dx * dx + dz * dz;
        potential += bG_m[b] / Math.sqrt(dSq + softeningGridSq);
      }

      let y = -potential * kVis;
      let waveHighlight = 0;

      // Gravitational Wave Displacement
      if (hasWaves) {
        let waveY = 0;

        // A. Continuous Quadrupole Spiral from binary systems
        for (let e = 0; e < binaryCount; e++) {
          const em = binaryEmitters[e];
          const edx = gx - em.bx;
          const edz = gz - em.bz;
          const er = Math.sqrt(edx * edx + edz * edz);
          const theta = Math.atan2(edz, edx);
          // Quadrupole wave phase with outward propagation (c_gw = 26.0)
          const phase = 2 * (theta - em.phi) - (er * 0.38);
          const waveAtten = (em.amplitude / Math.sqrt(er + 2.5)) * Math.exp(-0.014 * er);
          const val = Math.cos(phase) * waveAtten;
          waveY += val;
          if (val > 0.08) {
            waveHighlight += val * 1.2;
          }
        }

        // B. Collision / Merger Wave Bursts propagating outward
        for (let w = 0; w < waveCount; w++) {
          const burst = this.waveBursts[w];
          const wdx = gx - burst.x;
          const wdz = gz - burst.z;
          const wr = Math.sqrt(wdx * wdx + wdz * wdz);
          const waveRadius = burst.speed * burst.time;
          const distFromFront = wr - waveRadius;
          const packetWidth = burst.wavelength * 2.2;

          if (Math.abs(distFromFront) < packetWidth * 1.8) {
            const envelope = Math.exp(-Math.pow(distFromFront / packetWidth, 2));
            const phase = (distFromFront / burst.wavelength) * Math.PI * 2;
            const temporalDecay = Math.max(0, 1.0 - (burst.time / burst.duration));
            const spatialDecay = 1.0 / Math.sqrt(wr + 2.5);
            const val = burst.amplitude * envelope * Math.cos(phase) * temporalDecay * spatialDecay * this.config.waveIntensity;
            waveY += val;
            if (val > 0.06) {
              waveHighlight += val * 1.8;
            }
          }
        }

        y += waveY;
      }

      linePos[v * 3 + 1] = y;

      // Color mapping: electric cyan -> bright aqua -> amber -> fiery orange -> intense yellow
      const depth = -y; // positive depth
      const t = Math.min(Math.max(depth, 0) / 16.0, 1.0);

      let r: number, g: number, b: number;
      if (t < 0.25) {
        const f = t / 0.25;
        r = 0.03 + f * 0.08;
        g = 0.45 + f * 0.35;
        b = 0.95 + f * 0.05;
      } else if (t < 0.6) {
        const f = (t - 0.25) / 0.35;
        r = 0.11 + f * 0.84;
        g = 0.80 - f * 0.15;
        b = 1.0 - f * 0.85;
      } else if (t < 0.85) {
        const f = (t - 0.6) / 0.25;
        r = 0.95 + f * 0.05;
        g = 0.65 - f * 0.35;
        b = 0.15 - f * 0.10;
      } else {
        const f = (t - 0.85) / 0.15;
        r = 1.0;
        g = 0.30 + f * 0.65;
        b = 0.05 + f * 0.55;
      }

      // Gravitational Wave Crest Luminous Highlight
      if (waveHighlight > 0) {
        const h = Math.min(waveHighlight * 0.8, 1.0);
        r = Math.min(r + h * 0.65, 1.0);
        g = Math.min(g + h * 0.45, 1.0);
        b = Math.min(b + h * 0.95, 1.0);
      }

      lineCol[v * 3] = r;
      lineCol[v * 3 + 1] = g;
      lineCol[v * 3 + 2] = b;
    }

    this.gridLineGeometry.attributes.position.needsUpdate = true;
    this.gridLineGeometry.attributes.color.needsUpdate = true;

    // Update surface mesh geometry
    const surfPos = (this.gridSurfaceGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const surfCount = this.gridSurfaceGeometry.attributes.position.count;
    for (let i = 0; i < surfCount; i++) {
      const sx = surfPos[i * 3];
      const sz = surfPos[i * 3 + 2];

      let pot = 0;
      for (let b = 0; b < bodyCount; b++) {
        const dx = sx - bx[b];
        const dz = sz - bz[b];
        pot += bG_m[b] / Math.sqrt(dx * dx + dz * dz + softeningGridSq);
      }
      let sy = -pot * kVis - 0.08;

      // Add wave ripples to surface sheet
      if (hasWaves) {
        for (let e = 0; e < binaryCount; e++) {
          const em = binaryEmitters[e];
          const er = Math.sqrt((sx - em.bx) ** 2 + (sz - em.bz) ** 2);
          const theta = Math.atan2(sz - em.bz, sx - em.bx);
          const phase = 2 * (theta - em.phi) - (er * 0.38);
          sy += Math.cos(phase) * ((em.amplitude / Math.sqrt(er + 2.5)) * Math.exp(-0.014 * er));
        }
        for (let w = 0; w < waveCount; w++) {
          const burst = this.waveBursts[w];
          const wr = Math.sqrt((sx - burst.x) ** 2 + (sz - burst.z) ** 2);
          const distFromFront = wr - burst.speed * burst.time;
          const packetWidth = burst.wavelength * 2.2;
          if (Math.abs(distFromFront) < packetWidth * 1.8) {
            const envelope = Math.exp(-Math.pow(distFromFront / packetWidth, 2));
            const phase = (distFromFront / burst.wavelength) * Math.PI * 2;
            const temporalDecay = Math.max(0, 1.0 - (burst.time / burst.duration));
            sy += burst.amplitude * envelope * Math.cos(phase) * temporalDecay * (1.0 / Math.sqrt(wr + 2.5)) * this.config.waveIntensity;
          }
        }
      }

      surfPos[i * 3 + 1] = sy;
    }
    this.gridSurfaceGeometry.attributes.position.needsUpdate = true;
    this.gridSurfaceGeometry.computeVertexNormals();
  }

  // Spawns body into simulation
  public addBody(data: CelestialBodyData): BodyInternal {
    const group = new THREE.Group();

    // Generate high-resolution procedural textures
    const textures = CelestialTextureFactory.getTextures(data.type, data.color);

    // Core sphere with realistic textured materials
    let coreMaterial: THREE.Material;
    if (data.type === 'blackhole') {
      coreMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    } else if (data.type === 'star') {
      coreMaterial = new THREE.MeshStandardMaterial({
        map: textures.map,
        emissiveMap: textures.emissiveMap,
        emissive: new THREE.Color(data.color),
        emissiveIntensity: 1.5,
        roughness: 0.15,
        metalness: 0.1,
      });
    } else if (data.type === 'planet') {
      coreMaterial = new THREE.MeshStandardMaterial({
        map: textures.map,
        bumpMap: textures.bumpMap,
        bumpScale: 0.08,
        roughness: 0.6,
        metalness: 0.15,
      });
    } else if (data.type === 'giant') {
      coreMaterial = new THREE.MeshStandardMaterial({
        map: textures.map,
        roughness: 0.75,
        metalness: 0.05,
      });
    } else {
      // moon / asteroid
      coreMaterial = new THREE.MeshStandardMaterial({
        map: textures.map,
        bumpMap: textures.bumpMap,
        bumpScale: 0.16,
        roughness: 0.88,
        metalness: 0.1,
      });
    }

    const sphereGeo = new THREE.SphereGeometry(data.radius, 36, 28);
    const coreMesh = new THREE.Mesh(sphereGeo, coreMaterial);
    group.add(coreMesh);

    // Realistic atmospheres, coronas, and accretion disks
    if (data.type === 'star') {
      // Glowing solar corona
      const glowGeo = new THREE.SphereGeometry(data.radius * 1.55, 32, 24);
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(data.glowColor || data.color),
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      group.add(glowMesh);

      // Light source on stars
      const starLight = new THREE.PointLight(new THREE.Color(data.color), 1.9, 140);
      group.add(starLight);
    } else if (data.type === 'planet') {
      // Atmospheric rim glow shell
      const atmoGeo = new THREE.SphereGeometry(data.radius * 1.07, 32, 24);
      const atmoMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
      group.add(atmoMesh);
    } else if (data.type === 'blackhole') {
      // Multi-layer relativistic accretion disk with Doppler gradient texture
      const diskTexture = CelestialTextureFactory.createAccretionDiskTexture();
      const ringGeo = new THREE.RingGeometry(data.radius * 1.25, data.radius * 3.5, 64);
      ringGeo.rotateX(Math.PI / 2.3);
      const ringMat = new THREE.MeshBasicMaterial({
        map: diskTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      group.add(ringMesh);

      // Inner gravitational photon ring
      const innerGlowGeo = new THREE.SphereGeometry(data.radius * 1.15, 28, 20);
      const innerGlowMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      });
      group.add(new THREE.Mesh(innerGlowGeo, innerGlowMat));
    }

    this.scene.add(group);

    // Orbital trail buffer geometry
    const maxTrail = this.config.trailLength;
    const trailPositions = new Float32Array(maxTrail * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

    const trailColor = data.type === 'star' ? '#f59e0b' : data.type === 'blackhole' ? '#c084fc' : data.color;
    const trailMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(trailColor),
      transparent: true,
      opacity: 0.75,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    this.scene.add(trailLine);

    const body: BodyInternal = {
      id: data.id,
      name: data.name,
      type: data.type,
      mass: data.mass,
      radius: data.radius,
      color: data.color,
      glowColor: data.glowColor || data.color,
      position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
      velocity: new THREE.Vector3(data.velocity.x, data.velocity.y, data.velocity.z),
      acceleration: new THREE.Vector3(0, 0, 0),
      isFixed: !!data.isFixed,
      mesh: group,
      trailLine,
      trailPositions,
      trailCount: 0,
      trailMax: maxTrail,
      trailIndex: 0,
      lastTrailPos: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
    };

    this.bodies.push(body);
    this.updateBodyVisualPosition(body);

    return body;
  }

  private updateBodyVisualPosition(body: BodyInternal) {
    const yDepth = this.config.bodyOnWell ? this.calculatePotential(body.position.x, body.position.z) : 0;
    body.mesh.position.set(body.position.x, yDepth, body.position.z);
  }

  public removeBody(id: string) {
    const idx = this.bodies.findIndex((b) => b.id === id);
    if (idx !== -1) {
      const b = this.bodies[idx];
      this.scene.remove(b.mesh);
      this.scene.remove(b.trailLine);
      b.mesh.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
      b.trailLine.geometry.dispose();
      this.bodies.splice(idx, 1);
      if (this.trackedBodyId === id) this.trackedBodyId = null;
      if (this.selectedBodyId === id) this.selectBody(null);
    }
  }

  public clearAllBodies() {
    for (const b of this.bodies) {
      this.scene.remove(b.mesh);
      this.scene.remove(b.trailLine);
      b.mesh.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
      b.trailLine.geometry.dispose();
    }
    this.bodies = [];
    this.waveBursts = [];
    for (const r of this.expandingRings) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      (r.mesh.material as THREE.Material).dispose();
    }
    this.expandingRings = [];
    this.shockwaves = [];
    this.trackedBodyId = null;
    this.selectBody(null);

    // Cancel active aiming
    this.isAiming = false;
    this.aimPointerId = null;
    this.controls.enabled = true;
    this.aimArrowMesh.visible = false;
    this.aimTrajectoryLine.visible = false;

    // Reset and silence audio drone & gravitational waves
    this.audio.updateCurvatureModulation(0, 0);

    // Instantly reset grid deformation to completely flat (y = 0)
    if (this.gridLineGeometry && this.originalGridCoords) {
      const linePos = (this.gridLineGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const lineCol = (this.gridLineGeometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < this.gridVerticesTotal; i++) {
        linePos[i * 3 + 1] = 0;
        lineCol[i * 3]     = 0.04;
        lineCol[i * 3 + 1] = 0.65;
        lineCol[i * 3 + 2] = 0.92;
      }
      (this.gridLineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.gridLineGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
    if (this.gridSurfaceGeometry) {
      const surfPos = (this.gridSurfaceGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      const surfLen = this.gridSegments * this.gridSegments * 6;
      for (let i = 0; i < surfLen; i++) {
        surfPos[i * 3 + 1] = 0;
      }
      (this.gridSurfaceGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  public selectBody(id: string | null) {
    this.selectedBodyId = id;
    if (this.selectionRing) {
      this.selectionRing.visible = !!id;
    }
  }

  public setBodyMass(id: string, newMass: number) {
    const b = this.bodies.find((item) => item.id === id);
    if (!b) return;
    const clampedMass = Math.max(0.01, newMass);
    b.mass = clampedMass;

    // Dynamically update radius and visual scale
    let newRadius = 1.0;
    if (b.type === 'blackhole') {
      newRadius = Math.max(1.8, Math.min(8.0, 1.8 + Math.log10(Math.max(clampedMass, 1)) * 1.4));
    } else if (b.type === 'star') {
      newRadius = Math.max(1.5, Math.min(7.0, 1.2 + Math.cbrt(clampedMass) * 0.4));
    } else if (b.type === 'giant') {
      newRadius = Math.max(1.0, Math.min(4.0, 0.8 + Math.cbrt(clampedMass) * 0.3));
    } else if (b.type === 'planet') {
      newRadius = Math.max(0.6, Math.min(2.5, 0.5 + Math.cbrt(clampedMass) * 0.25));
    } else if (b.type === 'moon') {
      newRadius = Math.max(0.4, Math.min(1.5, 0.35 + Math.cbrt(clampedMass) * 0.2));
    } else {
      newRadius = Math.max(0.3, Math.min(1.2, 0.2 + Math.cbrt(clampedMass) * 0.15));
    }
    b.radius = newRadius;

    const baseScale = b.type === 'blackhole' ? 3.2 : b.type === 'star' ? 3.2 : b.type === 'giant' ? 1.8 : b.type === 'planet' ? 1.2 : b.type === 'moon' ? 0.75 : 0.45;
    b.mesh.scale.setScalar(newRadius / baseScale);
  }

  public setBodyFixed(id: string, isFixed: boolean) {
    const b = this.bodies.find((item) => item.id === id);
    if (!b) return;
    b.isFixed = isFixed;
    if (isFixed) {
      b.velocity.set(0, 0, 0);
      b.acceleration.set(0, 0, 0);
    }
  }

  public loadPreset(bodiesData: CelestialBodyData[], configOverrides?: Partial<SimulationConfig>) {
    this.clearAllBodies();
    if (configOverrides) {
      Object.assign(this.config, configOverrides);
    }
    for (const b of bodiesData) {
      this.addBody(b);
    }
  }

  private spawnBodyFromPlacement(position: THREE.Vector3, velocity: THREE.Vector3) {
    const id = `body-${Date.now()}`;
    let name = 'Nuevo Cuerpo';
    let mass = 20;
    let radius = 1.2;
    let color = '#38bdf8';
    let glowColor = '#0284c7';

    switch (this.placementType) {
      case 'blackhole':
        name = 'Agujero Negro';
        mass = 2800;
        radius = 3.2;
        color = '#000000';
        glowColor = '#f59e0b';
        break;
      case 'star':
        name = 'Estrella Solar';
        mass = 1000;
        radius = 3.2;
        color = '#f59e0b';
        glowColor = '#fbbf24';
        break;
      case 'giant':
        name = 'Planeta Gigante';
        mass = 80;
        radius = 1.8;
        color = '#818cf8';
        glowColor = '#6366f1';
        break;
      case 'planet':
        name = 'Planeta Terrestre';
        mass = 20;
        radius = 1.2;
        color = '#38bdf8';
        glowColor = '#0ea5e9';
        break;
      case 'moon':
        name = 'Satélite / Luna';
        mass = 4;
        radius = 0.75;
        color = '#cbd5e1';
        glowColor = '#94a3b8';
        break;
      case 'asteroid':
        name = 'Asteroide de Prueba';
        mass = 0.2;
        radius = 0.45;
        color = '#e2e8f0';
        glowColor = '#94a3b8';
        break;
    }

    this.addBody({
      id,
      name,
      type: this.placementType,
      mass,
      radius,
      color,
      glowColor,
      position: { x: position.x, y: 0, z: position.z },
      velocity: { x: velocity.x, y: 0, z: velocity.z },
      isFixed: this.placementFixed,
    });

    // Sound effect on launch
    this.audio.playLaunch(velocity.length(), this.placementType === 'blackhole' || this.placementType === 'star');
  }

  // Physics integration (N-Body Semi-implicit Euler / Symplectic Verlet with sub-stepping)
  private stepPhysics(dt: number) {
    if (this.config.isPaused || this.bodies.length === 0) return;

    const subSteps = 10;
    const subDt = (dt * this.config.timeScale) / subSteps;
    const softeningSq = this.config.softening * this.config.softening;
    const G = this.config.G;

    for (let step = 0; step < subSteps; step++) {
      const count = this.bodies.length;

      // 1. Reset and compute current accelerations
      for (let i = 0; i < count; i++) {
        this.bodies[i].acceleration.set(0, 0, 0);
      }
      for (let i = 0; i < count; i++) {
        const bi = this.bodies[i];
        if (bi.isFixed) continue;

        for (let j = 0; j < count; j++) {
          if (i === j) continue;
          const bj = this.bodies[j];
          const dx = bj.position.x - bi.position.x;
          const dz = bj.position.z - bi.position.z;
          const rSq = dx * dx + dz * dz + softeningSq;
          const dist = Math.sqrt(rSq);
          const force = (G * bj.mass) / (rSq * dist);

          bi.acceleration.x += dx * force;
          bi.acceleration.z += dz * force;
        }
      }

      // 2. Position update: r = r + v*dt + 0.5*a*dt^2
      for (let i = 0; i < count; i++) {
        const bi = this.bodies[i];
        if (bi.isFixed) continue;
        bi.position.x += bi.velocity.x * subDt + 0.5 * bi.acceleration.x * subDt * subDt;
        bi.position.z += bi.velocity.z * subDt + 0.5 * bi.acceleration.z * subDt * subDt;
      }

      // 3. Compute new accelerations at new positions
      const newAccX = new Float32Array(count);
      const newAccZ = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const bi = this.bodies[i];
        if (bi.isFixed) continue;
        for (let j = 0; j < count; j++) {
          if (i === j) continue;
          const bj = this.bodies[j];
          const dx = bj.position.x - bi.position.x;
          const dz = bj.position.z - bi.position.z;
          const rSq = dx * dx + dz * dz + softeningSq;
          const dist = Math.sqrt(rSq);
          const force = (G * bj.mass) / (rSq * dist);
          newAccX[i] += dx * force;
          newAccZ[i] += dz * force;
        }
      }

      // 4. Velocity update: v = v + 0.5*(a_old + a_new)*dt
      for (let i = 0; i < count; i++) {
        const bi = this.bodies[i];
        if (bi.isFixed) continue;

        bi.velocity.x += 0.5 * (bi.acceleration.x + newAccX[i]) * subDt;
        bi.velocity.z += 0.5 * (bi.acceleration.z + newAccZ[i]) * subDt;
        bi.acceleration.x = newAccX[i];
        bi.acceleration.z = newAccZ[i];

        // Perihelion (closest orbital approach / highest curvature well point) detection
        let closestHeavier: BodyInternal | null = null;
        let minDist = Infinity;
        for (let j = 0; j < count; j++) {
          if (i === j) continue;
          const other = this.bodies[j];
          if (other.mass > bi.mass * 1.35) {
            const d = bi.position.distanceTo(other.position);
            if (d < minDist) {
              minDist = d;
              closestHeavier = other;
            }
          }
        }

        if (closestHeavier && minDist < 65) {
          const prevDist = bi.lastDistToClosestMass ?? minDist;
          const now = performance.now();
          if (bi.distTrend === 'decreasing' && minDist > prevDist + 0.04) {
            // Reached minimum distance and now moving away: Perihelion!
            if (!bi.lastPerihelionTime || (now - bi.lastPerihelionTime) > 750) {
              bi.lastPerihelionTime = now;
              const spd = bi.velocity.length();
              this.audio.playPerihelion(Math.min(spd / 6.5, 2.0));
            }
            bi.distTrend = 'increasing';
          } else if (minDist < prevDist - 0.04) {
            bi.distTrend = 'decreasing';
          }
          bi.lastDistToClosestMass = minDist;
        }
      }

      // 4. Collision detection & merging
      let mergedAny = false;
      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          const b1 = this.bodies[i];
          const b2 = this.bodies[j];

          const dx = b2.position.x - b1.position.x;
          const dz = b2.position.z - b1.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          // Physical collision threshold
          if (dist < b1.radius + b2.radius) {
            // Merge smaller into larger
            const primary = b1.mass >= b2.mass ? b1 : b2;
            const secondary = b1.mass >= b2.mass ? b2 : b1;

            const totalMass = primary.mass + secondary.mass;
            // Momentum conservation: v = (m1*v1 + m2*v2) / totalMass
            if (!primary.isFixed) {
              primary.velocity.x = (primary.mass * primary.velocity.x + secondary.mass * secondary.velocity.x) / totalMass;
              primary.velocity.z = (primary.mass * primary.velocity.z + secondary.mass * secondary.velocity.z) / totalMass;
              primary.position.x = (primary.mass * primary.position.x + secondary.mass * secondary.position.x) / totalMass;
              primary.position.z = (primary.mass * primary.position.z + secondary.mass * secondary.position.z) / totalMass;
            }

            primary.mass = totalMass;
            // Volume conservation radius: r_new = (r1^3 + r2^3)^(1/3)
            primary.radius = Math.min(Math.cbrt(Math.pow(primary.radius, 3) + Math.pow(secondary.radius, 3)), 6.0);
            primary.mesh.scale.setScalar(primary.radius / (primary.type === 'blackhole' ? 3.2 : primary.type === 'star' ? 3.2 : 1.2));

            // Spawn collision shockwave
            this.spawnCollisionEffect(primary.position, primary.color, primary.radius);

            // Trigger Gravitational Wave Burst from Merger & Sonic Impact
            const reducedMass = (primary.mass * secondary.mass) / totalMass;
            const waveEnergy = Math.min(reducedMass * 0.08 * this.config.waveIntensity, 8.0);
            this.triggerGravitationalBurst(primary.position.x, primary.position.z, Math.max(waveEnergy, 2.2));
            this.audio.playMerger(waveEnergy);

            // Remove secondary
            this.removeBody(secondary.id);
            mergedAny = true;
            break;
          }
        }
        if (mergedAny) break;
      }
    }
  }

  private spawnCollisionEffect(pos: THREE.Vector3, color: string, radius: number) {
    // Expanding ring
    const ringGeo = new THREE.RingGeometry(radius * 0.8, radius * 1.5, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    const yDepth = this.config.bodyOnWell ? this.calculatePotential(pos.x, pos.z) : 0;
    ringMesh.position.set(pos.x, yDepth + 0.1, pos.z);
    this.scene.add(ringMesh);

    this.expandingRings.push({
      mesh: ringMesh,
      life: 0,
      maxLife: 45,
      growthRate: 0.35 + radius * 0.15,
    });

    // Particle sparks
    const sparkCount = 18;
    for (let k = 0; k < sparkCount; k++) {
      const pGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const pMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(pos.x, yDepth + 0.1, pos.z);
      this.scene.add(pMesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 3.5;
      const vel = new THREE.Vector3(Math.cos(angle) * speed, (Math.random() - 0.2) * 1.5, Math.sin(angle) * speed);

      this.shockwaves.push({
        mesh: pMesh,
        velocity: vel,
        life: 0,
        maxLife: 35 + Math.random() * 20,
      });
    }
  }

  private updateParticles() {
    // Update shockwave rings
    for (let i = this.expandingRings.length - 1; i >= 0; i--) {
      const ring = this.expandingRings[i];
      ring.life++;
      const progress = ring.life / ring.maxLife;
      ring.mesh.scale.addScalar(ring.growthRate);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1.0 - progress);

      if (ring.life >= ring.maxLife) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        (ring.mesh.material as THREE.Material).dispose();
        this.expandingRings.splice(i, 1);
      }
    }

    // Update sparks
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const p = this.shockwaves[i];
      p.life++;
      p.mesh.position.add(p.velocity.clone().multiplyScalar(0.06));
      p.velocity.multiplyScalar(0.96);
      const progress = p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - progress;

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }

  private updateTrails() {
    for (const b of this.bodies) {
      if (!this.config.showTrails) {
        b.trailLine.visible = false;
        continue;
      }
      b.trailLine.visible = true;

      const yDepth = this.config.bodyOnWell ? this.calculatePotential(b.position.x, b.position.z) : 0;
      const curPos = new THREE.Vector3(b.position.x, yDepth, b.position.z);

      // Only add point if moved sufficiently
      if (curPos.distanceTo(b.lastTrailPos) > 0.35) {
        b.lastTrailPos.copy(curPos);

        const positions = b.trailPositions;
        const max = b.trailMax;

        // Shift circular buffer or append
        if (b.trailCount < max) {
          positions[b.trailCount * 3] = curPos.x;
          positions[b.trailCount * 3 + 1] = curPos.y;
          positions[b.trailCount * 3 + 2] = curPos.z;
          b.trailCount++;
        } else {
          // Slide array left
          positions.copyWithin(0, 3, max * 3);
          positions[(max - 1) * 3] = curPos.x;
          positions[(max - 1) * 3 + 1] = curPos.y;
          positions[(max - 1) * 3 + 2] = curPos.z;
        }

        b.trailLine.geometry.attributes.position.needsUpdate = true;
        b.trailLine.geometry.setDrawRange(0, b.trailCount);
      }
    }
  }

  // Camera tracking
  private updateCameraTarget() {
    if (this.trackedBodyId) {
      const b = this.bodies.find((item) => item.id === this.trackedBodyId);
      if (b) {
        const yDepth = this.config.bodyOnWell ? this.calculatePotential(b.position.x, b.position.z) : 0;
        this.controls.target.lerp(new THREE.Vector3(b.position.x, yDepth, b.position.z), 0.08);
      }
    }
  }

  // Center of mass computation for the selected system or entire cosmos
  public getSystemCenterOfMass(): { center: THREE.Vector3; radius: number; totalMass: number } {
    const center = new THREE.Vector3();
    let totalMass = 0;

    if (this.selectedBodyId) {
      const selected = this.bodies.find((b) => b.id === this.selectedBodyId);
      if (selected) {
        const yDepth = this.config.bodyOnWell ? this.calculatePotential(selected.position.x, selected.position.z) : 0;
        center.set(selected.position.x, yDepth, selected.position.z);
        const radius = Math.max(30, selected.radius * 7);
        return { center, radius, totalMass: selected.mass };
      }
    }

    if (this.bodies.length === 0) {
      return { center: new THREE.Vector3(0, 0, 0), radius: 55, totalMass: 0 };
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const b of this.bodies) {
      center.add(b.position.clone().multiplyScalar(b.mass));
      totalMass += b.mass;
      minX = Math.min(minX, b.position.x);
      maxX = Math.max(maxX, b.position.x);
      minZ = Math.min(minZ, b.position.z);
      maxZ = Math.max(maxZ, b.position.z);
    }

    if (totalMass > 0) {
      center.divideScalar(totalMass);
    }
    const yDepth = this.config.bodyOnWell ? this.calculatePotential(center.x, center.z) : 0;
    center.y = yDepth;

    const spreadX = maxX - minX;
    const spreadZ = maxZ - minZ;
    const spread = Math.sqrt(spreadX * spreadX + spreadZ * spreadZ);
    const radius = Math.max(42, Math.min(135, spread * 1.35 + 28));

    return { center, radius, totalMass };
  }

  // Toggles or sets Cinematic Camera orbiting around the system's center of mass
  public setCinematicCamera(enabled: boolean) {
    this.isCinematicCamera = enabled;
    if (this.onCinematicCameraChange) {
      this.onCinematicCameraChange(enabled);
    }

    if (enabled) {
      const { center, radius } = this.getSystemCenterOfMass();
      const dx = this.camera.position.x - center.x;
      const dz = this.camera.position.z - center.z;
      this.cinematicAngle = Math.atan2(dz, dx);

      const targetX = center.x + radius * Math.cos(this.cinematicAngle);
      const targetZ = center.z + radius * Math.sin(this.cinematicAngle);
      const targetY = center.y + radius * 0.45;

      if (this.activeCameraTween) {
        this.activeCameraTween.kill();
      }

      // Smoothly ease camera target with GSAP to eliminate jarring cuts
      gsap.to(this.controls.target, {
        x: center.x,
        y: center.y,
        z: center.z,
        duration: 1.8,
        ease: 'power2.inOut',
      });

      // Smoothly interpolate camera position with GSAP to orbit path
      this.activeCameraTween = gsap.to(this.camera.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 1.8,
        ease: 'power2.inOut',
        onComplete: () => {
          this.activeCameraTween = null;
        },
      });
    } else {
      if (this.activeCameraTween) {
        this.activeCameraTween.kill();
        this.activeCameraTween = null;
      }
    }
  }

  public setCameraView(view: 'free' | 'top' | 'side' | 'isometric' | 'cinematic') {
    if (view === 'cinematic') {
      this.setCinematicCamera(true);
      return;
    }

    if (this.isCinematicCamera) {
      this.setCinematicCamera(false);
    }

    let targetPos = new THREE.Vector3(0, 52, 75);
    let targetLook = new THREE.Vector3(0, -2, 0);

    switch (view) {
      case 'top':
        targetPos.set(0, 95, 0.01);
        targetLook.set(0, 0, 0);
        break;
      case 'side':
        targetPos.set(0, 8, 90);
        targetLook.set(0, -6, 0);
        break;
      case 'isometric':
        targetPos.set(65, 55, 65);
        targetLook.set(0, -2, 0);
        break;
      case 'free':
      default:
        targetPos.set(0, 52, 75);
        targetLook.set(0, -2, 0);
        break;
    }

    if (this.activeCameraTween) {
      this.activeCameraTween.kill();
    }

    // GSAP smooth camera glide for preset changes
    gsap.to(this.controls.target, {
      x: targetLook.x,
      y: targetLook.y,
      z: targetLook.z,
      duration: 1.5,
      ease: 'power2.inOut',
    });

    this.activeCameraTween = gsap.to(this.camera.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onComplete: () => {
        this.activeCameraTween = null;
      },
    });
  }

  // Energy & Metrics computation
  private computeMetrics() {
    let kinetic = 0;
    let potential = 0;
    const barycenter = new THREE.Vector3();
    let totalMass = 0;

    const count = this.bodies.length;
    for (let i = 0; i < count; i++) {
      const b = this.bodies[i];
      const speedSq = b.velocity.lengthSq();
      kinetic += 0.5 * b.mass * speedSq;

      barycenter.add(b.position.clone().multiplyScalar(b.mass));
      totalMass += b.mass;

      for (let j = i + 1; j < count; j++) {
        const bj = this.bodies[j];
        const dist = b.position.distanceTo(bj.position) + this.config.softening;
        potential -= (this.config.G * b.mass * bj.mass) / dist;
      }
    }

    if (totalMass > 0) {
      barycenter.divideScalar(totalMass);
    }

    if (this.onStatsUpdate) {
      this.onStatsUpdate({
        activeBodies: count,
        fps: this.currentFps,
        kineticEnergy: kinetic,
        potentialEnergy: potential,
        totalEnergy: kinetic + potential,
        barycenter,
        waveStrain: this.currentWaveStrain,
        activeBursts: this.waveBursts.length,
      });
    }
  }

  public resetSimulation() {
    this.clearAllBodies();
  }

  private animate() {
    if (this.isDestroyed) return;

    requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.06);
    this.lastTime = now;

    // FPS calculation
    this.frameCount++;
    if (now - this.fpsLastTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsLastTime));
      this.frameCount = 0;
      this.fpsLastTime = now;
    }

    // Step physics
    this.stepPhysics(dt);

    // Update body visual representations
    for (const b of this.bodies) {
      this.updateBodyVisualPosition(b);
      // Subtle rotation of spheres
      b.mesh.rotation.y += 0.008;
    }

    // Update dynamic spacetime mesh curvature & gravitational waves
    this.updateGridDeformation(dt);

    // Update orbital trails
    this.updateTrails();

    // Update collision particles
    this.updateParticles();

    // Camera follow or cinematic smooth orbit around center of mass
    if (this.isCinematicCamera) {
      this.cinematicAngle += 0.25 * dt;
      const { center, radius } = this.getSystemCenterOfMass();
      const altitude = center.y + radius * (0.42 + 0.12 * Math.sin(this.cinematicAngle * 0.7));
      const targetCamX = center.x + radius * Math.cos(this.cinematicAngle);
      const targetCamZ = center.z + radius * Math.sin(this.cinematicAngle);

      if (!this.activeCameraTween) {
        this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 0.05);
        this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, altitude, 0.05);
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, 0.05);
        this.controls.target.lerp(center, 0.06);
      } else {
        this.controls.target.lerp(center, 0.04);
      }
    } else {
      this.updateCameraTarget();
    }

    // Dynamic starfield & cosmic dust layers with stereoscopic parallax reacting to camera motion
    if (this.starsFieldFar && this.starsFieldMid && this.cosmicDustNear) {
      const camX = this.camera.position.x;
      const camY = this.camera.position.y;
      const camZ = this.camera.position.z;

      // Far cosmic background: very subtle shift & slow cosmic drift
      this.starsFieldFar.position.set(-camX * 0.015, -camY * 0.015, -camZ * 0.015);
      this.starsFieldFar.rotation.y += 0.00008;

      // Mid-depth starfield: moderate parallax shift & gentle cosmic rotation
      this.starsFieldMid.position.set(-camX * 0.065, -camY * 0.065, -camZ * 0.065);
      this.starsFieldMid.rotation.y += 0.00022;

      // Near cosmic dust: strong parallax shift reacting dynamically to camera angles
      this.cosmicDustNear.position.set(-camX * 0.2, -camY * 0.2, -camZ * 0.2);
      this.cosmicDustNear.rotation.y += 0.00045;
      this.cosmicDustNear.rotation.x += 0.00018;
    }

    // Selection ring tracking on active body
    if (this.selectedBodyId && this.selectionRing) {
      const selBody = this.bodies.find((b) => b.id === this.selectedBodyId);
      if (selBody) {
        this.selectionRing.visible = true;
        const yDepth = this.config.bodyOnWell ? this.calculatePotential(selBody.position.x, selBody.position.z) : 0;
        this.selectionRing.position.set(selBody.position.x, yDepth + 0.15, selBody.position.z);
        this.selectionRing.scale.setScalar(Math.max(selBody.radius * 1.45, 1.2));
        this.selectionRing.rotation.z += 0.025;
      } else {
        this.selectionRing.visible = false;
        this.selectedBodyId = null;
      }
    } else if (this.selectionRing) {
      this.selectionRing.visible = false;
    }

    // Update controls & render
    this.controls.update();

    if (this.config.bloomEnabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Stats emission
    this.computeMetrics();
  }

  public destroy() {
    this.isDestroyed = true;
    const dom = this.renderer.domElement;
    if (dom) {
      dom.removeEventListener('pointerdown', this.boundOnPointerDown);
    }
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('pointercancel', this.boundOnPointerCancel);
    window.removeEventListener('resize', this.boundOnResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.clearAllBodies();
    if (this.composer) {
      this.composer.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
