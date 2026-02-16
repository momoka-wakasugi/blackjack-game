const DealerAI = require('./DealerAI');
const BettingManager = require('./BettingManager');

/**
 * GameEngine class for managing game logic and player actions
 * Implements requirements 6.2, 6.3, 8.2, 8.3, 3.1, 3.2, 3.3, 3.4, 6.1, 6.5, 9.5, 9.10
 */
class GameEngine {
  constructor() {
    // GameEngine coordinates with RoomManager for game state
    this.dealerAI = new DealerAI();
    this.bettingManager = new BettingManager();
    // Track pending actions to prevent concurrent action conflicts (requirement 8.3)
    this.pendingActions = new Map(); // roomId -> { playerId, timestamp }
    this.actionTimeout = 100; // 100ms timeout for action processing
  }

  /**
   * Process a player action (hit or stand)
   * Implements requirements 6.2, 6.3, 8.2, 8.3
   * @param {GameState} gameState - The current game state
   * @param {string} playerId - The ID of the player taking action
   * @param {string} action - The action ('hit' or 'stand')
   * @returns {object} Result object with success status and updated state
   */
  processPlayerAction(gameState, playerId, action) {
    const roomId = gameState.roomId;
    
    // Check for concurrent action conflicts (requirement 8.3)
    const conflictCheck = this.checkActionConflict(roomId, playerId);
    if (!conflictCheck.allowed) {
      return {
        success: false,
        message: conflictCheck.reason,
        gameState
      };
    }

    // Lock this action to prevent concurrent processing
    this.lockAction(roomId, playerId);

    try {
      // Comprehensive validation using validateAction (requirement 8.2, 8.3)
      const validation = this.validateAction(gameState, playerId, action);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.reason,
          gameState
        };
      }

      // Get the player (already validated but needed for processing)
      const player = gameState.getPlayer(playerId);

      // Normalize action to lowercase
      const normalizedAction = action.toLowerCase().trim();

      // Process the action
      let result;
      if (normalizedAction === 'hit') {
        result = this.processHit(gameState, player);
      } else if (normalizedAction === 'stand') {
        result = this.processStand(gameState, player);
      }

      return result;
    } finally {
      // Always unlock the action after processing
      this.unlockAction(roomId);
    }
  }

  /**
   * Check if there's a concurrent action conflict
   * Implements requirement 8.3 - Handle concurrent action conflicts
   * @param {string} roomId - The room ID
   * @param {string} playerId - The player ID attempting action
   * @returns {object} Conflict check result
   */
  checkActionConflict(roomId, playerId) {
    const pending = this.pendingActions.get(roomId);
    
    if (!pending) {
      return { allowed: true };
    }

    const now = Date.now();
    const elapsed = now - pending.timestamp;

    // If action is still being processed
    if (elapsed < this.actionTimeout) {
      return {
        allowed: false,
        reason: 'Another action is being processed. Please wait.'
      };
    }

    // If timeout exceeded, allow new action (previous action may have failed)
    return { allowed: true };
  }

  /**
   * Lock an action to prevent concurrent processing
   * @param {string} roomId - The room ID
   * @param {string} playerId - The player ID
   */
  lockAction(roomId, playerId) {
    this.pendingActions.set(roomId, {
      playerId,
      timestamp: Date.now()
    });
  }

  /**
   * Unlock an action after processing
   * @param {string} roomId - The room ID
   */
  unlockAction(roomId) {
    this.pendingActions.delete(roomId);
  }

  /**
   * Process a hit action
   * Implements requirement 6.2 - Deal one card from deck and add to hand
   * @param {GameState} gameState - The current game state
   * @param {Player} player - The player hitting
   * @returns {object} Result object
   */
  processHit(gameState, player) {
    // Deal a card from the deck
    const card = gameState.deck.dealCard();
    
    if (!card) {
      return {
        success: false,
        message: 'No cards left in deck',
        gameState
      };
    }

    // Add card to player's hand
    player.addCard(card);
    gameState.lastActionTime = new Date();

    // Check if player busted
    if (player.status === 'bust') {
      // Move to next player automatically
      const nextPlayer = gameState.nextPlayer();
      
      return {
        success: true,
        message: 'Player busted',
        gameState,
        playerBusted: true,
        nextPlayer: nextPlayer ? nextPlayer.id : null
      };
    }

    // Check if player reached 21 - auto stand
    if (player.handValue === 21) {
      player.setStatus('stand');
      const nextPlayer = gameState.nextPlayer();
      
      return {
        success: true,
        message: 'Player reached 21 and stands automatically',
        gameState,
        autoStand: true,
        nextPlayer: nextPlayer ? nextPlayer.id : null
      };
    }

    return {
      success: true,
      message: 'Card dealt',
      gameState,
      playerBusted: false
    };
  }

  /**
   * Process a stand action
   * Implements requirement 6.3 - End player's turn and move to next
   * @param {GameState} gameState - The current game state
   * @param {Player} player - The player standing
   * @returns {object} Result object
   */
  processStand(gameState, player) {
    // Set player status to stand
    player.setStatus('stand');
    gameState.lastActionTime = new Date();

    // Move to next player
    const nextPlayer = gameState.nextPlayer();

    return {
      success: true,
      message: 'Player stands',
      gameState,
      nextPlayer: nextPlayer ? nextPlayer.id : null
    };
  }

  /**
   * Check if all players are done and dealer should play
   * @param {GameState} gameState - The current game state
   * @returns {boolean} True if dealer should play
   */
  shouldDealerPlay(gameState) {
    return gameState.areAllPlayersDone();
  }

  /**
   * Update game state after an action
   * @param {GameState} gameState - The game state to update
   * @returns {object} Updated game state information
   */
  updateGameState(gameState) {
    gameState.lastActionTime = new Date();
    
    return {
      status: gameState.status,
      currentPlayerIndex: gameState.currentPlayerIndex,
      currentPlayer: gameState.getCurrentPlayer(),
      allPlayersDone: gameState.areAllPlayersDone()
    };
  }

  /**
   * Validate if an action is allowed for a player
   * Implements requirement 8.2 - Validate actions are executed on valid turns
   * Enhanced validation with additional security checks (requirement 8.3)
   * @param {GameState} gameState - The current game state
   * @param {string} playerId - The player ID
   * @param {string} action - The action to validate
   * @returns {object} Validation result
   */
  validateAction(gameState, playerId, action) {
    // Check game state exists
    if (!gameState) {
      return {
        valid: false,
        reason: 'Game state not found'
      };
    }

    // Check game is in progress
    if (gameState.status !== 'playing') {
      return {
        valid: false,
        reason: 'Game is not in progress'
      };
    }

    // Check player ID is provided and valid format
    if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
      return {
        valid: false,
        reason: 'Invalid player ID'
      };
    }

    // Prevent injection attacks - validate player ID format
    if (playerId.length > 100 || /[<>\"']/.test(playerId)) {
      return {
        valid: false,
        reason: 'Invalid player ID format'
      };
    }

    // Check player exists
    const player = gameState.getPlayer(playerId);
    if (!player) {
      return {
        valid: false,
        reason: 'Player not found'
      };
    }

    // Check it's player's turn
    const currentPlayer = gameState.getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return {
        valid: false,
        reason: 'Not player\'s turn'
      };
    }

    // Check player can take action (must be connected and not bust)
    if (!player.canTakeAction()) {
      return {
        valid: false,
        reason: 'Player cannot take action (bust or disconnected)'
      };
    }

    // Check action is valid
    if (!action || typeof action !== 'string' || action.trim() === '') {
      return {
        valid: false,
        reason: 'Invalid action format'
      };
    }

    // Normalize action to lowercase for comparison
    const normalizedAction = action.toLowerCase().trim();
    
    if (normalizedAction !== 'hit' && normalizedAction !== 'stand') {
      return {
        valid: false,
        reason: 'Invalid action type'
      };
    }

    return {
      valid: true
    };
  }

  /**
   * Get available actions for a player
   * @param {GameState} gameState - The current game state
   * @param {string} playerId - The player ID
   * @returns {string[]} Array of available actions
   */
  getAvailableActions(gameState, playerId) {
    const validation = this.validateAction(gameState, playerId, 'hit');
    
    if (!validation.valid) {
      return [];
    }

    // Player can always hit or stand when it's their turn
    return ['hit', 'stand'];
  }

  /**
   * Execute dealer's turn automatically
   * Implements requirement 3.1, 3.2, 3.3 - Dealer plays automatically after all players are done
   * @param {GameState} gameState - The current game state
   * @returns {Promise<object>} Result of dealer's turn
   */
  async playDealerTurn(gameState) {
    if (!this.dealerAI.shouldStartDealerTurn(gameState)) {
      return {
        success: false,
        message: 'Dealer turn cannot start yet'
      };
    }

    const result = await this.dealerAI.playDealerTurn(gameState);
    return result;
  }

  /**
   * Determine winners and end the game
   * Implements requirements 3.4, 6.1, 6.5, 9.6, 9.7, 9.8, 9.9, 9.10 - Win determination, game end, and payouts
   * @param {GameState} gameState - The current game state
   * @returns {object} Game result with winners and payouts
   */
  determineWinners(gameState) {
    gameState.endGame();
    
    // Calculate payouts for each player (requirement 9.10)
    const payouts = [];
    gameState.players.forEach(player => {
      if (player.currentBet > 0) {
        // Determine result for this player
        let result;
        const isWinner = gameState.winners.includes(player.id);
        
        if (player.status === 'bust') {
          result = 'lose';
        } else if (player.status === 'blackjack' && isWinner) {
          result = 'blackjack';
        } else if (isWinner) {
          result = 'win';
        } else if (player.handValue === gameState.dealer.handValue && gameState.dealer.status !== 'bust') {
          result = 'push';
        } else {
          result = 'lose';
        }
        
        // Calculate payout
        const payoutAmount = this.bettingManager.calculatePayout(player.currentBet, result);
        
        // Calculate actual winnings (for display purposes)
        // For lose: -betAmount, for push: 0, for win/blackjack: positive amount
        let actualWinnings;
        if (result === 'lose') {
          actualWinnings = -player.currentBet;
        } else if (result === 'push') {
          actualWinnings = 0;
        } else {
          actualWinnings = payoutAmount - player.currentBet;
        }
        
        // Update player balance
        this.bettingManager.updateBalance(player, payoutAmount);
        
        // Record payout result
        payouts.push({
          playerId: player.id,
          betAmount: player.currentBet,
          outcome: result,  // Changed from 'result' to 'outcome'
          payout: actualWinnings,  // Net winnings/loss for display
          newBalance: player.balance,
          timestamp: new Date()
        });
      }
    });
    
    // Store payouts in game state
    gameState.payouts = payouts;
    
    return {
      success: true,
      winners: gameState.winners,
      payouts: payouts,
      dealerHandValue: gameState.dealer.handValue,
      dealerStatus: gameState.dealer.status,
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        handValue: p.handValue,
        status: p.status,
        isWinner: gameState.winners.includes(p.id),
        balance: p.balance,
        currentBet: p.currentBet
      }))
    };
  }

  /**
   * Place bet for a player
   * Implements requirements 9.2, 9.4
   * @param {GameState} gameState - The current game state
   * @param {string} playerId - The player ID
   * @param {number} amount - The bet amount
   * @returns {object} Result of bet placement
   */
  placeBet(gameState, playerId, amount) {
    // Validate game state
    if (!gameState || gameState.status !== 'betting') {
      return {
        success: false,
        reason: 'Game is not in betting phase'
      };
    }

    // Get player
    const player = gameState.getPlayer(playerId);
    if (!player) {
      return {
        success: false,
        reason: 'Player not found'
      };
    }

    // Check if player already bet
    if (player.hasBet) {
      return {
        success: false,
        reason: 'Player has already placed a bet'
      };
    }

    // Place bet using BettingManager
    const result = this.bettingManager.placeBet(player, amount);
    
    return result;
  }

  /**
   * Get dealer AI instance (for testing)
   * @returns {DealerAI} The dealer AI instance
   */
  getDealerAI() {
    return this.dealerAI;
  }
}

module.exports = GameEngine;
