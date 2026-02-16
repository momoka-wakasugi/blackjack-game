const RoomManager = require('../src/server/RoomManager');
const Player = require('../src/server/game/Player');

describe('RoomManager', () => {
  let roomManager;

  beforeEach(() => {
    roomManager = new RoomManager(10, 6);
  });

  describe('Room Creation (Requirement 4.1)', () => {
    test('should create a new room', () => {
      const room = roomManager.createRoom('room1', 'Test Room');
      expect(room).not.toBeNull();
      expect(room.id).toBe('room1');
      expect(room.name).toBe('Test Room');
      expect(roomManager.getRoomCount()).toBe(1);
    });

    test('should return existing room if room ID already exists', () => {
      const room1 = roomManager.createRoom('room1', 'Test Room');
      const room2 = roomManager.createRoom('room1', 'Test Room');
      expect(room1).toBe(room2);
      expect(roomManager.getRoomCount()).toBe(1);
    });

    test('should not create room when max limit reached', () => {
      const smallManager = new RoomManager(2, 6);
      smallManager.createRoom('room1', 'Room 1');
      smallManager.createRoom('room2', 'Room 2');
      const room3 = smallManager.createRoom('room3', 'Room 3');
      expect(room3).toBeNull();
      expect(smallManager.getRoomCount()).toBe(2);
    });

    test('should support at least 3 independent rooms (Requirement 4.1)', () => {
      const room1 = roomManager.createRoom('room1', 'Room 1');
      const room2 = roomManager.createRoom('room2', 'Room 2');
      const room3 = roomManager.createRoom('room3', 'Room 3');
      
      expect(room1).not.toBeNull();
      expect(room2).not.toBeNull();
      expect(room3).not.toBeNull();
      expect(roomManager.getRoomCount()).toBe(3);
    });
  });

  describe('Room Retrieval', () => {
    test('should get room by ID', () => {
      roomManager.createRoom('room1', 'Test Room');
      const room = roomManager.getRoom('room1');
      expect(room).not.toBeNull();
      expect(room.id).toBe('room1');
    });

    test('should return null for non-existent room', () => {
      const room = roomManager.getRoom('nonexistent');
      expect(room).toBeNull();
    });

    test('should get all rooms', () => {
      roomManager.createRoom('room1', 'Room 1');
      roomManager.createRoom('room2', 'Room 2');
      const rooms = roomManager.getAllRooms();
      expect(rooms.length).toBe(2);
    });

    test('should get room list with info (Requirement 4.2)', () => {
      roomManager.createRoom('room1', 'Room 1');
      roomManager.createRoom('room2', 'Room 2');
      const roomList = roomManager.getRoomList();
      
      expect(roomList.length).toBe(2);
      expect(roomList[0]).toHaveProperty('id');
      expect(roomList[0]).toHaveProperty('name');
      expect(roomList[0]).toHaveProperty('playerCount');
      expect(roomList[0]).toHaveProperty('maxPlayers');
    });
  });

  describe('Player Management', () => {
    test('should add player to room', () => {
      roomManager.createRoom('room1', 'Test Room');
      const player = new Player('p1', 'Alice', 'socket1');
      
      const result = roomManager.addPlayerToRoom('room1', player);
      expect(result.success).toBe(true);
      expect(result.room.getPlayerCount()).toBe(1);
    });

    test('should not add player to non-existent room', () => {
      const player = new Player('p1', 'Alice', 'socket1');
      const result = roomManager.addPlayerToRoom('nonexistent', player);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Room not found');
    });

    test('should prevent player from joining multiple rooms (Requirement 4.4)', () => {
      roomManager.createRoom('room1', 'Room 1');
      roomManager.createRoom('room2', 'Room 2');
      const player = new Player('p1', 'Alice', 'socket1');
      
      const result1 = roomManager.addPlayerToRoom('room1', player);
      expect(result1.success).toBe(true);
      
      const result2 = roomManager.addPlayerToRoom('room2', player);
      expect(result2.success).toBe(false);
      expect(result2.message).toBe('Player is already in another room');
    });

    test('should allow player to rejoin same room', () => {
      roomManager.createRoom('room1', 'Room 1');
      const player = new Player('p1', 'Alice', 'socket1');
      
      roomManager.addPlayerToRoom('room1', player);
      const result = roomManager.addPlayerToRoom('room1', player);
      expect(result.success).toBe(false); // Room.addPlayer prevents duplicates
    });

    test('should remove player from room', () => {
      roomManager.createRoom('room1', 'Test Room');
      const player = new Player('p1', 'Alice', 'socket1');
      
      roomManager.addPlayerToRoom('room1', player);
      const removed = roomManager.removePlayerFromRoom('room1', 'p1');
      expect(removed).toBe(true);
      
      const room = roomManager.getRoom('room1');
      expect(room.getPlayerCount()).toBe(0);
    });

    test('should remove player from any room', () => {
      roomManager.createRoom('room1', 'Test Room');
      const player = new Player('p1', 'Alice', 'socket1');
      
      roomManager.addPlayerToRoom('room1', player);
      const removed = roomManager.removePlayerFromAnyRoom('p1');
      expect(removed).toBe(true);
      
      const room = roomManager.getRoom('room1');
      expect(room.getPlayerCount()).toBe(0);
    });

    test('should get player room', () => {
      roomManager.createRoom('room1', 'Test Room');
      const player = new Player('p1', 'Alice', 'socket1');
      
      roomManager.addPlayerToRoom('room1', player);
      const room = roomManager.getPlayerRoom('p1');
      expect(room).not.toBeNull();
      expect(room.id).toBe('room1');
    });

    test('should check if player is in specific room', () => {
      roomManager.createRoom('room1', 'Test Room');
      const player = new Player('p1', 'Alice', 'socket1');
      
      roomManager.addPlayerToRoom('room1', player);
      expect(roomManager.isPlayerInRoom('p1', 'room1')).toBe(true);
      expect(roomManager.isPlayerInRoom('p1', 'room2')).toBe(false);
    });
  });

  describe('Room Independence (Requirement 4.3)', () => {
    test('should maintain independent state across multiple rooms', () => {
      // Create three rooms
      roomManager.createRoom('room1', 'Room 1');
      roomManager.createRoom('room2', 'Room 2');
      roomManager.createRoom('room3', 'Room 3');
      
      // Add players to different rooms
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      const player3 = new Player('p3', 'Charlie', 'socket3');
      
      roomManager.addPlayerToRoom('room1', player1);
      roomManager.addPlayerToRoom('room2', player2);
      roomManager.addPlayerToRoom('room3', player3);
      
      // Verify each room has only its own player
      const room1 = roomManager.getRoom('room1');
      const room2 = roomManager.getRoom('room2');
      const room3 = roomManager.getRoom('room3');
      
      expect(room1.getPlayerCount()).toBe(1);
      expect(room2.getPlayerCount()).toBe(1);
      expect(room3.getPlayerCount()).toBe(1);
      
      expect(room1.getPlayer('p1')).not.toBeNull();
      expect(room1.getPlayer('p2')).toBeNull();
      expect(room2.getPlayer('p2')).not.toBeNull();
      expect(room2.getPlayer('p1')).toBeNull();
    });

    test('should allow games to progress independently in multiple rooms', () => {
      roomManager.createRoom('room1', 'Room 1');
      roomManager.createRoom('room2', 'Room 2');
      
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      roomManager.addPlayerToRoom('room1', player1);
      roomManager.addPlayerToRoom('room2', player2);
      
      const room1 = roomManager.getRoom('room1');
      const room2 = roomManager.getRoom('room2');
      
      // Place bets for players
      player1.hasBet = true;
      player1.currentBet = 100;
      player2.hasBet = true;
      player2.currentBet = 100;
      
      // Start game in room1 only
      room1.startGame();
      
      expect(room1.isGameInProgress).toBe(true);
      expect(room2.isGameInProgress).toBe(false);
      
      // Start game in room2
      room2.startGame();
      
      expect(room1.isGameInProgress).toBe(true);
      expect(room2.isGameInProgress).toBe(true);
      
      // End game in room1
      room1.endGame();
      
      expect(room1.isGameInProgress).toBe(false);
      expect(room2.isGameInProgress).toBe(true);
    });

    test('should maintain separate deck states across rooms', () => {
      roomManager.createRoom('room1', 'Room 1');
      roomManager.createRoom('room2', 'Room 2');
      
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      roomManager.addPlayerToRoom('room1', player1);
      roomManager.addPlayerToRoom('room2', player2);
      
      const room1 = roomManager.getRoom('room1');
      const room2 = roomManager.getRoom('room2');
      
      room1.startGame();
      room2.startGame();
      
      // Each room should have its own deck
      const deck1 = room1.gameState.deck;
      const deck2 = room2.gameState.deck;
      
      expect(deck1).not.toBe(deck2);
      expect(deck1.cards.length).toBe(deck2.cards.length);
    });
  });

  describe('Room Deletion', () => {
    test('should delete room', () => {
      roomManager.createRoom('room1', 'Test Room');
      const deleted = roomManager.deleteRoom('room1');
      expect(deleted).toBe(true);
      expect(roomManager.getRoomCount()).toBe(0);
    });

    test('should remove player tracking when deleting room', () => {
      roomManager.createRoom('room1', 'Test Room');
      const player = new Player('p1', 'Alice', 'socket1');
      
      roomManager.addPlayerToRoom('room1', player);
      roomManager.deleteRoom('room1');
      
      const playerRoom = roomManager.getPlayerRoom('p1');
      expect(playerRoom).toBeNull();
    });

    test('should return false when deleting non-existent room', () => {
      const deleted = roomManager.deleteRoom('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('Capacity Management', () => {
    test('should check if at capacity', () => {
      const smallManager = new RoomManager(2, 6);
      expect(smallManager.isAtCapacity()).toBe(false);
      
      smallManager.createRoom('room1', 'Room 1');
      expect(smallManager.isAtCapacity()).toBe(false);
      
      smallManager.createRoom('room2', 'Room 2');
      expect(smallManager.isAtCapacity()).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should get room statistics', () => {
      roomManager.createRoom('room1', 'Room 1');
      roomManager.createRoom('room2', 'Room 2');
      roomManager.createRoom('room3', 'Room 3');
      
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      roomManager.addPlayerToRoom('room1', player1);
      roomManager.addPlayerToRoom('room2', player2);
      
      const room1 = roomManager.getRoom('room1');
      
      // Place bet for player1
      player1.hasBet = true;
      player1.currentBet = 100;
      
      room1.startGame();
      
      const stats = roomManager.getStats();
      
      expect(stats.totalRooms).toBe(3);
      expect(stats.activeGames).toBe(1);
      expect(stats.totalPlayers).toBe(2);
      expect(stats.emptyRooms).toBe(1);
    });
  });
});
