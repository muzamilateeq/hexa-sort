/* Developed by Muzammil */
/**
 * Hexa Sort - Main Menu Controller
 * Seamlessly manages screen states: Loading Screen -> Main Menu -> Gameplay,
 * with audio-reactive controls, persistent high scores, level badges, and rich animations.
 */

class MainMenuController {
  constructor() {
    this.menuEl = document.getElementById('main-menu-screen');
    this.highScoreEl = document.getElementById('menu-high-score');
    this.levelEl = document.getElementById('menu-level-text');
    this.btnPlay = document.getElementById('btn-main-play');
    this.btnSound = document.getElementById('btn-menu-sound');
    this.soundIcon = document.getElementById('menu-sound-icon');
    this.btnInstructions = document.getElementById('btn-menu-instructions');
    this.gameHeader = document.getElementById('game-header');
    this.canvasContainer = document.getElementById('canvas-container');

    this.isOpen = false;
    this.init();
  }

  init() {
    if (!this.menuEl) return;

    const handleStart = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.startGame();
    };

    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', handleStart);
      this.btnPlay.addEventListener('touchend', handleStart);
    }

    if (this.btnSound) {
      this.btnSound.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        this.toggleSound();
      });
    }

    if (this.btnInstructions) {
      this.btnInstructions.addEventListener('click', (e) => {
        if (e) e.stopPropagation();
        if (window.soundCtrl) window.soundCtrl.playClick();
        const inst = document.getElementById('modal-instructions');
        if (inst) inst.classList.remove('hidden');
      });
    }

    this.updateStats();
    this.updateSoundIcon();
  }

  updateStats() {
    let best = 0;
    let lvl = 1;
    try {
      const s = localStorage.getItem('hexasort_highscore');
      if (s) best = parseInt(s, 10) || 0;
      const l = localStorage.getItem('hexasort_level');
      if (l) lvl = Math.max(1, parseInt(l, 10) || 1);
    } catch (e) {}

    if (this.highScoreEl) this.highScoreEl.textContent = best.toLocaleString();
    if (this.levelEl) this.levelEl.textContent = `LEVEL ${lvl}`;
  }

  updateSoundIcon() {
    if (this.soundIcon && window.soundCtrl) {
      this.soundIcon.textContent = window.soundCtrl.isMuted ? '🔇' : '🔊';
    }
  }

  toggleSound() {
    if (window.soundCtrl) {
      window.soundCtrl.toggleMute();
      window.soundCtrl.playClick();
      this.updateSoundIcon();
      if (window.hexaGame) {
        window.hexaGame.updateSoundIcons();
      }
    }
  }

  show() {
    this.isOpen = true;
    this.updateStats();
    this.updateSoundIcon();

    if (this.menuEl) {
      this.menuEl.classList.remove('hidden');
      this.menuEl.classList.remove('menu-fade-out');
      this.menuEl.classList.add('menu-fade-in');
    }

    // Hide in-game HUD while on main menu
    if (this.gameHeader) {
      this.gameHeader.style.opacity = '0';
      this.gameHeader.style.pointerEvents = 'none';
    }
    if (this.canvasContainer) {
      this.canvasContainer.style.opacity = '0';
      this.canvasContainer.style.pointerEvents = 'none';
    }
  }

  hide() {
    this.isOpen = false;

    if (this.menuEl) {
      this.menuEl.classList.remove('menu-fade-in');
      this.menuEl.classList.add('menu-fade-out');
      setTimeout(() => {
        this.menuEl.classList.add('hidden');
        this.menuEl.classList.remove('menu-fade-out');
      }, 350);
    }

    // Reveal in-game HUD
    if (this.gameHeader) {
      this.gameHeader.style.opacity = '1';
      this.gameHeader.style.pointerEvents = 'auto';
      this.gameHeader.style.transition = 'opacity 0.35s ease';
    }
    if (this.canvasContainer) {
      this.canvasContainer.style.opacity = '1';
      this.canvasContainer.style.pointerEvents = 'auto';
      this.canvasContainer.style.transition = 'opacity 0.35s ease';
    }
  }

  startGame() {
    if (window.soundCtrl) {
      window.soundCtrl.init();
      window.soundCtrl.playClick();
    }

    this.hide();

    // Boot or resize gameplay engine
    if (!window.hexaGame) {
      window.hexaGame = new HexaSortGame();
    } else {
      window.hexaGame.resize();
    }
  }
}

window.MainMenuController = MainMenuController;

window.showMainMenu = function() {
  if (!window.mainMenuCtrl) {
    window.mainMenuCtrl = new MainMenuController();
  }
  window.mainMenuCtrl.show();
};

window.hideMainMenu = function() {
  if (window.mainMenuCtrl) {
    window.mainMenuCtrl.hide();
  }
};

// Auto-instantiate when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (!window.mainMenuCtrl) {
    window.mainMenuCtrl = new MainMenuController();
  }
});
