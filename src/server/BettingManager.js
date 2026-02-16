/**
 * BettingManager class for managing betting system
 * Implements requirements 9.1, 9.3, 9.4, 9.6, 9.7, 9.8, 9.9
 */
class BettingManager {
  constructor() {
    this.INITIAL_BALANCE = 1000;
    this.MIN_BET = 1;
    this.CHIP_DENOMINATIONS = [1, 5, 25, 100, 500, 1000, 5000];
  }

  /**
   * Initialize player balance
   * Implements requirement 9.1
   * @param {Player} player - The player to initialize
   */
  initializePlayerBalance(player) {
    player.balance = this.INITIAL_BALANCE;
    player.currentBet = 0;
    player.hasBet = false;
  }

  /**
   * Validate bet amount
   * Implements requirements 9.3, 9.4
   * @param {number} bet - The bet amount
   * @param {number} playerBalance - The player's current balance
   * @returns {object} Validation result
   */
  validateBet(bet, playerBalance) {
    // Check if bet is a valid number
    if (typeof bet !== 'number' || isNaN(bet) || !isFinite(bet)) {
      return { valid: false, reason: 'Invalid bet amount format' };
    }

    // Check minimum bet
    if (bet < this.MIN_BET) {
      return { valid: false, reason: `Bet must be at least $${this.MIN_BET}` };
    }

    // Check player balance
    if (bet > playerBalance) {
      return { valid: false, reason: 'Insufficient balance' };
    }

    // Check if bet can be made with valid chip combinations
    if (!this.isValidChipCombination(bet)) {
      return { valid: false, reason: 'Invalid chip combination' };
    }

    return { valid: true };
  }

  /**
   * Check if amount can be made with valid chip denominations
   * Implements requirement 9.3
   * @param {number} amount - The amount to check
   * @returns {boolean} True if valid chip combination exists
   */
  isValidChipCombination(amount) {
    // Use dynamic programming to check if amount can be made with chips
    const dp = new Array(amount + 1).fill(false);
    dp[0] = true;

    for (let i = 1; i <= amount; i++) {
      for (const chip of this.CHIP_DENOMINATIONS) {
        if (i >= chip && dp[i - chip]) {
          dp[i] = true;
          break;
        }
      }
    }

    return dp[amount];
  }

  /**
   * Calculate payout based on game result
   * Implements requirements 9.6, 9.7, 9.8, 9.9
   * @param {number} betAmount - The bet amount
   * @param {string} result - The game result ('blackjack', 'win', 'push', 'lose')
   * @returns {number} The net change in balance (bet + winnings for win, bet for push, 0 for lose)
   */
  calculatePayout(betAmount, result) {
    switch (result) {
      case 'blackjack':
        // 3:2 payout: return bet + 1.5x bet = 2.5x bet
        return betAmount + (betAmount * 1.5);
      case 'win':
        // 1:1 payout: return bet + 1x bet = 2x bet
        return betAmount + betAmount;
      case 'push':
        // Return bet only
        return betAmount;
      case 'lose':
        // Lose bet (no return)
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Update player balance after game
   * @param {Player} player - The player
   * @param {number} payout - The payout amount
   */
  updateBalance(player, payout) {
    // For win/blackjack: balance + bet + payout
    // For push: balance + bet (payout is 0)
    // For lose: balance (payout is -bet, so balance + bet + (-bet) = balance)
    player.balance += payout;
    player.currentBet = 0;
    player.hasBet = false;
  }

  /**
   * Reset player balance to initial amount
   * Implements requirement 9.11
   * @param {Player} player - The player
   */
  resetBalance(player) {
    player.balance = this.INITIAL_BALANCE;
    player.currentBet = 0;
    player.hasBet = false;
  }

  /**
   * Place bet for player
   * @param {Player} player - The player
   * @param {number} amount - The bet amount
   * @returns {object} Result of bet placement
   */
  placeBet(player, amount) {
    const validation = this.validateBet(amount, player.balance);
    
    if (!validation.valid) {
      return {
        success: false,
        reason: validation.reason
      };
    }

    // Deduct bet from balance
    player.balance -= amount;
    player.currentBet = amount;
    player.hasBet = true;

    return {
      success: true,
      newBalance: player.balance,
      currentBet: player.currentBet
    };
  }

  /**
   * Check if player needs balance reset
   * @param {Player} player - The player
   * @returns {boolean} True if balance is below minimum bet
   */
  needsBalanceReset(player) {
    return player.balance < this.MIN_BET;
  }

  /**
   * Get chip denominations
   * @returns {Array} Array of chip denominations
   */
  getChipDenominations() {
    return this.CHIP_DENOMINATIONS.map(value => ({
      value,
      color: this.getChipColor(value),
      label: `$${value.toLocaleString()}`
    }));
  }

  /**
   * Get chip color based on value
   * @param {number} value - The chip value
   * @returns {string} The chip color
   */
  getChipColor(value) {
    const colorMap = {
      1: 'white',
      5: 'red',
      25: 'green',
      100: 'black',
      500: 'purple',
      1000: 'orange',
      5000: 'brown'
    };
    return colorMap[value] || 'white';
  }
}

module.exports = BettingManager;
