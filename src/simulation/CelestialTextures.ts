import * as THREE from 'three';
import { BodyType } from './types';

// Cache generated textures so we don't recreate them needlessly
const textureCache: Record<string, { map: THREE.CanvasTexture; bumpMap?: THREE.CanvasTexture; emissiveMap?: THREE.CanvasTexture }> = {};

/**
 * Creates high-detail procedural textures for celestial bodies using HTML5 Canvas2D.
 * Guarantees zero CORS failures, instant load time, offline operation, and custom scientific aesthetics.
 */
export class CelestialTextureFactory {
  /**
   * Generates or retrieves cached textures for a given celestial body type and base color.
   */
  public static getTextures(type: BodyType, baseColorHex: string): {
    map: THREE.CanvasTexture;
    bumpMap?: THREE.CanvasTexture;
    emissiveMap?: THREE.CanvasTexture;
  } {
    const key = `${type}_${baseColorHex}`;
    if (textureCache[key]) {
      return textureCache[key];
    }

    let textures: { map: THREE.CanvasTexture; bumpMap?: THREE.CanvasTexture; emissiveMap?: THREE.CanvasTexture };

    switch (type) {
      case 'star':
        textures = this.createStarTexture(baseColorHex);
        break;
      case 'planet':
        textures = this.createTerrestrialTexture(baseColorHex);
        break;
      case 'giant':
        textures = this.createGasGiantTexture(baseColorHex);
        break;
      case 'moon':
      case 'asteroid':
        textures = this.createRockyTexture(baseColorHex);
        break;
      case 'blackhole':
      default:
        textures = this.createBlackHoleTexture();
        break;
    }

    textureCache[key] = textures;
    return textures;
  }

  /**
   * Generates a glowing, turbulent solar surface with granulations, flares and hotspots.
   */
  private static createStarTexture(colorHex: string): {
    map: THREE.CanvasTexture;
    emissiveMap: THREE.CanvasTexture;
  } {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Base color gradient (incandescent core to fiery rim)
    const baseCol = new THREE.Color(colorHex);
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, colorHex);
    grad.addColorStop(0.5, '#f59e0b');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Solar granulation cells
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const nx = x / width;
        const ny = y / height;

        // Multi-frequency noise for convective plasma granules
        const n1 = Math.sin(nx * 32 * Math.PI) * Math.cos(ny * 24 * Math.PI);
        const n2 = Math.sin(nx * 64 * Math.PI + 1.2) * Math.sin(ny * 48 * Math.PI + 2.1);
        const n3 = Math.cos(nx * 128 * Math.PI + ny * 96 * Math.PI);
        const turbulence = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2 + 1) * 0.5;

        // Bright flares / sunspots variation
        const flare = Math.sin(nx * 12 * Math.PI) * Math.sin(ny * 8 * Math.PI);
        const intensity = 0.75 + turbulence * 0.35 + (flare > 0.6 ? 0.35 : 0.0);

        data[idx] = Math.min(255, Math.floor(baseCol.r * 255 * intensity * 1.3));
        data[idx + 1] = Math.min(255, Math.floor(baseCol.g * 255 * intensity * 1.15));
        data[idx + 2] = Math.min(255, Math.floor(baseCol.b * 255 * intensity * 0.75));
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Emissive canvas
    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = width;
    emissiveCanvas.height = height;
    const eCtx = emissiveCanvas.getContext('2d')!;
    eCtx.drawImage(canvas, 0, 0);

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;

    const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.ClampToEdgeWrapping;

    return { map, emissiveMap };
  }

  /**
   * Generates Earth-like terrestrial textures: oceans, continents, coastal waters and cloud wisps.
   */
  private static createTerrestrialTexture(colorHex: string): {
    map: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Deep ocean base
    ctx.fillStyle = '#0a2342';
    ctx.fillRect(0, 0, width, height);

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bCtx = bumpCanvas.getContext('2d')!;
    bCtx.fillStyle = '#000000';
    bCtx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const bumpData = bCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const bdata = bumpData.data;

    for (let y = 0; y < height; y++) {
      const lat = (y / height - 0.5) * Math.PI;
      const cosLat = Math.cos(lat);

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const lon = (x / width) * Math.PI * 2;

        // Spherical continent harmonics
        const c1 = Math.sin(lon * 2) * Math.cos(lat * 3);
        const c2 = Math.sin(lon * 4 + 1.2) * Math.sin(lat * 5 + 0.8) * 0.5;
        const c3 = Math.cos(lon * 8 + lat * 6) * 0.25;
        const c4 = Math.sin(lon * 16) * Math.cos(lat * 12) * 0.12;
        const landNoise = c1 + c2 + c3 + c4;

        // Ice caps at extreme latitudes
        const isPolar = Math.abs(lat) > 1.2;

        if (isPolar) {
          // Polar ice
          data[idx] = 230;
          data[idx + 1] = 240;
          data[idx + 2] = 255;
          bdata[idx] = 160;
        } else if (landNoise > 0.08) {
          // Continent / Mountain ranges
          const heightVal = Math.min(1.0, (landNoise - 0.08) * 2.2);
          if (heightVal > 0.7) {
            // Mountain peaks (snow/rock)
            data[idx] = 190;
            data[idx + 1] = 175;
            data[idx + 2] = 160;
            bdata[idx] = 255;
          } else if (heightVal > 0.3) {
            // Forest / Vegetation / Plains
            data[idx] = 34 + Math.floor(heightVal * 50);
            data[idx + 1] = 120 + Math.floor(heightVal * 40);
            data[idx + 2] = 45;
            bdata[idx] = 180;
          } else {
            // Coastal green/arid
            data[idx] = 70;
            data[idx + 1] = 140;
            data[idx + 2] = 80;
            bdata[idx] = 90;
          }
        } else if (landNoise > -0.05) {
          // Shallow coastal waters / continental shelf (cyan turquoise)
          data[idx] = 14;
          data[idx + 1] = 110;
          data[idx + 2] = 160;
          bdata[idx] = 30;
        } else {
          // Deep abyss ocean
          data[idx] = 8;
          data[idx + 1] = 28;
          data[idx + 2] = 68;
          bdata[idx] = 0;
        }

        // Swirling atmospheric clouds
        const cloud1 = Math.sin(lon * 6 + Math.sin(lat * 8)) * Math.cos(lat * 4);
        const cloud2 = Math.sin(lon * 12 + 2.5) * Math.cos(lat * 10);
        const cloudNoise = cloud1 * 0.6 + cloud2 * 0.4;
        if (cloudNoise > 0.32 && !isPolar) {
          const alpha = Math.min(1.0, (cloudNoise - 0.32) * 2.8);
          data[idx] = Math.floor(data[idx] * (1 - alpha) + 245 * alpha);
          data[idx + 1] = Math.floor(data[idx + 1] * (1 - alpha) + 250 * alpha);
          data[idx + 2] = Math.floor(data[idx + 2] * (1 - alpha) + 255 * alpha);
        }

        data[idx + 3] = 255;
        bdata[idx + 1] = bdata[idx];
        bdata[idx + 2] = bdata[idx];
        bdata[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    bCtx.putImageData(bumpData, 0, 0);

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.ClampToEdgeWrapping;

    return { map, bumpMap };
  }

  /**
   * Generates Jupiter-like gas giant atmospheric bands, wavy turbulence and Great Red Spot storm vortex.
   */
  private static createGasGiantTexture(colorHex: string): {
    map: THREE.CanvasTexture;
  } {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Jovian atmospheric palette
    const colors = [
      '#d97706', // ochre
      '#fef3c7', // light cream
      '#b45309', // amber-brown
      '#fffbeb', // bright ammonia cloud
      '#78350f', // deep storm belt
      '#fed7aa', // pastel orange
      '#9a3412', // terracotta
    ];

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Spot coordinates (normalized): (0.6, 0.65)
    const spotX = 0.58;
    const spotY = 0.68;
    const spotRadiusX = 0.08;
    const spotRadiusY = 0.04;

    for (let y = 0; y < height; y++) {
      const ny = y / height;
      // Multi-band zonal flow
      const baseBand = Math.sin(ny * 22 * Math.PI) * 0.5 + 0.5;

      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const idx = (y * width + x) * 4;

        // Wave turbulence between shear bands
        const wave = Math.sin(nx * 16 * Math.PI + ny * 8) * 0.04 +
                     Math.cos(nx * 32 * Math.PI - ny * 12) * 0.02;

        const effectiveY = Math.min(0.999, Math.max(0.001, ny + wave));
        const bandVal = (Math.sin(effectiveY * 26 * Math.PI) + 1) * 0.5;

        // Palette interpolation
        const colIdx = Math.floor(bandVal * (colors.length - 1));
        const c1 = new THREE.Color(colors[colIdx]);
        const c2 = new THREE.Color(colors[Math.min(colors.length - 1, colIdx + 1)]);
        const blend = (bandVal * (colors.length - 1)) % 1;

        let r = THREE.MathUtils.lerp(c1.r, c2.r, blend);
        let g = THREE.MathUtils.lerp(c1.g, c2.g, blend);
        let b = THREE.MathUtils.lerp(c1.b, c2.b, blend);

        // Great Red Spot Oval Vortex
        const dx = (nx - spotX) / spotRadiusX;
        const dy = (ny - spotY) / spotRadiusY;
        const distSq = dx * dx + dy * dy;

        if (distSq < 1.0) {
          const stormAlpha = Math.cos(distSq * (Math.PI / 2));
          // Swirling reddish-orange vortex
          const spiralAngle = Math.atan2(dy, dx) + Math.sqrt(distSq) * 4.0;
          const spiralBand = Math.sin(spiralAngle * 3) * 0.15;

          r = THREE.MathUtils.lerp(r, 0.88 + spiralBand, stormAlpha);
          g = THREE.MathUtils.lerp(g, 0.22 + spiralBand * 0.5, stormAlpha);
          b = THREE.MathUtils.lerp(b, 0.12, stormAlpha);
        }

        data[idx] = Math.floor(r * 255);
        data[idx + 1] = Math.floor(g * 255);
        data[idx + 2] = Math.floor(b * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;

    return { map };
  }

  /**
   * Generates Moon/Asteroid rocky surfaces with impact craters and granular basalt noise.
   */
  private static createRockyTexture(colorHex: string): {
    map: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
  } {
    const width = 256;
    const height = 128;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Gray rocky base
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, width, height);

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bCtx = bumpCanvas.getContext('2d')!;
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const bData = bCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const bdata = bData.data;

    // Deterministic crater centers
    const craters = [
      { x: 45, y: 35, r: 18 },
      { x: 130, y: 70, r: 24 },
      { x: 200, y: 40, r: 15 },
      { x: 90, y: 95, r: 12 },
      { x: 170, y: 105, r: 16 },
      { x: 225, y: 85, r: 10 },
      { x: 20, y: 80, r: 9 },
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Granular basalt noise
        const grain = (Math.random() - 0.5) * 28;
        let bumpVal = 128 + grain;
        let colVal = 140 + grain;

        // Check distance to craters
        for (const c of craters) {
          const dx = x - c.x;
          const dy = y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < c.r) {
            const factor = dist / c.r;
            // Center is depressed (dark), rim is elevated (bright)
            if (factor > 0.8) {
              // Rim
              bumpVal += 65 * (1 - Math.abs(factor - 0.9) * 10);
              colVal += 45;
            } else {
              // Depression
              bumpVal -= 50 * (1 - factor);
              colVal -= 35;
            }
          }
        }

        colVal = Math.min(255, Math.max(20, colVal));
        bumpVal = Math.min(255, Math.max(0, bumpVal));

        data[idx] = colVal;
        data[idx + 1] = colVal;
        data[idx + 2] = colVal;
        data[idx + 3] = 255;

        bdata[idx] = bumpVal;
        bdata[idx + 1] = bumpVal;
        bdata[idx + 2] = bumpVal;
        bdata[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    bCtx.putImageData(bData, 0, 0);

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.ClampToEdgeWrapping;

    return { map, bumpMap };
  }

  /**
   * Black hole texture (event horizon core).
   */
  private static createBlackHoleTexture(): {
    map: THREE.CanvasTexture;
  } {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 64, 32);

    const map = new THREE.CanvasTexture(canvas);
    return { map };
  }

  /**
   * Creates an accretion disk texture with relativistic beaming and radial Doppler gradation.
   */
  public static createAccretionDiskTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size / 2;
    const innerRadius = size * 0.22;

    const grad = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)'); // Ultra-hot inner ISCO
    grad.addColorStop(0.15, 'rgba(251, 191, 36, 0.92)'); // Brilliant gold
    grad.addColorStop(0.4, 'rgba(249, 115, 22, 0.85)'); // Hot amber
    grad.addColorStop(0.75, 'rgba(220, 38, 38, 0.5)'); // Dark crimson
    grad.addColorStop(0.95, 'rgba(126, 34, 206, 0.15)'); // Relativistic blueshift edge
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Fine concentric spiral density rings
    ctx.save();
    ctx.translate(centerX, centerY);
    for (let r = innerRadius; r < outerRadius; r += 3) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.08})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
}
