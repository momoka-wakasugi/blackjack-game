const Deck = require('./Deck');

/**
 * GameState class representing the state of a blackjack game
 * Implements requirements 6.2, 6.3, 6.4
 */
class GameState {
  constructor(roomId) {
    this.roomId = roomId;
    this.status = 'waiting'; // 'waiting' | 'betting' | 'playing' | 'finished'
    this.players = [];
    this.dealer = {
      hand: [],
      status: 'waiting', // 'waiting' | 'playing' | 'finished'
      handValue: 0
    };
    this.deck = new Deck();
    this.currentPlayerIndex = 0;
    this.winners = [];
    this.payouts = []; // Array of payout results
    this.gameStartTime = null;
    this.lastActionTime = new Date();
  }

  /**
   * Add a player to the game
   * @param {Player} player - The player to add
   */
  addPlayer(player) {
    this.players.push(player);
    this.lastActionTime = new Date();
  }

  /**
   * Remove a player from the game
   * @param {string} playerId - The ID of the player to remove
   * @returns {boolean} True if player was removed
   */
  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      this.players.splice(index, 1);
      this.lastActionTime = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get a player by ID
   * @param {string} playerId - The player ID
   * @returns {Player|null} The player or null if not found
   */
  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId) || null;
  }

  /**
   * Get the current player whose turn it is
   * @returns {Player|null} The current player or null
   */
  getCurrentPlayer() {
    if (this.currentPlayerIndex >= 0 && this.currentPlayerIndex < this.players.length) {
      return this.players[this.currentPlayerIndex];
    }
    return null;
  }

  /**
   * Move to the next player's turn
   * @returns {Player|null} The next player or null if all players are done
   */
  nextPlayer() {
    this.currentPlayerIndex++;
    if (this.currentPlayerIndex >= this.players.length) {
      return null; // All players done, dealer's turn
    }
    return this.getCurrentPlayer();
  }

  /**
   * Start a new game
   */
  startGame() {
    this.status = 'playing';
    this.gameStartTime = new Date();
    this.lastActionTime = new Date();
    this.currentPlayerIndex = 0;
    this.winners = [];
    this.deck.reset();
    
    // Reset all players
    this.players.forEach(player => {
      player.resetHand();
      player.setStatus('playing');
    });
    
    // Reset dealer
    this.dealer.hand = [];
    this.dealer.status = 'waiting';
    this.dealer.handValue = 0;
  }

  /**
   * Deal initial cards (2 cards to each player and dealer)
   */
  dealInitialCards() {
    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        const card = this.deck.dealCard();
        if (card) {
          player.addCard(card);
        }
      });
      
      // Deal to dealer
      const dealerCard = this.deck.dealCard();
      if (dealerCard) {
        // Hide dealer's second card
        if (i === 1) {
          dealerCard.setHidden(true);
        }
        this.dealer.hand.push(dealerCard);
      }
    }
    
    this.dealer.handValue = this.calculateDealerHandValue();
    
    // Don't change blackjack status - keep it for payout calculation
    // Players with blackjack are automatically done (checked in canTakeAction)
    
    // Move to first player who can take action
    while (this.currentPlayerIndex < this.players.length) {
      const currentPlayer = this.players[this.currentPlayerIndex];
      if (currentPlayer.canTakeAction()) {
        break;
      }
      this.currentPlayerIndex++;
    }
    
    this.lastActionTime = new Date();
  }

  /**
   * Calculate dealer's hand value with Ace handling
   * Implements requirement 6.4
   * @returns {number} The optimal hand value
   */
  calculateDealerHandValue() {
    let value = 0;
    let aceCount = 0;

    for (const card of this.dealer.hand) {
      if (card.rank === 'A') {
        aceCount++;
        value += 11;
      } else {
        value += card.value;
      }
    }

    // Adjust aces from 11 to 1 if needed
    while (value > 21 && aceCount > 0) {
      value -= 10;
      aceCount--;
    }

    return value;
  }

  /**
   * Add a card to dealer's hand
   * @param {Card} card - The card to add
   */
  addCardToDealer(card) {
    this.dealer.hand.push(card);
    this.dealer.handValue = this.calculateDealerHandValue();
    this.lastActionTime = new Date();
  }

  /**
   * Reveal dealer's hidden card
   */
  revealDealerCard() {
    this.dealer.hand.forEach(card => card.setHidden(false));
    this.dealer.handValue = this.calculateDealerHandValue();
  }

  /**
   * End the game and determine winners
   */
  endGame() {
    this.status = 'finished';
    this.dealer.status = 'finished';
    this.determineWinners();
    this.lastActionTime = new Date();
  }

  /**
   * Determine winners based on blackjack rules
   * Implements requirements 6.5, 3.4, 6.1 - Win determination and bust handling
   */
  determineWinners() {
    this.winners = [];
    const dealerValue = this.dealer.handValue;
    const dealerBust = dealerValue > 21;

    this.players.forEach(player => {
      // Requirement 6.1: Players who busted lose
      if (player.status === 'bust') {
        // Player busted, dealer wins
        return;
      }

      // Requirement 6.5: Standard blackjack win determination
      if (dealerBust) {
        // Dealer busted, player wins if not busted
        this.winners.push(player.id);
      } else if (player.handValue > dealerValue) {
        // Player has higher value than dealer
        this.winners.push(player.id);
      } else if (player.handValue === dealerValue) {
        // Push (tie) - treating as no winner (could add to separate array if needed)
      }
      // else dealer wins (player.handValue < dealerValue)
    });
  }

  /**
   * Check if all players are done (stand or bust)
   * @returns {boolean} True if all players are done
   */
  areAllPlayersDone() {
    return this.players.every(player => 
      player.status === 'stand' || player.status === 'bust' || player.status === 'blackjack'
    );
  }

  /**
   * Start betting phase
   * Implements requirement 9.2
   */
  startBettingPhase() {
    this.status = 'betting';
    this.payouts = [];
    this.lastActionTime = new Date();
    
    // Reset all players' betting status
    this.players.forEach(player => {
      player.hasBet = false;
    });
  }

  /**
   * Check if all players have placed their bets
   * Implements requirement 9.5
   * @returns {boolean} True if all players have bet
   */
  areAllPlayersBetPlaced() {
    return this.players.length > 0 && this.players.every(player => player.hasBet);
  }

  /**
   * Add payout result for a player
   * @param {string} playerId - The player ID
   * @param {number} betAmount - The bet amount
   * @param {string} result - The game result
   * @param {number} payout - The payout amount
   * @param {number} newBalance - The player's new balance
   */
  addPayoutResult(playerId, betAmount, result, payout, newBalance) {
    this.payouts.push({
      playerId,
      betAmount,
      result,
      payout,
      newBalance,
      timestamp: new Date()
    });
  }

  /**
   * Get game state for client
   * @param {boolean} hideDealer - Whether to hide dealer's cards
   * @returns {object} Game state object
   */
  toClientObject(hideDealer = false) {
    return {
      roomId: this.roomId,
      status: this.status,
      players: this.players.map(p => p.toClientObject()),
      dealer: {
        hand: this.dealer.hand.map(card => card.toClientObject()),
        handValue: hideDealer ? null : this.dealer.handValue,
        status: this.dealer.status
      },
      currentPlayerIndex: this.currentPlayerIndex,
      winners: this.winners,
      payouts: this.payouts,
      gameStartTime: this.gameStartTime,
      lastActionTime: this.lastActionTime
    };
  }
}

module.exports = GameState;
