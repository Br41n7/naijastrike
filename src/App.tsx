/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/engine.ts';
import { soundSystem } from './game/audio.ts';
import { PlayerStats } from './game/types.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { HUD } from './components/HUD.tsx';
import { MobileControls } from './components/MobileControls.tsx';
import { PauseModal } from './components/PauseModal.tsx';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Game state
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused'>('title');
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    maxHealth: 100,
    armor: 75,
    maxArmor: 100,
    stamina: 100,
    maxStamina: 100,
    ammo: 30,
    maxAmmo: 30,
    isReloading: false,
    score: 0,
    targetsHit: 0,
    totalTargets: 6,
    speed: 0,
    isGrounded: true,
  });

  const [isMuted, setIsMuted] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [shoulderSide, setShoulderSide] = useState<'right' | 'left'>('right');
  const [hitNotification, setHitNotification] = useState<{ text: string; headshot: boolean; id: number } | null>(null);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [invertY, setInvertY] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(false);

  // Detect touch device on mount
  useEffect(() => {
    const hasTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    setIsTouchDevice(hasTouch);
    setShowTouchControls(hasTouch);
  }, []);

  // Initialize Three.js Game Engine once
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const engine = new GameEngine(container);
    engineRef.current = engine;

    // React callbacks
    engine.onStatsUpdate = (newStats) => {
      // Throttle update state
      setStats((prev) => {
        if (
          prev.health === newStats.health &&
          prev.armor === newStats.armor &&
          prev.ammo === newStats.ammo &&
          prev.score === newStats.score &&
          prev.isReloading === newStats.isReloading &&
          Math.abs(prev.stamina - newStats.stamina) < 1
        ) {
          return prev;
        }
        return newStats;
      });
    };

    engine.onHitFeedback = (info) => {
      const text = info.headshot ? `HEADSHOT CRIT +${info.damage}!` : `TARGET HIT +${info.damage}`;
      setHitNotification({
        text,
        headshot: info.headshot,
        id: Date.now(),
      });
      setTimeout(() => {
        setHitNotification(null);
      }, 1200);
    };

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Update sensitivity in engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.input.mouseSensitivity = 0.0022 * sensitivity;
      engineRef.current.input.touchSensitivity = 0.0045 * sensitivity;
    }
  }, [sensitivity]);

  // Update Invert Y in engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.input.invertY = invertY;
    }
  }, [invertY]);

  // Audio mute sync
  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    soundSystem.setMuted(next);
  }, [isMuted]);

  // Shoulder view switch
  const toggleShoulder = useCallback(() => {
    const next = shoulderSide === 'right' ? 'left' : 'right';
    setShoulderSide(next);
    if (engineRef.current) {
      engineRef.current.cameraController.setShoulder(next);
    }
  }, [shoulderSide]);

  // Pointer lock request
  const requestPointerLock = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.input.requestPointerLock();
    }
  }, []);

  // Check pointer lock changes
  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(!!document.pointerLockElement);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, []);

  // Reset player position
  const resetPlayerPosition = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.player.respawn();
    }
  }, []);

  // Game state handlers
  const handleStartGame = () => {
    setGameState('playing');
    if (!isTouchDevice && engineRef.current) {
      engineRef.current.input.requestPointerLock();
    }
  };

  const handlePauseGame = () => {
    setGameState('paused');
    if (engineRef.current) {
      engineRef.current.setPaused(true);
    }
  };

  const handleResumeGame = () => {
    setGameState('playing');
    if (engineRef.current) {
      engineRef.current.setPaused(false);
      if (!isTouchDevice) {
        engineRef.current.input.requestPointerLock();
      }
    }
  };

  // Keyboard shortcut for Esc -> Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && gameState === 'playing') {
        handlePauseGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950 font-sans select-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen onStart={handleStartGame} isTouchDevice={isTouchDevice} />
      )}

      {/* In-Game HUD (Perimeter Low-Occlusion) */}
      {gameState !== 'title' && (
        <HUD
          engine={engineRef.current}
          stats={stats}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onPause={handlePauseGame}
          onRequestPointerLock={requestPointerLock}
          isPointerLocked={isPointerLocked}
          shoulderSide={shoulderSide}
          onToggleShoulder={toggleShoulder}
          hitNotification={hitNotification}
          onResetPosition={resetPlayerPosition}
          sensitivity={sensitivity}
          onChangeSensitivity={setSensitivity}
          isTouchDevice={isTouchDevice}
          showTouchControls={showTouchControls}
          onToggleTouchControls={() => setShowTouchControls(!showTouchControls)}
        />
      )}

      {/* Mobile Touch Controls Overlay (Virtual Joystick & Action Buttons) */}
      {gameState === 'playing' && showTouchControls && engineRef.current && (
        <MobileControls inputManager={engineRef.current.input} />
      )}

      {/* Pause & Settings Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResumeGame}
          onReset={resetPlayerPosition}
          sensitivity={sensitivity}
          onChangeSensitivity={setSensitivity}
          invertY={invertY}
          onToggleInvertY={() => setInvertY(!invertY)}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />
      )}
    </div>
  );
}
