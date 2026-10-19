/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputState } from './types.ts';

export class InputManager {
  public state: InputState = {
    forward: 0,
    strafe: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    jump: false,
    sprint: false,
    fire: false,
    reload: false,
  };

  private keysHeld: Record<string, boolean> = {};
  private isPointerLocked = false;
  private isDraggingMouse = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Mobile virtual joystick state
  private joystickActive = false;
  private joystickTouchId: number | null = null;
  private joystickOriginX = 0;
  private joystickOriginY = 0;
  private joystickRadius = 45; // Pixels max displacement

  // Mobile touch look swipe state
  private lookTouchId: number | null = null;
  private lastTouchLookX = 0;
  private lastTouchLookY = 0;

  // Settings
  public mouseSensitivity = 0.0022;
  public touchSensitivity = 0.0045;
  public invertY = false;

  private domElement: HTMLElement | null = null;
  private onPointerLockChangeCallback?: (locked: boolean) => void;
  private onPauseCallback?: () => void;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
  }

  public attach(
    element: HTMLElement,
    callbacks?: {
      onPointerLockChange?: (locked: boolean) => void;
      onPause?: () => void;
    }
  ) {
    this.domElement = element;
    this.onPointerLockChangeCallback = callbacks?.onPointerLockChange;
    this.onPauseCallback = callbacks?.onPause;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    element.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  public detach() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    if (this.domElement) {
      this.domElement.removeEventListener('mousedown', this.handleMouseDown);
    }
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.resetAll();
  }

  public requestPointerLock() {
    if (this.domElement && !this.isPointerLocked) {
      try {
        this.domElement.requestPointerLock();
      } catch (err) {
        console.warn('Pointer lock request error:', err);
      }
    }
  }

  public exitPointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  public getPointerLocked(): boolean {
    return this.isPointerLocked;
  }

  private handlePointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    if (this.onPointerLockChangeCallback) {
      this.onPointerLockChangeCallback(this.isPointerLocked);
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    this.keysHeld[e.code] = true;

    if (e.code === 'KeyR') {
      this.state.reload = true;
    }
    if (e.code === 'Space') {
      this.state.jump = true;
      e.preventDefault();
    }
    if (e.code === 'Escape') {
      if (this.onPauseCallback) {
        this.onPauseCallback();
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keysHeld[e.code] = false;
    if (e.code === 'KeyR') {
      this.state.reload = false;
    }
    if (e.code === 'Space') {
      this.state.jump = false;
    }
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      // Left click
      this.state.fire = true;
      this.isDraggingMouse = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.isPointerLocked) {
      this.state.lookDeltaX += e.movementX * this.mouseSensitivity;
      this.state.lookDeltaY += (this.invertY ? -e.movementY : e.movementY) * this.mouseSensitivity;
    } else if (this.isDraggingMouse) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      this.state.lookDeltaX += dx * this.mouseSensitivity;
      this.state.lookDeltaY += (this.invertY ? -dy : dy) * this.mouseSensitivity;
    }
  }

  private handleMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.state.fire = false;
      this.isDraggingMouse = false;
    }
  }

  private handleWindowBlur() {
    this.resetAll();
  }

  public resetAll() {
    this.keysHeld = {};
    this.state.forward = 0;
    this.state.strafe = 0;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    this.state.jump = false;
    this.state.sprint = false;
    this.state.fire = false;
    this.state.reload = false;
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.lookTouchId = null;
    this.isDraggingMouse = false;
  }

  // Mobile Touch Joystick Handlers
  public onJoystickTouchStart(touchId: number, startX: number, startY: number) {
    this.joystickActive = true;
    this.joystickTouchId = touchId;
    this.joystickOriginX = startX;
    this.joystickOriginY = startY;
  }

  public onJoystickTouchMove(touchId: number, clientX: number, clientY: number) {
    if (!this.joystickActive || this.joystickTouchId !== touchId) return;

    const dx = clientX - this.joystickOriginX;
    const dy = clientY - this.joystickOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.state.strafe = 0;
      this.state.forward = 0;
      return;
    }

    const clampedDist = Math.min(dist, this.joystickRadius);
    const normX = (dx / dist) * (clampedDist / this.joystickRadius);
    const normY = (dy / dist) * (clampedDist / this.joystickRadius);

    this.state.strafe = normX;
    this.state.forward = -normY; // Drag up is forward
  }

  public onJoystickTouchEnd(touchId: number) {
    if (this.joystickTouchId === touchId) {
      this.joystickActive = false;
      this.joystickTouchId = null;
      this.state.strafe = 0;
      this.state.forward = 0;
    }
  }

  // Mobile Touch Look Pad Handlers
  public onLookTouchStart(touchId: number, clientX: number, clientY: number) {
    this.lookTouchId = touchId;
    this.lastTouchLookX = clientX;
    this.lastTouchLookY = clientY;
  }

  public onLookTouchMove(touchId: number, clientX: number, clientY: number) {
    if (this.lookTouchId !== touchId) return;

    const dx = clientX - this.lastTouchLookX;
    const dy = clientY - this.lastTouchLookY;
    this.lastTouchLookX = clientX;
    this.lastTouchLookY = clientY;

    this.state.lookDeltaX += dx * this.touchSensitivity;
    this.state.lookDeltaY += (this.invertY ? -dy : dy) * this.touchSensitivity;
  }

  public onLookTouchEnd(touchId: number) {
    if (this.lookTouchId === touchId) {
      this.lookTouchId = null;
    }
  }

  // Direct Mobile Action Buttons
  public setAction(action: 'jump' | 'sprint' | 'fire' | 'reload', active: boolean) {
    this.state[action] = active;
  }

  /**
   * Consolidates keyboard inputs and resets single-frame deltas
   */
  public update(): InputState {
    // If not using mobile virtual joystick, compute from keyboard WASD / Arrow keys
    if (!this.joystickActive) {
      let forward = 0;
      let strafe = 0;

      if (this.keysHeld['KeyW'] || this.keysHeld['ArrowUp']) forward += 1;
      if (this.keysHeld['KeyS'] || this.keysHeld['ArrowDown']) forward -= 1;
      if (this.keysHeld['KeyA'] || this.keysHeld['ArrowLeft']) strafe -= 1;
      if (this.keysHeld['KeyD'] || this.keysHeld['ArrowRight']) strafe += 1;

      this.state.forward = forward;
      this.state.strafe = strafe;
    }

    // Sprint key
    if (this.keysHeld['ShiftLeft'] || this.keysHeld['ShiftRight']) {
      this.state.sprint = true;
    }

    return this.state;
  }

  /**
   * Clears accumulated mouse/touch look deltas after applying to camera
   */
  public consumeLookDeltas(): { dx: number; dy: number } {
    const dx = this.state.lookDeltaX;
    const dy = this.state.lookDeltaY;
    this.state.lookDeltaX = 0;
    this.state.lookDeltaY = 0;
    return { dx, dy };
  }
}
