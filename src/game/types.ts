/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface InputState {
  forward: number; // -1 to 1 (W/S or joystick Y)
  strafe: number;  // -1 to 1 (A/D or joystick X)
  lookDeltaX: number; // Horizontal mouse/touch look in radians
  lookDeltaY: number; // Vertical mouse/touch look in radians
  jump: boolean;
  sprint: boolean;
  fire: boolean;
  reload: boolean;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  maxStamina: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  score: number;
  targetsHit: number;
  totalTargets: number;
  speed: number;
  isGrounded: boolean;
}

export interface Collider {
  id: string;
  type: 'box' | 'cylinder';
  box?: THREE.Box3;
  cylinder?: {
    center: THREE.Vector3;
    radius: number;
    height: number;
  };
  mesh?: THREE.Object3D;
  isTarget?: boolean;
  targetHp?: number;
  maxTargetHp?: number;
}

export interface BulletTracer {
  start: THREE.Vector3;
  end: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  beamMesh?: THREE.Line | THREE.Mesh;
}

export interface HitParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
}

export interface GameSettings {
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  soundVolume: number;
  soundMuted: boolean;
  shoulderSide: 'right' | 'left';
  showDebug: boolean;
}

export interface EnemyData {
  id: string;
  name: string;
  position: THREE.Vector3;
  rotationY: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  type: 'patrol' | 'sentry';
  distanceToPlayer: number;
  isAlerted: boolean;
  isInRadarRange: boolean;
  radarVisibility: number;
}

