const GameState = require('./GameState');

/**
 * Room class representing a game room
 * Implements requirements 4.1, 4.3, 4.4
 */
class Room {
  constructor(id, name, maxPlayers = 6) {
    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.gameState = new GameState(id);
    this.isGameInProgress = false;
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  /**
   * Add a player to the room
   * @param {Player} player - The player to add
   * @returns {boolean} True if player was added successfully
   */
  addPlayer(player) {
    // Check if room is full
    if (this.gameState.players.length >= this.maxPlayers) {
      return false;
    }

    // Check if game is in progress (requirement 2.4)
    if (this.isGameInProgress) {
      return false;
    }

    // Check if player is already in the room
    if (this.gameState.getPlayer(player.id)) {
      return false;
    }

    this.gameState.addPlayer(player);
    this.lastActivity = new Date();
    return true;
  }

  /**
   * Remove a player from the room
   * @param {string} playerId - The ID of the player to remove
   * @returns {boolean} True if player was removed
   */
  removePlayer(playerId) {
    const removed = this.gameState.removePlayer(playerId);
    if (removed) {
      this.lastActivity = new Date();
      
      // If no players left and game was in progress, reset game
      if (this.gameState.players.length === 0 && this.isGameInProgress) {
        this.resetGame();
      }
    }
    return removed;
  }

  /**
   * Get a player by ID
   * @param {string} playerId - The player ID
   * @returns {Player|null} The player or null if not found
   */
  getPlayer(playerId) {
    return this.gameState.getPlayer(playerId);
  }

  /**
   * Get all players in the room
   * @returns {Player[]} Array of players
   */
  getPlayers() {
    return this.gameState.players;
  }

  /**
   * Get the number of players in the room
   * @returns {number} Number of players
   */
  getPlayerCount() {
    return this.gameState.players.length;
  }

  /**
   * Check if room is full
   * @returns {boolean} True if room is at max capacity
   */
  isFull() {
    return this.gameState.players.length >= this.maxPlayers;
  }

  /**
   * Check if room is empty
   * @returns {boolean} True if no players in room
   */
  isEmpty() {
    return this.gameState.players.length === 0;
  }

  /**
   * Start betting phase in the room
   * Implements requirement 9.2 - Display betting interface before game
   * @returns {boolean} True if betting phase was started successfully
   */
  startBettingPhase() {
    // Need at least one player to start
    if (this.gameState.players.length === 0) {
      return false;
    }

    // Game already in progress
    if (this.isGameInProgress) {
      return false;
    }

    this.gameState.status = 'betting';
    this.lastActivity = new Date();
    return true;
  }

  /**
   * Check if all players have placed bets
   * Implements requirement 9.5 - Start game after all players bet
   * @returns {boolean} True if all players have bet
   */
  allPlayersHaveBet() {
    if (this.gameState.players.length === 0) {
      return false;
    }
    return this.gameState.players.every(player => player.hasBet);
  }

  /**
   * Start a game in the room (after betting phase)
   * @returns {boolean} True if game was started successfully
   */
  startGame() {
    // Need at least one player to start (requirement 2.1)
    if (this.gameState.players.length === 0) {
      return false;
    }

    // Game already in progress
    if (this.isGameInProgress) {
      return false;
    }

    // All players must have placed bets (requirement 9.5)
    if (!this.allPlayersHaveBet()) {
      return false;
    }

    this.isGameInProgress = true;
    this.gameState.startGame();
    this.gameState.dealInitialCards();
    this.lastActivity = new Date();
    return true;
  }

  /**
   * End the current game
   */
  endGame() {
    this.gameState.endGame();
    this.isGameInProgress = false;
    this.lastActivity = new Date();
  }

  /**
   * Reset the game state while preserving players
   * Implements requirement 3.5 - Allow new game start after game ends
   */
  resetGame() {
    // Preserve current players
    const currentPlayers = this.gameState.players;
    
    // Create new game state
    this.isGameInProgress = false;
    this.gameState = new GameState(this.id);
    
    // Re-add players to new game state
    currentPlayers.forEach(player => {
      // Reset player state for new game
      player.resetHand();
      // Reset betting state
      player.hasBet = false;
      player.currentBet = 0;
      this.gameState.addPlayer(player);
    });
    
    this.lastActivity = new Date();
  }

  /**
   * Get room info for client
   * @returns {object} Room information
   */
  getRoomInfo() {
    return {
      id: this.id,
      name: this.name,
      playerCount: this.getPlayerCount(),
      maxPlayers: this.maxPlayers,
      isGameInProgress: this.isGameInProgress,
      isFull: this.isFull()
    };
  }

  /**
   * Get full room state for client
   * @returns {object} Complete room state
   */
  toClientObject() {
    return {
      id: this.id,
      name: this.name,
      maxPlayers: this.maxPlayers,
      isGameInProgress: this.isGameInProgress,
      gameState: this.gameState.toClientObject(),
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }
}

module.exports = Room;
