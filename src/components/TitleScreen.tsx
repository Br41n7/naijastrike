/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Play, Crosshair, Shield, Smartphone, Monitor } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  isTouchDevice: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, isTouchDevice }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        onStart();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-between items-center p-6 md:p-12 bg-gradient-to-b from-stone-950/80 via-stone-950/60 to-stone-950/90 backdrop-blur-none text-stone-100 select-none">
      {/* Top Banner & Status */}
      <div className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-emerald-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SECTOR 7 // LAGOS PORT TACTICAL GRID</span>
        </div>
        <div className="flex items-center gap-2 text-stone-400">
          {isTouchDevice ? (
            <>
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>TOUCH CONTROLS DETECTED</span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-emerald-400" />
              <span>DESKTOP KEYBOARD + MOUSE</span>
            </>
          )}
        </div>
      </div>

      {/* Hero Title Lockup */}
      <div className="max-w-2xl text-center flex flex-col items-center">
        {/* Bespoke SVG Title Insignia */}
        <div className="mb-3">
          <svg
            className="w-20 h-20 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            {/* Nigerian eagle-inspired tactical chevron */}
            <polygon points="50,6 88,28 88,72 50,94 12,72 12,28" stroke="#10b981" strokeWidth="2.5" />
            <polygon points="50,18 78,35 78,65 50,82 22,65 22,35" stroke="#f59e0b" strokeWidth="1.5" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" />
            <line x1="15" y1="50" x2="85" y2="50" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" />
            <circle cx="50" cy="50" r="14" fill="#047857" stroke="#34d399" strokeWidth="2" />
            <polygon points="50,40 56,56 44,56" fill="#fde047" />
          </svg>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight uppercase font-display bg-gradient-to-r from-emerald-400 via-stone-100 to-amber-400 bg-clip-text text-transparent drop-shadow-lg">
          NAIJA STRIKE
        </h1>
        <p className="mt-2 text-sm md:text-base tracking-[0.25em] text-emerald-400/90 font-mono font-semibold uppercase">
          EKO PROTOCOL // 3D TACTICAL ARENA
        </p>

        <p className="mt-4 text-xs md:text-sm text-stone-300 max-w-lg leading-relaxed font-sans">
          Deploy into a stylized Lagos urban district. Engage tactical practice targets with precision carbine fire, smooth 3rd-person movement, and responsive wall-slide physics.
        </p>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="mt-8 group relative px-8 py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-stone-950 font-display font-bold text-lg uppercase tracking-wider transition-all duration-200 transform hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.35)] flex items-center gap-3 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>ENTER ARENA</span>
          <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-400" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-amber-400" />
        </button>
      </div>

      {/* Flat Control Hints */}
      <div className="w-full flex flex-col items-center gap-2">
        <div className="py-2 px-4 rounded bg-stone-900/80 border border-stone-800 text-[11px] md:text-xs font-mono text-stone-300 text-center tracking-wide">
          {isTouchDevice ? (
            <span>Left Stick: Move · Right Area: Swipe to Look · Touch Buttons: Fire, Jump, Sprint, Reload</span>
          ) : (
            <span>WASD Move · Space Jump · Mouse Aim & Left Click Shoot · Shift Sprint · R Reload · Esc Pause</span>
          )}
        </div>
        <p className="text-[10px] text-stone-500 font-mono">
          NAIJA STRIKE FOUNDATION V1.0 · CLIENT-SIDE 3D PROTOTYPE
        </p>
      </div>
    </div>
  );
};
