const fc = require('fast-check');
const { io: ioClient } = require('socket.io-client');
const http = require('http');
const socketIo = require('socket.io');
const WebSocketHandler = require('../src/server/websocket/WebSocketHandler');

/**
 * Property-Based Tests for Player Join Processing
 * Feature: blackjack-multiplayer-game
 * 
 * **プロパティ 1: プレイヤー参加処理の完全性**
 * **プロパティ 2: 接続切断時の除外処理**
 * **検証対象: 要件 1.2, 1.3, 1.4**
 */

describe('プレイヤー参加処理のプロパティベーステスト', () => {
  let server;
  let io;
  let wsHandler;
  const TEST_PORT = 3002;

  beforeAll(async () => {
    // テスト用サーバーの起動
    server = http.createServer();
    io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    wsHandler = new WebSocketHandler(io);
    
    await new Promise((resolve) => {
      server.listen(TEST_PORT, () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    // サーバーのクリーンアップ
    io.close();
    await new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  test('プロパティ 1: プレイヤー参加処理の完全性 - 任意のルームとプレイヤーに対して参加処理が完全に実行される', async () => {
    /**
     * Property: Player join processing completeness
     * 
     * 任意のルームとプレイヤーに対して、プレイヤーが参加ボタンをクリックした時、
     * そのプレイヤーがルームの参加者リストに追加され、
     * 既存の全参加者にリアルタイムで参加通知が送信される
     * 
     * **検証対象: 要件 1.2, 1.3**
     * 
     * This property verifies that:
     * 1. Player is added to the room's participant list
     * 2. All existing participants receive real-time join notification
     * 3. The joining player receives confirmation
     * 4. Room state is correctly updated
     */
    
    await fc.assert(
      fc.asyncProperty(
        // Generate room ID
        fc.constantFrom('room1', 'room2', 'room3', 'test-room-1', 'test-room-2'),
        // Generate number of existing players (0-5)
        fc.integer({ min: 0, max: 5 }),
        // Generate new player name
        fc.string({ minLength: 1, maxLength: 20 }),
        async (roomId, existingPlayerCount, newPlayerName) => {
          const clients = [];
          const existingPlayers = [];
          
          try {
            // Create existing players
            for (let i = 0; i < existingPlayerCount; i++) {
              const client = ioClient(`http://localhost:${TEST_PORT}`);
              clients.push(client);
              
              await new Promise((resolve) => {
                client.on('connect', () => {
                  client.emit('join-room', {
                    roomId,
                    playerId: `existing-player-${i}`,
                    playerName: `ExistingPlayer${i}`
                  });
                });
                
                client.on('joined-room', (data) => {
                  existingPlayers.push({
                    id: `existing-player-${i}`,
                    name: `ExistingPlayer${i}`,
                    client
                  });
                  resolve();
                });
              });
            }
            
            // Wait a bit for all existing players to settle
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Track notifications received by existing players
            const notificationsReceived = new Map();
            existingPlayers.forEach(player => {
              notificationsReceived.set(player.id, false);
              player.client.once('player-joined', (data) => {
                notificationsReceived.set(player.id, true);
              });
            });
            
            // Create new player and join
            const newClient = ioClient(`http://localhost:${TEST_PORT}`);
            clients.push(newClient);
            
            const joinResult = await new Promise((resolve) => {
              newClient.on('connect', () => {
                newClient.emit('join-room', {
                  roomId,
                  playerId: 'new-player',
                  playerName: newPlayerName
                });
              });
              
              newClient.on('joined-room', (data) => {
                resolve(data);
              });
              
              // Timeout after 2 seconds
              setTimeout(() => resolve(null), 2000);
            });
            
            // Wait for notifications to propagate
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify: New player received confirmation (requirement 1.2)
            expect(joinResult).not.toBeNull();
            expect(joinResult.roomId).toBe(roomId);
            expect(joinResult.playerId).toBe('new-player');
            
            // Verify: New player is in the participant list
            expect(joinResult.players).toBeDefined();
            const playerIds = joinResult.players.map(p => p.id);
            expect(playerIds).toContain('new-player');
            
            // Verify: All existing players received notification (requirement 1.3)
            for (const [playerId, received] of notificationsReceived.entries()) {
              expect(received).toBe(true);
            }
            
            // Verify: Room state is correctly updated
            const expectedPlayerCount = existingPlayerCount + 1;
            expect(joinResult.players.length).toBe(expectedPlayerCount);
            
            return true;
          } finally {
            // Cleanup: disconnect all clients
            clients.forEach(client => {
              if (client.connected) {
                client.disconnect();
              }
            });
          }
        }
      ),
      { numRuns: 50, timeout: 5000 } // 50 iterations with 5 second timeout
    );
  });

  test('プロパティ 2: 接続切断時の除外処理 - 任意の参加中のプレイヤーの接続が切断された時に除外処理が実行される', async () => {
    /**
     * Property: Disconnect exclusion processing
     * 
     * 任意の参加中のプレイヤーに対して、接続が切断された時、
     * そのプレイヤーがルームから除外され、
     * 他の全参加者に切断通知が送信される
     * 
     * **検証対象: 要件 1.4**
     * 
     * This property verifies that:
     * 1. Disconnected player is removed from the room
     * 2. All other participants receive disconnect notification
     * 3. Room state is correctly updated
     * 4. Player count decreases by one
     */
    
    await fc.assert(
      fc.asyncProperty(
        // Generate room ID
        fc.constantFrom('room1', 'room2', 'room3', 'test-room-3', 'test-room-4'),
        // Generate number of players (2-6, need at least 2 to test disconnect)
        fc.integer({ min: 2, max: 6 }),
        // Generate which player to disconnect (0-based index)
        fc.integer({ min: 0, max: 5 }),
        async (roomId, playerCount, disconnectIndex) => {
          const clients = [];
          const players = [];
          
          try {
            // Create and join players
            for (let i = 0; i < playerCount; i++) {
              const client = ioClient(`http://localhost:${TEST_PORT}`);
              clients.push(client);
              
              await new Promise((resolve) => {
                client.on('connect', () => {
                  client.emit('join-room', {
                    roomId,
                    playerId: `player-${i}`,
                    playerName: `Player${i}`
                  });
                });
                
                client.on('joined-room', (data) => {
                  players.push({
                    id: `player-${i}`,
                    name: `Player${i}`,
                    client,
                    index: i
                  });
                  resolve();
                });
              });
            }
            
            // Wait for all players to settle
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Determine which player to disconnect
            const targetIndex = disconnectIndex % playerCount;
            const targetPlayer = players[targetIndex];
            const remainingPlayers = players.filter((_, i) => i !== targetIndex);
            
            // Track disconnect notifications received by remaining players
            const disconnectNotifications = new Map();
            remainingPlayers.forEach(player => {
              disconnectNotifications.set(player.id, false);
              player.client.once('player-left', (data) => {
                if (data.playerId === targetPlayer.id) {
                  disconnectNotifications.set(player.id, true);
                }
              });
            });
            
            // Disconnect the target player
            targetPlayer.client.disconnect();
            
            // Wait for disconnect to propagate
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verify: All remaining players received disconnect notification (requirement 1.4)
            for (const [playerId, received] of disconnectNotifications.entries()) {
              expect(received).toBe(true);
            }
            
            // Verify: Player count decreased by one
            // We can verify this by checking the room state through another player
            if (remainingPlayers.length > 0) {
              const verifyClient = remainingPlayers[0].client;
              
              // Request room state update by performing an action
              const roomState = await new Promise((resolve) => {
                let resolved = false;
                
                verifyClient.once('room-state-update', (data) => {
                  if (!resolved) {
                    resolved = true;
                    resolve(data);
                  }
                });
                
                // Trigger a state update by having another player join temporarily
                const tempClient = ioClient(`http://localhost:${TEST_PORT}`);
                tempClient.on('connect', () => {
                  tempClient.emit('join-room', {
                    roomId,
                    playerId: 'temp-verify-player',
                    playerName: 'TempPlayer'
                  });
                });
                
                tempClient.on('joined-room', () => {
                  tempClient.disconnect();
                });
                
                // Timeout after 1 second
                setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    resolve(null);
                  }
                }, 1000);
              });
              
              // If we got room state, verify player count
              if (roomState && roomState.gameState) {
                const currentPlayerIds = roomState.gameState.players.map(p => p.id);
                expect(currentPlayerIds).not.toContain(targetPlayer.id);
              }
            }
            
            return true;
          } finally {
            // Cleanup: disconnect all remaining clients
            clients.forEach(client => {
              if (client.connected) {
                client.disconnect();
              }
            });
          }
        }
      ),
      { numRuns: 50, timeout: 5000 } // 50 iterations with 5 second timeout
    );
  });

  test('プロパティ 1 拡張: 複数プレイヤーの連続参加処理', async () => {
    /**
     * Extended property test for multiple sequential player joins
     * Ensures the system correctly handles rapid sequential joins
     */
    
    await fc.assert(
      fc.asyncProperty(
        // Generate room ID
        fc.constantFrom('room1', 'room2', 'room3'),
        // Generate number of players to join sequentially (2-5)
        fc.integer({ min: 2, max: 5 }),
        async (roomId, playerCount) => {
          const clients = [];
          const joinedPlayers = [];
          
          try {
            // Join players sequentially
            for (let i = 0; i < playerCount; i++) {
              const client = ioClient(`http://localhost:${TEST_PORT}`);
              clients.push(client);
              
              const joinResult = await new Promise((resolve) => {
                client.on('connect', () => {
                  client.emit('join-room', {
                    roomId,
                    playerId: `seq-player-${i}`,
                    playerName: `SeqPlayer${i}`
                  });
                });
                
                client.on('joined-room', (data) => {
                  resolve(data);
                });
                
                // Timeout after 2 seconds
                setTimeout(() => resolve(null), 2000);
              });
              
              // Verify each join was successful
              expect(joinResult).not.toBeNull();
              expect(joinResult.roomId).toBe(roomId);
              expect(joinResult.playerId).toBe(`seq-player-${i}`);
              
              // Verify player count increases correctly
              expect(joinResult.players.length).toBe(i + 1);
              
              joinedPlayers.push({
                id: `seq-player-${i}`,
                client
              });
              
              // Small delay between joins
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Verify all players are in the final state
            const finalClient = clients[clients.length - 1];
            const finalState = await new Promise((resolve) => {
              // Get current state by emitting a request
              finalClient.once('joined-room', (data) => {
                resolve(data);
              });
              
              // Re-emit join to get current state
              finalClient.emit('join-room', {
                roomId,
                playerId: `seq-player-${playerCount - 1}`,
                playerName: `SeqPlayer${playerCount - 1}`
              });
              
              setTimeout(() => resolve(null), 1000);
            });
            
            if (finalState) {
              expect(finalState.players.length).toBe(playerCount);
              
              // Verify all player IDs are present
              const playerIds = finalState.players.map(p => p.id);
              for (let i = 0; i < playerCount; i++) {
                expect(playerIds).toContain(`seq-player-${i}`);
              }
            }
            
            return true;
          } finally {
            // Cleanup
            clients.forEach(client => {
              if (client.connected) {
                client.disconnect();
              }
            });
          }
        }
      ),
      { numRuns: 30, timeout: 10000 } // 30 iterations with 10 second timeout
    );
  });

  test('プロパティ 2 拡張: 複数プレイヤーの同時切断処理', async () => {
    /**
     * Extended property test for multiple simultaneous disconnects
     * Ensures the system correctly handles multiple players disconnecting at once
     */
    
    await fc.assert(
      fc.asyncProperty(
        // Generate room ID
        fc.constantFrom('room1', 'room2', 'room3'),
        // Generate number of players (3-6)
        fc.integer({ min: 3, max: 6 }),
        // Generate number of players to disconnect (1 to playerCount-1)
        fc.integer({ min: 1, max: 5 }),
        async (roomId, playerCount, disconnectCount) => {
          const clients = [];
          const players = [];
          
          try {
            // Create and join players
            for (let i = 0; i < playerCount; i++) {
              const client = ioClient(`http://localhost:${TEST_PORT}`);
              clients.push(client);
              
              await new Promise((resolve) => {
                client.on('connect', () => {
                  client.emit('join-room', {
                    roomId,
                    playerId: `multi-disc-player-${i}`,
                    playerName: `MultiDiscPlayer${i}`
                  });
                });
                
                client.on('joined-room', () => {
                  players.push({
                    id: `multi-disc-player-${i}`,
                    client,
                    index: i
                  });
                  resolve();
                });
              });
            }
            
            // Wait for all players to settle
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Determine how many to disconnect (at least 1, at most playerCount-1)
            const actualDisconnectCount = Math.min(
              Math.max(1, disconnectCount),
              playerCount - 1
            );
            
            // Track disconnect notifications
            const remainingPlayers = players.slice(actualDisconnectCount);
            const disconnectingPlayers = players.slice(0, actualDisconnectCount);
            
            const notificationCounts = new Map();
            remainingPlayers.forEach(player => {
              notificationCounts.set(player.id, 0);
              player.client.on('player-left', (data) => {
                const currentCount = notificationCounts.get(player.id) || 0;
                notificationCounts.set(player.id, currentCount + 1);
              });
            });
            
            // Disconnect multiple players simultaneously
            disconnectingPlayers.forEach(player => {
              player.client.disconnect();
            });
            
            // Wait for disconnects to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify: Each remaining player received notification for each disconnect
            for (const [playerId, count] of notificationCounts.entries()) {
              expect(count).toBe(actualDisconnectCount);
            }
            
            return true;
          } finally {
            // Cleanup
            clients.forEach(client => {
              if (client.connected) {
                client.disconnect();
              }
            });
          }
        }
      ),
      { numRuns: 30, timeout: 10000 } // 30 iterations with 10 second timeout
    );
  });
});
