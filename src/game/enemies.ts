/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CollisionSystem } from './collision.ts';
import { EnemyData } from './types.ts';

export class EnemyActor {
  public mesh: THREE.Group = new THREE.Group();
  public position: THREE.Vector3;
  public rotationY = 0;
  public hp = 100;
  public maxHp = 100;
  public isAlive = true;
  public hitTimer = 0;
  public respawnTimer = 0;

  private bodyMesh!: THREE.Mesh;
  private visorMesh!: THREE.Mesh;
  private weaponMesh!: THREE.Mesh;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private shadowDecal!: THREE.Mesh;

  private currentWaypoint = 0;
  private animTimer = 0;

  constructor(
    public id: string,
    public name: string,
    public type: 'patrol' | 'sentry',
    initialPos: THREE.Vector3,
    public waypoints: THREE.Vector3[] = [],
    public patrolSpeed: number = 2.4
  ) {
    this.position = initialPos.clone();
    this.buildMesh();
    this.mesh.position.copy(this.position);
  }

  /**
   * Procedural rogue combatant mesh (crimson & dark steel)
   */
  private buildMesh() {
    const rogueMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937, // Dark carbon armor
      roughness: 0.6,
      metalness: 0.4,
    });

    const rogueTrimMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b, // Rogue dark crimson
      roughness: 0.5,
      metalness: 0.3,
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Glowing red optical visor
      emissive: 0xdc2626,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.8,
    });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.55, 0.35);
    this.bodyMesh = new THREE.Mesh(torsoGeo, rogueTrimMat);
    this.bodyMesh.position.y = 1.15;
    this.bodyMesh.castShadow = true;
    this.mesh.add(this.bodyMesh);

    // Armor plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.08), rogueMat);
    plate.position.set(0, 1.2, 0.18);
    this.mesh.add(plate);

    // 2. Helmet & Glowing Visor
    const headGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const head = new THREE.Mesh(headGeo, rogueMat);
    head.position.y = 1.62;
    head.castShadow = true;
    this.mesh.add(head);

    const visorGeo = new THREE.BoxGeometry(0.3, 0.1, 0.08);
    this.visorMesh = new THREE.Mesh(visorGeo, visorMat);
    this.visorMesh.position.set(0, 1.62, 0.16);
    this.mesh.add(this.visorMesh);

    // 3. Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.75, 0.2);
    this.leftLeg = new THREE.Mesh(legGeo, rogueMat);
    this.leftLeg.position.set(-0.16, 0.42, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, rogueMat);
    this.rightLeg.position.set(0.16, 0.42, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    // 4. Weapon
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    this.weaponMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.6), gunMat);
    this.weaponMesh.position.set(0.24, 1.1, 0.35);
    this.weaponMesh.castShadow = true;
    this.mesh.add(this.weaponMesh);

    // 5. Ground contact shadow
    const shadowGeo = new THREE.CircleGeometry(0.5, 12);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.shadowDecal = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDecal.rotation.x = -Math.PI / 2;
    this.shadowDecal.position.y = 0.02;
    this.mesh.add(this.shadowDecal);
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    if (!this.isAlive) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return;
    }

    // Hit flash reaction
    if (this.hitTimer > 0) {
      this.hitTimer -= delta * 5;
      if (this.hitTimer < 0) this.hitTimer = 0;
      this.mesh.scale.set(1 + this.hitTimer * 0.1, 1, 1 + this.hitTimer * 0.1);
    }

    // Patrol waypoint AI movement
    if (this.type === 'patrol' && this.waypoints.length > 0) {
      const targetWp = this.waypoints[this.currentWaypoint];
      const dx = targetWp.x - this.position.x;
      const dz = targetWp.z - this.position.z;
      const distToWp = Math.sqrt(dx * dx + dz * dz);

      if (distToWp < 0.6) {
        // Move to next waypoint
        this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
      } else {
        // Move towards waypoint
        const dirX = dx / distToWp;
        const dirZ = dz / distToWp;

        this.position.x += dirX * this.patrolSpeed * delta;
        this.position.z += dirZ * this.patrolSpeed * delta;

        // Smooth rotation towards travel direction
        const targetRot = Math.atan2(dirX, dirZ);
        this.rotationY = THREE.MathUtils.damp(this.rotationY, targetRot, 8, delta);
        this.mesh.rotation.y = this.rotationY;

        // Leg swing animation
        this.animTimer += delta * 7;
        const legAngle = Math.sin(this.animTimer) * 0.45;
        this.leftLeg.rotation.x = legAngle;
        this.rightLeg.rotation.x = -legAngle;
      }
    } else {
      // Sentry: subtly look towards player when player gets near
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 22) {
        const targetRot = Math.atan2(dx, dz);
        this.rotationY = THREE.MathUtils.damp(this.rotationY, targetRot, 4, delta);
        this.mesh.rotation.y = this.rotationY;
      }
    }

    this.mesh.position.copy(this.position);
  }

  public takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.hitTimer = 1.0;

    if (this.hp <= 0) {
      this.isAlive = false;
      this.respawnTimer = 9.0; // 9s respawn
      this.mesh.rotation.z = Math.PI / 2; // Collapse down
      this.mesh.position.y = 0.2;
      return true; // Eliminated
    }
    return false;
  }

  public respawn() {
    this.isAlive = true;
    this.hp = this.maxHp;
    this.mesh.rotation.z = 0;
    this.mesh.position.y = 0;
    this.mesh.scale.set(1, 1, 1);
  }
}

export class EnemyManager {
  public enemies: EnemyActor[] = [];
  public group: THREE.Group = new THREE.Group();

  constructor(private collision: CollisionSystem) {
    this.spawnEnemies();
  }

  private spawnEnemies() {
    const enemyConfigs: Array<{
      id: string;
      name: string;
      type: 'patrol' | 'sentry';
      start: [number, number];
      waypoints?: [number, number][];
    }> = [
      {
        id: 'enemy_sentry_west',
        name: 'Viper-1 (Depot)',
        type: 'sentry',
        start: [-15, -8],
      },
      {
        id: 'enemy_patrol_central',
        name: 'Cobra-2 (Convoy)',
        type: 'patrol',
        start: [6, 4],
        waypoints: [
          [6, 4],
          [6, 16],
          [-4, 16],
          [-4, 4],
        ],
      },
      {
        id: 'enemy_sentry_telecom',
        name: 'Viper-3 (Telecom)',
        type: 'sentry',
        start: [-16, 20],
      },
      {
        id: 'enemy_patrol_crossroad',
        name: 'Cobra-4 (Street)',
        type: 'patrol',
        start: [-14, -4],
        waypoints: [
          [-14, -4],
          [14, -4],
        ],
      },
      {
        id: 'enemy_sentry_east',
        name: 'Viper-5 (Logistics)',
        type: 'sentry',
        start: [16, -16],
      },
      {
        id: 'enemy_patrol_south',
        name: 'Cobra-6 (Substation)',
        type: 'patrol',
        start: [12, 22],
        waypoints: [
          [12, 22],
          [2, 24],
          [2, 14],
          [12, 14],
        ],
      },
    ];

    for (const cfg of enemyConfigs) {
      const startVec = new THREE.Vector3(cfg.start[0], 0, cfg.start[1]);
      const wps = cfg.waypoints
        ? cfg.waypoints.map((w) => new THREE.Vector3(w[0], 0, w[1]))
        : [];

      const enemy = new EnemyActor(cfg.id, cfg.name, cfg.type, startVec, wps);
      this.enemies.push(enemy);
      this.group.add(enemy.mesh);

      // Register box collider with collision system
      const min = new THREE.Vector3(startVec.x - 0.5, 0, startVec.z - 0.5);
      const max = new THREE.Vector3(startVec.x + 0.5, 2.0, startVec.z + 0.5);
      this.collision.addBoxCollider(cfg.id, min, max, enemy.mesh, true, 100);
    }
  }

  public update(delta: number, playerPos: THREE.Vector3) {
    for (const enemy of this.enemies) {
      enemy.update(delta, playerPos);

      // Keep collider box synchronized with moving enemy position
      const collider = this.collision.colliders.find((c) => c.id === enemy.id);
      if (collider && collider.box) {
        const ep = enemy.position;
        collider.box.min.set(ep.x - 0.5, 0, ep.z - 0.5);
        collider.box.max.set(ep.x + 0.5, 2.0, ep.z + 0.5);
        collider.targetHp = enemy.hp;
      }
    }
  }

  public registerHit(id: string, damage: number): { hit: boolean; killed: boolean; enemy?: EnemyActor } {
    const enemy = this.enemies.find((e) => e.id === id);
    if (!enemy || !enemy.isAlive) return { hit: false, killed: false };

    const killed = enemy.takeDamage(damage);
    return { hit: true, killed, enemy };
  }

  /**
   * Returns tracked enemy data with distances to player and radar range filter
   */
  public getEnemyData(playerPos: THREE.Vector3, maxRadarDistance = 32): EnemyData[] {
    return this.enemies.map((enemy) => {
      const dx = enemy.position.x - playerPos.x;
      const dz = enemy.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const inRange = dist <= maxRadarDistance;

      // Radar visibility factor (smooth fade near edge of range)
      const radarVis = inRange
        ? Math.max(0.2, 1 - (dist / maxRadarDistance) * 0.8)
        : 0;

      return {
        id: enemy.id,
        name: enemy.name,
        position: enemy.position.clone(),
        rotationY: enemy.rotationY,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        isAlive: enemy.isAlive,
        type: enemy.type,
        distanceToPlayer: Math.round(dist * 10) / 10,
        isAlerted: dist < 14 && enemy.isAlive,
        isInRadarRange: inRange,
        radarVisibility: radarVis,
      };
    });
  }
}
