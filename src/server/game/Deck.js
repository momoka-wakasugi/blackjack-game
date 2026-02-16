const Card = require('./Card');

/**
 * Deck class representing a standard 52-card deck
 * Implements requirements 6.2, 8.1 - server-side deck management
 */
class Deck {
  constructor() {
    this.cards = [];
    this.initializeDeck();
    this.shuffle();
  }

  /**
   * Initialize a standard 52-card deck
   */
  initializeDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    this.cards = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm
   * Ensures cryptographically secure randomization for server-side management
   */
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Deal a single card from the top of the deck
   * @returns {Card|null} The dealt card, or null if deck is empty
   */
  dealCard() {
    if (this.cards.length === 0) {
      return null;
    }
    return this.cards.pop();
  }

  /**
   * Deal multiple cards
   * @param {number} count - Number of cards to deal
   * @returns {Card[]} Array of dealt cards
   */
  dealCards(count) {
    const dealtCards = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      dealtCards.push(this.dealCard());
    }
    return dealtCards;
  }

  /**
   * Get the number of remaining cards in the deck
   * @returns {number} Number of cards left
   */
  getRemainingCount() {
    return this.cards.length;
  }

  /**
   * Check if deck is empty
   * @returns {boolean} True if deck has no cards left
   */
  isEmpty() {
    return this.cards.length === 0;
  }

  /**
   * Reset and shuffle the deck (create new deck)
   */
  reset() {
    this.initializeDeck();
    this.shuffle();
  }

  /**
   * Get deck state for debugging (server-side only)
   * @returns {object} Deck state information
   */
  getState() {
    return {
      remainingCards: this.cards.length,
      isEmpty: this.isEmpty()
    };
  }
}

module.exports = Deck;