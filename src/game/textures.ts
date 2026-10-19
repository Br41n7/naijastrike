/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export class TextureGenerator {
  private static setTextureParams(texture: THREE.CanvasTexture, maxAnisotropy = 4) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    texture.needsUpdate = true;
  }

  /**
   * Road asphalt with yellow/white lane stripes and grit
   */
  public static createRoadTexture(maxAnisotropy = 4): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base asphalt dark grey
    ctx.fillStyle = '#1e2124';
    ctx.fillRect(0, 0, 512, 512);

    // Micro noise / grit
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 22;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Center dashed white line
    ctx.fillStyle = '#e2e8f0';
    for (let y = 32; y < 512; y += 128) {
      ctx.fillRect(250, y, 12, 64);
    }

    // Outer solid curb guides
    ctx.fillStyle = '#f59e0b'; // Lagos yellow taxi / road marking hue
    ctx.fillRect(16, 0, 6, 512);
    ctx.fillRect(490, 0, 6, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.setTextureParams(texture, maxAnisotropy);
    return texture;
  }

  /**
   * Paved concrete sidewalk tiles
   */
  public static createSidewalkTexture(maxAnisotropy = 4): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#78716c';
    ctx.fillRect(0, 0, 256, 256);

    // Grid lines for concrete slabs
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 0, 128, 128);
    ctx.strokeRect(0, 128, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);

    // Noise
    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.setTextureParams(texture, maxAnisotropy);
    return texture;
  }

  /**
   * Shipping container corrugated siding with stencil marking
   */
  public static createContainerTexture(
    baseColor: string,
    accentColor: string,
    codeText: string,
    maxAnisotropy = 4
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 256);

    // Corrugation ribs (vertical stripes)
    for (let x = 0; x < 512; x += 32) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(x, 0, 10, 256);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(x + 10, 0, 10, 256);
    }

    // Top and bottom reinforced border
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, 512, 16);
    ctx.fillRect(0, 240, 512, 16);

    // Stencil text
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 28px monospace';
    ctx.fillText(codeText, 36, 70);

    ctx.font = 'bold 16px monospace';
    ctx.fillText('LAGOS APAPA PORT · MAX GW 32,500 KG', 36, 110);
    ctx.fillText('TACTICAL RESUPPLY UNIT #04', 36, 134);

    const texture = new THREE.CanvasTexture(canvas);
    this.setTextureParams(texture, maxAnisotropy);
    return texture;
  }

  /**
   * Nigerian green and white striped market stall canopy
   */
  public static createNaijaStripesTexture(maxAnisotropy = 4): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const stripeWidth = 32;
    for (let x = 0; x < 256; x += stripeWidth * 2) {
      ctx.fillStyle = '#057a55'; // Naija deep green
      ctx.fillRect(x, 0, stripeWidth, 256);
      ctx.fillStyle = '#f9fafb'; // White
      ctx.fillRect(x + stripeWidth, 0, stripeWidth, 256);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.setTextureParams(texture, maxAnisotropy);
    return texture;
  }

  /**
   * High-contrast combat training target bullseye
   */
  public static createTargetTexture(maxAnisotropy = 4): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Background board
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, 256, 256);

    // Concentric rings
    const center = 128;
    const rings = [
      { r: 110, color: '#111827' },
      { r: 90, color: '#ffffff' },
      { r: 70, color: '#111827' },
      { r: 50, color: '#ef4444' }, // Red ring
      { r: 30, color: '#ffffff' },
      { r: 15, color: '#dc2626' }, // Bullseye
    ];

    for (const ring of rings) {
      ctx.beginPath();
      ctx.arc(center, center, ring.r, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.fill();
    }

    // Crosshairs
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center, 10);
    ctx.lineTo(center, 246);
    ctx.moveTo(10, center);
    ctx.lineTo(246, center);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    this.setTextureParams(texture, maxAnisotropy);
    return texture;
  }

  /**
   * Hazard stripes (yellow and black)
   */
  public static createHazardTexture(maxAnisotropy = 4): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    const stripeWidth = 32;
    for (let x = -256; x < 512; x += stripeWidth * 2) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth - 256, 256);
      ctx.lineTo(x - 256, 256);
      ctx.closePath();
    }
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.setTextureParams(texture, maxAnisotropy);
    return texture;
  }
}
