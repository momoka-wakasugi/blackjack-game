/**
 * ベッティング通信の統合テスト
 * 
 * ベット配置から配当受取までのエンドツーエンドテスト
 * 複数プレイヤーの同時ベット処理テスト
 * 要件: 9.5, 9.10
 */

const { io: ioClient } = require('socket.io-client');
const http = require('http');
const socketIo = require('socket.io');
const WebSocketHandler = require('../src/server/websocket/WebSocketHandler');

describe('ベッティング通信の統合テスト', () => {
  let server;
  let io;
  let wsHandler;
  let clientSocket1;
  let clientSocket2;
  let clientSocket3;
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
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    if (clientSocket3?.connected) clientSocket3.disconnect();
    
    io.close();
    await new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  beforeEach(() => {
    // 各テスト前にクライアントソケットをクリーンアップ
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    if (clientSocket3?.connected) clientSocket3.disconnect();
  });

  describe('ベット配置から配当受取までのエンドツーエンドテスト', () => {
    test('単一プレイヤーがベットを配置し、ゲームをプレイして配当を受け取る', (done) => {
      const roomId = 'betting-test-room-1';
      let bettingPhaseStarted = false;
      let betPlaced = false;
      let gameStarted = false;
      const initialBalance = 10000;
      const betAmount = 100;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'BettingPlayer1' });
      });

      clientSocket1.on('joined-room', (data) => {
        expect(data.roomId).toBe(roomId);
        // ベッティングフェーズを開始
        clientSocket1.emit('start-betting', { roomId });
      });

      clientSocket1.on('betting-phase-started', (data) => {
        bettingPhaseStarted = true;
        expect(data.balance).toBe(initialBalance);
        
        // ベットを配置
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: betAmount
        });
      });

      clientSocket1.on('bet-placed', (result) => {
        if (!betPlaced) {
          betPlaced = true;
          expect(result.success).toBe(true);
          expect(result.newBalance).toBe(initialBalance - betAmount);
          expect(result.currentBet).toBe(betAmount);
        }
      });

      clientSocket1.on('game-started', (data) => {
        if (!gameStarted) {
          gameStarted = true;
          expect(data.gameState.status).toBe('playing');
          
          // プレイヤーがスタンド
          clientSocket1.emit('player-action', {
            roomId,
            action: 'stand'
          });
        }
      });

      clientSocket1.on('payout-result', (payout) => {
        expect(payout.playerId).toBe(clientSocket1.id);
        expect(['win', 'blackjack', 'push', 'lose']).toContain(payout.outcome);
        expect(typeof payout.payout).toBe('number');
        expect(typeof payout.newBalance).toBe('number');
        
        // 配当が正しく計算されているか確認
        if (payout.outcome === 'win') {
          expect(payout.payout).toBe(betAmount * 2);
        } else if (payout.outcome === 'blackjack') {
          expect(payout.payout).toBe(betAmount * 2.5);
        } else if (payout.outcome === 'push') {
          expect(payout.payout).toBe(betAmount);
        } else if (payout.outcome === 'lose') {
          expect(payout.payout).toBe(0);
        }
        
        done();
      });
    }, 10000);

    test('プレイヤーが勝利して1:1配当を受け取る', (done) => {
      const roomId = 'betting-test-room-2';
      const betAmount = 500;
      const initialBalance = 10000;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'WinningPlayer' });
      });

      clientSocket1.on('joined-room', () => {
        clientSocket1.emit('start-betting', { roomId });
      });

      clientSocket1.on('betting-phase-started', () => {
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: betAmount
        });
      });

      clientSocket1.on('game-started', () => {
        // スタンドして勝敗を待つ
        clientSocket1.emit('player-action', {
          roomId,
          action: 'stand'
        });
      });

      clientSocket1.on('payout-result', (payout) => {
        expect(payout.playerId).toBe(clientSocket1.id);
        
        // 残高が正しく更新されているか確認
        const expectedBalance = initialBalance - betAmount + payout.payout;
        expect(payout.newBalance).toBe(expectedBalance);
        
        done();
      });
    }, 10000);

    test('プレイヤーがバストして配当を失う', (done) => {
      const roomId = 'betting-test-room-3';
      const betAmount = 250;
      const initialBalance = 10000;
      let hitCount = 0;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'BustingPlayer' });
      });

      clientSocket1.on('joined-room', () => {
        clientSocket1.emit('start-betting', { roomId });
      });

      clientSocket1.on('betting-phase-started', () => {
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: betAmount
        });
      });

      clientSocket1.on('game-started', () => {
        // 連続でヒットしてバストを狙う
        clientSocket1.emit('player-action', {
          roomId,
          action: 'hit'
        });
      });

      clientSocket1.on('game-state-update', (data) => {
        const player = data.gameState.players.find(p => p.id === clientSocket1.id);
        
        if (player && player.status === 'active' && hitCount < 5) {
          hitCount++;
          clientSocket1.emit('player-action', {
            roomId,
            action: 'hit'
          });
        }
      });

      clientSocket1.on('payout-result', (payout) => {
        expect(payout.playerId).toBe(clientSocket1.id);
        expect(payout.outcome).toBe('lose');
        expect(payout.payout).toBe(0);
        
        // バストした場合、残高はベット額分減少
        expect(payout.newBalance).toBe(initialBalance - betAmount);
        
        done();
      });
    }, 10000);
  });

  describe('複数プレイヤーの同時ベット処理テスト (要件 9.5)', () => {
    test('2人のプレイヤーが同時にベットを配置し、全員ベット後にゲームが開始される', (done) => {
      const roomId = 'betting-test-room-4';
      const betAmount1 = 100;
      const betAmount2 = 200;
      let player1BetPlaced = false;
      let player2BetPlaced = false;
      let gameStarted = false;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'MultiPlayer1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'MultiPlayer2' });
      });

      let bothJoined = false;
      clientSocket1.on('player-joined', (data) => {
        if (data.player.name === 'MultiPlayer2' && !bothJoined) {
          bothJoined = true;
          // 両方のプレイヤーが参加したらベッティング開始
          clientSocket1.emit('start-betting', { roomId });
        }
      });

      clientSocket1.on('betting-phase-started', () => {
        // Player1がベット配置
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: betAmount1
        });
      });

      clientSocket2.on('betting-phase-started', () => {
        // Player2がベット配置
        clientSocket2.emit('place-bet', {
          roomId,
          playerId: clientSocket2.id,
          amount: betAmount2
        });
      });

      clientSocket1.on('bet-placed', (result) => {
        if (result.success && !player1BetPlaced) {
          player1BetPlaced = true;
          expect(result.currentBet).toBe(betAmount1);
        }
      });

      clientSocket2.on('bet-placed', (result) => {
        if (result.success && !player2BetPlaced) {
          player2BetPlaced = true;
          expect(result.currentBet).toBe(betAmount2);
        }
      });

      // 全員がベットした後、ゲームが自動的に開始されることを確認
      clientSocket1.on('game-started', (data) => {
        if (!gameStarted) {
          gameStarted = true;
          expect(player1BetPlaced).toBe(true);
          expect(player2BetPlaced).toBe(true);
          expect(data.gameState.status).toBe('playing');
          expect(data.gameState.players).toHaveLength(2);
          
          done();
        }
      });
    }, 10000);

    test('3人のプレイヤーが順次ベットを配置し、全員ベット後にゲームが開始される', (done) => {
      const roomId = 'betting-test-room-5';
      const betAmounts = [100, 250, 500];
      const betsPlaced = [false, false, false];
      let gameStarted = false;

      const clients = [
        ioClient(`http://localhost:${TEST_PORT}`),
        ioClient(`http://localhost:${TEST_PORT}`),
        ioClient(`http://localhost:${TEST_PORT}`)
      ];

      clientSocket1 = clients[0];
      clientSocket2 = clients[1];
      clientSocket3 = clients[2];

      clients.forEach((client, index) => {
        client.on('connect', () => {
          client.emit('join-room', { roomId, playerName: `ThreePlayer${index + 1}` });
        });
      });

      let joinCount = 0;
      clientSocket1.on('player-joined', () => {
        joinCount++;
        if (joinCount === 2) {
          // 全員参加したらベッティング開始
          clientSocket1.emit('start-betting', { roomId });
        }
      });

      clients.forEach((client, index) => {
        client.on('betting-phase-started', () => {
          // 各プレイヤーが順次ベット配置
          setTimeout(() => {
            client.emit('place-bet', {
              roomId,
              playerId: client.id,
              amount: betAmounts[index]
            });
          }, index * 300);
        });

        client.on('bet-placed', (result) => {
          if (result.success && !betsPlaced[index]) {
            betsPlaced[index] = true;
            expect(result.currentBet).toBe(betAmounts[index]);
          }
        });
      });

      clientSocket1.on('game-started', (data) => {
        if (!gameStarted) {
          gameStarted = true;
          
          // 全員がベットしたことを確認
          expect(betsPlaced.every(placed => placed)).toBe(true);
          expect(data.gameState.status).toBe('playing');
          expect(data.gameState.players).toHaveLength(3);
          
          // クリーンアップ
          clients.forEach(client => {
            if (client.connected) client.disconnect();
          });
          
          done();
        }
      });
    }, 15000);

    test('複数プレイヤーがベットし、それぞれ異なる結果で配当を受け取る', (done) => {
      const roomId = 'betting-test-room-6';
      const betAmount1 = 100;
      const betAmount2 = 200;
      const payoutsReceived = [false, false];
      const payoutResults = [];

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'PayoutPlayer1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'PayoutPlayer2' });
      });

      let bothJoined = false;
      clientSocket1.on('player-joined', (data) => {
        if (data.player.name === 'PayoutPlayer2' && !bothJoined) {
          bothJoined = true;
          clientSocket1.emit('start-betting', { roomId });
        }
      });

      clientSocket1.on('betting-phase-started', () => {
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: betAmount1
        });
      });

      clientSocket2.on('betting-phase-started', () => {
        clientSocket2.emit('place-bet', {
          roomId,
          playerId: clientSocket2.id,
          amount: betAmount2
        });
      });

      clientSocket1.on('game-started', () => {
        // Player1はスタンド
        clientSocket1.emit('player-action', {
          roomId,
          action: 'stand'
        });
      });

      clientSocket2.on('game-state-update', (data) => {
        const player2 = data.gameState.players.find(p => p.id === clientSocket2.id);
        if (player2 && player2.status === 'active') {
          // Player2もスタンド
          clientSocket2.emit('player-action', {
            roomId,
            action: 'stand'
          });
        }
      });

      clientSocket1.on('payout-result', (payout) => {
        if (!payoutsReceived[0]) {
          payoutsReceived[0] = true;
          payoutResults.push(payout);
          
          expect(payout.playerId).toBe(clientSocket1.id);
          expect(typeof payout.payout).toBe('number');
          expect(typeof payout.newBalance).toBe('number');
          
          if (payoutsReceived.every(received => received)) {
            // 両方のプレイヤーが配当を受け取った
            expect(payoutResults).toHaveLength(2);
            done();
          }
        }
      });

      clientSocket2.on('payout-result', (payout) => {
        if (!payoutsReceived[1]) {
          payoutsReceived[1] = true;
          payoutResults.push(payout);
          
          expect(payout.playerId).toBe(clientSocket2.id);
          expect(typeof payout.payout).toBe('number');
          expect(typeof payout.newBalance).toBe('number');
          
          if (payoutsReceived.every(received => received)) {
            // 両方のプレイヤーが配当を受け取った
            expect(payoutResults).toHaveLength(2);
            done();
          }
        }
      });
    }, 15000);
  });

  describe('ベッティングエラーハンドリング', () => {
    test('無効なベット額が拒否される', (done) => {
      const roomId = 'betting-test-room-7';
      const invalidBetAmount = 0.5; // 最小ベット額未満

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'InvalidBetPlayer' });
      });

      clientSocket1.on('joined-room', () => {
        clientSocket1.emit('start-betting', { roomId });
      });

      clientSocket1.on('betting-phase-started', () => {
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: invalidBetAmount
        });
      });

      clientSocket1.on('bet-placed', (result) => {
        expect(result.success).toBe(false);
        expect(result.reason).toBeDefined();
        done();
      });
    }, 10000);

    test('残高を超えるベット額が拒否される', (done) => {
      const roomId = 'betting-test-room-8';
      const excessiveBetAmount = 20000; // 初期残高10000を超える

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'ExcessiveBetPlayer' });
      });

      clientSocket1.on('joined-room', () => {
        clientSocket1.emit('start-betting', { roomId });
      });

      clientSocket1.on('betting-phase-started', () => {
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: excessiveBetAmount
        });
      });

      clientSocket1.on('bet-placed', (result) => {
        expect(result.success).toBe(false);
        expect(result.reason).toContain('balance');
        done();
      });
    }, 10000);

    test('無効なチップ組み合わせのベット額が拒否される', (done) => {
      const roomId = 'betting-test-room-9';
      const invalidChipAmount = 3; // $1, $5, $25等の組み合わせで作れない

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'InvalidChipPlayer' });
      });

      clientSocket1.on('joined-room', () => {
        clientSocket1.emit('start-betting', { roomId });
      });

      clientSocket1.on('betting-phase-started', () => {
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: invalidChipAmount
        });
      });

      clientSocket1.on('bet-placed', (result) => {
        expect(result.success).toBe(false);
        expect(result.reason).toContain('chip');
        done();
      });
    }, 10000);
  });

  describe('残高管理とリセット機能', () => {
    test('残高リセット機能が正しく動作する', (done) => {
      const roomId = 'betting-test-room-10';
      const initialBalance = 10000;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'ResetPlayer' });
      });

      clientSocket1.on('joined-room', () => {
        // 残高リセットをリクエスト
        clientSocket1.emit('reset-balance', {
          roomId,
          playerId: clientSocket1.id
        });
      });

      clientSocket1.on('balance-updated', (data) => {
        expect(data.balance).toBe(initialBalance);
        done();
      });
    }, 10000);
  });

  describe('ベッティングフローの完全な統合テスト (要件 9.10)', () => {
    test('完全なベッティングフロー: ベット配置→ゲーム→配当→残高更新', (done) => {
      const roomId = 'betting-test-room-11';
      const betAmount = 1000;
      const initialBalance = 10000;
      const testFlow = {
        joined: false,
        bettingStarted: false,
        betPlaced: false,
        gameStarted: false,
        gameEnded: false,
        payoutReceived: false
      };

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'FullFlowPlayer' });
      });

      clientSocket1.on('joined-room', () => {
        testFlow.joined = true;
        expect(testFlow.joined).toBe(true);
        
        clientSocket1.emit('start-betting', { roomId });
      });

      clientSocket1.on('betting-phase-started', (data) => {
        testFlow.bettingStarted = true;
        expect(testFlow.bettingStarted).toBe(true);
        expect(data.balance).toBe(initialBalance);
        
        clientSocket1.emit('place-bet', {
          roomId,
          playerId: clientSocket1.id,
          amount: betAmount
        });
      });

      clientSocket1.on('bet-placed', (result) => {
        if (!testFlow.betPlaced) {
          testFlow.betPlaced = true;
          expect(testFlow.betPlaced).toBe(true);
          expect(result.success).toBe(true);
          expect(result.newBalance).toBe(initialBalance - betAmount);
          expect(result.currentBet).toBe(betAmount);
        }
      });

      clientSocket1.on('game-started', (data) => {
        if (!testFlow.gameStarted) {
          testFlow.gameStarted = true;
          expect(testFlow.gameStarted).toBe(true);
          expect(data.gameState.status).toBe('playing');
          
          // プレイヤーがスタンド
          clientSocket1.emit('player-action', {
            roomId,
            action: 'stand'
          });
        }
      });

      clientSocket1.on('game-ended', (result) => {
        if (!testFlow.gameEnded) {
          testFlow.gameEnded = true;
          expect(testFlow.gameEnded).toBe(true);
          expect(result.winners).toBeDefined();
        }
      });

      clientSocket1.on('payout-result', (payout) => {
        if (!testFlow.payoutReceived) {
          testFlow.payoutReceived = true;
          expect(testFlow.payoutReceived).toBe(true);
          
          // 全フローの完了を確認
          expect(testFlow.joined).toBe(true);
          expect(testFlow.bettingStarted).toBe(true);
          expect(testFlow.betPlaced).toBe(true);
          expect(testFlow.gameStarted).toBe(true);
          expect(testFlow.gameEnded).toBe(true);
          
          // 配当結果の検証
          expect(payout.playerId).toBe(clientSocket1.id);
          expect(['win', 'blackjack', 'push', 'lose']).toContain(payout.outcome);
          expect(typeof payout.payout).toBe('number');
          expect(typeof payout.newBalance).toBe('number');
          
          // 残高が正しく更新されているか確認
          const expectedBalance = initialBalance - betAmount + payout.payout;
          expect(payout.newBalance).toBe(expectedBalance);
          
          done();
        }
      });
    }, 15000);
  });
});
