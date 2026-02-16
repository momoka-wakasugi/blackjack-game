const fc = require('fast-check');
const RoomManager = require('../src/server/RoomManager');
const Player = require('../src/server/game/Player');

/**
 * Property-Based Tests for Room Management
 * Feature: blackjack-multiplayer-game
 */

test('Property 9: Room Independence - Validates: Requirements 4.3', () => {
  /**
   * Property: Operations in one room do not affect other rooms
   * 
   * This property verifies that:
   * 1. Player operations in one room don't affect other rooms
   * 2. Game state changes in one room are isolated
   * 3. Deck states remain independent across rooms
   * 4. Multiple rooms can operate simultaneously without interference
   */
  
  fc.assert(
    fc.property(
      // Generate number of rooms (2-5)
      fc.integer({ min: 2, max: 5 }),
      // Generate number of players per room (1-6)
      fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 2, maxLength: 5 }),
      // Generate which rooms should start games
      fc.array(fc.boolean(), { minLength: 2, maxLength: 5 }),
      (roomCount, playersPerRoom, shouldStartGame) => {
        const roomManager = new RoomManager(10, 6);
        const rooms = [];
        const allPlayers = [];
        
        // Create rooms and add players
        for (let i = 0; i < roomCount; i++) {
          const roomId = `room${i}`;
          const room = roomManager.createRoom(roomId, `Room ${i}`);
          expect(room).not.toBeNull();
          rooms.push(room);
          
          // Add players to this room
          const playerCount = playersPerRoom[i] || 1;
          for (let j = 0; j < playerCount; j++) {
            const playerId = `p${i}-${j}`;
            const player = new Player(playerId, `Player ${i}-${j}`, `socket-${i}-${j}`);
            const result = roomManager.addPlayerToRoom(roomId, player);
            expect(result.success).toBe(true);
            allPlayers.push({ player, roomId });
          }
        }
        
        // Verify each room has correct player count
        for (let i = 0; i < roomCount; i++) {
          const expectedCount = playersPerRoom[i] || 1;
          expect(rooms[i].getPlayerCount()).toBe(expectedCount);
        }
        
        // Start games in some rooms
        for (let i = 0; i < roomCount; i++) {
          if (shouldStartGame[i]) {
            // プレイヤー全員にベットを配置
            const players = rooms[i].getPlayers();
            players.forEach(player => {
              player.currentBet = 100;
              player.hasBet = true;
            });
            rooms[i].startGame();
          }
        }
        
        // Verify room independence: game state in one room doesn't affect others
        for (let i = 0; i < roomCount; i++) {
          const expectedGameState = shouldStartGame[i] || false;
          expect(rooms[i].isGameInProgress).toBe(expectedGameState);
          
          // Verify other rooms are unaffected
          for (let j = 0; j < roomCount; j++) {
            if (i !== j) {
              const expectedOtherGameState = shouldStartGame[j] || false;
              expect(rooms[j].isGameInProgress).toBe(expectedOtherGameState);
            }
          }
        }
        
        // Verify player isolation: players in one room don't appear in others
        for (let i = 0; i < roomCount; i++) {
          const roomPlayers = rooms[i].getPlayers();
          const roomPlayerIds = roomPlayers.map(p => p.id);
          
          // Check that only players assigned to this room are present
          for (const { player, roomId } of allPlayers) {
            if (roomId === `room${i}`) {
              expect(roomPlayerIds).toContain(player.id);
            } else {
              expect(roomPlayerIds).not.toContain(player.id);
            }
          }
        }
        
        // Verify deck independence: each room has its own deck
        const deckStates = rooms.map(room => room.gameState.deck);
        for (let i = 0; i < deckStates.length; i++) {
          for (let j = i + 1; j < deckStates.length; j++) {
            // Decks should be different objects
            expect(deckStates[i]).not.toBe(deckStates[j]);
          }
        }
        
        // Perform operation in one room and verify others are unaffected
        if (roomCount >= 2) {
          const room0InitialPlayerCount = rooms[0].getPlayerCount();
          const room1InitialPlayerCount = rooms[1].getPlayerCount();
          
          // Remove a player from room 0
          const room0Players = rooms[0].getPlayers();
          if (room0Players.length > 0) {
            roomManager.removePlayerFromRoom('room0', room0Players[0].id);
            
            // Verify room 0 player count changed
            expect(rooms[0].getPlayerCount()).toBe(room0InitialPlayerCount - 1);
            
            // Verify room 1 player count unchanged
            expect(rooms[1].getPlayerCount()).toBe(room1InitialPlayerCount);
            
            // Verify all other rooms unchanged
            for (let i = 2; i < roomCount; i++) {
              const expectedCount = playersPerRoom[i] || 1;
              expect(rooms[i].getPlayerCount()).toBe(expectedCount);
            }
          }
        }
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});

test('Property 10: Duplicate Participation Prevention - Validates: Requirements 4.4', () => {
  /**
   * Property: A player cannot join multiple rooms simultaneously
   * 
   * This property verifies that:
   * 1. A player can only be in one room at a time
   * 2. Attempting to join a second room while in another is rejected
   * 3. A player can join a different room after leaving the first
   * 4. The system maintains accurate player-room mappings
   */
  
  fc.assert(
    fc.property(
      // Generate number of rooms (2-5)
      fc.integer({ min: 2, max: 5 }),
      // Generate number of players (1-10)
      fc.integer({ min: 1, max: 10 }),
      // Generate room assignment attempts (array of room indices)
      fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 20 }),
      (roomCount, playerCount, roomAssignments) => {
        const roomManager = new RoomManager(10, 6);
        const rooms = [];
        const players = [];
        
        // Create rooms
        for (let i = 0; i < roomCount; i++) {
          const roomId = `room${i}`;
          const room = roomManager.createRoom(roomId, `Room ${i}`);
          expect(room).not.toBeNull();
          rooms.push({ id: roomId, room });
        }
        
        // Create players
        for (let i = 0; i < playerCount; i++) {
          const player = new Player(`player${i}`, `Player ${i}`, `socket-${i}`);
          players.push(player);
        }
        
        // Track which room each player is in
        const playerRoomMap = new Map();
        
        // Attempt to assign players to rooms based on generated assignments
        for (let i = 0; i < Math.min(roomAssignments.length, playerCount * 3); i++) {
          const playerIndex = i % playerCount;
          const roomIndex = roomAssignments[i] % roomCount;
          const player = players[playerIndex];
          const roomId = rooms[roomIndex].id;
          const room = roomManager.getRoom(roomId);
          
          // Check room state BEFORE attempting to add
          const wasRoomFull = room ? room.isFull() : false;
          
          const result = roomManager.addPlayerToRoom(roomId, player);
          
          if (!playerRoomMap.has(player.id)) {
            // Player not in any room yet
            if (wasRoomFull) {
              // Room was full, should fail
              expect(result.success).toBe(false);
            } else {
              // Room had space, should succeed
              expect(result.success).toBe(true);
              if (result.success) {
                playerRoomMap.set(player.id, roomId);
              }
            }
          } else {
            const currentRoom = playerRoomMap.get(player.id);
            if (currentRoom === roomId) {
              // Trying to join same room again, should fail (duplicate prevention)
              expect(result.success).toBe(false);
            } else {
              // Trying to join different room, should fail (requirement 4.4)
              expect(result.success).toBe(false);
              expect(result.message).toBe('Player is already in another room');
              
              // Verify player is still in original room
              expect(roomManager.isPlayerInRoom(player.id, currentRoom)).toBe(true);
              expect(roomManager.isPlayerInRoom(player.id, roomId)).toBe(false);
            }
          }
        }
        
        // Verify each player is in at most one room
        for (const player of players) {
          let roomsContainingPlayer = 0;
          for (const { id: roomId } of rooms) {
            if (roomManager.isPlayerInRoom(player.id, roomId)) {
              roomsContainingPlayer++;
            }
          }
          expect(roomsContainingPlayer).toBeLessThanOrEqual(1);
        }
        
        // Test that player can join different room after leaving
        if (players.length > 0 && roomCount >= 2) {
          const testPlayer = players[0];
          const currentRoom = roomManager.getPlayerRoom(testPlayer.id);
          
          if (currentRoom) {
            // Remove player from current room
            const removed = roomManager.removePlayerFromRoom(currentRoom.id, testPlayer.id);
            expect(removed).toBe(true);
            
            // Verify player is no longer in any room
            expect(roomManager.getPlayerRoom(testPlayer.id)).toBeNull();
            
            // Find a room that is not full
            let targetRoom = null;
            for (const { id: roomId, room } of rooms) {
              if (!room.isFull()) {
                targetRoom = roomId;
                break;
              }
            }
            
            // Only test if we found a non-full room
            if (targetRoom) {
              const result = roomManager.addPlayerToRoom(targetRoom, testPlayer);
              expect(result.success).toBe(true);
              expect(roomManager.isPlayerInRoom(testPlayer.id, targetRoom)).toBe(true);
            }
          }
        }
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});

test('Property 10 Extended: Player-Room Mapping Consistency', () => {
  /**
   * Extended property test for player-room mapping consistency
   * Ensures the system maintains accurate tracking of player locations
   */
  
  fc.assert(
    fc.property(
      // Generate sequence of join/leave operations
      fc.array(
        fc.record({
          operation: fc.constantFrom('join', 'leave'),
          playerId: fc.integer({ min: 0, max: 4 }),
          roomId: fc.integer({ min: 0, max: 2 })
        }),
        { minLength: 5, maxLength: 30 }
      ),
      (operations) => {
        const roomManager = new RoomManager(10, 6);
        const players = [];
        const rooms = [];
        
        // Create 3 rooms
        for (let i = 0; i < 3; i++) {
          const room = roomManager.createRoom(`room${i}`, `Room ${i}`);
          rooms.push(room);
        }
        
        // Create 5 players
        for (let i = 0; i < 5; i++) {
          const player = new Player(`p${i}`, `Player ${i}`, `socket-${i}`);
          players.push(player);
        }
        
        // Execute operations
        for (const op of operations) {
          const player = players[op.playerId];
          const roomId = `room${op.roomId}`;
          
          if (op.operation === 'join') {
            roomManager.addPlayerToRoom(roomId, player);
          } else {
            roomManager.removePlayerFromRoom(roomId, player.id);
          }
          
          // After each operation, verify consistency
          const playerRoom = roomManager.getPlayerRoom(player.id);
          
          if (playerRoom) {
            // Player is in a room, verify they're actually in that room
            expect(playerRoom.getPlayer(player.id)).not.toBeNull();
            expect(roomManager.isPlayerInRoom(player.id, playerRoom.id)).toBe(true);
            
            // Verify player is not in any other room
            for (const room of rooms) {
              if (room.id !== playerRoom.id) {
                expect(roomManager.isPlayerInRoom(player.id, room.id)).toBe(false);
              }
            }
          } else {
            // Player is not in any room, verify they're not in any room
            for (const room of rooms) {
              expect(roomManager.isPlayerInRoom(player.id, room.id)).toBe(false);
              expect(room.getPlayer(player.id)).toBeNull();
            }
          }
        }
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});
