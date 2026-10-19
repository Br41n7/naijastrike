/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CollisionSystem } from './collision.ts';
import { TextureGenerator } from './textures.ts';

export class Arena {
  public group: THREE.Group = new THREE.Group();
  public targets: Array<{
    mesh: THREE.Group;
    id: string;
    hp: number;
    maxHp: number;
    hitAnimation: number;
    initialRotY: number;
  }> = [];

  private roadTexture: THREE.CanvasTexture;
  private sidewalkTexture: THREE.CanvasTexture;
  private containerTexture1: THREE.CanvasTexture;
  private containerTexture2: THREE.CanvasTexture;
  private stallTexture: THREE.CanvasTexture;
  private targetTexture: THREE.CanvasTexture;
  private hazardTexture: THREE.CanvasTexture;

  constructor(private collision: CollisionSystem, maxAnisotropy = 4) {
    this.roadTexture = TextureGenerator.createRoadTexture(maxAnisotropy);
    this.sidewalkTexture = TextureGenerator.createSidewalkTexture(maxAnisotropy);
    this.containerTexture1 = TextureGenerator.createContainerTexture('#065f46', '#34d399', 'NPA-8820-T', maxAnisotropy);
    this.containerTexture2 = TextureGenerator.createContainerTexture('#b45309', '#fde047', 'LAG-4419-X', maxAnisotropy);
    this.stallTexture = TextureGenerator.createNaijaStripesTexture(maxAnisotropy);
    this.targetTexture = TextureGenerator.createTargetTexture(maxAnisotropy);
    this.hazardTexture = TextureGenerator.createHazardTexture(maxAnisotropy);

    this.buildGround();
    this.buildPerimeter();
    this.buildUrbanDistrict();
    this.buildShippingYard();
    this.buildMarketStalls();
    this.buildStreetFurniture();
    this.buildCombatTargets();
  }

  /**
   * Ground plane: central paved road with sand/gravel outer edges
   */
  private buildGround() {
    // Large landscape ground
    const groundGeo = new THREE.PlaneGeometry(160, 160);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xc2a67e, // Warm Lagos sand/earth
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.02;
    this.group.add(ground);

    // Central Main Street (Asphalt)
    const roadGeo = new THREE.PlaneGeometry(14, 70);
    this.roadTexture.repeat.set(1, 5);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.8,
      metalness: 0.1,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 0);
    road.receiveShadow = true;
    this.group.add(road);

    // Cross Street
    const crossRoadGeo = new THREE.PlaneGeometry(50, 12);
    const crossRoad = new THREE.Mesh(crossRoadGeo, roadMat);
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(0, 0.015, -4);
    crossRoad.receiveShadow = true;
    this.group.add(crossRoad);

    // Concrete Sidewalk Curbs
    this.buildSidewalk(-10, 0, 6, 68);
    this.buildSidewalk(10, 0, 6, 68);
  }

  private buildSidewalk(x: number, z: number, w: number, d: number) {
    const curbGeo = new THREE.BoxGeometry(w, 0.2, d);
    const curbMat = new THREE.MeshStandardMaterial({
      map: this.sidewalkTexture,
      roughness: 0.75,
      metalness: 0.1,
    });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(x, 0.1, z);
    curb.receiveShadow = true;
    this.group.add(curb);
  }

  /**
   * Perimeter barrier walls with fence tops preventing leaving arena
   */
  private buildPerimeter() {
    const arenaSize = 70; // 70x70 meters
    const half = arenaSize / 2;
    const wallH = 4.5;
    const wallThick = 1.5;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      metalness: 0.1,
    });

    const createWallSegment = (x: number, z: number, w: number, d: number, id: string) => {
      const g = new THREE.Group();
      // Base concrete barrier
      const baseGeo = new THREE.BoxGeometry(w, wallH, d);
      const baseMesh = new THREE.Mesh(baseGeo, wallMat);
      baseMesh.position.y = wallH / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      g.add(baseMesh);

      // Hazard trim along bottom
      const hazardGeo = new THREE.BoxGeometry(w + 0.05, 0.5, d + 0.05);
      const hazardMat = new THREE.MeshStandardMaterial({
        map: this.hazardTexture,
        roughness: 0.6,
      });
      const hazardMesh = new THREE.Mesh(hazardGeo, hazardMat);
      hazardMesh.position.y = 0.25;
      g.add(hazardMesh);

      g.position.set(x, 0, z);
      this.group.add(g);

      // Register collision box
      const min = new THREE.Vector3(x - w / 2, 0, z - d / 2);
      const max = new THREE.Vector3(x + w / 2, wallH + 2, z + d / 2);
      this.collision.addBoxCollider(id, min, max, g);
    };

    createWallSegment(0, -half, arenaSize + 2, wallThick, 'wall_north');
    createWallSegment(0, half, arenaSize + 2, wallThick, 'wall_south');
    createWallSegment(-half, 0, wallThick, arenaSize + 2, 'wall_west');
    createWallSegment(half, 0, wallThick, arenaSize + 2, 'wall_east');
  }

  /**
   * Multi-story stylized buildings with rooftop tanks, AC units, and trims
   */
  private buildUrbanDistrict() {
    // Building 1: West Tactical Depot (Multi-tiered)
    this.createBuilding(-20, -18, 14, 11, 16, 0x334155, 'Depot West');
    // Building 2: North West Telecom Facility
    this.createBuilding(-22, 16, 12, 14, 12, 0x1e293b, 'Telecom Hub');
    // Building 3: East Logistics Tower
    this.createBuilding(22, -16, 13, 16, 15, 0x3f3f46, 'Logistics East');
    // Building 4: South East Power Substation
    this.createBuilding(20, 18, 14, 9, 14, 0x27272a, 'Substation Alpha');
    // Mid-sized office block
    this.createBuilding(-24, 0, 10, 8, 10, 0x475569, 'Control Post');
  }

  private createBuilding(
    x: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    colorHex: number,
    name: string
  ) {
    const bGroup = new THREE.Group();
    bGroup.position.set(x, 0, z);

    // Main structure
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.8,
      metalness: 0.15,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = height / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bGroup.add(bodyMesh);

    // Roof parapet trim
    const parapetGeo = new THREE.BoxGeometry(width + 0.4, 0.7, depth + 0.4);
    const parapetMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.7,
      metalness: 0.3,
    });
    const parapet = new THREE.Mesh(parapetGeo, parapetMat);
    parapet.position.y = height + 0.35;
    bGroup.add(parapet);

    // Rooftop water tank (Iconic tropical/Lagos urban feature)
    const tankGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.2, 12);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Blue water tank
      roughness: 0.4,
      metalness: 0.2,
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(width * 0.25, height + 1.2, depth * 0.2);
    tank.castShadow = true;
    bGroup.add(tank);

    // AC Unit boxes on rooftop
    const acGeo = new THREE.BoxGeometry(1.4, 0.9, 0.8);
    const acMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.5,
      metalness: 0.4,
    });
    const ac = new THREE.Mesh(acGeo, acMat);
    ac.position.set(-width * 0.2, height + 0.45, -depth * 0.2);
    bGroup.add(ac);

    // Window bands (stylized tinted glass slits)
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.2,
      metalness: 0.85,
    });
    const winWidth = width * 0.75;
    for (let floor = 2; floor < height - 1; floor += 3) {
      const winGeo = new THREE.BoxGeometry(winWidth, 1.2, 0.2);
      const winMesh = new THREE.Mesh(winGeo, windowMat);
      winMesh.position.set(0, floor + 0.6, depth / 2 + 0.05);
      bGroup.add(winMesh);
    }

    this.group.add(bGroup);

    // Add box collider
    const min = new THREE.Vector3(x - width / 2, 0, z - depth / 2);
    const max = new THREE.Vector3(x + width / 2, height + 2, z + depth / 2);
    this.collision.addBoxCollider(`bldg_${name}`, min, max, bGroup);
  }

  /**
   * Cargo Shipping Containers (Lagos maritime hub inspired)
   */
  private buildShippingYard() {
    // Container clusters providing tactical cover and chokepoints
    this.createContainer(-7, -8, 6.2, 2.6, 2.6, 0, this.containerTexture1, 'cont_1');
    this.createContainer(-7, -8, 6.2, 2.6, 2.6, 2.6, this.containerTexture2, 'cont_2'); // Stacked!
    this.createContainer(7, 8, 6.2, 2.6, 2.6, Math.PI / 4, this.containerTexture2, 'cont_3');
    this.createContainer(9, -7, 6.2, 2.6, 2.6, -Math.PI / 6, this.containerTexture1, 'cont_4');
    this.createContainer(-8, 9, 6.2, 2.6, 2.6, Math.PI / 2, this.containerTexture1, 'cont_5');
  }

  private createContainer(
    x: number,
    z: number,
    length: number,
    height: number,
    width: number,
    rotY: number,
    texture: THREE.CanvasTexture,
    id: string
  ) {
    const cGroup = new THREE.Group();
    cGroup.position.set(x, 0, z);
    cGroup.rotation.y = rotY;

    const geo = new THREE.BoxGeometry(length, height, width);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.65,
      metalness: 0.35,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cGroup.add(mesh);

    // Corner castings
    const cornerMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.5,
      metalness: 0.6,
    });
    const corners = [
      [-length / 2, -width / 2],
      [length / 2, -width / 2],
      [-length / 2, width / 2],
      [length / 2, width / 2],
    ];
    for (const [cx, cz] of corners) {
      const cBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, height + 0.05, 0.3), cornerMat);
      cBox.position.set(cx, height / 2, cz);
      cGroup.add(cBox);
    }

    this.group.add(cGroup);

    // Approximate bounding box collider (with rotation margin)
    const span = Math.max(length, width) * 0.5;
    const min = new THREE.Vector3(x - span, 0, z - span);
    const max = new THREE.Vector3(x + span, height, z + span);
    this.collision.addBoxCollider(id, min, max, cGroup);
  }

  /**
   * Colorful Naija market kiosk stalls with striped awnings
   */
  private buildMarketStalls() {
    this.createStall(-12, -18, 0, 'stall_1');
    this.createStall(12, 17, Math.PI, 'stall_2');
    this.createStall(-12, 16, Math.PI * 0.5, 'stall_3');
  }

  private createStall(x: number, z: number, rotY: number, id: string) {
    const sGroup = new THREE.Group();
    sGroup.position.set(x, 0, z);
    sGroup.rotation.y = rotY;

    // Table / counter base
    const tableGeo = new THREE.BoxGeometry(3.2, 1.0, 1.8);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Timber wood
      roughness: 0.85,
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = 0.5;
    table.castShadow = true;
    table.receiveShadow = true;
    sGroup.add(table);

    // Awning posts
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.7 });
    const postCoords = [
      [-1.5, -0.8],
      [1.5, -0.8],
      [-1.5, 0.8],
      [1.5, 0.8],
    ];
    for (const [px, pz] of postCoords) {
      const post = new THREE.Mesh(poleGeo, poleMat);
      post.position.set(px, 1.25, pz);
      sGroup.add(post);
    }

    // Slanted striped awning
    const awningGeo = new THREE.BoxGeometry(3.6, 0.08, 2.2);
    const awningMat = new THREE.MeshStandardMaterial({
      map: this.stallTexture,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(0, 2.4, 0.1);
    awning.rotation.x = 0.15;
    awning.castShadow = true;
    sGroup.add(awning);

    this.group.add(sGroup);

    const min = new THREE.Vector3(x - 1.8, 0, z - 1.2);
    const max = new THREE.Vector3(x + 1.8, 2.6, z + 1.2);
    this.collision.addBoxCollider(id, min, max, sGroup);
  }

  /**
   * Concrete Jersey barriers, ammo crates, drums, and palm trees
   */
  private buildStreetFurniture() {
    // Concrete Jersey barriers along road chokepoints
    this.createBarrier(-3.5, 14, 0, 'bar_1');
    this.createBarrier(3.5, 14, 0, 'bar_2');
    this.createBarrier(-4, -14, 0.2, 'bar_3');
    this.createBarrier(4, -14, -0.2, 'bar_4');

    // Tactical ammo/supply crate clusters
    this.createCrateCluster(-5, 2, 'crates_mid_left');
    this.createCrateCluster(5, -3, 'crates_mid_right');
    this.createCrateCluster(-14, -7, 'crates_back_left');

    // Palm trees in sidewalk planters (Tropical African urban feel)
    this.createPalmTree(-10, -12);
    this.createPalmTree(10, -12);
    this.createPalmTree(-10, 12);
    this.createPalmTree(10, 12);

    // Street lights with warm glowing fixtures
    this.createStreetLamp(-6.5, -20);
    this.createStreetLamp(6.5, -20);
    this.createStreetLamp(-6.5, 20);
    this.createStreetLamp(6.5, 20);
  }

  private createBarrier(x: number, z: number, rotY: number, id: string) {
    const bGroup = new THREE.Group();
    bGroup.position.set(x, 0, z);
    bGroup.rotation.y = rotY;

    const geo = new THREE.BoxGeometry(2.8, 0.9, 0.7);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xa8a29e,
      roughness: 0.8,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.45;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bGroup.add(mesh);

    // Warning stripe band
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.82, 0.2, 0.72),
      new THREE.MeshStandardMaterial({ map: this.hazardTexture })
    );
    stripe.position.y = 0.45;
    bGroup.add(stripe);

    this.group.add(bGroup);

    const min = new THREE.Vector3(x - 1.5, 0, z - 0.5);
    const max = new THREE.Vector3(x + 1.5, 1.2, z + 0.5);
    this.collision.addBoxCollider(id, min, max, bGroup);
  }

  private createCrateCluster(x: number, z: number, id: string) {
    const cGroup = new THREE.Group();
    cGroup.position.set(x, 0, z);

    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x713f12,
      roughness: 0.85,
    });

    // 3 crates in a cluster
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.2), crateMat);
    c1.position.set(0, 0.55, 0);
    c1.castShadow = true;
    c1.receiveShadow = true;
    cGroup.add(c1);

    const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), crateMat);
    c2.position.set(1.0, 0.5, 0.2);
    c2.rotation.y = 0.3;
    c2.castShadow = true;
    c2.receiveShadow = true;
    cGroup.add(c2);

    const c3 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.0), crateMat);
    c3.position.set(0.4, 1.5, 0.1);
    c3.rotation.y = -0.15;
    c3.castShadow = true;
    c3.receiveShadow = true;
    cGroup.add(c3);

    this.group.add(cGroup);

    const min = new THREE.Vector3(x - 1.0, 0, z - 1.0);
    const max = new THREE.Vector3(x + 1.8, 2.2, z + 1.0);
    this.collision.addBoxCollider(id, min, max, cGroup);
  }

  private createPalmTree(x: number, z: number) {
    const pGroup = new THREE.Group();
    pGroup.position.set(x, 0, z);

    // Trunk (segmented curve)
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 6, 7);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x573926,
      roughness: 0.9,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(0, 3, 0);
    trunk.rotation.z = (Math.random() - 0.5) * 0.1;
    trunk.castShadow = true;
    pGroup.add(trunk);

    // Palm fronds (composite leaves)
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const leafGeo = new THREE.ConeGeometry(0.7, 3.2, 4);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(angle) * 1.2, 5.8, Math.sin(angle) * 1.2);
      leaf.rotation.x = Math.PI / 2 + 0.3;
      leaf.rotation.y = angle;
      leaf.castShadow = true;
      pGroup.add(leaf);
    }

    this.group.add(pGroup);

    // Trunk collider
    this.collision.addCylinderCollider(`palm_${x}_${z}`, new THREE.Vector3(x, 0, z), 0.4, 5, pGroup);
  }

  private createStreetLamp(x: number, z: number) {
    const lGroup = new THREE.Group();
    lGroup.position.set(x, 0, z);

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3,
    });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 8), poleMat);
    pole.position.y = 2.5;
    pole.castShadow = true;
    lGroup.add(pole);

    // Arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), poleMat);
    arm.position.set(x > 0 ? -0.6 : 0.6, 4.9, 0);
    arm.rotation.z = x > 0 ? Math.PI / 3 : -Math.PI / 3;
    lGroup.add(arm);

    // Fixture head
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 0.8,
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.35), headMat);
    head.position.set(x > 0 ? -1.0 : 1.0, 4.7, 0);
    lGroup.add(head);

    this.group.add(lGroup);
    this.collision.addCylinderCollider(`lamp_${x}_${z}`, new THREE.Vector3(x, 0, z), 0.2, 5, lGroup);
  }

  /**
   * Shootable practice combat target dummies placed around the urban arena
   */
  private buildCombatTargets() {
    const targetSpawns = [
      { x: 0, z: -26, rot: 0, id: 'target_center_north' },
      { x: -14, z: -12, rot: Math.PI / 4, id: 'target_west_flank' },
      { x: 14, z: -10, rot: -Math.PI / 4, id: 'target_east_flank' },
      { x: -8, z: 22, rot: Math.PI, id: 'target_south_west' },
      { x: 8, z: 24, rot: Math.PI, id: 'target_south_east' },
      { x: 0, z: 28, rot: Math.PI, id: 'target_center_south' },
    ];

    for (const s of targetSpawns) {
      this.createCombatTarget(s.x, s.z, s.rot, s.id);
    }
  }

  private createCombatTarget(x: number, z: number, rotY: number, id: string) {
    const tGroup = new THREE.Group();
    tGroup.position.set(x, 0, z);
    tGroup.rotation.y = rotY;

    // Steel tripod base
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.3 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8), baseMat);
    post.position.y = 0.9;
    post.castShadow = true;
    tGroup.add(post);

    // Target Silhouette Board (Upper torso + head cutout)
    const boardMat = new THREE.MeshStandardMaterial({
      map: this.targetTexture,
      roughness: 0.5,
      metalness: 0.1,
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.08), boardMat);
    board.position.y = 1.6;
    board.castShadow = true;
    tGroup.add(board);

    // Head target plate
    const headBoard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.08), boardMat);
    headBoard.position.set(0, 2.35, 0);
    headBoard.castShadow = true;
    tGroup.add(headBoard);

    this.group.add(tGroup);

    // Register collider
    const min = new THREE.Vector3(x - 0.7, 0, z - 0.7);
    const max = new THREE.Vector3(x + 0.7, 2.6, z + 0.7);
    this.collision.addBoxCollider(id, min, max, tGroup, true, 100);

    this.targets.push({
      mesh: tGroup,
      id,
      hp: 100,
      maxHp: 100,
      hitAnimation: 0,
      initialRotY: rotY,
    });
  }

  /**
   * Update animated reactive elements (target wobble on hit)
   */
  public update(delta: number) {
    for (const t of this.targets) {
      if (t.hitAnimation > 0) {
        t.hitAnimation -= delta * 4;
        if (t.hitAnimation < 0) t.hitAnimation = 0;
        // Wobble spring animation
        const wobble = Math.sin(t.hitAnimation * Math.PI * 4) * 0.25 * t.hitAnimation;
        t.mesh.rotation.x = wobble;
      }
    }
  }

  public registerTargetHit(id: string, damage = 35): boolean {
    const target = this.targets.find((t) => t.id === id);
    if (!target) return false;

    target.hp = Math.max(0, target.hp - damage);
    target.hitAnimation = 1.0;

    if (target.hp <= 0) {
      // Pop target down briefly then respawn after delay
      target.mesh.scale.set(0.05, 0.05, 0.05);
      setTimeout(() => {
        target.hp = target.maxHp;
        target.mesh.scale.set(1, 1, 1);
      }, 3500);
      return true; // Target destroyed
    }
    return false;
  }
}
