/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Compass, Maximize2, Minimize2, ShieldAlert, Crosshair, Skull, Radio } from 'lucide-react';
import { GameEngine } from '../game/engine.ts';
import { EnemyData } from '../game/types.ts';

interface MiniMapProps {
  engine: GameEngine | null;
  defaultRadarRange?: number;
}

// Static landmark geometries in arena coordinates (meters)
const ARENA_SIZE = 70; // 70m x 70m, from -35 to +35
const HALF_SIZE = ARENA_SIZE / 2;

const BUILDINGS = [
  { id: 'Depot West', x: -20, z: -18, w: 14, d: 16, label: 'DEPOT' },
  { id: 'Telecom Hub', x: -22, z: 16, w: 12, d: 12, label: 'TELCO' },
  { id: 'Logistics East', x: 22, z: -16, w: 13, d: 15, label: 'LOGISTICS' },
  { id: 'Substation Alpha', x: 20, z: 18, w: 14, d: 14, label: 'SUB-A' },
  { id: 'Control Post', x: -24, z: 0, w: 10, d: 10, label: 'CTRL' },
];

const CONTAINERS = [
  { x: -7, z: -8, w: 6.2, d: 2.6, rot: 0, color: '#047857' },
  { x: 7, z: 8, w: 6.2, d: 2.6, rot: Math.PI / 4, color: '#b45309' },
  { x: 9, z: -7, w: 6.2, d: 2.6, rot: -Math.PI / 6, color: '#047857' },
  { x: -8, z: 9, w: 6.2, d: 2.6, rot: Math.PI / 2, color: '#047857' },
];

export const MiniMap: React.FC<MiniMapProps> = ({ engine, defaultRadarRange = 32 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [zoomMode, setZoomMode] = useState<'arena' | 'local'>('arena');
  const [radarRange, setRadarRange] = useState(defaultRadarRange); // Distance threshold in meters
  const [coords, setCoords] = useState({ x: 0, z: 10, heading: 0, distToWall: 25 });
  const [isNearWall, setIsNearWall] = useState(false);

  // Hostile tracking stats for HUD display
  const [threatStats, setThreatStats] = useState<{
    inRangeCount: number;
    closestDist: number | null;
    isCritical: boolean;
  }>({
    inRangeCount: 0,
    closestDist: null,
    isCritical: false,
  });

  // Breadcrumb path trail of player positions
  const trailRef = useRef<Array<{ x: number; z: number }>>([]);
  const lastTrailTime = useRef(0);
  const sweepAngleRef = useRef(0);

  useEffect(() => {
    let animId: number;

    const render = (timestamp: number) => {
      animId = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      if (!canvas || !engine) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const player = engine.player;
      const camera = engine.cameraController;
      if (!player) return;

      const px = player.position.x;
      const pz = player.position.z;
      const rotY = player.rotationY;

      // Effective radar distance threshold:
      // In arena mode: uses configured radarRange (e.g. 32m)
      // In local mode: uses 16m close-up range
      const effectiveRadarRange = zoomMode === 'arena' ? radarRange : 16;

      // Track enemy position data from GameEngine
      const enemyDataList: EnemyData[] = engine.getEnemyData(effectiveRadarRange);

      // Filter enemies that are within the radar distance threshold
      const enemiesWithinRange = enemyDataList.filter(
        (e) => e.distanceToPlayer <= effectiveRadarRange
      );

      // Calculate distance to nearest boundary wall
      const distEast = HALF_SIZE - px;
      const distWest = px - (-HALF_SIZE);
      const distSouth = HALF_SIZE - pz;
      const distNorth = pz - (-HALF_SIZE);
      const minDist = Math.max(0, Math.min(distEast, distWest, distSouth, distNorth));

      // Calculate camera heading in degrees (0 = North, 90 = East, 180 = South, 270 = West)
      const forwardDir = camera.getForwardDirection();
      let headingDeg = Math.round(Math.atan2(forwardDir.x, -forwardDir.z) * (180 / Math.PI));
      if (headingDeg < 0) headingDeg += 360;

      // Throttle coordinate & threat updates to React state (~8 fps)
      if (timestamp - lastTrailTime.current > 120) {
        lastTrailTime.current = timestamp;
        setCoords({
          x: Math.round(px * 10) / 10,
          z: Math.round(pz * 10) / 10,
          heading: headingDeg,
          distToWall: Math.round(minDist),
        });
        setIsNearWall(minDist <= 5);

        // Find closest active enemy
        const aliveInRange = enemiesWithinRange.filter((e) => e.isAlive);
        let minEnemyDist: number | null = null;
        for (const e of aliveInRange) {
          if (minEnemyDist === null || e.distanceToPlayer < minEnemyDist) {
            minEnemyDist = e.distanceToPlayer;
          }
        }

        setThreatStats({
          inRangeCount: aliveInRange.length,
          closestDist: minEnemyDist,
          isCritical: minEnemyDist !== null && minEnemyDist < 10,
        });

        // Record breadcrumb trail (max 18 points)
        trailRef.current.push({ x: px, z: pz });
        if (trailRef.current.length > 18) {
          trailRef.current.shift();
        }
      }

      // Rotate radar sweep line
      sweepAngleRef.current = (sweepAngleRef.current + 0.035) % (Math.PI * 2);

      // Canvas dimensions
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Coordinate transformation:
      // In 'arena' mode: arena (-35 to +35) maps to canvas with padding
      // In 'local' mode: 28m area centered on the player
      const mapRadius = (width / 2) - 8;
      const viewMeters = zoomMode === 'arena' ? HALF_SIZE : 16;
      const scale = mapRadius / viewMeters;

      const worldToCanvas = (wx: number, wz: number): { cx: number; cy: number } => {
        if (zoomMode === 'arena') {
          // North (-Z) is UP (negative Y on canvas)
          return {
            cx: centerX + (wx / HALF_SIZE) * mapRadius,
            cy: centerY + (wz / HALF_SIZE) * mapRadius,
          };
        } else {
          // Centered on player
          return {
            cx: centerX + (wx - px) * scale,
            cy: centerY + (wz - pz) * scale,
          };
        }
      };

      // 1. Clear background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw tactical background grid lines
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1;
      const gridStep = zoomMode === 'arena' ? 10 : 5;
      for (let g = -HALF_SIZE; g <= HALF_SIZE; g += gridStep) {
        const p1 = worldToCanvas(g, -HALF_SIZE);
        const p2 = worldToCanvas(g, HALF_SIZE);
        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);
        ctx.stroke();

        const p3 = worldToCanvas(-HALF_SIZE, g);
        const p4 = worldToCanvas(HALF_SIZE, g);
        ctx.beginPath();
        ctx.moveTo(p3.cx, p3.cy);
        ctx.lineTo(p4.cx, p4.cy);
        ctx.stroke();
      }

      // 3. Draw concentric radar range circles
      const rangeMeters = zoomMode === 'arena' ? [15, 30] : [8, 16];
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.lineWidth = 1;
      for (const rm of rangeMeters) {
        const rCanvas = (rm / viewMeters) * mapRadius;
        ctx.beginPath();
        if (zoomMode === 'arena') {
          ctx.arc(centerX, centerY, rCanvas, 0, Math.PI * 2);
        } else {
          const pc = worldToCanvas(px, pz);
          ctx.arc(pc.cx, pc.cy, rCanvas, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      // 4. Draw Streets (Asphalt & Cross street)
      const roadTopLeft = worldToCanvas(-7, -HALF_SIZE);
      const roadBotRight = worldToCanvas(7, HALF_SIZE);
      ctx.fillStyle = 'rgba(41, 37, 36, 0.85)';
      ctx.fillRect(roadTopLeft.cx, roadTopLeft.cy, roadBotRight.cx - roadTopLeft.cx, roadBotRight.cy - roadTopLeft.cy);

      const crossTopLeft = worldToCanvas(-25, -10);
      const crossBotRight = worldToCanvas(25, 2);
      ctx.fillRect(crossTopLeft.cx, crossTopLeft.cy, crossBotRight.cx - crossTopLeft.cx, crossBotRight.cy - crossTopLeft.cy);

      // Road centerline dashes (yellow)
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      const lineStart = worldToCanvas(0, -HALF_SIZE);
      const lineEnd = worldToCanvas(0, HALF_SIZE);
      ctx.beginPath();
      ctx.moveTo(lineStart.cx, lineStart.cy);
      ctx.lineTo(lineEnd.cx, lineEnd.cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. Draw Buildings
      for (const b of BUILDINGS) {
        const tl = worldToCanvas(b.x - b.w / 2, b.z - b.d / 2);
        const br = worldToCanvas(b.x + b.w / 2, b.z + b.d / 2);
        const bw = br.cx - tl.cx;
        const bh = br.cy - tl.cy;

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(tl.cx, tl.cy, bw, bh);

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(tl.cx, tl.cy, bw, bh);

        if (bw > 24 && bh > 14) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.label, tl.cx + bw / 2, tl.cy + bh / 2);
        }
      }

      // 6. Draw Shipping Containers
      for (const c of CONTAINERS) {
        const cc = worldToCanvas(c.x, c.z);
        const cw = c.w * scale;
        const cd = c.d * scale;

        ctx.save();
        ctx.translate(cc.cx, cc.cy);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-cw / 2, -cd / 2, cw, cd);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-cw / 2, -cd / 2, cw, cd);
        ctx.restore();
      }

      // 7. Draw Combat Practice Targets
      if (engine.arena && engine.arena.targets) {
        for (const t of engine.arena.targets) {
          const tc = worldToCanvas(t.mesh.position.x, t.mesh.position.z);
          const isAlive = t.hp > 0;

          ctx.save();
          ctx.translate(tc.cx, tc.cy);

          ctx.beginPath();
          ctx.moveTo(0, -3.5);
          ctx.lineTo(3.5, 0);
          ctx.lineTo(0, 3.5);
          ctx.lineTo(-3.5, 0);
          ctx.closePath();

          if (isAlive) {
            ctx.fillStyle = '#f59e0b'; // Amber for practice targets
            ctx.fill();
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          } else {
            ctx.fillStyle = '#52525b';
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // 8. Draw Arena Boundary Walls (Perimeter)
      const boundTL = worldToCanvas(-HALF_SIZE, -HALF_SIZE);
      const boundBR = worldToCanvas(HALF_SIZE, HALF_SIZE);
      const bWidth = boundBR.cx - boundTL.cx;
      const bHeight = boundBR.cy - boundTL.cy;

      ctx.strokeStyle = minDist <= 5 ? '#ef4444' : '#10b981';
      ctx.lineWidth = minDist <= 5 ? 2.5 : 1.5;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(boundTL.cx, boundTL.cy, bWidth, bHeight);
      ctx.setLineDash([]);

      // Corner guard brackets on boundary
      const cornerSize = 6;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boundTL.cx, boundTL.cy + cornerSize);
      ctx.lineTo(boundTL.cx, boundTL.cy);
      ctx.lineTo(boundTL.cx + cornerSize, boundTL.cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boundBR.cx - cornerSize, boundTL.cy);
      ctx.lineTo(boundBR.cx, boundTL.cy);
      ctx.lineTo(boundBR.cx, boundTL.cy + cornerSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boundTL.cx, boundBR.cy - cornerSize);
      ctx.lineTo(boundTL.cx, boundBR.cy);
      ctx.lineTo(boundTL.cx + cornerSize, boundBR.cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boundBR.cx - cornerSize, boundBR.cy);
      ctx.lineTo(boundBR.cx, boundBR.cy);
      ctx.lineTo(boundBR.cx, boundBR.cy - cornerSize);
      ctx.stroke();

      // 9. Draw Radar Range Detection Boundary (Perimeter circle around player)
      const playerCanvasPos = worldToCanvas(px, pz);
      const detectionRadiusCanvas = (effectiveRadarRange / viewMeters) * mapRadius;

      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(playerCanvasPos.cx, playerCanvasPos.cy, detectionRadiusCanvas, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 10. Radar Sweep Line (Rotating around player)
      const sweepLength = detectionRadiusCanvas;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(playerCanvasPos.cx, playerCanvasPos.cy);
      ctx.arc(
        playerCanvasPos.cx,
        playerCanvasPos.cy,
        sweepLength,
        sweepAngleRef.current - 0.35,
        sweepAngleRef.current
      );
      ctx.lineTo(playerCanvasPos.cx, playerCanvasPos.cy);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playerCanvasPos.cx, playerCanvasPos.cy);
      ctx.lineTo(
        playerCanvasPos.cx + Math.cos(sweepAngleRef.current) * sweepLength,
        playerCanvasPos.cy + Math.sin(sweepAngleRef.current) * sweepLength
      );
      ctx.stroke();
      ctx.restore();

      // 11. Draw Player Movement Breadcrumbs
      ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      for (let i = 0; i < trailRef.current.length; i++) {
        const pt = trailRef.current[i];
        const pc = worldToCanvas(pt.x, pt.z);
        const ptSize = (i / trailRef.current.length) * 2 + 0.8;
        ctx.beginPath();
        ctx.arc(pc.cx, pc.cy, ptSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // 12. Draw Camera Vision Cone (FOV ~60 degrees)
      const camAngle = Math.atan2(forwardDir.z, forwardDir.x);
      const coneLength = 28;
      const halfFov = (32 * Math.PI) / 180;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(playerCanvasPos.cx, playerCanvasPos.cy);
      ctx.arc(playerCanvasPos.cx, playerCanvasPos.cy, coneLength, camAngle - halfFov, camAngle + halfFov);
      ctx.closePath();
      const coneGradient = ctx.createRadialGradient(
        playerCanvasPos.cx,
        playerCanvasPos.cy,
        2,
        playerCanvasPos.cx,
        playerCanvasPos.cy,
        coneLength
      );
      coneGradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
      coneGradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
      ctx.fillStyle = coneGradient;
      ctx.fill();
      ctx.restore();

      // 13. Draw Player Directional Marker (Tactical Chevron)
      ctx.save();
      ctx.translate(playerCanvasPos.cx, playerCanvasPos.cy);
      const playerAngle = Math.atan2(Math.cos(rotY), Math.sin(rotY));
      ctx.rotate(playerAngle);

      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 1, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // 14. ENEMY BLIPS RENDERING (Only for enemies within radar distance threshold)
      for (const enemy of enemiesWithinRange) {
        const ec = worldToCanvas(enemy.position.x, enemy.position.z);

        ctx.save();
        ctx.translate(ec.cx, ec.cy);

        if (enemy.isAlive) {
          // Radar sweep lighting effect
          // Calculate angle from player to enemy on canvas
          const angleToEnemy = Math.atan2(ec.cy - playerCanvasPos.cy, ec.cx - playerCanvasPos.cx);
          const normAngleToEnemy = (angleToEnemy + Math.PI * 2) % (Math.PI * 2);
          const angleDiff = Math.abs(normAngleToEnemy - sweepAngleRef.current);
          const isSwept = angleDiff < 0.25 || angleDiff > Math.PI * 2 - 0.25;

          // Pulsing danger glow
          const pulsePhase = (timestamp * 0.008) % (Math.PI * 2);
          const pulseScale = 1 + Math.sin(pulsePhase) * 0.25;

          // Outer threat ring
          ctx.beginPath();
          ctx.arc(0, 0, (enemy.isAlerted ? 9 : 7) * pulseScale, 0, Math.PI * 2);
          ctx.fillStyle = isSwept
            ? 'rgba(254, 202, 202, 0.45)'
            : enemy.isAlerted
            ? 'rgba(239, 68, 68, 0.35)'
            : 'rgba(239, 68, 68, 0.2)';
          ctx.fill();

          // Enemy Diamond / Blip Body
          ctx.beginPath();
          ctx.moveTo(0, -5.5);
          ctx.lineTo(5.5, 0);
          ctx.lineTo(0, 5.5);
          ctx.lineTo(-5.5, 0);
          ctx.closePath();
          ctx.fillStyle = isSwept ? '#fca5a5' : '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Facing indicator pip on enemy
          const enemyFacingAngle = Math.atan2(Math.cos(enemy.rotationY), Math.sin(enemy.rotationY));
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.sin(enemyFacingAngle) * 8, -Math.cos(enemyFacingAngle) * 8);
          ctx.stroke();

          // Distance Tag if enemy is close
          if (enemy.distanceToPlayer < 20) {
            ctx.fillStyle = '#fca5a5';
            ctx.font = 'bold 7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${enemy.distanceToPlayer}m`, 0, -8);
          }
        } else {
          // Neutralized hostile: Dimmed Red 'X'
          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-3.5, -3.5);
          ctx.lineTo(3.5, 3.5);
          ctx.moveTo(3.5, -3.5);
          ctx.lineTo(-3.5, 3.5);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 15. Cardinal Direction Badges (N, S, E, W)
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ef4444'; // Red for North
      ctx.fillText('N', centerX, 8);
      ctx.fillStyle = '#71717a';
      ctx.fillText('S', centerX, height - 6);
      ctx.fillText('W', 8, centerY);
      ctx.fillText('E', width - 8, centerY);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [engine, zoomMode, radarRange]);

  return (
    <div className="flex flex-col gap-1 p-2 rounded-lg bg-stone-950/85 border border-stone-800 text-stone-100 pointer-events-auto shadow-2xl backdrop-blur-none select-none">
      {/* MiniMap Tactical Header */}
      <div className="flex items-center justify-between border-b border-stone-800/80 pb-1.5 text-xs font-mono">
        <div className="flex items-center gap-1.5 font-bold">
          <Compass className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '14s' }} />
          <span className="tracking-wider text-[11px] text-emerald-400">RADAR</span>
          {threatStats.inRangeCount > 0 ? (
            <span className="flex items-center gap-1 text-[9px] px-1 rounded bg-red-950 border border-red-500/80 text-red-300 font-bold animate-pulse">
              <Skull className="w-2.5 h-2.5" />
              <span>{threatStats.inRangeCount} FOE</span>
            </span>
          ) : (
            <span className="text-[9px] px-1 rounded bg-stone-900 text-emerald-400/80 font-bold">
              CLEAR
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Radar Distance Range Selector Toggle (24M, 32M, 45M) */}
          <button
            onClick={() => {
              const next = radarRange === 24 ? 32 : radarRange === 32 ? 45 : 24;
              setRadarRange(next);
            }}
            className="px-1.5 py-0.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[9px] font-mono text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
            title="Cycle Enemy Radar Detection Range (24m / 32m / 45m)"
          >
            R:{radarRange}M
          </button>

          {/* Zoom Toggle */}
          <button
            onClick={() => setZoomMode(zoomMode === 'arena' ? 'local' : 'arena')}
            className="px-1.5 py-0.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[9px] font-mono text-stone-300 hover:text-emerald-300 transition-colors cursor-pointer"
            title="Toggle MiniMap Zoom Mode (Full Arena vs Close-Up Follow)"
          >
            {zoomMode === 'arena' ? '70M' : '16M'}
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Radar' : 'Minimize Radar'}
            aria-label="Toggle Radar Size"
          >
            {isCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Radar Screen Canvas */}
      {!isCollapsed ? (
        <div className="relative flex flex-col items-center">
          <div className="relative rounded overflow-hidden border border-stone-800/80 bg-stone-950">
            <canvas
              ref={canvasRef}
              width={180}
              height={180}
              className="block cursor-crosshair"
            />

            {/* Perimeter Wall Proximity Alert Banner */}
            {isNearWall && (
              <div className="absolute top-2 inset-x-2 py-0.5 bg-red-950/90 border border-red-500 rounded text-[9px] font-mono font-bold text-red-300 flex items-center justify-center gap-1 animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                <span>PERIMETER WALL ({coords.distToWall}M)</span>
              </div>
            )}

            {/* Critical Enemy Proximity Threat Banner */}
            {threatStats.isCritical && (
              <div className="absolute bottom-2 inset-x-2 py-0.5 bg-red-950/95 border border-red-500 rounded text-[9px] font-mono font-bold text-red-200 flex items-center justify-center gap-1 animate-bounce shadow-lg">
                <Skull className="w-3 h-3 text-red-400" />
                <span>HOSTILE CLOSE ({threatStats.closestDist}M)</span>
              </div>
            )}
          </div>

          {/* Footer Coordinates & Enemy Threat Readout */}
          <div className="w-full mt-1.5 flex items-center justify-between text-[10px] font-mono text-stone-400">
            <div>
              POS: <span className="text-emerald-400 tabular-nums">X:{coords.x >= 0 ? `+${coords.x}` : coords.x}</span>{' '}
              <span className="text-emerald-400 tabular-nums">Z:{coords.z >= 0 ? `+${coords.z}` : coords.z}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {threatStats.closestDist !== null ? (
                <span className="text-red-400 font-bold tabular-nums">
                  FOE: {threatStats.closestDist}m
                </span>
              ) : (
                <span className="text-amber-300 font-semibold tabular-nums">
                  {coords.heading.toString().padStart(3, '0')}°
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed Compact Readout Bar */
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-stone-300 py-0.5">
          <div className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="tabular-nums">X:{coords.x} Z:{coords.z}</span>
          </div>

          {threatStats.inRangeCount > 0 ? (
            <div className="flex items-center gap-1 text-red-400 font-bold tabular-nums animate-pulse">
              <Skull className="w-3 h-3" />
              <span>{threatStats.inRangeCount} ({threatStats.closestDist}m)</span>
            </div>
          ) : (
            <div className="text-emerald-400 text-[9px]">RADAR CLEAR</div>
          )}

          <div className="text-stone-400 text-[9px]">
            WALL: {coords.distToWall}M
          </div>
        </div>
      )}
    </div>
  );
};
