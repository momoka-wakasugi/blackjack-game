/**
 * Player class representing a game participant
 * Implements requirements 1.2, 6.4
 */
class Player {
  constructor(id, name, socketId) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.joinedAt = new Date();
    this.isConnected = true;
    this.currentHand = [];
    this.handValue = 0;
    this.status = 'waiting'; // 'waiting' | 'playing' | 'stand' | 'bust' | 'blackjack'
    
    // Betting properties (requirement 9.1)
    this.balance = 0; // Will be initialized by BettingManager
    this.currentBet = 0;
    this.hasBet = false;
  }

  /**
   * Add a card to the player's hand
   * @param {Card} card - The card to add
   */
  addCard(card) {
    this.currentHand.push(card);
    this.handValue = this.calculateHandValue();
    this.updateStatus();
  }

  /**
   * Calculate the optimal value of the player's hand
   * Implements requirement 6.4 - Ace handling (11 if possible, otherwise 1)
   * @returns {number} The optimal hand value
   */
  calculateHandValue() {
    let value = 0;
    let aceCount = 0;

    // First pass: count aces and sum other cards
    for (const card of this.currentHand) {
      if (card.rank === 'A') {
        aceCount++;
        value += 11; // Start with Ace as 11
      } else {
        value += card.value;
      }
    }

    // Adjust aces from 11 to 1 if needed to avoid bust
    while (value > 21 && aceCount > 0) {
      value -= 10; // Convert one Ace from 11 to 1
      aceCount--;
    }

    return value;
  }

  /**
   * Update player status based on hand value
   */
  updateStatus() {
    if (this.handValue > 21) {
      this.status = 'bust';
    } else if (this.handValue === 21 && this.currentHand.length === 2) {
      this.status = 'blackjack';
    }
  }

  /**
   * Set player status
   * @param {string} status - The new status
   */
  setStatus(status) {
    this.status = status;
  }

  /**
   * Reset player's hand for a new game
   */
  resetHand() {
    this.currentHand = [];
    this.handValue = 0;
    this.status = 'waiting';
    // Note: Don't reset betting properties here - they persist across games
  }

  /**
   * Set connection status
   * @param {boolean} connected - Whether the player is connected
   */
  setConnected(connected) {
    this.isConnected = connected;
  }

  /**
   * Get player state for client
   * @returns {object} Player state object
   */
  toClientObject() {
    return {
      id: this.id,
      name: this.name,
      hand: this.currentHand.map(card => card.toClientObject()),
      handValue: this.handValue,
      status: this.status,
      isConnected: this.isConnected,
      balance: this.balance,
      currentBet: this.currentBet,
      hasBet: this.hasBet
    };
  }

  /**
   * Check if player can take action
   * @returns {boolean} True if player can hit or stand
   */
  canTakeAction() {
    // Players with blackjack cannot take action (auto-stand)
    // Players who are bust cannot take action
    // Players who have stood cannot take action
    return (this.status === 'playing') && this.isConnected;
  }
}

module.exports = Player;
