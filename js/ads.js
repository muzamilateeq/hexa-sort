/* Developed by Muzammil */
/**
 * Hexa Sort - Ad Integration Hooks & SDK Placeholders
 * Ready for monetization integration (Google AdSense, AdMob, Poki, CrazyGames, GameDistribution, etc.)
 */

class AdManager {
  constructor() {
    this.adModal = document.getElementById('modal-ad-simulation');
    this.adTimerSpan = document.getElementById('ad-timer');
    this.btnCloseAd = document.getElementById('btn-close-ad');
    this.rewardTimer = null;
    this.currentRewardSuccess = null;

    if (this.btnCloseAd) {
      this.btnCloseAd.addEventListener('click', () => {
        this.closeAd();
      });
    }
  }

  /**
   * Hook for Interstitial (Full Screen) Ads
   * Call between levels, on game restart, or after N moves.
   *
   * @param {string} placement - Identifier (e.g., 'level_complete', 'game_over')
   * @param {function} onComplete - Callback executed after ad completes or is dismissed
   */
  showInterstitial(placement = 'generic', onComplete = null) {
    console.log(`[AdManager] showInterstitialAd requested at placement: "${placement}"`);

    // SDK Hook Point:
    // If using CrazyGames: window.CrazyGames.SDK.ad.requestAd("midgame")
    // If using Poki: PokiSDK.commercialBreak().then(...)
    // If using GameDistribution: gdsdk.showAd()

    // Default simulation: brief instant resolution for seamless dev experience
    if (typeof onComplete === 'function') {
      setTimeout(() => {
        onComplete();
      }, 100);
    }
  }

  /**
   * Hook for Rewarded Video Ads
   * Provides player with valuable in-game perks (Revives, Extra Boosters, Double Score).
   *
   * @param {string} rewardType - 'revive' | 'booster_hammer' | 'booster_shuffle' | 'booster_bomb'
   * @param {function} onSuccess - Callback when player finishes watching ad
   * @param {function} onFailed - Callback if ad fails to load or player closes early
   */
  showRewarded(rewardType = 'reward', onSuccess = null, onFailed = null) {
    console.log(`[AdManager] showRewardedAd requested for reward: "${rewardType}"`);

    this.currentRewardSuccess = onSuccess;

    // Show simulated modal with 3s countdown to verify reward loop
    if (this.adModal && this.adTimerSpan && this.btnCloseAd) {
      this.adModal.classList.remove('hidden');
      this.btnCloseAd.disabled = true;
      let countdown = 3;
      this.adTimerSpan.textContent = `Reward in ${countdown}s`;

      if (this.rewardTimer) clearInterval(this.rewardTimer);

      this.rewardTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          this.adTimerSpan.textContent = `Reward in ${countdown}s`;
        } else {
          clearInterval(this.rewardTimer);
          this.adTimerSpan.textContent = `Reward Granted!`;
          this.btnCloseAd.disabled = false;
          this.btnCloseAd.classList.add('pulse-btn');
        }
      }, 1000);
    } else {
      // Direct fallback
      if (typeof onSuccess === 'function') onSuccess();
    }
  }

  /**
   * Close ad overlay and trigger reward
   */
  closeAd() {
    if (this.rewardTimer) clearInterval(this.rewardTimer);
    if (this.adModal) {
      this.adModal.classList.add('hidden');
    }
    if (this.btnCloseAd) {
      this.btnCloseAd.disabled = true;
      this.btnCloseAd.classList.remove('pulse-btn');
    }

    if (typeof this.currentRewardSuccess === 'function') {
      const cb = this.currentRewardSuccess;
      this.currentRewardSuccess = null;
      cb();
    }
  }
}

// Global Ad instance
const adInstance = new AdManager();

/**
 * Global Hook Points as requested in prompt:
 */
window.showInterstitialAd = function(placement, onComplete) {
  adInstance.showInterstitial(placement, onComplete);
};

window.showRewardedAd = function(rewardType, onSuccess, onFailed) {
  adInstance.showRewarded(rewardType, onSuccess, onFailed);
};

window.AdManagerInstance = adInstance;
