/* Developed by Muzammil */
/**
 * Hexa Sort - Particle FX, Burst Physics & Flying Tile Arc Animations
 * Strict implementation of ease-out cubic lerping and depth-ordered particle emission.
 */

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.flyingTiles = [];
    this.burstAnimations = []; // Active 1.3x scale-up & fade-out slots
  }

  clear() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.flyingTiles = [];
    this.burstAnimations = [];
  }

  /**
   * Emit 12 to 16 radial sparkle particles and shockwave on 10-stack clear
   */
  emitClearBurst(cx, cy, colorHex, particleCount = 14) {
    const paletteObj = HEX_PALETTE[colorHex] || { particle: colorHex || '#FFBA08' };
    const pColor = paletteObj.particle;

    // Expanding shockwave ring
    this.shockwaves.push({
      x: cx,
      y: cy,
      radius: 10,
      maxRadius: 85,
      color: pColor,
      alpha: 1,
      speed: 4.2
    });

    // 12-16 radial sparkle particles as specified
    const count = Math.max(12, Math.min(16, particleCount));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 3.0 + Math.random() * 5.0;
      const size = 3.5 + Math.random() * 4.5;
      const life = 38 + Math.random() * 20;

      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.2, // initial upward lift
        gravity: 0.16,
        size: size,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        color: pColor,
        alpha: 1,
        life: life,
        maxLife: life,
        isSparkle: true
      });
    }
  }

  /**
   * Trigger burst scale (1.3x scale, fade alpha to 0) on a slot before emptying
   */
  addBurstAnimation(slot, colorHex, durationMs = 280, onComplete = null) {
    this.burstAnimations.push({
      slot: slot,
      colorHex: colorHex,
      progress: 0,
      durationMs: durationMs,
      onComplete: onComplete
    });
  }

  /**
   * Queue flying tile with ease-out cubic interpolation:
   * x = lerp(startX, endX, t);
   * y = lerp(startY, endY, t) - Math.sin(t * Math.PI) * arcHeight;
   */
  addFlyingTile(startPos, endPos, colorHex, hexSize, delayMs = 0, onComplete = null) {
    this.flyingTiles.push({
      startX: startPos.x,
      startY: startPos.y,
      endX: endPos.x,
      endY: endPos.y,
      colorHex: colorHex,
      hexSize: hexSize,
      progress: 0,
      duration: 380, // duration in ms (~23 frames)
      elapsed: 0,
      delayMs: delayMs,
      arcHeight: 55 + Math.random() * 20,
      onComplete: onComplete,
      currentX: startPos.x,
      currentY: startPos.y
    });
  }

  /**
   * Add floating popup text (e.g. +100, COMBO x2!)
   */
  addFloatingText(text, x, y, color = '#FFB800', size = 26) {
    this.floatingTexts.push({
      text: text,
      x: x,
      y: y,
      vy: -1.8,
      scale: 0.6,
      targetScale: 1.25,
      alpha: 1,
      color: color,
      size: size,
      life: 55,
      maxLife: 55
    });
  }

  /**
   * Update particle physics and flying tile positions
   */
  update(dt = 16.6) {
    // 1. Update Flying Tiles
    for (let i = this.flyingTiles.length - 1; i >= 0; i--) {
      const t = this.flyingTiles[i];
      if (t.delayMs > 0) {
        t.delayMs -= dt;
        continue;
      }

      t.elapsed += dt;
      t.progress = Math.min(1, t.elapsed / t.duration);

      // Ease-out cubic interpolation: 1 - (1 - p)^3
      const easedT = HexMath.easeOutCubic(t.progress);

      t.currentX = HexMath.lerp(t.startX, t.endX, easedT);
      const baseY = HexMath.lerp(t.startY, t.endY, easedT);
      t.currentY = baseY - Math.sin(t.progress * Math.PI) * t.arcHeight;

      if (t.progress >= 1) {
        if (t.onComplete) t.onComplete();
        this.flyingTiles.splice(i, 1);
      }
    }

    // 2. Update Burst Scale Animations
    for (let i = this.burstAnimations.length - 1; i >= 0; i--) {
      const b = this.burstAnimations[i];
      b.progress += dt / b.durationMs;
      if (b.progress >= 1) {
        b.progress = 1;
        if (b.onComplete) b.onComplete();
        this.burstAnimations.splice(i, 1);
      }
    }

    // 3. Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed;
      sw.alpha = 1 - (sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 4. Update Radial Sparkle Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;
      p.life--;
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 5. Update Floating Score Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.vy *= 0.95;
      if (ft.scale < ft.targetScale) ft.scale += 0.08;
      ft.life--;
      if (ft.life < 18) ft.alpha = ft.life / 18;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  hasActiveAnimations() {
    return this.flyingTiles.length > 0 || this.burstAnimations.length > 0;
  }

  /**
   * Render free flying tiles with depth sorting support
   */
  renderFlyingTiles(ctx) {
    for (const t of this.flyingTiles) {
      if (t.delayMs > 0) continue;

      // Ground shadow following underneath
      ctx.save();
      const baseY = HexMath.lerp(t.startY, t.endY, HexMath.easeOutCubic(t.progress));
      const shadowAlpha = 0.35 * Math.max(0, 1 - (baseY - t.currentY) / 100);
      ctx.globalAlpha = shadowAlpha;
      ctx.beginPath();
      ctx.ellipse(t.currentX, baseY + 6, t.hexSize * 0.5, t.hexSize * 0.28, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#060812';
      ctx.fill();
      ctx.restore();

      // Render flying 3D Tile
      const tiltScale = 1.05 + 0.12 * Math.sin(t.progress * Math.PI);
      HexRenderer.draw3DTile(
        ctx,
        t.currentX,
        t.currentY,
        t.hexSize,
        t.colorHex,
        6,
        tiltScale,
        1
      );
    }
  }

  /**
   * Render particles, shockwaves, and floating texts
   */
  renderEffects(ctx) {
    // 1. Shockwaves
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3.5;
      ctx.globalAlpha = sw.alpha * 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Sparkle Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Star sparkle geometry
      ctx.beginPath();
      const spikes = 4;
      const outerR = p.size;
      const innerR = p.size * 0.35;
      for (let j = 0; j < spikes * 2; j++) {
        const r = (j % 2 === 0) ? outerR : innerR;
        const angle = (j * Math.PI) / spikes;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();

      ctx.restore();
    }

    // 3. Floating Score Texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${Math.round(ft.size * ft.scale)}px 'Fredoka', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Drop shadow for readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);

      // Highlight core
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ft.text, ft.x, ft.y - 1);

      ctx.restore();
    }
  }
}

window.ParticleSystem = ParticleSystem;
