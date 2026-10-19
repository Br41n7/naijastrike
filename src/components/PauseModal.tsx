/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, RotateCw, Volume2, VolumeX, Settings, X } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onReset: () => void;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  invertY: boolean;
  onToggleInvertY: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onReset,
  sensitivity,
  onChangeSensitivity,
  invertY,
  onToggleInvertY,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-none text-stone-100 select-none">
      <div className="w-full max-w-md p-6 rounded-xl bg-stone-900 border-2 border-stone-700 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-stone-100">
              MISSION PAUSED
            </h2>
          </div>
          <button
            onClick={onResume}
            className="p-1 rounded text-stone-400 hover:text-stone-100 hover:bg-stone-800 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4 font-mono text-xs">
          {/* Sensitivity Slider */}
          <div className="flex items-center justify-between p-3 rounded bg-stone-950/50 border border-stone-800">
            <span className="text-stone-300">LOOK SENSITIVITY</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={sensitivity}
                onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
                className="w-28 accent-emerald-500 cursor-pointer"
              />
              <span className="tabular-nums w-8 text-right text-emerald-400 font-bold">
                {sensitivity.toFixed(1)}x
              </span>
            </div>
          </div>

          {/* Invert Y */}
          <div className="flex items-center justify-between p-3 rounded bg-stone-950/50 border border-stone-800">
            <span className="text-stone-300">INVERT VERTICAL LOOK (Y)</span>
            <button
              onClick={onToggleInvertY}
              className={`px-3 py-1 rounded border font-bold cursor-pointer transition-colors ${
                invertY
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-stone-900 border-stone-700 text-stone-400'
              }`}
            >
              {invertY ? 'INVERTED' : 'NORMAL'}
            </button>
          </div>

          {/* Sound Mute */}
          <div className="flex items-center justify-between p-3 rounded bg-stone-950/50 border border-stone-800">
            <span className="text-stone-300">SYNTHETIC AUDIO</span>
            <button
              onClick={onToggleMute}
              className="flex items-center gap-2 px-3 py-1 rounded bg-stone-900 border border-stone-700 hover:border-emerald-500 text-stone-300 cursor-pointer"
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-red-400" />
                  <span>MUTED</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>ENABLED</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-stone-800">
          <button
            onClick={onResume}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-stone-950 font-display font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>RESUME MISSION</span>
          </button>

          <button
            onClick={() => {
              onReset();
              onResume();
            }}
            className="w-full py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            <span>RESPAWN OPERATOR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
