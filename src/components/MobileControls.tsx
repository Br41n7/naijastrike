/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Crosshair, ArrowUp, Zap, RotateCcw } from 'lucide-react';
import { InputManager } from '../game/input.ts';

interface MobileControlsProps {
  inputManager: InputManager;
  onFireDown?: () => void;
  onFireUp?: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  inputManager,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const lookAreaRef = useRef<HTMLDivElement>(null);

  // Joystick visual state
  const [joystickActive, setJoystickActive] = useState(false);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isSprinting, setIsSprinting] = useState(false);

  // Touch look listener
  useEffect(() => {
    const lookEl = lookAreaRef.current;
    if (!lookEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        inputManager.onLookTouchStart(touch.identifier, touch.clientX, touch.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        inputManager.onLookTouchMove(touch.identifier, touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        inputManager.onLookTouchEnd(touch.identifier);
      }
    };

    lookEl.addEventListener('touchstart', handleTouchStart, { passive: false });
    lookEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    lookEl.addEventListener('touchend', handleTouchEnd, { passive: false });
    lookEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      lookEl.removeEventListener('touchstart', handleTouchStart);
      lookEl.removeEventListener('touchmove', handleTouchMove);
      lookEl.removeEventListener('touchend', handleTouchEnd);
      lookEl.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [inputManager]);

  // Virtual Joystick touch handler
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    setJoystickActive(true);
    inputManager.onJoystickTouchStart(touch.identifier, centerX, centerY);
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!joystickActive && e.type !== 'touchstart') return;
    const touch = e.changedTouches[0];
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 40;

    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const offsetX = Math.cos(angle) * clampedDist;
    const offsetY = Math.sin(angle) * clampedDist;

    setKnobOffset({ x: offsetX, y: offsetY });
    inputManager.onJoystickTouchMove(touch.identifier, touch.clientX, touch.clientY);
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    setJoystickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    inputManager.onJoystickTouchEnd(touch.identifier);
  };

  const toggleSprint = () => {
    const next = !isSprinting;
    setIsSprinting(next);
    inputManager.setAction('sprint', next);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none">
      {/* Upper-Right Camera Look Swipe Zone */}
      <div
        ref={lookAreaRef}
        className="absolute top-16 right-0 w-3/5 h-3/5 pointer-events-auto touch-none"
        aria-label="Look Area"
      />

      {/* Bottom-Left Virtual Movement Joystick */}
      <div className="absolute bottom-8 left-6 pointer-events-auto touch-none">
        <div
          ref={joystickRef}
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          className="relative w-32 h-32 rounded-full bg-stone-900/60 border-2 border-emerald-500/40 backdrop-blur-none flex items-center justify-center shadow-lg active:border-emerald-400"
        >
          {/* Directional crosshair lines */}
          <div className="absolute w-full h-[1px] bg-emerald-500/20" />
          <div className="absolute h-full w-[1px] bg-emerald-500/20" />

          {/* Draggable Knob */}
          <div
            className="w-14 h-14 rounded-full bg-emerald-500/80 border-2 border-emerald-300 shadow-md flex items-center justify-center transform transition-transform duration-75"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          >
            <div className="w-4 h-4 rounded-full bg-stone-950/60" />
          </div>
        </div>
        <div className="text-[10px] text-center text-emerald-400/70 font-mono mt-1 tracking-wider uppercase">
          MOVE
        </div>
      </div>

      {/* Bottom-Right Action Buttons Cluster */}
      <div className="absolute bottom-6 right-6 pointer-events-auto flex flex-col items-end gap-3 touch-none">
        {/* Upper Row: Reload + Sprint Toggle */}
        <div className="flex items-center gap-3">
          {/* Reload Button */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              inputManager.setAction('reload', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              inputManager.setAction('reload', false);
            }}
            onMouseDown={() => inputManager.setAction('reload', true)}
            onMouseUp={() => inputManager.setAction('reload', false)}
            className="w-12 h-12 rounded-full bg-stone-900/80 border border-stone-600 text-stone-200 active:bg-amber-500 active:text-stone-950 flex flex-col items-center justify-center shadow-md active:scale-95 transition-transform"
            aria-label="Reload"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-[8px] font-mono font-bold mt-0.5">R</span>
          </button>

          {/* Sprint Toggle */}
          <button
            onClick={toggleSprint}
            className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center shadow-md active:scale-95 transition-all ${
              isSprinting
                ? 'bg-amber-500 border-amber-300 text-stone-950 font-bold'
                : 'bg-stone-900/80 border-stone-600 text-stone-200'
            }`}
            aria-label="Sprint"
          >
            <Zap className="w-5 h-5 fill-current" />
            <span className="text-[8px] font-mono font-bold mt-0.5">SPRINT</span>
          </button>

          {/* Jump Button */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              inputManager.setAction('jump', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              inputManager.setAction('jump', false);
            }}
            onMouseDown={() => inputManager.setAction('jump', true)}
            onMouseUp={() => inputManager.setAction('jump', false)}
            className="w-14 h-14 rounded-full bg-emerald-950/80 border-2 border-emerald-500 text-emerald-300 active:bg-emerald-500 active:text-stone-950 flex flex-col items-center justify-center shadow-lg active:scale-95 transition-transform"
            aria-label="Jump"
          >
            <ArrowUp className="w-6 h-6 stroke-[2.5]" />
            <span className="text-[9px] font-mono font-bold">JUMP</span>
          </button>
        </div>

        {/* Primary Fire Button (Large) */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            inputManager.setAction('fire', true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            inputManager.setAction('fire', false);
          }}
          onMouseDown={() => inputManager.setAction('fire', true)}
          onMouseUp={() => inputManager.setAction('fire', false)}
          className="w-20 h-20 rounded-full bg-red-600/90 border-4 border-amber-400 text-stone-100 active:bg-amber-400 active:text-stone-950 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-transform"
          aria-label="Fire Weapon"
        >
          <Crosshair className="w-8 h-8 stroke-[2.5]" />
          <span className="text-[10px] font-mono font-black tracking-wider">FIRE</span>
        </button>
      </div>
    </div>
  );
};
