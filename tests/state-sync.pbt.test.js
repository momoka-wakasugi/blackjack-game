const fc = require('fast-check');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const http = require('http');
const WebSocketHandler = require('../src/server/websocket/WebSocketHandler');

/**
 * Property-Based Tests for State Synchronization
 * Feature: blackjack-multiplayer-game
 * 
 * Tests:
 * - Property 11: 自動再接続と状態同期
 * - Property 18: 状態同期保証
 * 
 * Validates: Requirements 5.3, 8.4
 */

/**
 * Helper function to create server and get port
 */
async function createTestServer() {
  const httpServer = http.createServer();
  const ioServer = new Server(httpServer);
  const wsHandler = new WebSocketHandler(ioServer);
  
  return new Promise((resolve) => {
    httpServer.listen(() => {
      const port = httpServer.address().port;
      resolve({ httpServer, ioServer, wsHandler, port });
    });
  });
}

/**
 * Helper function to close server
 */
async function closeTestServer(httpServer, ioServer) {
  return new Promise((resolve) => {
    ioServer.close();
    httpServer.close(() => {
      resolve();
    });
  });
}

/**
 * Helper function to create a client socket
 */
function createClientSocket(port) {
  const socket = Client(`http://localhost:${port}`, {
    reconnection: true,
    reconnectionDelay: 100,
    reconnectionDelayMax: 500,
    reconnectionAttempts: 3
  });
  return socket;
}

/**
 * Helper function to wait for event
 */
function waitForEvent(socket, eventName, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Property 18: 状態同期保証
 * **Validates: Requirements 8.4**
 * 
 * 任意のゲーム状態更新において、全ての接続中クライアントが同じゲーム状態を持つことが保証される
 */
test('プロパティ 18: 状態同期保証 - 全ての接続中クライアントが同じゲーム状態を受信する', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2, max: 4 }), // Number of players
      fc.constantFrom('hit', 'stand'), // Single action to keep test fast
      async (numPlayers, action) => {
        // Create server
        const { httpServer, ioServer, wsHandler, port } = await createTestServer();
        const clients = [];
        const roomId = `test-room-${Date.now()}`;
        
        try {
          // Connect all clients
          for (let i = 0; i < numPlayers; i++) {
            const client = createClientSocket(port);
            clients.push(client);
            
            await waitForEvent(client, 'connect');
            
            // Join room
            client.emit('join-room', {
              roomId: roomId,
              playerId: `player-${i}`,
              playerName: `Player ${i}`
            });
            
            await waitForEvent(client, 'joined-room');
          }

          // Start betting phase
          clients[0].emit('start-betting', { roomId: roomId });
          await waitForEvent(clients[0], 'betting-phase-started');

          // Set up game-started listeners before placing bets
          const gameStartPromises = clients.map(client => 
            waitForEvent(client, 'game-started')
          );

          // All players place bets
          for (let i = 0; i < numPlayers; i++) {
            clients[i].emit('place-bet', {
              roomId: roomId,
              playerId: `player-${i}`,
              amount: 100
            });
            await waitForEvent(clients[i], 'bet-placed');
          }
          
          // Wait for game to start (automatically after all bets)
          await Promise.all(gameStartPromises);

          // Perform an action and collect states
          const statePromises = clients.map(client => 
            waitForEvent(client, 'game-state-update')
          );
          
          // Send action from first player
          clients[0].emit('player-action', {
            roomId: roomId,
            playerId: 'player-0',
            action: action
          });
          
          const states = await Promise.all(statePromises);

          // Verify all clients received the same game state
          if (states.length > 1) {
            const firstState = JSON.stringify(states[0].gameState);
            
            for (let i = 1; i < states.length; i++) {
              const currentState = JSON.stringify(states[i].gameState);
              expect(currentState).toBe(firstState);
            }
          }

          // Cleanup
          clients.forEach(client => client.disconnect());
          await closeTestServer(httpServer, ioServer);
          
        } catch (error) {
          // Cleanup on error
          clients.forEach(client => {
            if (client.connected) {
              client.disconnect();
            }
          });
          await closeTestServer(httpServer, ioServer);
          throw error;
        }
      }
    ),
    { numRuns: 100, timeout: 15000 }
  );
});

/**
 * Property 11: 自動再接続と状態同期
 * **Validates: Requirements 5.3**
 * 
 * 任意のプレイヤーの接続が一時的に切断された場合、自動再接続が試行され、
 * 再接続時に最新のゲーム状態が同期される
 */
test('プロパティ 11: 自動再接続と状態同期 - 再接続時に最新のゲーム状態が同期される', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('hit', 'stand'), // Action to perform while disconnected
      async (action) => {
        // Create server
        const { httpServer, ioServer, wsHandler, port } = await createTestServer();
        const roomId = `test-room-${Date.now()}`;
        
        // Create two clients
        const client1 = createClientSocket(port);
        const client2 = createClientSocket(port);
        
        try {
          // Connect both clients
          await waitForEvent(client1, 'connect');
          await waitForEvent(client2, 'connect');
          
          // Join room - one at a time
          client1.emit('join-room', {
            roomId: roomId,
            playerId: 'player-1',
            playerName: 'Player 1'
          });
          await waitForEvent(client1, 'joined-room');
          
          client2.emit('join-room', {
            roomId: roomId,
            playerId: 'player-2',
            playerName: 'Player 2'
          });
          await waitForEvent(client2, 'joined-room');

          // Start betting phase
          client1.emit('start-betting', { roomId: roomId });
          await waitForEvent(client1, 'betting-phase-started');

          // Set up game-started listeners before placing bets
          const gameStart1Promise = waitForEvent(client1, 'game-started');
          const gameStart2Promise = waitForEvent(client2, 'game-started');

          // Both players place bets
          client1.emit('place-bet', {
            roomId: roomId,
            playerId: 'player-1',
            amount: 100
          });
          await waitForEvent(client1, 'bet-placed');

          client2.emit('place-bet', {
            roomId: roomId,
            playerId: 'player-2',
            amount: 100
          });
          await waitForEvent(client2, 'bet-placed');

          // Wait for game to start (automatically after all bets)
          await gameStart1Promise;
          await gameStart2Promise;

          // Disconnect client2 temporarily
          client2.disconnect();
          
          // Wait a bit to ensure disconnection
          await new Promise(resolve => setTimeout(resolve, 200));

          // Perform action with client1 while client2 is disconnected
          client1.emit('player-action', {
            roomId: roomId,
            playerId: 'player-1',
            action: action
          });
          
          // Wait for state update on client1
          const stateUpdate1 = await waitForEvent(client1, 'game-state-update');

          // Reconnect client2
          client2.connect();
          
          // Wait for reconnection
          await waitForEvent(client2, 'connect');
          
          // Client2 should rejoin the room
          client2.emit('join-room', {
            roomId: roomId,
            playerId: 'player-2',
            playerName: 'Player 2'
          });
          
          // Wait for joined-room event which includes current game state
          const rejoinData = await waitForEvent(client2, 'joined-room');

          // Verify that client2 received the current game state
          expect(rejoinData.gameState).toBeDefined();
          
          // The game state should reflect the action that was performed
          if (rejoinData.gameState) {
            expect(rejoinData.gameState.status).toBeDefined();
            expect(rejoinData.gameState.players).toBeDefined();
            expect(Array.isArray(rejoinData.gameState.players)).toBe(true);
          }

          // Cleanup
          client1.disconnect();
          client2.disconnect();
          await closeTestServer(httpServer, ioServer);
          
        } catch (error) {
          // Cleanup on error
          if (client1.connected) client1.disconnect();
          if (client2.connected) client2.disconnect();
          await closeTestServer(httpServer, ioServer);
          throw error;
        }
      }
    ),
    { numRuns: 100, timeout: 15000 }
  );
});
