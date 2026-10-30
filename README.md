# Hexa Sort - HTML5 Canvas Color Tile Sorting & Merge Puzzle Game
/* Developed by Muzammil */

A complete, production-grade, modular HTML5 Canvas puzzle game inspired by the hit casual game **Hexa Sort**, built in pure JavaScript without external game engines.

---

## 📐 1. Hexagonal Grid Mathematics & Coordinate System

- **Axial Coordinate Model `(q, r)`**:
  - Exact screen projection:
    $$\begin{aligned}
    x &= \text{size} \times \sqrt{3} \times (q + r / 2) + \text{originX} \\
    y &= \text{size} \times (3 / 2) \times r + \text{originY}
    \end{aligned}$$
  - Symmetrical 19-slot layout arranged in a radius-2 axial ring (`|q| <= 2, |r| <= 2, |q+r| <= 2`).
- **Slot Data Structure**:
  ```javascript
  {
    id: "0,0",
    q: 0,
    r: 0,
    x: 200,
    y: 240,
    stack: ['#E63946', '#E63946', '#1D3557'], // bottom-to-top
    maxCapacity: 10
  }
  ```
- **Adjacency Algorithm**:
  `getNeighbors(slot)` queries the 6 axial directional offsets:
  `(+1, 0), (+1, -1), (0, -1), (-1, 0), (-1, +1), (0, +1)`.

---

## 🎨 2. Spawn Trays & Input Handling

- **3 Fixed Spawn Trays**:
  - Positioned below the board on dedicated podium bases.
  - Each tray generates an incoming stack of 2 to 4 tiles picked from a contrasting palette:
    - Crimson Coral: `#E63946`
    - Ocean Navy: `#1D3557`
    - Emerald Teal: `#2A9D8F`
    - Warm Amber: `#F4A261`
    - Royal Purple: `#9B5DE5`
    - Electric Cyan: `#00BBF9`
- **Fluid Drag-and-Drop & Touch Engine**:
  - Unified handling for mouse (`mousedown`, `mousemove`, `mouseup`) and touch (`touchstart`, `touchmove`, `touchend`).
  - Screen-to-canvas coordinate normalization via `getBoundingClientRect()` and `devicePixelRatio`.
  - Active dragged stack elevates on Y-axis (`-40px` offset) with a `1.1x` scale and a dynamic ground shadow.
- **Snapping & Snap-Back Physics**:
  - Calculates Euclidean distance: $\text{dist} = \sqrt{(px - \text{slot}.x)^2 + (py - \text{slot}.y)^2}$.
  - If $\text{dist} \le \text{slotRadius} \times 1.2$ AND `slot.stack.length + incoming.length <= slot.maxCapacity`: valid placement!
  - If invalid: smooth ease-out cubic **snap-back lerp animation** returns the stack to its tray base.

---

## 🔄 3. Cascading Transfer & Sorting Mechanics

- **Step-by-Step Recursive Cascade**:
  1. Identifies `topColor` of the recently changed `targetSlot`.
  2. Queries `getNeighbors(targetSlot)` and filters adjacent neighbors sharing the matching `topColor`.
  3. Sorts matching neighbors by lowest stack size first.
  4. Pops matching contiguous tiles of `topColor` from neighbor and pushes them to `targetSlot` with an **arc lerp trajectory**:
     $$\begin{aligned}
     t &= 1 - (1 - \text{progress})^3 \\
     x &= \text{lerp}(\text{startX}, \text{endX}, t) \\
     y &= \text{lerp}(\text{startY}, \text{endY}, t) - \sin(t \times \pi) \times \text{arcHeight}
     \end{aligned}$$
  5. If the neighbor now exposes a new `topColor` matching its own adjacent neighbors, triggers sorting chain for that neighbor recursively.
- **10-Stack Clear & Burst Animation**:
  - When any slot accumulates 10 tiles of identical color:
    - User input locks into `RESOLVING_ANIMATION` state.
    - Burst animation scales tiles to `1.3x`, fades alpha to `0`, and emits **12 to 16 radial sparkle particles** with shockwave rings.
    - Empties the slot stack completely.
    - Awards `100 * comboMultiplier` points with floating text and audio fanfare.
    - Re-evaluates adjacent slots for cascading merges exposed by the cleared tiles.

---

## ⚡ 4. 60 FPS Render Loop & Isometric Depth Sorting

- **Update Phase**:
  - Lerps flying tile arcs, burst scales, particle velocities, and tray snap-backs.
- **Draw Phase (Isometric Depth Sorting)**:
  - **Sorts all slots by screen Y position ascending** prior to rendering, ensuring lower-screen stacks render in front of upper-screen stacks without visual overlap clipping.
  - Draws empty beveled hexagon sockets with glowing hover indicators.
  - Draws 3D beveled tiles with vertical offset `tileY = slot.y - stackIndex * 6`.
  - Draws flying tiles above stationary board tiles.
  - Draws active dragged item on top of all layers.

---

## 🕹️ 5. State Machine & Fail Condition

- **Finite States**:
  - `IDLE`: Listening for mouse and touch inputs.
  - `DRAGGING`: Tracking active stack, rendering shadow and hover highlights.
  - `RESOLVING_ANIMATION`: Input locked during tile transfers, bursts, and cascades.
  - `GAME_OVER`: Triggered when all 3 spawn trays are occupied and none can fit on any board slot.
- **Fail Condition & Recovery**:
  - Triggers Game Over modal with final score, high score, and a **Watch Ad to Revive (+3 Free Slots)** perk.

---

## 🛠️ Boosters

- 🔨 **Hammer**: Smash any stack on the board.
- 🔀 **Shuffle**: Reroll all 3 incoming trays.
- 💣 **Color Bomb**: Clear all tiles of a selected color across the board.
- ↩️ **Undo**: Revert the previous placement move.

---

## 🚀 Running the Game

Launch a lightweight local server:
```bash
python -m http.server 8080
```
Open in browser:
```
http://localhost:8080
```
*(Or double-click `index.html` directly in any modern browser!)*
