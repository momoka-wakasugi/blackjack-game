/**
 * DealerAI class for automated dealer behavior
 * Implements requirements 3.1, 3.2, 3.3
 */
class DealerAI {
  constructor() {
    this.hitThreshold = 17; // Dealer hits on 16 or below, stands on 17 or above
    this.dealDelay = 1000; // 1 second delay between dealer actions for visibility
  }

  /**
   * Execute the dealer's turn automatically
   * Implements requirement 3.1 - Dealer automatically starts after all players are done
   * @param {GameState} gameState - The current game state
   * @returns {Promise<object>} Result of dealer's turn
   */
  async playDealerTurn(gameState) {
    // Reveal dealer's hidden card
    gameState.revealDealerCard();

    const actions = [];
    
    // Dealer hits until reaching 17 or above
    while (this.shouldHit(gameState.dealer.handValue)) {
      await this.delay(this.dealDelay);
      
      const card = gameState.deck.dealCard();
      if (!card) {
        // No more cards in deck
        break;
      }

      gameState.addCardToDealer(card);
      actions.push({
        action: 'hit',
        card: card.toClientObject(),
        handValue: gameState.dealer.handValue
      });

      // Check if dealer busted
      if (gameState.dealer.handValue > 21) {
        gameState.dealer.status = 'bust';
        break;
      }
    }

    // Dealer stands (either reached 17+ or busted)
    if (gameState.dealer.handValue <= 21) {
      gameState.dealer.status = 'stand';
    }

    return {
      success: true,
      actions,
      finalHandValue: gameState.dealer.handValue,
      dealerStatus: gameState.dealer.status
    };
  }

  /**
   * Determine if dealer should hit based on hand value
   * Implements requirements 3.2, 3.3 - Hit on 16 or below, stand on 17 or above
   * @param {number} handValue - The dealer's current hand value
   * @returns {boolean} True if dealer should hit
   */
  shouldHit(handValue) {
    return handValue < this.hitThreshold;
  }

  /**
   * Check if dealer should start their turn
   * Implements requirement 3.1 - Dealer starts when all players are done
   * @param {GameState} gameState - The current game state
   * @returns {boolean} True if dealer should start
   */
  shouldStartDealerTurn(gameState) {
    return gameState.areAllPlayersDone() && gameState.status === 'playing';
  }

  /**
   * Delay helper for dealer actions
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set the delay between dealer actions
   * @param {number} ms - Milliseconds to delay
   */
  setDealDelay(ms) {
    this.dealDelay = ms;
  }

  /**
   * Get dealer AI configuration
   * @returns {object} Configuration object
   */
  getConfig() {
    return {
      hitThreshold: this.hitThreshold,
      dealDelay: this.dealDelay
    };
  }
}

module.exports = DealerAI;
