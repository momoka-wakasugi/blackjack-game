/**
 * Card class representing a playing card
 * Implements requirements 6.2, 8.1
 */
class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = this.calculateValue(rank);
    this.hidden = false;
  }

  /**
   * Calculate the numeric value of a card
   * @param {string} rank - The rank of the card (A, 2-10, J, Q, K)
   * @returns {number} The numeric value
   */
  calculateValue(rank) {
    if (rank === 'A') {
      return 11; // Ace defaults to 11, will be adjusted in hand calculation
    } else if (['J', 'Q', 'K'].includes(rank)) {
      return 10;
    } else {
      return parseInt(rank);
    }
  }

  /**
   * Set card visibility (for dealer's hidden card)
   * @param {boolean} hidden - Whether the card should be hidden
   */
  setHidden(hidden) {
    this.hidden = hidden;
  }

  /**
   * Get card representation for client
   * @returns {object} Card object for client display
   */
  toClientObject() {
    if (this.hidden) {
      return {
        suit: null,
        rank: null,
        value: null,
        hidden: true
      };
    }
    
    return {
      suit: this.suit,
      rank: this.rank,
      value: this.value,
      hidden: false
    };
  }

  /**
   * String representation of the card
   * @returns {string} Card as string
   */
  toString() {
    return `${this.rank} of ${this.suit}`;
  }
}

module.exports = Card;