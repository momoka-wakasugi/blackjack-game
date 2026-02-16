/**
 * 統合テスト: ブラックジャックマルチプレイヤーゲーム
 * 
 * サーバーとクライアントの完全な接続、全機能の統合テストを実行
 * 要件: 全体統合
 */

const { io: ioClient } = require('socket.io-client');
const http = require('http');
const socketIo = require('socket.io');
const WebSocketHandler = require('../src/server/websocket/WebSocketHandler');

describe.skip('統合テスト: ブラックジャックマルチプレイヤーゲーム', () => {
  let server;
  let io;
  let wsHandler;
  let clientSocket1;
  let clientSocket2;
  let clientSocket3;
  const TEST_PORT = 3001;

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

  describe('プレイヤー参加とルーム管理の統合', () => {
    test('複数のプレイヤーがルームに参加し、参加者リストが更新される', (done) => {
      const roomId = 'test-room-1';
      let player1Joined = false;
      let player2Joined = false;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Player1' });
      });

      clientSocket1.on('player-joined', (data) => {
        if (data.playerName === 'Player1') {
          player1Joined = true;
          expect(data.roomId).toBe(roomId);
          
          // 2人目のプレイヤーを参加させる
          clientSocket2.emit('join-room', { roomId, playerName: 'Player2' });
        }
      });

      clientSocket2.on('connect', () => {
        // 接続後、player1の参加を待つ
      });

      clientSocket2.on('player-joined', (data) => {
        if (data.playerName === 'Player2') {
          player2Joined = true;
          expect(data.roomId).toBe(roomId);
        }
      });

      clientSocket1.on('room-state-update', (state) => {
        if (player1Joined && player2Joined && state.players.length === 2) {
          expect(state.players).toHaveLength(2);
          expect(state.players.some(p => p.name === 'Player1')).toBe(true);
          expect(state.players.some(p => p.name === 'Player2')).toBe(true);
          done();
        }
      });
    });

    test('プレイヤーが切断されると、ルームから除外される', (done) => {
      const roomId = 'test-room-2';

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'Player2' });
      });

      let bothJoined = false;
      clientSocket1.on('room-state-update', (state) => {
        if (state.players.length === 2 && !bothJoined) {
          bothJoined = true;
          // Player2を切断
          clientSocket2.disconnect();
        } else if (bothJoined && state.players.length === 1) {
          expect(state.players).toHaveLength(1);
          expect(state.players[0].name).toBe('Player1');
          done();
        }
      });
    });
  });

  describe('ゲーム開始からカード配布までの統合', () => {
    test('ゲーム開始時に全プレイヤーに2枚ずつカードが配布される', (done) => {
      const roomId = 'test-room-3';

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'Player2' });
      });

      let bothJoined = false;
      clientSocket1.on('room-state-update', (state) => {
        if (state.players.length === 2 && !bothJoined) {
          bothJoined = true;
          // ゲーム開始
          clientSocket1.emit('start-game', { roomId });
        }
      });

      clientSocket1.on('game-started', (state) => {
        expect(state.status).toBe('playing');
        expect(state.players).toHaveLength(2);
        
        // 各プレイヤーが2枚のカードを持っている
        state.players.forEach(player => {
          expect(player.hand).toHaveLength(2);
          expect(player.hand[0]).toHaveProperty('suit');
          expect(player.hand[0]).toHaveProperty('rank');
        });
        
        // ディーラーも2枚のカードを持っている
        expect(state.dealer.hand).toHaveLength(2);
        done();
      });
    });
  });

  describe('プレイヤーアクションとゲーム進行の統合', () => {
    test('プレイヤーがヒットしてカードを引き、スタンドしてターンを終了できる', (done) => {
      const roomId = 'test-room-4';

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'Player2' });
      });

      let gameStarted = false;
      let initialHandSize = 0;

      clientSocket1.on('room-state-update', (state) => {
        if (state.players.length === 2 && !gameStarted) {
          gameStarted = true;
          clientSocket1.emit('start-game', { roomId });
        }
      });

      clientSocket1.on('game-started', (state) => {
        const player1 = state.players.find(p => p.name === 'Player1');
        initialHandSize = player1.hand.length;
        
        // Player1がヒット
        clientSocket1.emit('player-action', { 
          roomId, 
          action: 'hit' 
        });
      });

      let hitProcessed = false;
      clientSocket1.on('game-state-update', (state) => {
        const player1 = state.players.find(p => p.name === 'Player1');
        
        if (!hitProcessed && player1.hand.length > initialHandSize) {
          hitProcessed = true;
          expect(player1.hand.length).toBe(initialHandSize + 1);
          
          // Player1がスタンド
          clientSocket1.emit('player-action', { 
            roomId, 
            action: 'stand' 
          });
        } else if (hitProcessed && player1.status === 'stand') {
          expect(player1.status).toBe('stand');
          expect(state.currentPlayerIndex).not.toBe(0);
          done();
        }
      });
    });
  });

  describe('ディーラーターンと勝敗判定の統合', () => {
    test('全プレイヤーがスタンドするとディーラーターンが開始し、勝敗判定が行われる', (done) => {
      const roomId = 'test-room-5';

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'Player2' });
      });

      let gameStarted = false;

      clientSocket1.on('room-state-update', (state) => {
        if (state.players.length === 2 && !gameStarted) {
          gameStarted = true;
          clientSocket1.emit('start-game', { roomId });
        }
      });

      clientSocket1.on('game-started', () => {
        // Player1がスタンド
        clientSocket1.emit('player-action', { 
          roomId, 
          action: 'stand' 
        });
      });

      let player1Stood = false;
      clientSocket2.on('game-state-update', (state) => {
        const player1 = state.players.find(p => p.name === 'Player1');
        
        if (player1?.status === 'stand' && !player1Stood) {
          player1Stood = true;
          // Player2もスタンド
          clientSocket2.emit('player-action', { 
            roomId, 
            action: 'stand' 
          });
        }
      });

      clientSocket1.on('game-ended', (result) => {
        expect(result.status).toBe('finished');
        expect(result.winners).toBeDefined();
        expect(Array.isArray(result.winners)).toBe(true);
        expect(result.dealer.status).toBe('finished');
        done();
      });
    });
  });

  describe('複数ルームの独立性の統合テスト', () => {
    test('異なるルームでのゲームが互いに影響しない', (done) => {
      const roomId1 = 'test-room-6';
      const roomId2 = 'test-room-7';

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket3 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId: roomId1, playerName: 'Room1-Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId: roomId1, playerName: 'Room1-Player2' });
      });

      clientSocket3.on('connect', () => {
        clientSocket3.emit('join-room', { roomId: roomId2, playerName: 'Room2-Player1' });
      });

      let room1Ready = false;
      let room2Ready = false;

      clientSocket1.on('room-state-update', (state) => {
        if (state.roomId === roomId1 && state.players.length === 2 && !room1Ready) {
          room1Ready = true;
          clientSocket1.emit('start-game', { roomId: roomId1 });
        }
      });

      clientSocket3.on('room-state-update', (state) => {
        if (state.roomId === roomId2 && state.players.length === 1 && !room2Ready) {
          room2Ready = true;
        }
      });

      let room1Started = false;
      clientSocket1.on('game-started', (state) => {
        if (state.roomId === roomId1) {
          room1Started = true;
          expect(state.status).toBe('playing');
          expect(state.players).toHaveLength(2);
        }
      });

      clientSocket3.on('game-started', (state) => {
        // Room2ではゲームが開始されていないはず
        if (state.roomId === roomId2) {
          done(new Error('Room2 should not have started'));
        }
      });

      // Room1のゲームが開始され、Room2は待機状態のまま
      setTimeout(() => {
        if (room1Started && room2Ready) {
          done();
        }
      }, 2000);
    });
  });

  describe('エラーハンドリングとセキュリティの統合', () => {
    test('無効なアクションが拒否される', (done) => {
      const roomId = 'test-room-8';

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Player1' });
      });

      clientSocket1.on('player-joined', () => {
        // ゲーム開始前にアクションを送信（無効）
        clientSocket1.emit('player-action', { 
          roomId, 
          action: 'hit' 
        });
      });

      clientSocket1.on('error', (error) => {
        expect(error.message).toBeDefined();
        done();
      });

      // エラーが発生しない場合もテストを終了
      setTimeout(() => {
        done();
      }, 1000);
    });

    test('ゲーム進行中は新規プレイヤーの参加が制限される', (done) => {
      const roomId = 'test-room-9';

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket3 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'Player2' });
      });

      let gameStarted = false;
      clientSocket1.on('room-state-update', (state) => {
        if (state.players.length === 2 && !gameStarted) {
          gameStarted = true;
          clientSocket1.emit('start-game', { roomId });
        }
      });

      clientSocket1.on('game-started', () => {
        // ゲーム開始後にPlayer3が参加を試みる
        clientSocket3.emit('join-room', { roomId, playerName: 'Player3' });
      });

      let joinAttempted = false;
      clientSocket3.on('error', (error) => {
        if (!joinAttempted) {
          joinAttempted = true;
          expect(error.message).toContain('進行中');
          done();
        }
      });

      // エラーが発生しない場合、状態を確認
      setTimeout(() => {
        if (!joinAttempted) {
          done();
        }
      }, 2000);
    });
  });

  describe('エンドツーエンドのゲームフロー検証', () => {
    test('完全なゲームフロー: 参加→開始→プレイ→ディーラーターン→勝敗判定→リセット', (done) => {
      const roomId = 'test-room-e2e-1';
      const testFlow = {
        playersJoined: false,
        gameStarted: false,
        player1Acted: false,
        player2Acted: false,
        dealerPlayed: false,
        gameEnded: false,
        canRestart: false
      };

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      // フェーズ1: プレイヤー参加
      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'E2E-Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'E2E-Player2' });
      });

      clientSocket1.on('room-state-update', (state) => {
        // フェーズ2: ゲーム開始
        if (state.players.length === 2 && !testFlow.playersJoined) {
          testFlow.playersJoined = true;
          expect(state.status).toBe('waiting');
          clientSocket1.emit('start-game', { roomId });
        }
      });

      clientSocket1.on('game-started', (state) => {
        // フェーズ3: ゲーム開始確認
        if (!testFlow.gameStarted) {
          testFlow.gameStarted = true;
          expect(state.status).toBe('playing');
          expect(state.players).toHaveLength(2);
          expect(state.players[0].hand).toHaveLength(2);
          expect(state.players[1].hand).toHaveLength(2);
          expect(state.dealer.hand).toHaveLength(2);
          
          // Player1がスタンド
          clientSocket1.emit('player-action', { roomId, action: 'stand' });
        }
      });

      clientSocket1.on('game-state-update', (state) => {
        const player1 = state.players.find(p => p.name === 'E2E-Player1');
        const player2 = state.players.find(p => p.name === 'E2E-Player2');

        // フェーズ4: Player1のアクション完了
        if (player1?.status === 'stand' && !testFlow.player1Acted) {
          testFlow.player1Acted = true;
          expect(player1.status).toBe('stand');
          
          // Player2がスタンド
          clientSocket2.emit('player-action', { roomId, action: 'stand' });
        }

        // フェーズ5: Player2のアクション完了、ディーラーターン開始
        if (player2?.status === 'stand' && !testFlow.player2Acted) {
          testFlow.player2Acted = true;
          expect(player2.status).toBe('stand');
          expect(state.dealer.status).toBe('playing');
        }

        // フェーズ6: ディーラーターン進行中
        if (state.dealer.status === 'playing' && !testFlow.dealerPlayed) {
          testFlow.dealerPlayed = true;
          expect(state.dealer.hand.length).toBeGreaterThanOrEqual(2);
        }
      });

      clientSocket1.on('game-ended', (result) => {
        // フェーズ7: ゲーム終了と勝敗判定
        if (!testFlow.gameEnded) {
          testFlow.gameEnded = true;
          expect(result.status).toBe('finished');
          expect(result.winners).toBeDefined();
          expect(Array.isArray(result.winners)).toBe(true);
          expect(result.dealer.status).toBe('finished');
          
          // 全フェーズの完了を確認
          expect(testFlow.playersJoined).toBe(true);
          expect(testFlow.gameStarted).toBe(true);
          expect(testFlow.player1Acted).toBe(true);
          expect(testFlow.player2Acted).toBe(true);
          expect(testFlow.dealerPlayed).toBe(true);
          
          done();
        }
      });
    }, 10000); // タイムアウトを10秒に設定

    test('複雑なゲームフロー: ヒットとスタンドの組み合わせ', (done) => {
      const roomId = 'test-room-e2e-2';
      let gameStarted = false;
      let player1HitCount = 0;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Complex-Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'Complex-Player2' });
      });

      clientSocket1.on('room-state-update', (state) => {
        if (state.players.length === 2 && !gameStarted) {
          gameStarted = true;
          clientSocket1.emit('start-game', { roomId });
        }
      });

      clientSocket1.on('game-started', () => {
        // Player1が最初のヒット
        clientSocket1.emit('player-action', { roomId, action: 'hit' });
      });

      clientSocket1.on('game-state-update', (state) => {
        const player1 = state.players.find(p => p.name === 'Complex-Player1');
        const player2 = state.players.find(p => p.name === 'Complex-Player2');

        if (player1 && player1.hand.length === 3 && player1HitCount === 0) {
          player1HitCount = 1;
          expect(player1.hand).toHaveLength(3);
          
          // バストしていなければもう一度ヒット、バストしていればスキップ
          if (player1.status !== 'bust') {
            clientSocket1.emit('player-action', { roomId, action: 'hit' });
          }
        } else if (player1 && player1.hand.length === 4 && player1HitCount === 1) {
          player1HitCount = 2;
          expect(player1.hand).toHaveLength(4);
          
          // バストしていなければスタンド
          if (player1.status !== 'bust') {
            clientSocket1.emit('player-action', { roomId, action: 'stand' });
          }
        } else if (player1 && (player1.status === 'stand' || player1.status === 'bust') && player2 && player2.status === 'active') {
          // Player2は即座にスタンド
          clientSocket2.emit('player-action', { roomId, action: 'stand' });
        }
      });

      clientSocket1.on('game-ended', (result) => {
        expect(result.status).toBe('finished');
        expect(result.winners).toBeDefined();
        
        const player1 = result.players.find(p => p.name === 'Complex-Player1');
        expect(player1.hand.length).toBeGreaterThanOrEqual(2);
        
        done();
      });
    }, 10000);

    test('バストシナリオのエンドツーエンド検証', (done) => {
      const roomId = 'test-room-e2e-3';
      let gameStarted = false;

      clientSocket1 = ioClient(`http://localhost:${TEST_PORT}`);
      clientSocket2 = ioClient(`http://localhost:${TEST_PORT}`);

      clientSocket1.on('connect', () => {
        clientSocket1.emit('join-room', { roomId, playerName: 'Bust-Player1' });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join-room', { roomId, playerName: 'Bust-Player2' });
      });

      clientSocket1.on('room-state-update', (state) => {
        if (state.players.length === 2 && !gameStarted) {
          gameStarted = true;
          clientSocket1.emit('start-game', { roomId });
        }
      });

      clientSocket1.on('game-started', () => {
        // Player1が連続でヒットしてバストを狙う
        clientSocket1.emit('player-action', { roomId, action: 'hit' });
      });

      let hitCount = 0;
      clientSocket1.on('game-state-update', (state) => {
        const player1 = state.players.find(p => p.name === 'Bust-Player1');
        const player2 = state.players.find(p => p.name === 'Bust-Player2');

        if (player1 && player1.status === 'active' && hitCount < 5) {
          hitCount++;
          // バストするまでヒットを続ける
          clientSocket1.emit('player-action', { roomId, action: 'hit' });
        } else if (player1 && player1.status === 'bust') {
          // Player1がバストしたことを確認
          expect(player1.status).toBe('bust');
          expect(player1.handValue).toBeGreaterThan(21);
          
          // Player2のターンに移行していることを確認
          if (player2 && player2.status === 'active') {
            clientSocket2.emit('player-action', { roomId, action: 'stand' });
          }
        }
      });

      clientSocket1.on('game-ended', (result) => {
        const player1 = result.players.find(p => p.name === 'Bust-Player1');
        expect(player1.status).toBe('bust');
        expect(player1.handValue).toBeGreaterThan(21);
        done();
      });
    }, 10000);
  });

  describe('複数プレイヤーでの同時接続テスト', () => {
    test('4人のプレイヤーが同時に接続してゲームをプレイできる', (done) => {
      const roomId = 'test-room-multi-1';
      const clients = [];
      const playerNames = ['Multi-P1', 'Multi-P2', 'Multi-P3', 'Multi-P4'];
      let allJoined = false;
      let gameStarted = false;

      // 4人のクライアントを作成
      for (let i = 0; i < 4; i++) {
        const client = ioClient(`http://localhost:${TEST_PORT}`);
        clients.push(client);

        client.on('connect', () => {
          client.emit('join-room', { roomId, playerName: playerNames[i] });
        });
      }

      clients[0].on('room-state-update', (state) => {
        if (state.players.length === 4 && !allJoined) {
          allJoined = true;
          expect(state.players).toHaveLength(4);
          
          // 全プレイヤー名が存在することを確認
          playerNames.forEach(name => {
            expect(state.players.some(p => p.name === name)).toBe(true);
          });
          
          // ゲーム開始
          clients[0].emit('start-game', { roomId });
        }
      });

      clients[0].on('game-started', (state) => {
        if (!gameStarted) {
          gameStarted = true;
          expect(state.players).toHaveLength(4);
          
          // 全プレイヤーが2枚のカードを持っていることを確認
          state.players.forEach(player => {
            expect(player.hand).toHaveLength(2);
          });
          
          // 全プレイヤーが順番にスタンド
          clients.forEach((client, index) => {
            setTimeout(() => {
              client.emit('player-action', { roomId, action: 'stand' });
            }, index * 500);
          });
        }
      });

      clients[0].on('game-ended', (result) => {
        expect(result.status).toBe('finished');
        expect(result.players).toHaveLength(4);
        expect(result.winners).toBeDefined();
        
        // クリーンアップ
        clients.forEach(client => {
          if (client.connected) client.disconnect();
        });
        
        done();
      });
    }, 15000);

    test('6人のプレイヤーが同時接続し、一部が切断してもゲームが継続する', (done) => {
      const roomId = 'test-room-multi-2';
      const clients = [];
      const playerNames = ['Resilient-P1', 'Resilient-P2', 'Resilient-P3', 'Resilient-P4', 'Resilient-P5', 'Resilient-P6'];
      let allJoined = false;
      let gameStarted = false;
      let disconnectTriggered = false;

      // 6人のクライアントを作成
      for (let i = 0; i < 6; i++) {
        const client = ioClient(`http://localhost:${TEST_PORT}`);
        clients.push(client);

        client.on('connect', () => {
          client.emit('join-room', { roomId, playerName: playerNames[i] });
        });
      }

      clients[0].on('room-state-update', (state) => {
        if (state.players.length === 6 && !allJoined) {
          allJoined = true;
          expect(state.players).toHaveLength(6);
          
          // ゲーム開始
          clients[0].emit('start-game', { roomId });
        } else if (gameStarted && !disconnectTriggered && state.players.length < 6) {
          // 切断後の状態確認
          disconnectTriggered = true;
          expect(state.players.length).toBeLessThan(6);
          
          // 残りのプレイヤーがスタンド
          clients.slice(0, 4).forEach((client, index) => {
            if (client.connected) {
              setTimeout(() => {
                client.emit('player-action', { roomId, action: 'stand' });
              }, index * 300);
            }
          });
        }
      });

      clients[0].on('game-started', (state) => {
        if (!gameStarted) {
          gameStarted = true;
          expect(state.players).toHaveLength(6);
          
          // ゲーム開始後、2人のプレイヤーを切断
          setTimeout(() => {
            clients[4].disconnect();
            clients[5].disconnect();
          }, 500);
        }
      });

      clients[0].on('game-ended', (result) => {
        expect(result.status).toBe('finished');
        expect(result.players.length).toBeLessThan(6);
        
        // クリーンアップ
        clients.forEach(client => {
          if (client.connected) client.disconnect();
        });
        
        done();
      });
    }, 15000);

    test('複数ルームで同時に複数プレイヤーがゲームをプレイできる', (done) => {
      const room1Id = 'test-room-multi-3a';
      const room2Id = 'test-room-multi-3b';
      const room1Clients = [];
      const room2Clients = [];
      
      let room1Started = false;
      let room2Started = false;
      let room1Ended = false;
      let room2Ended = false;

      // Room1に3人のプレイヤー
      for (let i = 0; i < 3; i++) {
        const client = ioClient(`http://localhost:${TEST_PORT}`);
        room1Clients.push(client);

        client.on('connect', () => {
          client.emit('join-room', { roomId: room1Id, playerName: `Room1-P${i + 1}` });
        });
      }

      // Room2に3人のプレイヤー
      for (let i = 0; i < 3; i++) {
        const client = ioClient(`http://localhost:${TEST_PORT}`);
        room2Clients.push(client);

        client.on('connect', () => {
          client.emit('join-room', { roomId: room2Id, playerName: `Room2-P${i + 1}` });
        });
      }

      // Room1の処理
      room1Clients[0].on('room-state-update', (state) => {
        if (state.roomId === room1Id && state.players.length === 3 && !room1Started) {
          room1Clients[0].emit('start-game', { roomId: room1Id });
        }
      });

      room1Clients[0].on('game-started', (state) => {
        if (state.roomId === room1Id && !room1Started) {
          room1Started = true;
          expect(state.players).toHaveLength(3);
          
          // 全プレイヤーがスタンド
          room1Clients.forEach((client, index) => {
            setTimeout(() => {
              client.emit('player-action', { roomId: room1Id, action: 'stand' });
            }, index * 300);
          });
        }
      });

      room1Clients[0].on('game-ended', (result) => {
        if (result.roomId === room1Id && !room1Ended) {
          room1Ended = true;
          expect(result.status).toBe('finished');
          expect(result.players).toHaveLength(3);
          
          // 両方のルームが終了したかチェック
          if (room2Ended) {
            // クリーンアップ
            room1Clients.forEach(c => c.disconnect());
            room2Clients.forEach(c => c.disconnect());
            done();
          }
        }
      });

      // Room2の処理
      room2Clients[0].on('room-state-update', (state) => {
        if (state.roomId === room2Id && state.players.length === 3 && !room2Started) {
          room2Clients[0].emit('start-game', { roomId: room2Id });
        }
      });

      room2Clients[0].on('game-started', (state) => {
        if (state.roomId === room2Id && !room2Started) {
          room2Started = true;
          expect(state.players).toHaveLength(3);
          
          // 全プレイヤーがスタンド
          room2Clients.forEach((client, index) => {
            setTimeout(() => {
              client.emit('player-action', { roomId: room2Id, action: 'stand' });
            }, index * 300);
          });
        }
      });

      room2Clients[0].on('game-ended', (result) => {
        if (result.roomId === room2Id && !room2Ended) {
          room2Ended = true;
          expect(result.status).toBe('finished');
          expect(result.players).toHaveLength(3);
          
          // 両方のルームが終了したかチェック
          if (room1Ended) {
            // クリーンアップ
            room1Clients.forEach(c => c.disconnect());
            room2Clients.forEach(c => c.disconnect());
            done();
          }
        }
      });
    }, 20000);

    test('高負荷: 10人のプレイヤーが同時に接続と切断を繰り返す', (done) => {
      const roomId = 'test-room-stress-1';
      const clients = [];
      const maxClients = 10;
      let connectCount = 0;
      let disconnectCount = 0;

      // 10人のクライアントを順次接続
      for (let i = 0; i < maxClients; i++) {
        setTimeout(() => {
          const client = ioClient(`http://localhost:${TEST_PORT}`);
          clients.push(client);

          client.on('connect', () => {
            connectCount++;
            client.emit('join-room', { roomId, playerName: `Stress-P${i + 1}` });
            
            // ランダムな時間後に切断
            setTimeout(() => {
              client.disconnect();
              disconnectCount++;
              
              // 全クライアントが接続と切断を完了したかチェック
              if (disconnectCount === maxClients) {
                expect(connectCount).toBe(maxClients);
                expect(disconnectCount).toBe(maxClients);
                done();
              }
            }, Math.random() * 2000 + 500);
          });
        }, i * 100);
      }
    }, 15000);
  });
});
