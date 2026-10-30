/* Developed by Muzammil */
/**
 * Hexa Sort - Production Game Engine
 * Implements strict axial math, depth-sorted isometric rendering, snap-back physics,
 * queue-based cascade transfers, 10-stack bursts, and robust finite state machine.
 */

// Game States
const GAME_STATE = {
  IDLE: 'IDLE',
  DRAGGING: 'DRAGGING',
  RESOLVING_ANIMATION: 'RESOLVING_ANIMATION',
  GAME_OVER: 'GAME_OVER'
};

class HexaSortGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('canvas-container');

    // Subsystems
    this.particles = new ParticleSystem();
    this.sound = window.soundCtrl;

    // Configuration & Geometry
    this.GRID_RADIUS = 2; // Radius 2 axial hex = 19 slots
    this.MAX_CAPACITY = 10; // Max tiles per slot before burst
    this.DPR = window.devicePixelRatio || 1;

    // Viewport & Layout Metrics
    this.width = 400;
    this.height = 600;
    this.hexSize = 36;
    this.slotRadius = 36;
    this.originX = 200;
    this.originY = 240;

    // State Machine
    this.state = GAME_STATE.IDLE;
    this.board = new Map(); // Key: `${q},${r}` -> Slot object
    this.trays = [null, null, null]; // 3 incoming trays below the board
    this.level = 5;
    this.score = 1450;
    this.highScore = 1450;
    this.levelGoal = 1000;
    this.levelProgress = 250;
    this.comboMultiplier = 1;
    this.isInitialMockupState = true;

    // Drag-and-Drop & Snap-back State
    this.draggedTrayIndex = null;
    this.dragPointer = { x: 0, y: 0 };
    this.dragOffset = { x: 0, y: -40 }; // -40px vertical elevation
    this.hoveredSlotId = null;
    this.snapBackItems = []; // Lerping snap-backs

    // Boosters Inventory
    this.boosters = {
      hammer: 1,
      shuffle: 2,
      bomb: 1,
      undo: 2
    };
    this.activeBooster = null;
    this.historyStack = [];

    // Screen shake
    this.screenShake = 0;

    // Initialize systems
    this.loadSaveData();
    this.initBoard();
    this.initDOM();
    this.initInput();
    this.resize();

    // Start Level
    this.startLevel(this.level);

    // 60 FPS Game Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // Secondary resize triggers to ensure full viewport stability
    setTimeout(() => this.resize(), 60);
    setTimeout(() => this.resize(), 250);
  }

  /**
   * Safe procedural sound triggering wrapper
   */
  playSound(name, ...args) {
    if (!this.sound && window.soundCtrl) this.sound = window.soundCtrl;
    if (this.sound && typeof this.sound[name] === 'function') {
      try {
        this.sound[name](...args);
      } catch (e) {
        console.warn('Audio play exception', e);
      }
    }
  }

  /* ==========================================================================
     1. Hexagonal Grid Mathematics & Coordinate System
     ========================================================================== */

  /**
   * 19-slot wooden honeycomb layout matching gameplay-mockup.jpg exactly
   * Slot Data Structure: { id, col, r, u, v, x, y, stack: [], maxCapacity: 10 }
   */
  initBoard() {
    this.board.clear();
    for (const def of BOARD_SLOT_DEFS) {
      this.board.set(def.id, {
        id: def.id,
        col: def.col,
        r: def.r,
        u: def.u,
        v: def.v,
        x: 0,
        y: 0,
        stack: [], // color strings, index 0 = bottom, last = top
        maxCapacity: this.MAX_CAPACITY,
        bounceY: 0,
        burstProgress: 0
      });
    }
  }

  /**
   * Adjacency Algorithm:
   * Returns array of adjacent slots using 6 honeycomb offsets
   */
  getNeighbors(slot) {
    if (!slot) return [];
    const neighbors = [];
    for (const dir of HexMath.DIRECTIONS) {
      const nCol = slot.col + dir.dc;
      const nR = slot.r + dir.dr;
      const neighborSlot = this.board.get(`${nCol},${nR}`);
      if (neighborSlot) {
        neighbors.push(neighborSlot);
      }
    }
    return neighbors;
  }

  /* ==========================================================================
     2. Spawn Trays & Level Logic
     ========================================================================== */

  startLevel(lvl = 1) {
    this.level = lvl;
    this.levelProgress = 0;
    this.levelGoal = 250 + (lvl * 150);
    this.comboMultiplier = 1;
    this.state = GAME_STATE.IDLE;
    this.activeBooster = null;
    this.historyStack = [];
    this.snapBackItems = [];
    this.particles.clear();

    // Clear board stacks
    this.board.forEach(slot => {
      slot.stack = [];
      slot.bounceY = 0;
      slot.burstProgress = 0;
    });

    // Seed 3 starter puzzle slots
    this.seedInitialTiles();

    // Spawn 3 incoming trays
    this.refillTrays();

    this.updateHUD();
    this.updateBoosterUI();
  }

  getActivePalette() {
    // Pick 4 to 6 contrasting colors based on level difficulty
    const count = Math.min(COLOR_KEYS.length, 3 + Math.floor((this.level - 1) / 2));
    return COLOR_KEYS.slice(0, count);
  }

  seedInitialTiles() {
    // Exact match to gameplay-mockup.jpg when on level 5
    if (this.level === 5) {
      const mockupBoard = {
        '0,-1': ['blue', 'blue', 'blue', 'blue'],
        '1,-1.5': ['yellow', 'yellow', 'yellow'],
        '1,-0.5': ['blue', 'blue', 'red'],
        '1,0.5': ['green', 'green', 'green'],
        '1,1.5': ['yellow', 'yellow'],
        '0,1': ['green', 'green', 'green'],
        '0,2': ['yellow', 'yellow', 'yellow'],
        '-1,-0.5': ['red', 'red'],
        '-1,0.5': ['blue', 'blue', 'blue']
      };
      for (const [key, stack] of Object.entries(mockupBoard)) {
        const slot = this.board.get(key);
        if (slot) {
          slot.stack = [...stack];
        }
      }
      return;
    }

    const palette = this.getActivePalette();
    const countSlots = Math.min(6, 3 + Math.floor(this.level / 2));
    const slotKeys = Array.from(this.board.keys()).sort(() => 0.5 - Math.random());
    const initialSlots = slotKeys.slice(0, countSlots);

    initialSlots.forEach(key => {
      const slot = this.board.get(key);
      const color = palette[Math.floor(Math.random() * palette.length)];
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        slot.stack.push(color);
      }
    });
  }

  getTrayPosition(index) {
    if (!this.trayDockRect) {
      const trayY = this.height * 0.84;
      const trayXs = [this.width * 0.20, this.width * 0.50, this.width * 0.80];
      return { x: trayXs[index], y: trayY };
    }
    // Exact pedestal coordinates from new-coins-bg.png (347x118)
    const trayOffsets = [
      { u: -0.310, v: -0.093 },
      { u: 0.000,  v: -0.212 },
      { u: 0.310,  v: -0.093 }
    ];
    const off = trayOffsets[index] || { u: 0, v: 0 };
    return {
      x: this.trayDockRect.x + this.trayDockRect.w / 2 + off.u * this.trayDockRect.w,
      y: this.trayDockRect.y + this.trayDockRect.h / 2 + off.v * this.trayDockRect.h
    };
  }

  refillTrays() {
    // Initial Level 5 trays match gameplay-mockup.jpg exactly
    if (this.level === 5 && this.isInitialMockupState) {
      this.isInitialMockupState = false;
      const mockupTrays = [
        ['yellow', 'yellow'],
        ['red', 'blue', 'red'],
        ['green', 'green', 'green']
      ];
      for (let i = 0; i < 3; i++) {
        const pos = this.getTrayPosition(i);
        this.trays[i] = {
          index: i,
          x: pos.x,
          y: pos.y,
          initialX: pos.x,
          initialY: pos.y,
          stack: mockupTrays[i],
          scale: 1.0,
          targetScale: 1.0,
          bounceY: 0
        };
      }
      this.playSound('playSpawn');
      return;
    }

    const palette = this.getActivePalette();

    for (let i = 0; i < 3; i++) {
      const stackSize = 2 + Math.floor(Math.random() * 3); // 2 to 4 tiles
      const isMono = Math.random() < 0.42;
      const primaryColor = palette[Math.floor(Math.random() * palette.length)];
      const stack = [];

      for (let j = 0; j < stackSize; j++) {
        if (isMono) {
          stack.push(primaryColor);
        } else {
          const c = (j === 0 || Math.random() < 0.6) 
            ? primaryColor 
            : palette[Math.floor(Math.random() * palette.length)];
          stack.push(c);
        }
      }

      const pos = this.getTrayPosition(i);
      this.trays[i] = {
        index: i,
        x: pos.x,
        y: pos.y,
        initialX: pos.x,
        initialY: pos.y,
        stack: stack,
        scale: 0.1,
        targetScale: 1.0,
        bounceY: 20
      };
    }

    this.playSound('playSpawn');
  }

  /* ==========================================================================
     3. Screen-to-Canvas Normalization & Drag-and-Drop Engine
     ========================================================================== */

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || this.container.clientWidth || window.innerWidth || 400;
    const h = rect.height || this.container.clientHeight || (window.innerHeight - 150) || 600;
    this.width = Math.max(300, w);
    this.height = Math.max(450, h);

    this.DPR = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(this.width * this.DPR);
    this.canvas.height = Math.round(this.height * this.DPR);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.DPR, this.DPR);

    // 1. Tray base dock: new-coins-bg.png (347 / 118 ratio)
    // In mockup: dock is ~87% of screen width, resting with ~3.8% bottom margin
    const trayAspect = 347 / 118;
    const trayW = Math.min(this.width * 0.88, 395);
    const trayH = trayW / trayAspect;
    const trayDockX = (this.width - trayW) / 2;
    const trayBottomMargin = Math.max(14, this.height * 0.038);
    const trayDockY = this.height - trayH - trayBottomMargin;
    this.trayDockRect = { x: trayDockX, y: trayDockY, w: trayW, h: trayH };

    // 2. Honeycomb Board: board-full.png aspect ratio is 274 / 249 = 1.1004
    // In mockup: board is ~90-92% of screen width and sits comfortably right above the bottom dock
    const boardAspect = 274 / 249;
    const maxBoardW = Math.min(this.width * 0.90, 410);
    const maxBoardH = (trayDockY - 20) * 0.70;
    let boardW = maxBoardW;
    let boardH = boardW / boardAspect;
    if (boardH > maxBoardH) {
      boardH = maxBoardH;
      boardW = boardH * boardAspect;
    }

    const boardX = (this.width - boardW) / 2;
    // In mockup: gap between board bottom and tray dock top is ~3.6% of height
    const boardBottomGap = Math.max(16, Math.min(30, this.height * 0.036));
    const boardY = Math.max(12, trayDockY - boardH - boardBottomGap);
    this.boardRect = { x: boardX, y: boardY, w: boardW, h: boardH };

    const boardCenterX = boardX + boardW / 2;
    const boardCenterY = boardY + boardH / 2;
    this.hexSize = (boardW / 274) * 28.0; // Perfectly fits 19 wooden cavities matching mockup
    this.slotRadius = this.hexSize * 0.98;

    // Position each slot from u, v
    this.board.forEach(slot => {
      slot.x = boardCenterX + slot.u * boardW;
      slot.y = boardCenterY + slot.v * boardH;
    });

    // Recompute 3 fixed tray positions
    this.trays.forEach((tray, i) => {
      if (tray) {
        const pos = this.getTrayPosition(i);
        tray.x = pos.x;
        tray.y = pos.y;
        tray.initialX = pos.x;
        tray.initialY = pos.y;
      }
    });
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  initInput() {
    window.addEventListener('resize', () => this.resize());

    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(this.getCanvasCoords(e)));
    window.addEventListener('mousemove', (e) => this.onPointerMove(this.getCanvasCoords(e)));
    window.addEventListener('mouseup', (e) => this.onPointerUp(this.getCanvasCoords(e)));

    // Touch Events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onPointerDown(this.getCanvasCoords(e));
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.state === GAME_STATE.DRAGGING) {
        e.preventDefault();
        this.onPointerMove(this.getCanvasCoords(e));
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (this.state === GAME_STATE.DRAGGING) {
        e.preventDefault();
        const coords = e.changedTouches && e.changedTouches.length > 0 
          ? this.getCanvasCoords(e.changedTouches[0]) 
          : this.dragPointer;
        this.onPointerUp(coords);
      }
    }, { passive: false });
  }

  onPointerDown(pos) {
    if (this.state === GAME_STATE.RESOLVING_ANIMATION || this.state === GAME_STATE.GAME_OVER) return;
    if (!this.sound && window.soundCtrl) this.sound = window.soundCtrl;
    if (this.sound && typeof this.sound.init === 'function') {
      try { this.sound.init(); } catch (e) {}
    }

    // Booster handling
    if (this.activeBooster) {
      this.handleBoosterClick(pos);
      return;
    }

    // 1. Pick up tray item
    for (let i = 0; i < 3; i++) {
      const tray = this.trays[i];
      if (tray && tray.stack && tray.stack.length > 0) {
        const dist = HexRenderer.distance(pos.x, pos.y, tray.x, tray.y);
        if (dist <= this.slotRadius * 1.4) {
          this.state = GAME_STATE.DRAGGING;
          this.draggedTrayIndex = i;
          this.dragPointer = { x: pos.x, y: pos.y };
          this.dragStartPos = { x: pos.x, y: pos.y };
          this.playSound('playPick');
          return;
        }
      }
    }

    // 2. Tap-to-Place if a tray was selected
    if (this.selectedTrayIndex !== null) {
      const closest = this.findNearestSlot(pos.x, pos.y);
      if (closest && closest.dist <= this.slotRadius * 1.35) {
        const tray = this.trays[this.selectedTrayIndex];
        if (tray && this.isValidPlacement(closest.slot, tray.stack)) {
          this.placeTrayStack(this.selectedTrayIndex, closest.slot);
          this.selectedTrayIndex = null;
          return;
        }
      }
    }

    this.selectedTrayIndex = null;
  }

  onPointerMove(pos) {
    if (this.state !== GAME_STATE.DRAGGING || this.draggedTrayIndex === null) return;
    this.dragPointer = { x: pos.x, y: pos.y };

    // Snapping detection with -40px elevation offset
    const checkX = pos.x + this.dragOffset.x;
    const checkY = pos.y + this.dragOffset.y;
    const closest = this.findNearestSlot(checkX, checkY);
    const tray = this.trays[this.draggedTrayIndex];

    if (closest && closest.dist <= this.slotRadius * 1.2 && tray && this.isValidPlacement(closest.slot, tray.stack)) {
      this.hoveredSlotId = closest.slot.id;
    } else {
      this.hoveredSlotId = null;
    }
  }

  onPointerUp(pos) {
    if (this.state !== GAME_STATE.DRAGGING || this.draggedTrayIndex === null) return;

    const trayIdx = this.draggedTrayIndex;
    const tray = this.trays[trayIdx];
    this.draggedTrayIndex = null;
    this.state = GAME_STATE.IDLE;

    const checkX = pos.x + this.dragOffset.x;
    const checkY = pos.y + this.dragOffset.y;
    const closest = this.findNearestSlot(checkX, checkY);

    // Snapping Threshold Check:
    // If distance <= slotRadius * 1.2 AND targetSlot.stack.length < targetSlot.maxCapacity
    if (closest && closest.dist <= this.slotRadius * 1.2 && tray && this.isValidPlacement(closest.slot, tray.stack)) {
      this.placeTrayStack(trayIdx, closest.slot);
      this.selectedTrayIndex = null;
    } else {
      // Tap vs Drag test
      const movedDist = this.dragStartPos 
        ? HexRenderer.distance(pos.x, pos.y, this.dragStartPos.x, this.dragStartPos.y) 
        : 0;

      if (movedDist < 12) {
        // Simple tap: select for tap-to-place
        this.selectedTrayIndex = trayIdx;
      } else {
        // Dragged outside: smooth lerp snap-back animation to original tray position
        this.selectedTrayIndex = null;
        this.playSound('playClick');
        this.snapBackItems.push({
          trayIndex: trayIdx,
          startX: checkX,
          startY: checkY,
          targetX: tray.initialX,
          targetY: tray.initialY,
          stack: [...tray.stack],
          progress: 0,
          duration: 260
        });
      }
    }

    this.hoveredSlotId = null;
  }

  isValidPlacement(slot, incomingStack) {
    if (!slot || !incomingStack || incomingStack.length === 0) return false;
    // Valid if slot is empty, or if partially filled and fits within maxCapacity
    if (slot.stack.length === 0) return true;
    return (slot.stack.length + incomingStack.length <= slot.maxCapacity);
  }

  findNearestSlot(px, py) {
    let nearest = null;
    let minDist = Infinity;

    this.board.forEach(slot => {
      const dist = HexRenderer.distance(px, py, slot.x, slot.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = { slot, dist };
      }
    });

    return nearest;
  }

  /* ==========================================================================
     4. Cascading Transfer & Sorting Mechanics (Step-by-Step Chain Reaction)
     ========================================================================== */

  placeTrayStack(trayIndex, targetSlot) {
    const tray = this.trays[trayIndex];
    if (!tray || !targetSlot) return;

    this.saveSnapshot();

    // Push incoming tiles to target slot
    for (const color of tray.stack) {
      targetSlot.stack.push(color);
    }
    targetSlot.bounceY = 12;

    // Clear tray
    this.trays[trayIndex] = null;

    // Audio & Particles
    this.playSound('playPlace');

    // Enter Resolving Animation state (Lock interactions)
    this.state = GAME_STATE.RESOLVING_ANIMATION;
    this.comboMultiplier = 1;

    setTimeout(() => {
      this.resolveCascades(targetSlot);
    }, 120);
  }

  /**
   * Recursive / Queue-based Cascading Transfer Algorithm
   * 1. Identify targetSlot.topColor
   * 2. Query getNeighbors(targetSlot), filter neighbors with matching topColor
   * 3. Sort matching neighbors (lowest stack size first)
   * 4. Pop matching contiguous tiles of topColor from neighbor, push with arc lerp
   * 5. Repeat adjacency check recursively: if the neighbor is now exposing a new
   *    topColor that matches one of its other adjacent slots, trigger sorting chain for that neighbor.
   * 6. Check 10-stack accumulation & burst
   */
  async resolveCascades(initialTargetSlot) {
    const queue = [initialTargetSlot];
    const visitedSlots = new Set();

    while (queue.length > 0) {
      const targetSlot = queue.shift();
      if (!targetSlot || targetSlot.stack.length === 0) continue;

      const topColor = targetSlot.stack[targetSlot.stack.length - 1];

      // 1. Query adjacent neighbors using the 6 axial offsets
      const neighbors = this.getNeighbors(targetSlot);

      // 2. Filter neighbors having matching topColor
      const matchingNeighbors = neighbors.filter(nbr => {
        if (nbr.stack.length === 0) return false;
        return nbr.stack[nbr.stack.length - 1] === topColor;
      });

      // 3. Sort matching neighbors by lowest stack size first
      matchingNeighbors.sort((a, b) => a.stack.length - b.stack.length);

      for (const nbr of matchingNeighbors) {
        // Collect matching contiguous tiles from neighbor
        const tilesToTransfer = [];
        while (nbr.stack.length > 0 && nbr.stack[nbr.stack.length - 1] === topColor) {
          // Verify maxCapacity constraint
          if (targetSlot.stack.length + tilesToTransfer.length >= targetSlot.maxCapacity) break;
          tilesToTransfer.push(nbr.stack.pop());
        }

        if (tilesToTransfer.length > 0) {
          // Animate tile transfer along arc lerp trajectory
          await this.animateTransfer(nbr, targetSlot, tilesToTransfer, topColor);

          // 5. Repeat adjacency check recursively: if the neighbor is now exposing a new
          // topColor that matches one of its other adjacent slots, trigger sorting chain for that neighbor:
          if (nbr.stack.length > 0) {
            const newNbrTop = nbr.stack[nbr.stack.length - 1];
            const hasAdjacentMatch = this.getNeighbors(nbr).some(
              adj => adj.stack.length > 0 && adj.stack[adj.stack.length - 1] === newNbrTop
            );
            if (hasAdjacentMatch) {
              queue.push(nbr);
            }
          }
        }
      }

      // Check for 10-Stack Clear & Burst on targetSlot
      const burstHappened = await this.checkClearAndBurst(targetSlot);
      if (burstHappened) {
        // Clearing exposes the color underneath targetSlot: re-evaluate adjacent slots for cascading merges
        if (targetSlot.stack.length > 0) {
          queue.push(targetSlot);
        }
      }
    }

    // Cascade complete! Check refill, goals, and game over
    this.comboMultiplier = 1;

    // Refill trays if all 3 are empty
    const allEmpty = this.trays.every(t => t === null);
    if (allEmpty) {
      this.refillTrays();
    }

    // Goal Progression Check
    if (this.levelProgress >= this.levelGoal) {
      this.triggerLevelWin();
      return;
    }

    // Fail Condition Check
    this.checkFailCondition();

    // Release input lock
    if (this.state !== GAME_STATE.GAME_OVER) {
      this.state = GAME_STATE.IDLE;
    }
  }

  animateTransfer(srcSlot, tgtSlot, tiles, colorHex) {
    return new Promise(resolve => {
      const count = tiles.length;
      let completed = 0;

      tiles.forEach((c, idx) => {
        const startY = srcSlot.y - (srcSlot.stack.length + idx) * 6;
        const endY = tgtSlot.y - (tgtSlot.stack.length + idx) * 6;

        this.particles.addFlyingTile(
          { x: srcSlot.x, y: startY },
          { x: tgtSlot.x, y: endY },
          colorHex,
          this.hexSize,
          idx * 70, // Musical stagger
          () => {
            tgtSlot.stack.push(colorHex);
            tgtSlot.bounceY = 5;
            this.playSound('playTransfer', idx);

            completed++;
            if (completed >= count) {
              resolve();
            }
          }
        );
      });
    });
  }

  /**
   * Clear & Burst Condition:
   * Whenever any slot accumulates 10 tiles of identical color:
   * Lock user input, burst animation (scale 1.3x, fade alpha 0, 12-16 radial sparkle particles),
   * empty stack completely, award 100 * comboMultiplier.
   */
  async checkClearAndBurst(slot) {
    if (!slot || slot.stack.length < this.MAX_CAPACITY) return false;

    // Check if all 10 tiles are identical color
    const topColor = slot.stack[slot.stack.length - 1];
    let isFullIdentical = true;
    for (let i = slot.stack.length - 1; i >= slot.stack.length - this.MAX_CAPACITY; i--) {
      if (slot.stack[i] !== topColor) {
        isFullIdentical = false;
        break;
      }
    }

    if (!isFullIdentical) return false;

    // Trigger Burst Animation: 1.3x scale & fade alpha
    await new Promise(resolve => {
      this.particles.addBurstAnimation(slot, topColor, 260, () => {
        // Emit 12 to 16 radial sparkle particles as specified
        this.particles.emitClearBurst(slot.x, slot.y, topColor, 15);
        this.playSound('playClear', this.comboMultiplier);
        this.screenShake = 12;

        // Empty the 10 tiles completely
        for (let k = 0; k < this.MAX_CAPACITY; k++) {
          slot.stack.pop();
        }

        // Increment Score: Base 100 * comboMultiplier
        const earned = 100 * this.comboMultiplier;
        this.addScore(earned);
        this.particles.addFloatingText(`+${earned}`, slot.x, slot.y - 25, '#FFBA08', 28);

        if (this.comboMultiplier > 1) {
          this.showComboBanner(this.comboMultiplier);
        }

        this.comboMultiplier++;
        resolve();
      });
    });

    await this.delay(160);
    return true;
  }

  addScore(pts) {
    this.score += pts;
    this.levelProgress += pts;
    this.saveHighScore();
    this.updateHUD();
  }

  showComboBanner(multiplier) {
    const banner = document.getElementById('combo-banner');
    const text = document.getElementById('combo-text');
    text.textContent = `COMBO x${multiplier}!`;
    banner.classList.remove('hidden');

    banner.style.animation = 'none';
    banner.offsetHeight;
    banner.style.animation = null;

    setTimeout(() => {
      banner.classList.add('hidden');
    }, 850);
  }

  /* ==========================================================================
     5. Game State Machine & Fail Condition
     ========================================================================== */

  checkFailCondition() {
    // Fail Condition Check:
    // When all 3 spawn trays are occupied and none of them can fit on any empty
    // slot or matching partially-filled slot on the board:
    const activeTrays = this.trays.filter(t => t !== null && t.stack.length > 0);
    if (activeTrays.length !== 3) return; // Only fails when all 3 trays are occupied

    let hasAnyValidPlacement = false;

    for (const tray of activeTrays) {
      for (const [key, slot] of this.board) {
        if (this.isValidPlacement(slot, tray.stack)) {
          hasAnyValidPlacement = true;
          break;
        }
      }
      if (hasAnyValidPlacement) break;
    }

    if (!hasAnyValidPlacement) {
      this.state = GAME_STATE.GAME_OVER;
      this.playSound('playGameOver');

      document.getElementById('gameover-score').textContent = this.score.toLocaleString();
      document.getElementById('gameover-best').textContent = this.highScore.toLocaleString();
      document.getElementById('modal-game-over').classList.remove('hidden');
    }
  }

  triggerLevelWin() {
    this.state = GAME_STATE.GAME_OVER;
    this.playSound('playWin');

    const bonus = 250 + (this.level * 50);
    this.addScore(bonus);

    document.getElementById('win-score').textContent = this.score.toLocaleString();
    document.getElementById('win-bonus').textContent = `+${bonus}`;
    document.getElementById('modal-level-win').classList.remove('hidden');
  }

  /* ==========================================================================
     Booster Mechanics & Ad Integration
     ========================================================================== */

  selectBooster(boosterType) {
    if (this.state === GAME_STATE.RESOLVING_ANIMATION || this.state === GAME_STATE.GAME_OVER) return;
    this.playSound('playClick');

    if (this.boosters[boosterType] <= 0) {
      window.showRewardedAd(`booster_${boosterType}`, () => {
        this.boosters[boosterType] += 1;
        this.updateBoosterUI();
        this.particles.addFloatingText('+1 BOOSTER!', this.width / 2, this.height * 0.75, '#FFBA08', 26);
      });
      return;
    }

    this.activeBooster = (this.activeBooster === boosterType) ? null : boosterType;
    if (this.activeBooster) {
      this.playSound('playBooster');
      this.particles.addFloatingText(`${boosterType.toUpperCase()} READY!`, this.width / 2, this.height * 0.45, '#00D2D3', 24);
    }
    this.updateBoosterUI();
  }

  useShuffleBooster() {
    if (this.state === GAME_STATE.RESOLVING_ANIMATION || this.state === GAME_STATE.GAME_OVER) return;
    this.playSound('playClick');

    if (this.boosters.shuffle <= 0) {
      window.showRewardedAd('booster_shuffle', () => {
        this.boosters.shuffle += 1;
        this.updateBoosterUI();
        this.useShuffleBooster();
      });
      return;
    }

    this.boosters.shuffle--;
    this.playSound('playBooster');
    this.refillTrays();
    this.updateBoosterUI();
    this.particles.addFloatingText('SHUFFLED!', this.width / 2, this.height * 0.78, '#2A9D8F', 24);
  }

  useUndoBooster() {
    if (this.state === GAME_STATE.RESOLVING_ANIMATION || this.state === GAME_STATE.GAME_OVER) return;
    this.playSound('playClick');

    if (this.historyStack.length === 0) {
      this.particles.addFloatingText('NO MOVES TO UNDO', this.width / 2, this.height * 0.5, '#9AA5BF', 20);
      return;
    }

    if (this.boosters.undo <= 0) {
      window.showRewardedAd('booster_undo', () => {
        this.boosters.undo += 1;
        this.updateBoosterUI();
        this.useUndoBooster();
      });
      return;
    }

    const prevState = this.historyStack.pop();
    this.board.forEach((slot, key) => {
      slot.stack = prevState.board[key] ? [...prevState.board[key]] : [];
      slot.bounceY = 0;
    });
    this.trays = prevState.trays.map(t => (t ? { ...t, stack: [...t.stack] } : null));
    this.score = prevState.score;
    this.levelProgress = prevState.levelProgress;

    this.boosters.undo--;
    this.playSound('playBooster');
    this.updateHUD();
    this.updateBoosterUI();
    this.particles.addFloatingText('MOVE UNDONE', this.width / 2, this.height * 0.5, '#00D2D3', 24);
  }

  saveSnapshot() {
    const boardSnap = {};
    this.board.forEach((slot, key) => {
      boardSnap[key] = [...slot.stack];
    });

    const traysSnap = this.trays.map(t => (t ? { ...t, stack: [...t.stack] } : null));

    this.historyStack.push({
      board: boardSnap,
      trays: traysSnap,
      score: this.score,
      levelProgress: this.levelProgress
    });

    if (this.historyStack.length > 5) this.historyStack.shift();
  }

  handleBoosterClick(pos) {
    const nearest = this.findNearestSlot(pos.x, pos.y);
    if (!nearest || nearest.dist > this.slotRadius * 1.35 || nearest.slot.stack.length === 0) return;

    const slot = nearest.slot;
    if (this.activeBooster === 'hammer') {
      const topColor = slot.stack[slot.stack.length - 1];
      this.particles.emitClearBurst(slot.x, slot.y, topColor, 16);
      slot.stack = [];
      this.playSound('playClear', 1);
      this.screenShake = 10;
      this.boosters.hammer--;
      this.activeBooster = null;
      this.updateBoosterUI();
      this.particles.addFloatingText('SMASHED!', slot.x, slot.y - 20, '#E63946', 24);

      this.state = GAME_STATE.RESOLVING_ANIMATION;
      setTimeout(() => this.resolveCascades(slot), 120);
    } else if (this.activeBooster === 'bomb') {
      const targetColor = slot.stack[slot.stack.length - 1];
      let cleared = 0;

      this.board.forEach(s => {
        const initLen = s.stack.length;
        s.stack = s.stack.filter(c => c !== targetColor);
        const removed = initLen - s.stack.length;
        if (removed > 0) {
          cleared += removed;
          this.particles.emitClearBurst(s.x, s.y, targetColor, 12);
        }
      });

      this.playSound('playClear', 3);
      this.screenShake = 15;
      this.boosters.bomb--;
      this.activeBooster = null;
      this.updateBoosterUI();
      this.addScore(cleared * 25);
      this.particles.addFloatingText(`COLOR BOMB! +${cleared * 25}`, this.width / 2, this.height * 0.45, '#FFBA08', 26);

      this.state = GAME_STATE.RESOLVING_ANIMATION;
      setTimeout(() => this.resolveCascades(slot), 120);
    }
  }

  executeRevive() {
    const occupied = [];
    this.board.forEach(slot => {
      if (slot.stack.length > 0) occupied.push(slot);
    });

    occupied.sort(() => 0.5 - Math.random());
    const cleared = occupied.slice(0, 3);
    cleared.forEach(s => {
      this.particles.emitClearBurst(s.x, s.y, '#00BBF9', 16);
      s.stack = [];
    });

    this.playSound('playClear', 2);
    this.screenShake = 14;
    this.state = GAME_STATE.IDLE;
    this.particles.addFloatingText('REVIVED! +3 FREE SLOTS', this.width / 2, this.height * 0.45, '#2A9D8F', 26);
  }

  /* ==========================================================================
     DOM UI & Persistence
     ========================================================================== */

  loadSaveData() {
    try {
      const best = localStorage.getItem('hexasort_highscore_v5');
      if (best) this.highScore = parseInt(best, 10) || 1450;
      else this.highScore = 1450;

      const lvl = localStorage.getItem('hexasort_level_v5');
      if (lvl) this.level = Math.max(1, parseInt(lvl, 10) || 5);
      else this.level = 5;

      const sc = localStorage.getItem('hexasort_score_v5');
      if (sc) this.score = parseInt(sc, 10) || 1450;
      else this.score = 1450;
    } catch (e) {
      this.level = 5;
      this.score = 1450;
      this.highScore = 1450;
    }
  }

  saveHighScore() {
    try {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('hexasort_highscore_v5', this.highScore.toString());
      }
      localStorage.setItem('hexasort_score_v5', this.score.toString());
      localStorage.setItem('hexasort_level_v5', this.level.toString());
    } catch (e) {}
  }

  initDOM() {
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    bindClick('btn-pause', () => this.togglePause());
    bindClick('btn-back', () => this.handleBack());
    bindClick('btn-sound', () => this.toggleSound());

    bindClick('btn-resume', () => this.togglePause());
    bindClick('btn-restart-pause', () => {
      this.togglePause();
      this.startLevel(this.level);
    });
    bindClick('btn-how-to-play-pause', () => {
      const p = document.getElementById('modal-pause');
      if (p) p.classList.add('hidden');
      const inst = document.getElementById('modal-instructions');
      if (inst) inst.classList.remove('hidden');
    });

    const returnToMainMenu = () => {
      const p = document.getElementById('modal-pause');
      if (p) p.classList.add('hidden');
      const win = document.getElementById('modal-level-win');
      if (win) win.classList.add('hidden');
      const go = document.getElementById('modal-game-over');
      if (go) go.classList.add('hidden');
      if (typeof window.showMainMenu === 'function') {
        window.showMainMenu();
      }
    };

    bindClick('btn-main-menu-pause', returnToMainMenu);
    bindClick('btn-main-menu-win', returnToMainMenu);
    bindClick('btn-main-menu-gameover', returnToMainMenu);

    bindClick('btn-close-instructions', () => {
      const inst = document.getElementById('modal-instructions');
      if (inst) inst.classList.add('hidden');
    });

    bindClick('btn-next-level', () => {
      const win = document.getElementById('modal-level-win');
      if (win) win.classList.add('hidden');
      window.showInterstitialAd('level_win', () => {
        this.startLevel(this.level + 1);
      });
    });

    bindClick('btn-restart-gameover', () => {
      const go = document.getElementById('modal-game-over');
      if (go) go.classList.add('hidden');
      window.showInterstitialAd('game_over', () => {
        this.startLevel(this.level);
      });
    });

    bindClick('btn-revive-ad', () => {
      window.showRewardedAd('revive', () => {
        const go = document.getElementById('modal-game-over');
        if (go) go.classList.add('hidden');
        this.executeRevive();
      });
    });

    bindClick('btn-booster-hammer', () => this.selectBooster('hammer'));
    bindClick('btn-booster-shuffle', () => this.useShuffleBooster());
    bindClick('btn-booster-bomb', () => this.selectBooster('bomb'));
    bindClick('btn-booster-undo', () => this.useUndoBooster());

    this.updateSoundIcons();
  }

  handleBack() {
    this.playSound('playClick');
    if (this.historyStack.length > 0) {
      const prevState = this.historyStack.pop();
      this.board.forEach((slot, key) => {
        slot.stack = prevState.board[key] ? [...prevState.board[key]] : [];
        slot.bounceY = 0;
      });
      this.trays = prevState.trays.map(t => (t ? { ...t, stack: [...t.stack] } : null));
      this.score = prevState.score;
      this.levelProgress = prevState.levelProgress;
      this.updateHUD();
      this.particles.addFloatingText('MOVE UNDONE', this.width / 2, this.height * 0.45, '#00d2d3', 24);
      this.playSound('playPick');
    } else {
      this.togglePause();
    }
  }

  updateHUD() {
    const lvlEl = document.getElementById('level-display');
    if (lvlEl) lvlEl.textContent = `LEVEL ${this.level}`;
    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
    const bestEl = document.getElementById('best-score-display');
    if (bestEl) bestEl.textContent = this.highScore.toLocaleString();

    const progressBar = document.getElementById('goal-progress-bar');
    if (progressBar) {
      const pct = Math.min(100, Math.round((this.levelProgress / this.levelGoal) * 100));
      progressBar.style.width = `${pct}%`;
    }
    const goalText = document.getElementById('goal-text');
    if (goalText) {
      goalText.textContent = `Target: ${this.levelProgress}/${this.levelGoal} pts`;
    }
  }

  updateBoosterUI() {
    const elHammer = document.getElementById('count-hammer');
    if (elHammer) elHammer.textContent = this.boosters.hammer;
    const elShuffle = document.getElementById('count-shuffle');
    if (elShuffle) elShuffle.textContent = this.boosters.shuffle;
    const elBomb = document.getElementById('count-bomb');
    if (elBomb) elBomb.textContent = this.boosters.bomb;
    const elUndo = document.getElementById('count-undo');
    if (elUndo) elUndo.textContent = this.boosters.undo;

    const btnHammer = document.getElementById('btn-booster-hammer');
    if (btnHammer) btnHammer.classList.toggle('active', this.activeBooster === 'hammer');
    const btnBomb = document.getElementById('btn-booster-bomb');
    if (btnBomb) btnBomb.classList.toggle('active', this.activeBooster === 'bomb');
  }

  toggleSound() {
    if (!this.sound && window.soundCtrl) this.sound = window.soundCtrl;
    if (this.sound && typeof this.sound.toggleMute === 'function') {
      this.sound.toggleMute();
    }
    this.updateSoundIcons();
  }

  updateSoundIcons() {
    const onIcon = document.getElementById('icon-sound-on');
    const offIcon = document.getElementById('icon-sound-off');
    const isMuted = this.sound ? !!this.sound.isMuted : false;
    if (onIcon && offIcon) {
      if (isMuted) {
        onIcon.classList.add('hidden');
        offIcon.classList.remove('hidden');
      } else {
        onIcon.classList.remove('hidden');
        offIcon.classList.add('hidden');
      }
    }
    const menuSoundIcon = document.getElementById('menu-sound-icon');
    if (menuSoundIcon) {
      menuSoundIcon.textContent = isMuted ? '🔇' : '🔊';
    }
  }

  togglePause() {
    if (this.state === GAME_STATE.GAME_OVER) return;
    const modal = document.getElementById('modal-pause');
    if (modal) modal.classList.toggle('hidden');
    this.playSound('playClick');
  }

  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  /* ==========================================================================
     6. Game Loop, Animation Lerping & Isometric Layer Ordering
     ========================================================================== */

  loop(currentTime) {
    const now = (typeof currentTime === 'number' && !isNaN(currentTime)) ? currentTime : performance.now();
    const dt = Math.min(32, Math.max(1, now - (this.lastTime || now)));
    this.lastTime = now;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake *= 0.9;
      if (this.screenShake < 0.3) this.screenShake = 0;
    }

    // Board bounce decay
    this.board.forEach(slot => {
      if (slot.bounceY > 0) {
        slot.bounceY *= 0.86;
        if (slot.bounceY < 0.1) slot.bounceY = 0;
      }
    });

    // Tray pop-in bounce decay
    this.trays.forEach(tray => {
      if (tray) {
        if (tray.scale < tray.targetScale) {
          tray.scale += (tray.targetScale - tray.scale) * 0.18;
        }
        if (tray.bounceY > 0) {
          tray.bounceY *= 0.85;
          if (tray.bounceY < 0.1) tray.bounceY = 0;
        }
      }
    });

    // Snap-back animation lerping
    for (let i = this.snapBackItems.length - 1; i >= 0; i--) {
      const item = this.snapBackItems[i];
      item.progress += dt / item.duration;
      if (item.progress >= 1) {
        this.snapBackItems.splice(i, 1);
      }
    }

    // Particle system update
    this.particles.update(dt);
  }

  /**
   * Draw Phase with Isometric Depth Sorting
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    // Camera screen shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 0. Draw Wooden Honeycomb Board (board-full.png)
    if (GAME_IMAGES.board && GAME_IMAGES.board.complete && this.boardRect) {
      ctx.drawImage(GAME_IMAGES.board, this.boardRect.x, this.boardRect.y, this.boardRect.w, this.boardRect.h);
    }

    // 1. Draw Empty Slot Highlights if hovered
    this.board.forEach((slot, key) => {
      const isHovered = (this.hoveredSlotId === key);
      if (isHovered) {
        HexRenderer.drawEmptySlot(ctx, slot.x, slot.y, this.hexSize, isHovered, true);
      }
    });

    // 2. ISOMETRIC DEPTH SORTING:
    // Sort all slots by their screen Y position (top-to-bottom)
    // so stacks on higher rows render behind stacks on lower rows
    const sortedSlots = Array.from(this.board.values()).sort((a, b) => a.y - b.y);

    sortedSlots.forEach(slot => {
      if (slot.stack.length > 0) {
        HexRenderer.drawStack(ctx, slot.x, slot.y, this.hexSize, slot.stack, {
          elevationY: slot.bounceY,
          showCount: false,
          burstProgress: slot.burstProgress
        });
      }
    });

    // 3. Draw Fixed Trays Base Pedestals
    this.drawTraysDock(ctx);

    // 4. Draw Incoming Tray Stacks
    this.trays.forEach((tray, idx) => {
      if (!tray || tray.stack.length === 0) return;
      if (this.state === GAME_STATE.DRAGGING && this.draggedTrayIndex === idx) return;

      const isSelected = (this.selectedTrayIndex === idx);
      const pulseElev = isSelected ? 8 * Math.sin(performance.now() * 0.006) : 0;
      const liftY = isSelected ? 15 + pulseElev : 0;

      // Selection ring
      if (isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(tray.x, tray.y - liftY, this.hexSize * 1.15, 0, Math.PI * 2);
        ctx.strokeStyle = '#00D2D3';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00D2D3';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }

      HexRenderer.drawStack(ctx, tray.x, tray.y - liftY, this.hexSize * 1.0, tray.stack, {
        scale: tray.scale,
        elevationY: tray.bounceY,
        liftShadow: isSelected,
        showCount: false
      });
    });

    // 5. Draw Snap-Back Lerp Stacks
    for (const snap of this.snapBackItems) {
      const t = HexMath.easeOutCubic(snap.progress);
      const curX = HexMath.lerp(snap.startX, snap.targetX, t);
      const curY = HexMath.lerp(snap.startY, snap.targetY, t);
      HexRenderer.drawStack(ctx, curX, curY, this.hexSize * 1.0, snap.stack, {
        scale: 1.0,
        liftShadow: true,
        showCount: false
      });
    }

    // 6. Draw Free Flying Tiles (Highest z-index above stationary board tiles)
    this.particles.renderFlyingTiles(ctx);

    // 7. Draw Active Dragged Tray Item (On top of all layers)
    if (this.state === GAME_STATE.DRAGGING && this.draggedTrayIndex !== null) {
      const dragTray = this.trays[this.draggedTrayIndex];
      if (dragTray) {
        const renderX = this.dragPointer.x + this.dragOffset.x;
        const renderY = this.dragPointer.y + this.dragOffset.y;

        // Render with 1.1x scale and dynamic dropped ground shadow
        HexRenderer.drawStack(ctx, renderX, renderY, this.hexSize * 1.12, dragTray.stack, {
          scale: 1.12,
          liftShadow: true,
          showCount: false
        });
      }
    }

    // 8. Draw Particle Effects & Floating Scores
    this.particles.renderEffects(ctx);

    ctx.restore();
  }

  drawTraysDock(ctx) {
    if (GAME_IMAGES.tray && GAME_IMAGES.tray.complete && this.trayDockRect) {
      ctx.drawImage(GAME_IMAGES.tray, this.trayDockRect.x, this.trayDockRect.y, this.trayDockRect.w, this.trayDockRect.h);
      return;
    }
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const pos = this.getTrayPosition(i);
      const sx = pos.x;
      const dockY = pos.y;

      // Glow pedestal
      ctx.beginPath();
      ctx.ellipse(sx, dockY + 6, this.hexSize * 0.95, this.hexSize * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 17, 28, 0.65)';
      ctx.fill();

      // Recessed platform
      ctx.beginPath();
      ctx.ellipse(sx, dockY + 2, this.hexSize * 0.85, this.hexSize * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(25, 30, 48, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

window.HexaSortGame = HexaSortGame;

// Instant & bulletproof boot launcher
function bootHexaGame() {
  if (!window.hexaGame) {
    window.hexaGame = new HexaSortGame();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootHexaGame);
  window.addEventListener('load', bootHexaGame);
} else {
  bootHexaGame();
}
