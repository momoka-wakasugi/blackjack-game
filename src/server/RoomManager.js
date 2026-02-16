const Room = require('./game/Room');
const BettingManager = require('./BettingManager');

/**
 * RoomManager class for managing multiple game rooms
 * Implements requirements 4.1, 4.3, 4.4, 9.1
 */
class RoomManager {
  constructor(maxRooms = 10, maxPlayersPerRoom = 6) {
    this.rooms = new Map();
    this.maxRooms = maxRooms;
    this.maxPlayersPerRoom = maxPlayersPerRoom;
    this.playerRoomMap = new Map(); // Track which room each player is in
    this.bettingManager = new BettingManager(); // Betting system manager
  }

  /**
   * Create a new room
   * Implements requirement 4.1 - Support multiple independent rooms
   * @param {string} roomId - Unique room identifier
   * @param {string} roomName - Display name for the room
   * @returns {Room|null} The created room or null if limit reached
   */
  createRoom(roomId, roomName) {
    // Check if room already exists
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    // Check if max rooms limit reached
    if (this.rooms.size >= this.maxRooms) {
      return null;
    }

    const room = new Room(roomId, roomName, this.maxPlayersPerRoom);
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Get a room by ID
   * @param {string} roomId - The room ID
   * @returns {Room|null} The room or null if not found
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get all rooms
   * @returns {Room[]} Array of all rooms
   */
  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  /**
   * Get room information for all rooms (for lobby display)
   * Implements requirement 4.2 - Display available rooms and player counts
   * @returns {object[]} Array of room info objects
   */
  getRoomList() {
    return Array.from(this.rooms.values()).map(room => room.getRoomInfo());
  }

  /**
   * Add a player to a room
   * Implements requirement 4.4 - Prevent simultaneous participation in multiple rooms
   * Implements requirement 9.1 - Initialize player balance
   * Enhanced with security validation (requirement 8.3)
   * @param {string} roomId - The room ID
   * @param {Player} player - The player to add
   * @returns {object} Result object with success status and message
   */
  addPlayerToRoom(roomId, player) {
    // Validate inputs
    if (!roomId || typeof roomId !== 'string') {
      return {
        success: false,
        message: 'Invalid room ID'
      };
    }

    if (!player || !player.id) {
      return {
        success: false,
        message: 'Invalid player object'
      };
    }

    // Check if player is already in another room (requirement 4.4)
    if (this.playerRoomMap.has(player.id)) {
      const currentRoomId = this.playerRoomMap.get(player.id);
      if (currentRoomId !== roomId) {
        return {
          success: false,
          message: 'Player is already in another room'
        };
      }
      // Player is already in this room (reconnection) - allow it
      return {
        success: true,
        message: 'Player reconnected to room',
        room: room
      };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        success: false,
        message: 'Room not found'
      };
    }

    // Only initialize balance for new players (not reconnecting)
    if (!player.balance || player.balance === 0) {
      this.bettingManager.initializePlayerBalance(player);
    }

    const added = room.addPlayer(player);
    if (added) {
      this.playerRoomMap.set(player.id, roomId);
      return {
        success: true,
        message: 'Player added to room',
        room: room
      };
    }

    return {
      success: false,
      message: 'Failed to add player to room (room full or game in progress)'
    };
  }

  /**
   * Remove a player from a room
   * Enhanced with validation (requirement 8.3)
   * @param {string} roomId - The room ID
   * @param {string} playerId - The player ID
   * @returns {boolean} True if player was removed
   */
  removePlayerFromRoom(roomId, playerId) {
    // Validate inputs
    if (!roomId || typeof roomId !== 'string') {
      return false;
    }

    if (!playerId || typeof playerId !== 'string') {
      return false;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const removed = room.removePlayer(playerId);
    if (removed) {
      this.playerRoomMap.delete(playerId);
      
      // Optionally clean up empty rooms
      if (room.isEmpty() && !room.isGameInProgress) {
        // Keep room for now, could implement auto-cleanup later
      }
    }

    return removed;
  }

  /**
   * Remove a player from any room they're in
   * @param {string} playerId - The player ID
   * @returns {boolean} True if player was removed from a room
   */
  removePlayerFromAnyRoom(playerId) {
    const roomId = this.playerRoomMap.get(playerId);
    if (roomId) {
      return this.removePlayerFromRoom(roomId, playerId);
    }
    return false;
  }

  /**
   * Get the room a player is currently in
   * @param {string} playerId - The player ID
   * @returns {Room|null} The room or null if player is not in any room
   */
  getPlayerRoom(playerId) {
    const roomId = this.playerRoomMap.get(playerId);
    if (roomId) {
      return this.rooms.get(roomId) || null;
    }
    return null;
  }

  /**
   * Check if a player is in a specific room
   * @param {string} playerId - The player ID
   * @param {string} roomId - The room ID
   * @returns {boolean} True if player is in the room
   */
  isPlayerInRoom(playerId, roomId) {
    return this.playerRoomMap.get(playerId) === roomId;
  }

  /**
   * Delete a room
   * @param {string} roomId - The room ID
   * @returns {boolean} True if room was deleted
   */
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Remove all players from tracking
    room.getPlayers().forEach(player => {
      this.playerRoomMap.delete(player.id);
    });

    return this.rooms.delete(roomId);
  }

  /**
   * Get total number of rooms
   * @returns {number} Number of rooms
   */
  getRoomCount() {
    return this.rooms.size;
  }

  /**
   * Check if room limit is reached
   * @returns {boolean} True if at max capacity
   */
  isAtCapacity() {
    return this.rooms.size >= this.maxRooms;
  }

  /**
   * Get statistics about all rooms
   * @returns {object} Statistics object
   */
  getStats() {
    const rooms = Array.from(this.rooms.values());
    return {
      totalRooms: rooms.length,
      activeGames: rooms.filter(r => r.isGameInProgress).length,
      totalPlayers: rooms.reduce((sum, r) => sum + r.getPlayerCount(), 0),
      emptyRooms: rooms.filter(r => r.isEmpty()).length
    };
  }
}

module.exports = RoomManager;
