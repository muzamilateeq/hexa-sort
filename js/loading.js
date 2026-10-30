/* Developed by Muzammil */
/**
 * Hexa Sort - Production Game Loading Screen System
 * Implements faithful reproduction of loading-screen-mockup.jpg
 * with smooth 60fps 3-slice liquid bar animation, floating particle bubbles,
 * asset preloading, audio warm-up, and polished entrance/exit transitions.
 */

class LoadingScreenController {
  constructor(options = {}) {
    this.screenEl = document.getElementById('loading-screen');
    this.textEl = document.getElementById('loading-percentage');
    this.statusTextEl = document.getElementById('loading-status-text');
    this.barCanvas = document.getElementById('loading-bar-canvas');
    this.btnPlay = document.getElementById('btn-play-now');
    this.bubblesContainer = document.getElementById('loading-bubble-particles');

    if (!this.screenEl || !this.barCanvas) {
      console.warn('Loading screen DOM elements not found');
      return;
    }

    this.ctx = this.barCanvas.getContext('2d');
    this.barCanvas.width = 554;
    this.barCanvas.height = 94;

    this.pausedAt = typeof options.pauseAt === 'number' ? options.pauseAt : null;
    this.progress = this.pausedAt !== null ? this.pausedAt : 0;
    this.targetProgress = this.progress;
    this.isComplete = false;
    this.hasExited = false;
    this.autoExitTimer = null;

    // Slice images
    this.images = {
      left: new Image(),
      mid: new Image(),
      right: new Image(),
      pill: new Image()
    };
    this.imagesLoaded = false;

    // Dynamic bubble particles for progress head
    this.bubbles = [];
    this.initBubbles();

    this.initImages();
    this.setupListeners();
    if (this.pausedAt === null) {
      this.startLoading();
    } else {
      if (this.textEl) {
        this.textEl.textContent = `${this.pausedAt}%`;
      }
    }
    this.renderLoop();
  }

  initImages() {
    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= 4) {
        this.imagesLoaded = true;
      }
    };

    this.images.left.onload = checkAllLoaded;
    this.images.mid.onload = checkAllLoaded;
    this.images.right.onload = checkAllLoaded;
    this.images.pill.onload = checkAllLoaded;

    this.images.left.src = 'assets/loading-screen/bar-cap-left.png';
    this.images.mid.src = 'assets/loading-screen/bar-body-mid.png';
    this.images.right.src = 'assets/loading-screen/bar-cap-right.png';
    this.images.pill.src = 'assets/loading-screen/loading-bar-fill-pill.png';
  }

  initBubbles() {
    for (let i = 0; i < 12; i++) {
      this.bubbles.push({
        x: Math.random() * 20 - 10,
        y: Math.random() * 40 - 20,
        radius: Math.random() * 3 + 1.5,
        speedY: Math.random() * 0.8 + 0.4,
        speedX: (Math.random() - 0.5) * 0.5,
        alpha: Math.random() * 0.7 + 0.3
      });
    }
  }

  setupListeners() {
    const handleStart = (e) => {
      if (e) e.stopPropagation();
      if (this.isComplete) {
        this.exit();
      }
    };

    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', handleStart);
      this.btnPlay.addEventListener('touchend', handleStart);
    }

    // Tapping anywhere when complete starts immediately
    this.screenEl.addEventListener('click', () => {
      if (this.isComplete) {
        this.exit();
      }
    });

    this.screenEl.addEventListener('touchend', () => {
      if (this.isComplete) {
        this.exit();
      }
    });
  }

  startLoading() {
    const startTime = performance.now();
    const duration = 2400; // ~2.4 seconds for ultra smooth, satisfying game load feel

    const updateStep = (now) => {
      if (this.hasExited || this.pausedAt !== null) return;

      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);

      // Casual game ease curve: quick start, slight pause around 65%, then smooth finish
      let eased;
      if (t < 0.6) {
        eased = (t / 0.6) * 0.65; // Reach 65% around 60% of time
      } else {
        const remaining = (t - 0.6) / 0.4;
        eased = 0.65 + Math.pow(remaining, 1.2) * 0.35;
      }

      this.targetProgress = Math.min(100, Math.floor(eased * 100));

      if (t < 1) {
        requestAnimationFrame(updateStep);
      } else {
        this.targetProgress = 100;
        this.onLoadFinished();
      }
    };

    requestAnimationFrame(updateStep);
  }

  onLoadFinished() {
    this.progress = 100;
    this.isComplete = true;

    if (this.statusTextEl) {
      this.statusTextEl.innerHTML = 'Ready! <span id="loading-percentage">100%</span>';
    }

    if (this.btnPlay) {
      this.btnPlay.classList.remove('hidden');
      this.btnPlay.classList.add('pop-in');
    }

    // Auto-transition to gameplay after 4s if player hasn't tapped yet
    this.autoExitTimer = setTimeout(() => {
      if (!this.hasExited) {
        this.exit();
      }
    }, 4000);
  }

  exit() {
    if (this.hasExited) return;
    this.hasExited = true;

    if (this.autoExitTimer) {
      clearTimeout(this.autoExitTimer);
      this.autoExitTimer = null;
    }

    // Unlock Web Audio API on this user interaction
    if (window.soundCtrl && typeof window.soundCtrl.init === 'function') {
      window.soundCtrl.init();
      // Play a friendly soft click or chime if available
      try {
        if (window.soundCtrl.playTap) window.soundCtrl.playTap();
      } catch (e) {}
    }

    // Smooth exit animation
    this.screenEl.classList.add('loading-fade-out');

    setTimeout(() => {
      this.screenEl.style.display = 'none';
      this.screenEl.classList.remove('loading-fade-out');

      // Smoothly reveal game page UI
      if (window.hexaGame && typeof window.hexaGame.resize === 'function') {
        window.hexaGame.resize();
      }
    }, 600);
  }

  renderLoop() {
    if (this.hasExited) return;

    // Smooth lerp progress towards target
    this.progress += (this.targetProgress - this.progress) * 0.18;
    if (Math.abs(this.targetProgress - this.progress) < 0.2) {
      this.progress = this.targetProgress;
    }

    const currentPct = Math.min(100, Math.max(0, Math.round(this.progress)));
    if (this.textEl) {
      this.textEl.textContent = `${currentPct}%`;
    }

    this.drawBar(this.progress / 100);

    requestAnimationFrame(() => this.renderLoop());
  }

  drawBar(pct) {
    const ctx = this.ctx;
    const W = 554;
    const H = 94;

    ctx.clearRect(0, 0, W, H);

    if (pct <= 0.01) return;

    const currentW = Math.max(25, W * pct);
    const leftW = 47;
    const rightW = 50;

    ctx.save();

    if (this.imagesLoaded) {
      if (currentW < (leftW + rightW)) {
        // Early phase: compress both caps gracefully
        const scale = currentW / (leftW + rightW);
        ctx.save();
        ctx.scale(scale, 1);
        ctx.drawImage(this.images.left, 0, 0, leftW, H);
        ctx.drawImage(this.images.right, leftW, 0, rightW, H);
        ctx.restore();
      } else {
        const midW = currentW - leftW - rightW;
        // 1. Draw Left Cap
        ctx.drawImage(this.images.left, 0, 0, leftW, H);
        // 2. Draw Stretched Middle Body
        if (midW > 0) {
          ctx.drawImage(this.images.mid, leftW, 0, midW, H);
        }
        // 3. Draw Right Cap with bubble highlights
        ctx.drawImage(this.images.right, leftW + midW, 0, rightW, H);
      }
    } else {
      // Procedural fallback while images load
      ctx.beginPath();
      ctx.roundRect(0, 0, currentW, H, H / 2);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#5cedfc');
      grad.addColorStop(0.3, '#19c6f7');
      grad.addColorStop(0.85, '#0097df');
      grad.addColorStop(1, '#0076ba');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Dynamic glowing bubbles at the leading edge
    const headX = currentW - 18;
    const headY = H / 2;

    for (let b of this.bubbles) {
      b.y -= b.speedY;
      b.x += b.speedX;
      b.alpha -= 0.008;

      if (b.alpha <= 0 || b.y < -30) {
        b.x = (Math.random() - 0.5) * 24;
        b.y = (Math.random() - 0.5) * 20;
        b.alpha = Math.random() * 0.6 + 0.4;
      }

      ctx.beginPath();
      ctx.arc(headX + b.x, headY + b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha})`;
      ctx.shadowColor = '#00d2d3';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

// Global debug helper to re-show the loading screen anytime
window.showLoadingScreen = function(forceProgress) {
  const el = document.getElementById('loading-screen');
  if (el) {
    el.style.display = 'flex';
    el.classList.remove('loading-fade-out');
    const btn = document.getElementById('btn-play-now');
    if (btn) btn.classList.add('hidden');
    const statusText = document.getElementById('loading-status-text');
    if (statusText) statusText.innerHTML = 'Loading... <span id="loading-percentage">0%</span>';
    const opts = typeof forceProgress === 'number' ? { pauseAt: forceProgress } : {};
    window.loadingController = new LoadingScreenController(opts);
  }
};

window.setLoadingProgress = function(pct) {
  if (window.loadingController) {
    window.loadingController.targetProgress = pct;
    window.loadingController.progress = pct;
    const textEl = document.getElementById('loading-percentage');
    if (textEl) textEl.textContent = `${pct}%`;
  }
};

// Auto-boot loading screen on DOM ready (supports ?loading=65 query param for previews)
function initLoadingScreenOnLoad() {
  const urlParams = new URLSearchParams(window.location.search);
  const previewParam = urlParams.get('loading');
  if (previewParam !== null) {
    const parsed = parseInt(previewParam, 10);
    window.loadingController = new LoadingScreenController({ pauseAt: isNaN(parsed) ? 65 : parsed });
  } else {
    window.loadingController = new LoadingScreenController();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoadingScreenOnLoad);
} else {
  initLoadingScreenOnLoad();
}
