/* Developed by Muzammil */
/**
 * Hexa Sort - Hexagonal Mathematics & 3D Isometric Sprite Renderer
 * Implements 1:1 gameplay mockup rendering with preloaded 3D glossy coin sprites,
 * 19-slot wooden honeycomb layout, and smooth elevation physics.
 */

// Asset file definitions
const GAME_ASSET_PATHS = {
  board: 'assets/game-page-ui/board-full.png',
  tray: 'assets/game-page-ui/new-coins-bg.png',
  slot: 'assets/game-page-ui/hexa-place.png',
  blue: 'assets/game-page-ui/blue.png',
  red: 'assets/game-page-ui/red.png',
  green: 'assets/game-page-ui/green.png',
  yellow: 'assets/game-page-ui/yellow.png',
  orange: 'assets/game-page-ui/orange.png',
  purple: 'assets/game-page-ui/purple.png'
};

const GAME_IMAGES = {};
let gameAssetsLoaded = false;

function preloadGameAssets() {
  const promises = Object.entries(GAME_ASSET_PATHS).map(([key, src]) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        GAME_IMAGES[key] = img;
        resolve();
      };
      img.onerror = () => {
        console.warn('Could not load image asset:', src);
        resolve();
      };
    });
  });
  return Promise.all(promises).then(() => {
    gameAssetsLoaded = true;
  });
}

// Start preloading immediately
preloadGameAssets();

// 6 Color Definitions matching 3D coin assets
const HEX_PALETTE = {
  blue: {
    id: 'blue',
    name: 'Blue',
    top: '#2563eb',
    topLight: '#60a5fa',
    side1: '#1d4ed8',
    side2: '#1e40af',
    border: 'rgba(255, 255, 255, 0.45)',
    particle: '#60a5fa'
  },
  red: {
    id: 'red',
    name: 'Red',
    top: '#dc2626',
    topLight: '#f87171',
    side1: '#b91c1c',
    side2: '#991b1b',
    border: 'rgba(255, 255, 255, 0.45)',
    particle: '#f87171'
  },
  green: {
    id: 'green',
    name: 'Green',
    top: '#16a34a',
    topLight: '#4ade80',
    side1: '#15803d',
    side2: '#166534',
    border: 'rgba(255, 255, 255, 0.45)',
    particle: '#4ade80'
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    top: '#eab308',
    topLight: '#fde047',
    side1: '#ca8a04',
    side2: '#a16207',
    border: 'rgba(255, 255, 255, 0.5)',
    particle: '#fde047'
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    top: '#f97316',
    topLight: '#fb923c',
    side1: '#ea580c',
    side2: '#c2410c',
    border: 'rgba(255, 255, 255, 0.5)',
    particle: '#fb923c'
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    top: '#9333ea',
    topLight: '#c084fc',
    side1: '#7e22ce',
    side2: '#6b21a8',
    border: 'rgba(255, 255, 255, 0.45)',
    particle: '#c084fc'
  }
};

const COLOR_KEYS = Object.keys(HEX_PALETTE);

// 19 Slot definitions matching board-full.png exactly (274x247 aspect ratio 1.1093)
const BOARD_SLOT_DEFS = [
  // Col -2 (leftmost, 3 slots)
  { id: '-2,-1', col: -2, r: -1, u: -0.36964, v: -0.20285 },
  { id: '-2,0',  col: -2, r: 0,  u: -0.36995, v: -0.00697 },
  { id: '-2,1',  col: -2, r: 1,  u: -0.36972, v: 0.18938 },

  // Col -1 (4 slots)
  { id: '-1,-1.5', col: -1, r: -1.5, u: -0.18466, v: -0.30010 },
  { id: '-1,-0.5', col: -1, r: -0.5, u: -0.18389, v: -0.10252 },
  { id: '-1,0.5',  col: -1, r: 0.5,  u: -0.18389, v: 0.09160 },
  { id: '-1,1.5',  col: -1, r: 1.5,  u: -0.18345, v: 0.28753 },

  // Col 0 (center column, 5 slots)
  { id: '0,-2', col: 0, r: -2, u: 0.00076, v: -0.39716 },
  { id: '0,-1', col: 0, r: -1, u: 0.00097, v: -0.20074 },
  { id: '0,0',  col: 0, r: 0,  u: 0.00121, v: -0.00521 },
  { id: '0,1',  col: 0, r: 1,  u: 0.00148, v: 0.19022 },
  { id: '0,2',  col: 0, r: 2,  u: 0.00137, v: 0.38451 },

  // Col 1 (4 slots)
  { id: '1,-1.5', col: 1, r: -1.5, u: 0.18636, v: -0.29949 },
  { id: '1,-0.5', col: 1, r: -0.5, u: 0.18641, v: -0.10331 },
  { id: '1,0.5',  col: 1, r: 0.5,  u: 0.18643, v: 0.09177 },
  { id: '1,1.5',  col: 1, r: 1.5,  u: 0.18640, v: 0.28766 },

  // Col 2 (rightmost, 3 slots)
  { id: '2,-1', col: 2, r: -1, u: 0.37113, v: -0.20235 },
  { id: '2,0',  col: 2, r: 0,  u: 0.37117, v: -0.00686 },
  { id: '2,1',  col: 2, r: 1,  u: 0.37104, v: 0.19034 }
];

// 6 Adjacency directions in (col, r) space
const HEX_NEIGHBORS = [
  { dc: 0, dr: -1 },    // North (Directly above)
  { dc: 0, dr: 1 },     // South (Directly below)
  { dc: 1, dr: -0.5 },  // North-East
  { dc: 1, dr: 0.5 },   // South-East
  { dc: -1, dr: -0.5 }, // North-West
  { dc: -1, dr: 0.5 }   // South-West
];

class HexMath {
  static DIRECTIONS = HEX_NEIGHBORS;

  static lerp(start, end, t) {
    return start + (end - start) * t;
  }

  static easeOutCubic(t) {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  }

  static distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }
}

class HexRenderer {
  static distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  /**
   * Draw stack of 3D coin sprites from bottom to top with vertical offset
   */
  static drawStack(ctx, cx, cy, size, stack, options = {}) {
    if (!stack || stack.length === 0) return;

    const {
      scale = 1,
      elevationY = 0,
      showCount = false,
      liftShadow = false,
      alpha = 1,
      burstProgress = 0
    } = options;

    const count = stack.length;
    // Normalized 3D coin dimensions: width:height ratio is 60:54 = 1.111
    const coinW = size * 1.54 * scale;
    const coinH = coinW * (54 / 60);
    const tileStep = coinH * 0.22; // ~22% vertical offset for natural 3D stack

    // Dynamic ground shadow
    ctx.save();
    ctx.globalAlpha = (liftShadow ? 0.35 : 0.55) * alpha;
    ctx.beginPath();
    const shadowY = liftShadow ? cy + 28 : cy + 8;
    const shadowRx = (coinW * 0.44) * (liftShadow ? 0.9 : 1.0);
    const shadowRy = (coinH * 0.22) * (liftShadow ? 0.9 : 1.0);
    ctx.ellipse(cx, shadowY, shadowRx, shadowRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 8, 20, 0.7)';
    ctx.fill();
    ctx.restore();

    // Draw each coin from bottom to top
    for (let i = 0; i < count; i++) {
      const colorKey = stack[i];
      const tileY = cy - (i * tileStep) - elevationY;
      const currentScale = 1 + burstProgress * 0.32;
      const currentAlpha = Math.max(0, Math.min(1, alpha * (1 - burstProgress)));

      const img = GAME_IMAGES[colorKey];
      if (img && img.complete) {
        ctx.save();
        ctx.globalAlpha = currentAlpha;
        const dw = coinW * currentScale;
        const dh = coinH * currentScale;
        ctx.drawImage(img, cx - dw / 2, tileY - dh / 2, dw, dh);
        ctx.restore();
      } else {
        // Fallback polygon
        HexRenderer.drawFallbackTile(ctx, cx, tileY, size * scale, colorKey, currentAlpha);
      }
    }

    // Stack Count Badge on top tile (if requested and count > 1)
    if (showCount && count > 1 && burstProgress === 0) {
      const topY = cy - ((count - 1) * tileStep) - elevationY;
      ctx.save();
      ctx.font = `bold ${Math.round(size * 0.42)}px 'Fredoka', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Warm drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillText(count, cx, topY + 1.5);

      // Clean white text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(count, cx, topY);
      ctx.restore();
    }
  }

  /**
   * Draw a single 3D tile (used by flying tiles during merges)
   */
  static draw3DTile(ctx, cx, cy, size, colorKey, thickness = 6, scale = 1, alpha = 1) {
    const img = GAME_IMAGES[colorKey];
    const coinW = size * 1.54 * scale;
    const coinH = coinW * (54 / 60);
    if (img && img.complete) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.drawImage(img, cx - coinW / 2, cy - coinH / 2, coinW, coinH);
      ctx.restore();
    } else {
      HexRenderer.drawFallbackTile(ctx, cx, cy, size * scale, colorKey, alpha);
    }
  }

  /**
   * Draw empty slot highlight / cavity ring
   */
  static drawEmptySlot(ctx, cx, cy, size, isHovered = false, isValid = true) {
    if (!isHovered) return;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.72, size * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = isValid ? 'rgba(0, 210, 211, 0.28)' : 'rgba(230, 57, 70, 0.28)';
    ctx.strokeStyle = isValid ? '#00d2d3' : '#e63946';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = isValid ? '#00d2d3' : '#e63946';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Fallback 2D beveled prism if image is loading
   */
  static drawFallbackTile(ctx, cx, cy, size, colorKey, alpha = 1) {
    const colorObj = HEX_PALETTE[colorKey] || HEX_PALETTE.blue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.7, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = colorObj.top;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

window.HEX_PALETTE = HEX_PALETTE;
window.COLOR_KEYS = COLOR_KEYS;
window.BOARD_SLOT_DEFS = BOARD_SLOT_DEFS;
window.HEX_NEIGHBORS = HEX_NEIGHBORS;
window.HexMath = HexMath;
window.HexRenderer = HexRenderer;
window.GAME_IMAGES = GAME_IMAGES;
window.preloadGameAssets = preloadGameAssets;
