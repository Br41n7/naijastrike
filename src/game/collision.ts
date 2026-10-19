/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Collider } from './types.ts';

export class CollisionSystem {
  public colliders: Collider[] = [];

  public clear() {
    this.colliders = [];
  }

  public addBoxCollider(
    id: string,
    min: THREE.Vector3,
    max: THREE.Vector3,
    mesh?: THREE.Object3D,
    isTarget = false,
    hp = 100
  ) {
    const box = new THREE.Box3(min.clone(), max.clone());
    this.colliders.push({
      id,
      type: 'box',
      box,
      mesh,
      isTarget,
      targetHp: hp,
      maxTargetHp: hp,
    });
  }

  public addCylinderCollider(
    id: string,
    center: THREE.Vector3,
    radius: number,
    height: number,
    mesh?: THREE.Object3D,
    isTarget = false,
    hp = 100
  ) {
    this.colliders.push({
      id,
      type: 'cylinder',
      cylinder: {
        center: center.clone(),
        radius,
        height,
      },
      mesh,
      isTarget,
      targetHp: hp,
      maxTargetHp: hp,
    });
  }

  /**
   * Check if a position collides with any obstacle.
   * playerRadius: radius of the player cylinder (default 0.45)
   * playerHeight: height of the player (default 1.8)
   */
  public checkCollision(
    pos: THREE.Vector3,
    playerRadius = 0.45,
    playerHeight = 1.8
  ): boolean {
    const playerBottom = pos.y;
    const playerTop = pos.y + playerHeight;

    for (const c of this.colliders) {
      if (c.type === 'box' && c.box) {
        // Vertical overlap check
        if (playerBottom > c.box.max.y || playerTop < c.box.min.y) {
          continue;
        }

        // Clamp player point to box bounds in 2D (X/Z)
        const closestX = Math.max(c.box.min.x, Math.min(pos.x, c.box.max.x));
        const closestZ = Math.max(c.box.min.z, Math.min(pos.z, c.box.max.z));

        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < playerRadius * playerRadius) {
          return true;
        }
      } else if (c.type === 'cylinder' && c.cylinder) {
        // Cylinder vs cylinder
        const cBot = c.cylinder.center.y;
        const cTop = cBot + c.cylinder.height;
        if (playerBottom > cTop || playerTop < cBot) {
          continue;
        }

        const dx = pos.x - c.cylinder.center.x;
        const dz = pos.z - c.cylinder.center.z;
        const minDist = playerRadius + c.cylinder.radius;

        if (dx * dx + dz * dz < minDist * minDist) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Move with wall sliding:
   * First test moving along X and Z together.
   * If collision occurs, test moving along X only.
   * Then test moving along Z only.
   * Returns the final resolved position.
   */
  public resolveMovement(
    currentPos: THREE.Vector3,
    delta: THREE.Vector3,
    playerRadius = 0.45,
    playerHeight = 1.8
  ): THREE.Vector3 {
    const resolved = currentPos.clone();
    const targetFull = currentPos.clone().add(delta);

    // If no collision with full target, allow move
    if (!this.checkCollision(targetFull, playerRadius, playerHeight)) {
      return targetFull;
    }

    // Try sliding along X
    const targetX = currentPos.clone();
    targetX.x += delta.x;
    if (!this.checkCollision(targetX, playerRadius, playerHeight)) {
      resolved.x = targetX.x;
    }

    // Try sliding along Z
    const targetZ = currentPos.clone();
    targetZ.z += delta.z;
    if (!this.checkCollision(targetZ, playerRadius, playerHeight)) {
      resolved.z = targetZ.z;
    }

    // If both failed independently, stay at current
    return resolved;
  }

  /**
   * Raycast check for gunshots / projectiles against all colliders
   */
  public raycastBullet(
    ray: THREE.Ray,
    maxDistance = 100
  ): { hit: boolean; point: THREE.Vector3; collider?: Collider; distance: number; isTarget: boolean } {
    let closestDist = maxDistance;
    let hitPoint: THREE.Vector3 | null = null;
    let hitCollider: Collider | undefined;

    const intersectionPoint = new THREE.Vector3();

    for (const c of this.colliders) {
      if (c.type === 'box' && c.box) {
        const point = ray.intersectBox(c.box, intersectionPoint);
        if (point) {
          const dist = ray.origin.distanceTo(point);
          if (dist < closestDist) {
            closestDist = dist;
            hitPoint = point.clone();
            hitCollider = c;
          }
        }
      }
    }

    if (hitPoint) {
      return {
        hit: true,
        point: hitPoint,
        collider: hitCollider,
        distance: closestDist,
        isTarget: hitCollider?.isTarget ?? false,
      };
    }

    // Missed everything: travel to max distance
    return {
      hit: false,
      point: ray.origin.clone().add(ray.direction.clone().multiplyScalar(maxDistance)),
      distance: maxDistance,
      isTarget: false,
    };
  }
}
