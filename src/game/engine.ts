/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Arena } from './arena.ts';
import { Player } from './player.ts';
import { ThirdPersonCamera } from './camera.ts';
import { CollisionSystem } from './collision.ts';
import { InputManager } from './input.ts';
import { BulletTracer, HitParticle, PlayerStats, EnemyData } from './types.ts';
import { soundSystem } from './audio.ts';
import { EnemyManager } from './enemies.ts';

// Pre-allocated vectors for frame tick
const _crosshairRay = new THREE.Ray();
const _camWorldPos = new THREE.Vector3();
const _fireOrigin = new THREE.Vector3();
const _fireDir = new THREE.Vector3();

export class GameEngine {
  public scene: THREE.Scene;
  public cameraController: ThirdPersonCamera;
  public renderer: THREE.WebGLRenderer;
  public collision: CollisionSystem;
  public arena: Arena;
  public enemyManager: EnemyManager;
  public player: Player;
  public input: InputManager;

  private clock: THREE.Clock;
  private animFrameId: number | null = null;
  private isPaused = false;
  private isDestroyed = false;

  // Visual effects
  private bulletTracers: BulletTracer[] = [];
  private tracerMaterial: THREE.LineBasicMaterial;
  private hitParticles: HitParticle[] = [];
  private particlePoints: THREE.Points;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.PointsMaterial;
  private particlePositions: Float32Array;
  private particleColors: Float32Array;
  private readonly maxParticles = 200;

  // React callbacks
  public onStatsUpdate?: (stats: PlayerStats) => void;
  public onHitFeedback?: (info: { isTarget: boolean; damage: number; headshot: boolean; targetHp?: number }) => void;

  constructor(private container: HTMLElement) {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd4a373); // Warm sun haze
    this.scene.fog = new THREE.FogExp2(0xd4a373, 0.012);

    // 2. Collision & Systems
    this.collision = new CollisionSystem();
    this.input = new InputManager();
    this.arena = new Arena(this.collision);
    this.scene.add(this.arena.group);

    this.enemyManager = new EnemyManager(this.collision);
    this.scene.add(this.enemyManager.group);

    this.player = new Player(this.collision);
    this.scene.add(this.player.group);

    // 3. Camera
    this.cameraController = new ThirdPersonCamera(width / height, this.collision);

    // 4. Renderer with optimal settings
    const isHeadless = typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: !isHeadless,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Procedural RoomEnvironment for realistic PBR reflections
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {
      // Fallback gracefully
    }

    // 5. Lighting Rig
    this.setupLighting();

    // 6. Particles & FX Setup
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });

    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    this.particleMat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.particlePoints = new THREE.Points(this.particleGeo, this.particleMat);
    this.scene.add(this.particlePoints);

    // 7. Clock and lifecycle
    this.clock = new THREE.Clock();

    // Pre-warm shaders
    this.renderer.compile(this.scene, this.cameraController.camera);

    // Attach inputs
    this.input.attach(this.renderer.domElement);

    // Bind event listeners
    this.handleResize = this.handleResize.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Start render loop
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  private setupLighting() {
    // Warm Key Sun Light
    const sun = new THREE.DirectionalLight(0xfff3d6, 2.4);
    sun.position.set(30, 45, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    const d = 42;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    // Cool Sky / Warm Earth Fill Light
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x92400e, 0.9);
    this.scene.add(hemiLight);

    // Ambient soft lift
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);
  }

  public handleResize() {
    if (this.isDestroyed || !this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.cameraController.setAspect(width / height);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  private handleVisibilityChange() {
    if (document.hidden) {
      this.isPaused = true;
      this.input.resetAll();
    } else {
      this.isPaused = false;
      this.clock.getDelta(); // Clear delta accumulation
    }
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.input.resetAll();
      this.input.exitPointerLock();
    } else {
      this.clock.getDelta();
    }
  }

  public getPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Main simulation frame tick
   */
  private tick() {
    if (this.isDestroyed) return;

    this.animFrameId = requestAnimationFrame(this.tick);

    if (this.isPaused) return;

    // Clamp delta time to avoid large physics steps
    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);

    // 1. Process Inputs
    const currentInput = this.input.update();
    const { dx, dy } = this.input.consumeLookDeltas();

    // 2. Rotate Camera
    this.cameraController.rotate(dx, dy);

    // 3. Update Player with camera yaw reference
    this.player.update(delta, currentInput, this.cameraController.yaw);

    // 4. Handle Weapon Fire Action
    if (currentInput.fire && this.player.canFire()) {
      this.processWeaponFire();
    }

    // 5. Update Camera follow position
    this.cameraController.update(this.player.position, delta);

    // 6. Update Arena targets & reactive props
    this.arena.update(delta);

    // 7. Update Enemy actors AI, positions, and collider synchronization
    this.enemyManager.update(delta, this.player.position);

    // 8. Update FX (Tracers & Sparks)
    this.updateBulletTracers(delta);
    this.updateHitParticles(delta);

    // 9. Render scene
    this.renderer.render(this.scene, this.cameraController.camera);

    // 10. Dispatch state to React HUD
    if (this.onStatsUpdate) {
      this.onStatsUpdate({ ...this.player.stats });
    }
  }

  /**
   * Raycast from crosshair (camera center) and spawn visual tracer from weapon muzzle
   */
  private processWeaponFire() {
    const muzzleTip = this.player.fire();
    if (!muzzleTip) return;

    // Trigger subtle camera recoil kick
    this.cameraController.triggerShake(0.12);

    // Camera ray from center of screen (crosshair)
    _camWorldPos.set(0, 0, 0);
    this.cameraController.camera.getWorldPosition(_camWorldPos);
    const camDir = this.cameraController.getForwardDirection();

    _crosshairRay.set(_camWorldPos, camDir);
    const result = this.collision.raycastBullet(_crosshairRay, 80);

    // Weapon tracer starts at gun barrel and travels to hit point
    _fireOrigin.copy(muzzleTip);
    _fireDir.copy(result.point).sub(_fireOrigin).normalize();

    this.spawnTracer(_fireOrigin, result.point);

    if (result.hit) {
      this.spawnHitParticles(result.point, result.isTarget);

      if (result.isTarget && result.collider) {
        const isHeadshot = result.point.y > 1.6;
        const damage = isHeadshot ? 70 : 35;
        let destroyed = false;

        if (result.collider.id.startsWith('enemy_')) {
          const hitRes = this.enemyManager.registerHit(result.collider.id, damage);
          destroyed = hitRes.killed;
          if (hitRes.hit) {
            this.player.stats.score += isHeadshot ? 200 : 100;
            if (destroyed) {
              this.player.stats.score += 250;
              this.player.stats.targetsHit++;
            }
          }
        } else {
          destroyed = this.arena.registerTargetHit(result.collider.id, damage);
          this.player.stats.score += isHeadshot ? 150 : 75;
          if (destroyed) {
            this.player.stats.targetsHit++;
          }
        }

        soundSystem.playHit(isHeadshot);

        if (this.onHitFeedback) {
          this.onHitFeedback({
            isTarget: true,
            damage,
            headshot: isHeadshot,
            targetHp: result.collider.targetHp,
          });
        }
      }
    }
  }

  /**
   * Returns tracked enemy data with distances to player
   */
  public getEnemyData(maxDistance = 32): EnemyData[] {
    return this.enemyManager.getEnemyData(this.player.position, maxDistance);
  }

  /**
   * Returns only enemies within the specified distance from the player
   */
  public getEnemiesInRange(maxDistance = 32): EnemyData[] {
    return this.enemyManager.getEnemyData(this.player.position, maxDistance).filter((e) => e.isInRadarRange);
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const points = [start.clone(), end.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, this.tracerMaterial);
    this.scene.add(line);

    this.bulletTracers.push({
      start: start.clone(),
      end: end.clone(),
      life: 0.08,
      maxLife: 0.08,
      color: new THREE.Color(0xfde047),
      beamMesh: line,
    });
  }

  private updateBulletTracers(delta: number) {
    for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
      const tracer = this.bulletTracers[i];
      tracer.life -= delta;
      if (tracer.life <= 0) {
        if (tracer.beamMesh) {
          this.scene.remove(tracer.beamMesh);
          (tracer.beamMesh as THREE.Line).geometry.dispose();
        }
        this.bulletTracers.splice(i, 1);
      }
    }
  }

  private spawnHitParticles(pos: THREE.Vector3, isTarget: boolean) {
    const count = isTarget ? 14 : 7;
    const baseColor = isTarget ? new THREE.Color(0xef4444) : new THREE.Color(0xf59e0b);

    for (let i = 0; i < count; i++) {
      if (this.hitParticles.length >= this.maxParticles) {
        this.hitParticles.shift();
      }

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4.5,
        Math.random() * 3.5 + 0.5,
        (Math.random() - 0.5) * 4.5
      );

      this.hitParticles.push({
        position: pos.clone(),
        velocity: vel,
        color: baseColor.clone().offsetHSL((Math.random() - 0.5) * 0.1, 0, 0),
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.45,
        size: 0.15,
      });
    }
  }

  private updateHitParticles(delta: number) {
    const posAttr = this.particleGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.particleGeo.getAttribute('color') as THREE.BufferAttribute;

    let activeCount = 0;

    for (let i = this.hitParticles.length - 1; i >= 0; i--) {
      const p = this.hitParticles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.hitParticles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= 12 * delta; // gravity
      p.position.addScaledVector(p.velocity, delta);

      const idx = activeCount * 3;
      this.particlePositions[idx] = p.position.x;
      this.particlePositions[idx + 1] = p.position.y;
      this.particlePositions[idx + 2] = p.position.z;

      const alpha = p.life / p.maxLife;
      this.particleColors[idx] = p.color.r * alpha;
      this.particleColors[idx + 1] = p.color.g * alpha;
      this.particleColors[idx + 2] = p.color.b * alpha;

      activeCount++;
    }

    // Zero out unused
    for (let i = activeCount; i < this.maxParticles; i++) {
      const idx = i * 3;
      this.particlePositions[idx] = 0;
      this.particlePositions[idx + 1] = -1000;
      this.particlePositions[idx + 2] = 0;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  /**
   * Safe disposal of all resources
   */
  public dispose() {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }

    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.input.detach();

    // Clean up tracers
    for (const tracer of this.bulletTracers) {
      if (tracer.beamMesh) {
        this.scene.remove(tracer.beamMesh);
        (tracer.beamMesh as THREE.Line).geometry.dispose();
      }
    }
    this.bulletTracers = [];

    // Traverse scene and dispose meshes
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });

    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
