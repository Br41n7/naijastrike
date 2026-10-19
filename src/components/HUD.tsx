/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Shield,
  Heart,
  Zap,
  MousePointer,
  RotateCw,
  HelpCircle,
} from 'lucide-react';
import { PlayerStats } from '../game/types.ts';
import { GameEngine } from '../game/engine.ts';
import { MiniMap } from './MiniMap.tsx';

interface HUDProps {
  engine: GameEngine | null;
  stats: PlayerStats;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRequestPointerLock: () => void;
  isPointerLocked: boolean;
  shoulderSide: 'right' | 'left';
  onToggleShoulder: () => void;
  hitNotification: { text: string; headshot: boolean; id: number } | null;
  onResetPosition: () => void;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  isTouchDevice: boolean;
  showTouchControls: boolean;
  onToggleTouchControls: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  engine,
  stats,
  isMuted,
  onToggleMute,
  onPause,
  onRequestPointerLock,
  isPointerLocked,
  shoulderSide,
  onToggleShoulder,
  hitNotification,
  onResetPosition,
  sensitivity,
  onChangeSensitivity,
  isTouchDevice,
  showTouchControls,
  onToggleTouchControls,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Health color mapping
  const hpPercent = Math.max(0, Math.min(100, (stats.health / stats.maxHealth) * 100));
  const hpColor =
    hpPercent > 60
      ? 'bg-emerald-500'
      : hpPercent > 30
      ? 'bg-amber-500'
      : 'bg-red-500';

  const armorPercent = Math.max(0, Math.min(100, (stats.armor / stats.maxArmor) * 100));
  const staminaPercent = Math.max(0, Math.min(100, (stats.stamina / stats.maxStamina) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 md:p-6 select-none">
      {/* 1. TOP PERIMETER: Status clusters */}
      <div className="w-full flex items-start justify-between">
        {/* Top-Left: Player Vitality Cluster & MiniMap */}
        <div className="flex flex-col gap-2 max-w-[210px] md:max-w-[230px]">
          {/* Vitality Cluster */}
          <div className="flex flex-col gap-2 p-2.5 rounded bg-stone-950/75 border border-stone-800 text-stone-100 pointer-events-auto">
            {/* Health Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>VITALITY</span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-emerald-300">
                  {Math.round(stats.health)} / {stats.maxHealth}
                </span>
              </div>
              <div className="w-full h-2.5 bg-stone-900 rounded-sm overflow-hidden p-0.5 border border-stone-800">
                <div
                  className={`h-full ${hpColor} transition-all duration-150 rounded-xs`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
            </div>

            {/* Armor Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400">
                <div className="flex items-center gap-1.5 font-bold">
                  <Shield className="w-3 h-3 fill-current" />
                  <span>ARMOR</span>
                </div>
                <span className="tabular-nums font-semibold text-cyan-300">
                  {Math.round(stats.armor)} / {stats.maxArmor}
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-900 rounded-sm overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-cyan-500 transition-all duration-150"
                  style={{ width: `${armorPercent}%` }}
                />
              </div>
            </div>

            {/* Stamina Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-amber-400">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>STAMINA</span>
                </div>
                <span className="tabular-nums text-amber-300 font-mono">
                  {Math.round(stats.stamina)}%
                </span>
              </div>
              <div className="w-full h-1 bg-stone-900 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-100"
                  style={{ width: `${staminaPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Mini-Map Radar Display */}
          <MiniMap engine={engine} />
        </div>

        {/* Top-Center: Hit Marker / Feedback Banner */}
        <div className="flex flex-col items-center">
          {hitNotification && (
            <div
              key={hitNotification.id}
              className={`px-3 py-1 rounded text-xs md:text-sm font-display font-bold uppercase tracking-wider animate-bounce ${
                hitNotification.headshot
                  ? 'bg-red-600 text-stone-100 border border-amber-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                  : 'bg-emerald-950/90 text-emerald-300 border border-emerald-500'
              }`}
            >
              {hitNotification.text}
            </div>
          )}
        </div>

        {/* Top-Right: Tactical Ammunition & Quick Actions */}
        <div className="flex items-start gap-2 pointer-events-auto">
          {/* Target Score & Ammo Display */}
          <div className="flex flex-col items-end p-2.5 rounded bg-stone-950/75 border border-stone-800 text-stone-100">
            <div className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
              TARGETS HIT: <span className="text-emerald-400 font-bold tabular-nums">{stats.targetsHit}</span>
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-2xl md:text-3xl font-display font-extrabold tabular-nums tracking-tight ${
                  stats.isReloading
                    ? 'text-amber-400 animate-pulse'
                    : stats.ammo <= 5
                    ? 'text-red-400'
                    : 'text-stone-100'
                }`}
              >
                {stats.isReloading ? 'RELOAD' : stats.ammo}
              </span>
              <span className="text-xs font-mono text-stone-400">/ {stats.maxAmmo}</span>
            </div>
            <div className="text-[9px] font-mono text-stone-400 uppercase">
              SCORE: <span className="text-amber-300 font-semibold tabular-nums">{stats.score}</span>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onToggleMute}
              className="p-2 rounded bg-stone-900/80 border border-stone-700 hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              aria-label="Sound Toggle"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={onPause}
              className="p-2 rounded bg-stone-900/80 border border-stone-700 hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition-colors cursor-pointer"
              title="Pause Game (Esc)"
              aria-label="Pause Game"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. CENTER: Tactical Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-8 h-8 flex items-center justify-center">
          {/* Center pip */}
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
          {/* Top reticle tick */}
          <div className="absolute top-0 w-0.5 h-2 bg-emerald-400/80" />
          {/* Bottom reticle tick */}
          <div className="absolute bottom-0 w-0.5 h-2 bg-emerald-400/80" />
          {/* Left reticle tick */}
          <div className="absolute left-0 w-2 h-0.5 bg-emerald-400/80" />
          {/* Right reticle tick */}
          <div className="absolute right-0 w-2 h-0.5 bg-emerald-400/80" />
        </div>
      </div>

      {/* 3. BOTTOM: Ergonomic Collapsible Dock (Zero Viewport Occlusion) */}
      <div className="w-full flex flex-col items-center pointer-events-auto">
        {/* Toggle Collapse/Expand Drawer Button */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="mb-1 px-3 py-0.5 rounded-t bg-stone-900/90 border-t border-x border-stone-700 text-[10px] font-mono tracking-widest text-stone-400 hover:text-stone-200 flex items-center gap-1.5 cursor-pointer"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3 text-emerald-400" />
              <span>SHOW DOCK</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 text-emerald-400" />
              <span>HIDE DOCK</span>
            </>
          )}
        </button>

        {/* Collapsible Dock Card */}
        {!isDockCollapsed && (
          <div className="w-full max-w-2xl px-4 py-2.5 rounded-lg bg-stone-950/85 border border-stone-800 text-stone-200 flex flex-wrap items-center justify-between gap-3 shadow-2xl backdrop-blur-none">
            {/* Left Items: Shoulder Switch & Pointer Lock */}
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleShoulder}
                className="px-2.5 py-1 rounded bg-stone-900 border border-stone-700 text-xs font-mono text-stone-300 hover:border-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Switch Camera Shoulder (Right/Left)"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>CAM: {shoulderSide.toUpperCase()}</span>
              </button>

              {!isTouchDevice && (
                <button
                  onClick={onRequestPointerLock}
                  className={`px-2.5 py-1 rounded border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isPointerLocked
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-amber-500'
                  }`}
                  title="Lock mouse for seamless 360 FPS look"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>{isPointerLocked ? 'MOUSE LOCKED' : 'LOCK MOUSE'}</span>
                </button>
              )}

              <button
                onClick={onToggleTouchControls}
                className={`px-2 py-1 rounded border text-xs font-mono flex items-center gap-1 cursor-pointer ${
                  showTouchControls
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                }`}
                title="Toggle virtual touch overlay controls"
              >
                <span>TOUCH CONTROLS: {showTouchControls ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Middle: Sensitivity Slider */}
            <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
              <span>SENS</span>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={sensitivity}
                onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
                className="w-20 md:w-28 accent-emerald-500 cursor-pointer"
              />
              <span className="tabular-nums w-7 text-stone-300">{sensitivity.toFixed(1)}x</span>
            </div>

            {/* Right Items: Reset & Help */}
            <div className="flex items-center gap-2">
              <button
                onClick={onResetPosition}
                className="px-2 py-1 rounded bg-stone-900 border border-stone-700 text-xs font-mono text-stone-300 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                title="Respawn / Reset Player to Start"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>RESPAWN</span>
              </button>

              <button
                onClick={() => setShowHelpModal(true)}
                className="p-1 rounded bg-stone-900 border border-stone-700 text-stone-300 hover:text-stone-100 transition-colors cursor-pointer"
                title="View Controls & Help"
                aria-label="Help Guide"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 pointer-events-auto">
          <div className="w-full max-w-md p-6 rounded-lg bg-stone-900 border border-stone-700 text-stone-100 shadow-2xl">
            <h3 className="text-xl font-display font-bold uppercase tracking-wide text-emerald-400 flex items-center gap-2">
              <Crosshair className="w-5 h-5" />
              TACTICAL CONTROL GUIDE
            </h3>

            <div className="mt-4 space-y-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-stone-950/60 border border-stone-800">
                <span className="text-amber-400 font-bold block mb-1">DESKTOP CONTROLS:</span>
                <ul className="space-y-1 text-stone-300">
                  <li>• <strong className="text-stone-100">WASD / Arrow Keys</strong>: Move tactical operator</li>
                  <li>• <strong className="text-stone-100">Mouse Drag / Pointer Lock</strong>: Camera aim and orbit</li>
                  <li>• <strong className="text-stone-100">Left Click</strong>: Fire carbine blaster</li>
                  <li>• <strong className="text-stone-100">Spacebar</strong>: Jump obstacle</li>
                  <li>• <strong className="text-stone-100">Shift</strong>: Tactical sprint (consumes stamina)</li>
                  <li>• <strong className="text-stone-100">R</strong>: Manual weapon reload</li>
                  <li>• <strong className="text-stone-100">Esc</strong>: Pause simulation</li>
                </ul>
              </div>

              <div className="p-2.5 rounded bg-stone-950/60 border border-stone-800">
                <span className="text-emerald-400 font-bold block mb-1">MOBILE TOUCH CONTROLS:</span>
                <ul className="space-y-1 text-stone-300">
                  <li>• <strong className="text-stone-100">Bottom-Left Virtual Stick</strong>: Fluid 360 movement</li>
                  <li>• <strong className="text-stone-100">Upper-Right Screen</strong>: Swipe to aim / look</li>
                  <li>• <strong className="text-stone-100">Action Cluster (Bottom-Right)</strong>: Fire, Jump, Sprint, Reload</li>
                </ul>
              </div>

              <div className="text-[11px] text-stone-400">
                Tip: Colliders prevent walking through buildings and containers; diagonal movement slides smoothly against walls.
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="mt-5 w-full py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-stone-950 font-display font-bold text-sm uppercase tracking-wider transition-colors cursor-pointer"
            >
              CLOSE GUIDE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
