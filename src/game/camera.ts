/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CollisionSystem } from './collision.ts';

// Pre-allocated vectors for camera calculations
const _targetPos = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  public yaw = 0; // Horizontal orbit angle (radians)
  public pitch = 0.18; // Vertical pitch angle (radians)

  public distance = 3.8;
  public shoulderOffset = 0.55; // Right shoulder (+), left shoulder (-)
  public targetHeight = 1.45; // Follow point (torso/head height)

  // Screen shake
  public shakeIntensity = 0;

  // Clamps
  private readonly minPitch = -0.85; // ~ -49 deg
  private readonly maxPitch = 1.15;  // ~ 65 deg
  private readonly minDistance = 1.0;

  constructor(aspect: number, private collision: CollisionSystem) {
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
    this.camera.position.set(0, 3, 15);
  }

  public setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public rotate(deltaYaw: number, deltaPitch: number) {
    this.yaw -= deltaYaw;
    this.pitch -= deltaPitch;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
  }

  public triggerShake(intensity = 0.15) {
    this.shakeIntensity = Math.min(0.4, this.shakeIntensity + intensity);
  }

  public setShoulder(side: 'right' | 'left') {
    this.shoulderOffset = side === 'right' ? 0.55 : -0.55;
  }

  /**
   * Smoothly updates camera position and look target
   */
  public update(playerPos: THREE.Vector3, delta: number) {
    // 1. Decay shake
    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - delta * 2.8);
    }
    const shakeX = (Math.random() * 2 - 1) * this.shakeIntensity * 0.1;
    const shakeY = (Math.random() * 2 - 1) * this.shakeIntensity * 0.1;

    // 2. Base target (player chest height)
    _targetPos.copy(playerPos);
    _targetPos.y += this.targetHeight;

    // 3. Compute spherical offset with shoulder offset
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // Backward vector from player
    const backX = sinYaw * cosPitch;
    const backY = sinPitch;
    const backZ = cosYaw * cosPitch;

    // Right vector for shoulder offset
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    // Desired ideal camera position
    _desiredPos.set(
      _targetPos.x + backX * this.distance + rightX * this.shoulderOffset + shakeX,
      _targetPos.y + backY * this.distance + shakeY,
      _targetPos.z + backZ * this.distance + rightZ * this.shoulderOffset
    );

    // 4. Camera collision avoidance: Raycast from player focus to desired camera position
    _rayDir.copy(_desiredPos).sub(_targetPos);
    const fullDist = _rayDir.length();
    _rayDir.normalize();

    const camRay = new THREE.Ray(_targetPos, _rayDir);
    const hitResult = this.collision.raycastBullet(camRay, fullDist);

    let effectivePos = _desiredPos;
    if (hitResult.hit && hitResult.distance < fullDist) {
      // Pull camera closer than obstacle with safety margin
      const safeDist = Math.max(this.minDistance, hitResult.distance - 0.25);
      effectivePos = _targetPos.clone().add(_rayDir.multiplyScalar(safeDist));
    }

    // Never let camera drop beneath the floor
    if (effectivePos.y < 0.3) {
      effectivePos.y = 0.3;
    }

    // 5. Exponential smooth damping for fluid follow movement
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, effectivePos.x, 16, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, effectivePos.y, 16, delta);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, effectivePos.z, 16, delta);

    // 6. Look slightly ahead of player chest along shoulder line
    const lookTarget = _targetPos.clone();
    lookTarget.x += rightX * (this.shoulderOffset * 0.4);
    lookTarget.z += rightZ * (this.shoulderOffset * 0.4);
    this.camera.lookAt(lookTarget);
  }

  /**
   * Get forward direction vector of camera for crosshair aiming
   */
  public getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }
}
