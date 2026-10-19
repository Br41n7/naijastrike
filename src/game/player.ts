/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CollisionSystem } from './collision.ts';
import { InputState, PlayerStats } from './types.ts';
import { soundSystem } from './audio.ts';

// Pre-allocated math helpers outside the animation loop to ensure zero GC in render loop
const _moveDir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _nextPos = new THREE.Vector3();

export class Player {
  public group: THREE.Group = new THREE.Group();
  public stats: PlayerStats = {
    health: 100,
    maxHealth: 100,
    armor: 75,
    maxArmor: 100,
    stamina: 100,
    maxStamina: 100,
    ammo: 30,
    maxAmmo: 30,
    isReloading: false,
    score: 0,
    targetsHit: 0,
    totalTargets: 6,
    speed: 0,
    isGrounded: true,
  };

  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 10);
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotationY: number = 0; // In radians

  // Procedural character sub-parts
  private upperBody: THREE.Group = new THREE.Group();
  private head: THREE.Group = new THREE.Group();
  private leftLeg: THREE.Group = new THREE.Group();
  private rightLeg: THREE.Group = new THREE.Group();
  private leftArm: THREE.Group = new THREE.Group();
  private rightArm: THREE.Group = new THREE.Group();
  private weapon: THREE.Group = new THREE.Group();
  private muzzleFlash: THREE.PointLight;
  private muzzleSprite: THREE.Mesh;
  private shadowDecal: THREE.Mesh;

  // Animation states
  private animTimer = 0;
  private footstepTimer = 0;
  private fireCooldown = 0;
  private reloadTimer = 0;
  private recoilPulse = 0;

  // Constants
  public readonly radius = 0.45;
  public readonly height = 1.8;
  private readonly walkSpeed = 6.2;
  private readonly sprintSpeed = 10.4;
  private readonly jumpForce = 8.8;
  private readonly gravity = 22.0;
  private readonly fireRate = 0.12; // ~8.3 rounds/sec

  constructor(private collision: CollisionSystem) {
    this.muzzleFlash = new THREE.PointLight(0xf59e0b, 0, 8);
    this.muzzleSprite = this.createMuzzleSprite();
    this.shadowDecal = this.createShadowDecal();

    this.buildCharacterMesh();
    this.group.position.copy(this.position);
  }

  private createMuzzleSprite(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(0.12, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0,
    });
    return new THREE.Mesh(geo, mat);
  }

  private createShadowDecal(): THREE.Mesh {
    const geo = new THREE.CircleGeometry(0.55, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(geo, mat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    return shadow;
  }

  /**
   * Builds procedural 12-part stylized tactical hero:
   * Torso, tactical vest, head with glowing visor, arms, legs, weapon carbine, shadow
   */
  private buildCharacterMesh() {
    const tacticalGreenMat = new THREE.MeshStandardMaterial({
      color: 0x065f46, // Deep Nigerian tactical green
      roughness: 0.65,
      metalness: 0.2,
    });

    const tacticalBlackMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.7,
      metalness: 0.4,
    });

    const armorPlatesMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.4,
      metalness: 0.7,
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x543625, // Deep rich skin tone
      roughness: 0.8,
      metalness: 0.05,
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4, // Cyan tactical optics visor
      emissive: 0x0891b2,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.8,
    });

    // 1. Pelvis / Hips (pivot for legs)
    const hipsGeo = new THREE.BoxGeometry(0.48, 0.22, 0.32);
    const hips = new THREE.Mesh(hipsGeo, tacticalBlackMat);
    hips.position.y = 0.95;
    hips.castShadow = true;
    this.group.add(hips);

    // 2. Upper Body Group (spine, chest, head, arms)
    this.upperBody.position.y = 0.95;

    // Torso / tactical vest
    const torsoGeo = new THREE.BoxGeometry(0.52, 0.46, 0.36);
    const torso = new THREE.Mesh(torsoGeo, tacticalGreenMat);
    torso.position.y = 0.28;
    torso.castShadow = true;
    this.upperBody.add(torso);

    // Chest armor plate with golden accent
    const chestPlateGeo = new THREE.BoxGeometry(0.44, 0.32, 0.1);
    const chestPlate = new THREE.Mesh(chestPlateGeo, armorPlatesMat);
    chestPlate.position.set(0, 0.32, 0.16);
    this.upperBody.add(chestPlate);

    // Tactical pouches on belt
    const pouchMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 });
    const pouch1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), pouchMat);
    pouch1.position.set(-0.16, 0.05, 0.18);
    this.upperBody.add(pouch1);

    const pouch2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.08), pouchMat);
    pouch2.position.set(0.16, 0.05, 0.18);
    this.upperBody.add(pouch2);

    // 3. Head & Helmet
    this.head.position.y = 0.58;

    // Tactical helmet
    const helmetGeo = new THREE.BoxGeometry(0.36, 0.34, 0.36);
    const helmet = new THREE.Mesh(helmetGeo, tacticalGreenMat);
    helmet.castShadow = true;
    this.head.add(helmet);

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.32, 0.12, 0.08);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.02, 0.16);
    this.head.add(visor);

    // Comms headset antenna
    const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.25);
    const antenna = new THREE.Mesh(antennaGeo, tacticalBlackMat);
    antenna.position.set(-0.19, 0.12, -0.05);
    antenna.rotation.z = -0.15;
    this.head.add(antenna);

    this.upperBody.add(this.head);

    // 4. Arms
    // Left Arm
    this.leftArm.position.set(-0.35, 0.42, 0);
    const lPauldron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.2), armorPlatesMat);
    lPauldron.position.y = -0.06;
    this.leftArm.add(lPauldron);
    const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), tacticalGreenMat);
    lForearm.position.y = -0.28;
    this.leftArm.add(lForearm);
    this.upperBody.add(this.leftArm);

    // Right Arm (holds weapon)
    this.rightArm.position.set(0.35, 0.42, 0);
    const rPauldron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.2), armorPlatesMat);
    rPauldron.position.y = -0.06;
    this.rightArm.add(rPauldron);
    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), tacticalGreenMat);
    rForearm.position.y = -0.28;
    this.rightArm.add(rForearm);
    this.upperBody.add(this.rightArm);

    // 5. Tactical Carbine Weapon
    this.weapon = this.buildWeapon();
    this.weapon.position.set(0.24, 0.18, 0.35);
    this.weapon.rotation.x = -Math.PI / 16;
    this.upperBody.add(this.weapon);

    this.group.add(this.upperBody);

    // 6. Legs
    // Left Leg
    this.leftLeg.position.set(-0.16, 0.95, 0);
    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.2), tacticalBlackMat);
    lThigh.position.y = -0.24;
    lThigh.castShadow = true;
    this.leftLeg.add(lThigh);
    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.26), armorPlatesMat);
    lBoot.position.set(0, -0.68, 0.03);
    lBoot.castShadow = true;
    this.leftLeg.add(lBoot);
    this.group.add(this.leftLeg);

    // Right Leg
    this.rightLeg.position.set(0.16, 0.95, 0);
    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.2), tacticalBlackMat);
    rThigh.position.y = -0.24;
    rThigh.castShadow = true;
    this.rightLeg.add(rThigh);
    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.26), armorPlatesMat);
    rBoot.position.set(0, -0.68, 0.03);
    rBoot.castShadow = true;
    this.rightLeg.add(rBoot);
    this.group.add(this.rightLeg);

    // 7. Ground shadow decal
    this.group.add(this.shadowDecal);
  }

  private buildWeapon(): THREE.Group {
    const wGroup = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.85,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x047857, // Green receiver shroud
      roughness: 0.4,
      metalness: 0.5,
    });

    // Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.52), gunMat);
    wGroup.add(body);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.38);
    wGroup.add(barrel);

    // Shroud
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.22), accentMat);
    shroud.position.set(0, 0.02, 0.22);
    wGroup.add(shroud);

    // Curved Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.12), gunMat);
    mag.position.set(0, -0.16, 0.08);
    mag.rotation.x = -0.25;
    wGroup.add(mag);

    // Tactical Holographic Optic Sight
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.14), gunMat);
    sight.position.set(0, 0.11, -0.04);
    wGroup.add(sight);

    // Muzzle light & flash sprite at barrel tip
    this.muzzleFlash.position.set(0, 0.02, 0.6);
    wGroup.add(this.muzzleFlash);

    this.muzzleSprite.position.set(0, 0.02, 0.6);
    wGroup.add(this.muzzleSprite);

    return wGroup;
  }

  /**
   * Main physics & animation update
   */
  public update(delta: number, input: InputState, cameraYaw: number) {
    // 1. Process Timers
    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }
    if (this.recoilPulse > 0) {
      this.recoilPulse -= delta * 12;
      if (this.recoilPulse < 0) this.recoilPulse = 0;
    }

    // Muzzle flash decay
    if (this.muzzleFlash.intensity > 0) {
      this.muzzleFlash.intensity = Math.max(0, this.muzzleFlash.intensity - delta * 35);
      const spriteMat = this.muzzleSprite.material as THREE.MeshBasicMaterial;
      spriteMat.opacity = Math.max(0, spriteMat.opacity - delta * 20);
    }

    // Reload logic
    if (this.stats.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.stats.isReloading = false;
        this.stats.ammo = this.stats.maxAmmo;
      }
    } else if (input.reload && this.stats.ammo < this.stats.maxAmmo) {
      this.startReload();
    }

    // 2. Sprint & Stamina
    const wantsSprint = input.sprint && input.forward > 0.1 && this.stats.stamina > 5;
    const currentSpeed = wantsSprint ? this.sprintSpeed : this.walkSpeed;

    if (wantsSprint) {
      this.stats.stamina = Math.max(0, this.stats.stamina - delta * 18);
    } else {
      this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina + delta * 12);
    }

    // 3. Horizontal Movement Calculation
    // Camera-relative forward and right vectors
    _forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw)).normalize();
    _right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).normalize();

    _moveDir.set(0, 0, 0);
    if (Math.abs(input.forward) > 0.05 || Math.abs(input.strafe) > 0.05) {
      _moveDir.addScaledVector(_forward, input.forward);
      _moveDir.addScaledVector(_right, input.strafe);
      if (_moveDir.lengthSq() > 1) {
        _moveDir.normalize();
      }
    }

    const isMoving = _moveDir.lengthSq() > 0.01;
    this.stats.speed = isMoving ? currentSpeed : 0;

    // Smooth character rotation: align facing with camera yaw (when moving or aiming)
    if (isMoving) {
      // Rotate character smoothly towards movement or camera facing
      const targetRotation = Math.atan2(_moveDir.x, _moveDir.z);
      // Smooth interpolation of rotation
      this.rotationY = THREE.MathUtils.damp(this.rotationY, targetRotation, 14, delta);
    } else {
      // Idle: face camera forward
      this.rotationY = THREE.MathUtils.damp(this.rotationY, cameraYaw + Math.PI, 8, delta);
    }
    this.group.rotation.y = this.rotationY;

    // 4. Vertical Physics (Jumping & Gravity)
    if (this.stats.isGrounded) {
      if (input.jump && this.stats.stamina >= 10) {
        this.velocity.y = this.jumpForce;
        this.stats.isGrounded = false;
        this.stats.stamina -= 10;
        soundSystem.playJump();
      } else {
        this.velocity.y = 0;
      }
    } else {
      this.velocity.y -= this.gravity * delta;
    }

    // 5. Collision & Position Update
    const moveX = _moveDir.x * currentSpeed * delta;
    const moveZ = _moveDir.z * currentSpeed * delta;
    _nextPos.set(moveX, 0, moveZ);

    // Resolve horizontal obstacle collisions with wall sliding
    const resolvedPos = this.collision.resolveMovement(this.position, _nextPos, this.radius, this.height);
    this.position.x = resolvedPos.x;
    this.position.z = resolvedPos.z;

    // Vertical move
    this.position.y += this.velocity.y * delta;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.stats.isGrounded = true;
    }

    this.group.position.copy(this.position);

    // Ground shadow keeps aligned with floor
    this.shadowDecal.position.y = 0.02 - this.position.y;

    // 6. Procedural Animations
    this.updateProceduralAnimation(delta, isMoving, wantsSprint);

    // 7. Footstep Audio
    if (isMoving && this.stats.isGrounded) {
      this.footstepTimer += delta * (wantsSprint ? 1.5 : 1.0);
      if (this.footstepTimer > 0.36) {
        soundSystem.playFootstep();
        this.footstepTimer = 0;
      }
    } else {
      this.footstepTimer = 0.3;
    }
  }

  private updateProceduralAnimation(delta: number, isMoving: boolean, isSprinting: boolean) {
    if (isMoving && this.stats.isGrounded) {
      const freq = isSprinting ? 14 : 9;
      this.animTimer += delta * freq;

      const legAngle = Math.sin(this.animTimer) * 0.65;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;

      const armAngle = Math.cos(this.animTimer) * 0.45;
      this.leftArm.rotation.x = armAngle;
      this.rightArm.rotation.x = -armAngle * 0.5;

      // Slight bobbing of upper body
      this.upperBody.position.y = 0.95 + Math.abs(Math.sin(this.animTimer * 2)) * 0.06;
      this.upperBody.rotation.x = isSprinting ? 0.2 : 0.05; // Forward lean
    } else if (!this.stats.isGrounded) {
      // In air: tuck legs slightly
      this.leftLeg.rotation.x = -0.3;
      this.rightLeg.rotation.x = 0.4;
      this.leftArm.rotation.x = -0.5;
      this.upperBody.position.y = 0.95;
      this.upperBody.rotation.x = 0;
    } else {
      // Idle breathing sway
      this.animTimer += delta * 2;
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, 0, 10, delta);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, 0, 10, delta);
      this.leftArm.rotation.x = THREE.MathUtils.damp(this.leftArm.rotation.x, 0, 10, delta);
      this.rightArm.rotation.x = THREE.MathUtils.damp(this.rightArm.rotation.x, 0, 10, delta);

      this.upperBody.position.y = 0.95 + Math.sin(this.animTimer) * 0.015;
      this.upperBody.rotation.x = 0;
    }

    // Weapon recoil kick
    this.weapon.position.z = 0.35 - this.recoilPulse * 0.08;
    this.weapon.rotation.x = -Math.PI / 16 + this.recoilPulse * 0.15;
  }

  public canFire(): boolean {
    return this.fireCooldown <= 0 && !this.stats.isReloading && this.stats.ammo > 0;
  }

  /**
   * Fires weapon: returns weapon tip world position for tracer calculation
   */
  public fire(): THREE.Vector3 | null {
    if (this.stats.isReloading) return null;

    if (this.stats.ammo <= 0) {
      soundSystem.playEmptyClick();
      this.startReload();
      return null;
    }

    this.stats.ammo--;
    this.fireCooldown = this.fireRate;
    this.recoilPulse = 1.0;

    // Trigger muzzle flash
    this.muzzleFlash.intensity = 4.0;
    const spriteMat = this.muzzleSprite.material as THREE.MeshBasicMaterial;
    spriteMat.opacity = 1.0;

    soundSystem.playShoot();

    // Get weapon tip world position
    const tip = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(tip);
    return tip;
  }

  public startReload() {
    if (this.stats.isReloading || this.stats.ammo === this.stats.maxAmmo) return;
    this.stats.isReloading = true;
    this.reloadTimer = 1.2;
    soundSystem.playReload();
  }

  public takeDamage(amount: number) {
    if (this.stats.armor > 0) {
      const absorbed = Math.min(this.stats.armor, amount * 0.7);
      this.stats.armor -= absorbed;
      this.stats.health = Math.max(0, this.stats.health - (amount - absorbed));
    } else {
      this.stats.health = Math.max(0, this.stats.health - amount);
    }
  }

  public respawn() {
    this.position.set(0, 0, 10);
    this.velocity.set(0, 0, 0);
    this.stats.health = this.stats.maxHealth;
    this.stats.armor = this.stats.maxArmor;
    this.stats.stamina = this.stats.maxStamina;
    this.stats.ammo = this.stats.maxAmmo;
    this.stats.isReloading = false;
    this.group.position.copy(this.position);
  }
}
