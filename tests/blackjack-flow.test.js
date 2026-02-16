/**
 * ブラックジャックシナリオの完全なフローテスト
 * 
 * このテストは以下のシナリオをカバーします：
 * 1. プレイヤーがブラックジャックを獲得
 * 2. ディーラーがブラックジャックを獲得
 * 3. 両方がブラックジャック（引き分け）
 * 4. ブラックジャック後のゲームフロー継続
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import http from 'http';
import { Server } from 'socket.io';
import express from 'express';
import RoomManager from '../src/server/RoomManager.js';
import GameEngine from '../src/server/GameEngine.js';
import WebSocketHandler from '../src/server/websocket/WebSocketHandler.js';
import Card from '../src/server/game/Card.js';

describe('ブラックジャック完全フローテスト', () => {
  let httpServer;
  let io;
  let roomManager;
  let gameEngine;
  let webSocketHandler;
  let serverPort;
  let clientSocket;

  beforeEach((done) => {
    // サーバーセットアップ
    const app = express();
    httpServer = http.createServer(app);
    io = new Server(httpServer);
    
    roomManager = new RoomManager();
    gameEngine = new GameEngine();
    webSocketHandler = new WebSocketHandler(io, roomManager, gameEngine);

    // ランダムポートでサーバー起動
    httpServer.listen(0, () => {
      serverPort = httpServer.address().port;
      done();
    });
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    io.close();
    httpServer.close(done);
  });

  it('シナリオ1: プレイヤーがブラックジャックを獲得し、3:2配当を受け取る', (done) => {
    clientSocket = ioClient(`http://localhost:${serverPort}`);
    
    let gameState;
    let payoutReceived = false;

    clientSocket.on('connect', () => {
      clientSocket.emit('join-room', { roomId: 'test-room-1' });
    });

    clientSocket.on('joined-room', (data) => {
      expect(data.playerId).toBeDefined();
      
      // ベッティングフェーズ開始
      clientSocket.emit('start-betting');
    });

    clientSocket.on('betting-phase', () => {
      // ベット配置
      clientSocket.emit('place-bet', { amount: 100 });
    });

    clientSocket.on('game-started', (data) => {
      gameState = data.gameState;
      
      // プレイヤーの手札を強制的にブラックジャックに設定
      const room = roomManager.getRoom('test-room-1');
      const player = room.gameState.players[0];
      
      // 手札をクリアしてブラックジャックを作成
      player.currentHand = [
        new Card('hearts', 'A'),
        new Card('spades', 'K')
      ];
      player.updateHandValue();
      
      expect(player.status).toBe('blackjack');
      expect(player.handValue).toBe(21);
      
      // ブラックジャックなので自動的にディーラーターンへ
      // 少し待ってからゲーム状態を確認
      setTimeout(() => {
        expect(room.gameState.areAllPlayersDone()).toBe(true);
      }, 100);
    });

    clientSocket.on('payout-result', (payout) => {
      console.log('Payout received:', payout);
      
      expect(payout.outcome).toBe('blackjack');
      expect(payout.betAmount).toBe(100);
      
      // 3:2配当: 100 * 1.5 = 150の利益
      expect(payout.payout).toBe(150);
      
      // 新しい残高: 1000 - 100 (bet) + 100 (bet return) + 150 (winnings) = 1150
      expect(payout.newBalance).toBe(1150);
      
      payoutReceived = true;
    });

    clientSocket.on('game-ended', () => {
      // ゲーム終了を確認
      setTimeout(() => {
        expect(payoutReceived).toBe(true);
        done();
      }, 100);
    });

    // タイムアウト設定
    setTimeout(() => {
      if (!payoutReceived) {
        done(new Error('Payout not received within timeout'));
      }
    }, 10000);
  });

  it('シナリオ2: ディーラーがブラックジャックを獲得し、プレイヤーが負ける', (done) => {
    clientSocket = ioClient(`http://localhost:${serverPort}`);
    
    let payoutReceived = false;

    clientSocket.on('connect', () => {
      clientSocket.emit('join-room', { roomId: 'test-room-2' });
    });

    clientSocket.on('joined-room', () => {
      clientSocket.emit('start-betting');
    });

    clientSocket.on('betting-phase', () => {
      clientSocket.emit('place-bet', { amount: 50 });
    });

    clientSocket.on('game-started', () => {
      const room = roomManager.getRoom('test-room-2');
      const player = room.gameState.players[0];
      
      // プレイヤーに通常の手札を設定
      player.currentHand = [
        new Card('hearts', '10'),
        new Card('spades', '9')
      ];
      player.updateHandValue();
      expect(player.handValue).toBe(19);
      
      // ディーラーにブラックジャックを設定
      room.gameState.dealer.hand = [
        new Card('diamonds', 'A'),
        new Card('clubs', 'Q')
      ];
      room.gameState.dealer.handValue = 21;
      room.gameState.dealer.status = 'blackjack';
      
      // プレイヤーをスタンドさせる
      player.setStatus('stand');
    });

    clientSocket.on('payout-result', (payout) => {
      console.log('Payout received:', payout);
      
      expect(payout.outcome).toBe('lose');
      expect(payout.betAmount).toBe(50);
      
      // 負けなので-50
      expect(payout.payout).toBe(-50);
      
      // 新しい残高: 1000 - 50 = 950
      expect(payout.newBalance).toBe(950);
      
      payoutReceived = true;
    });

    clientSocket.on('game-ended', () => {
      setTimeout(() => {
        expect(payoutReceived).toBe(true);
        done();
      }, 100);
    });

    setTimeout(() => {
      if (!payoutReceived) {
        done(new Error('Payout not received within timeout'));
      }
    }, 10000);
  });

  it('シナリオ3: プレイヤーとディーラー両方がブラックジャック（引き分け）', (done) => {
    clientSocket = ioClient(`http://localhost:${serverPort}`);
    
    let payoutReceived = false;

    clientSocket.on('connect', () => {
      clientSocket.emit('join-room', { roomId: 'test-room-3' });
    });

    clientSocket.on('joined-room', () => {
      clientSocket.emit('start-betting');
    });

    clientSocket.on('betting-phase', () => {
      clientSocket.emit('place-bet', { amount: 200 });
    });

    clientSocket.on('game-started', () => {
      const room = roomManager.getRoom('test-room-3');
      const player = room.gameState.players[0];
      
      // プレイヤーにブラックジャックを設定
      player.currentHand = [
        new Card('hearts', 'A'),
        new Card('spades', 'J')
      ];
      player.updateHandValue();
      expect(player.status).toBe('blackjack');
      
      // ディーラーにもブラックジャックを設定
      room.gameState.dealer.hand = [
        new Card('diamonds', 'A'),
        new Card('clubs', 'K')
      ];
      room.gameState.dealer.handValue = 21;
      room.gameState.dealer.status = 'blackjack';
    });

    clientSocket.on('payout-result', (payout) => {
      console.log('Payout received:', payout);
      
      expect(payout.outcome).toBe('push');
      expect(payout.betAmount).toBe(200);
      
      // 引き分けなので0（ベット額返却）
      expect(payout.payout).toBe(0);
      
      // 新しい残高: 1000 - 200 + 200 = 1000
      expect(payout.newBalance).toBe(1000);
      
      payoutReceived = true;
    });

    clientSocket.on('game-ended', () => {
      setTimeout(() => {
        expect(payoutReceived).toBe(true);
        done();
      }, 100);
    });

    setTimeout(() => {
      if (!payoutReceived) {
        done(new Error('Payout not received within timeout'));
      }
    }, 10000);
  });

  it('シナリオ4: 複数プレイヤーでブラックジャックが出てもゲームが継続する', (done) => {
    const client1 = ioClient(`http://localhost:${serverPort}`);
    const client2 = ioClient(`http://localhost:${serverPort}`);
    
    let player1Payout = false;
    let player2Payout = false;

    client1.on('connect', () => {
      client1.emit('join-room', { roomId: 'test-room-4' });
    });

    client2.on('connect', () => {
      client2.emit('join-room', { roomId: 'test-room-4' });
    });

    let joinedCount = 0;
    const handleJoined = () => {
      joinedCount++;
      if (joinedCount === 2) {
        client1.emit('start-betting');
      }
    };

    client1.on('joined-room', handleJoined);
    client2.on('joined-room', handleJoined);

    client1.on('betting-phase', () => {
      client1.emit('place-bet', { amount: 100 });
    });

    client2.on('betting-phase', () => {
      client2.emit('place-bet', { amount: 50 });
    });

    client1.on('game-started', () => {
      const room = roomManager.getRoom('test-room-4');
      
      // プレイヤー1にブラックジャック
      const player1 = room.gameState.players[0];
      player1.currentHand = [
        new Card('hearts', 'A'),
        new Card('spades', 'K')
      ];
      player1.updateHandValue();
      expect(player1.status).toBe('blackjack');
      
      // プレイヤー2に通常の手札
      const player2 = room.gameState.players[1];
      player2.currentHand = [
        new Card('diamonds', '10'),
        new Card('clubs', '8')
      ];
      player2.updateHandValue();
      expect(player2.handValue).toBe(18);
      
      // プレイヤー2をスタンドさせる
      player2.setStatus('stand');
    });

    client1.on('payout-result', (payout) => {
      console.log('Player 1 payout:', payout);
      expect(payout.outcome).toBe('blackjack');
      expect(payout.payout).toBe(150); // 100 * 1.5
      player1Payout = true;
    });

    client2.on('payout-result', (payout) => {
      console.log('Player 2 payout:', payout);
      // ディーラーの結果次第で勝敗が決まる
      expect(['win', 'lose', 'push']).toContain(payout.outcome);
      player2Payout = true;
    });

    client1.on('game-ended', () => {
      setTimeout(() => {
        expect(player1Payout).toBe(true);
        expect(player2Payout).toBe(true);
        
        client1.disconnect();
        client2.disconnect();
        done();
      }, 100);
    });

    setTimeout(() => {
      if (!player1Payout || !player2Payout) {
        client1.disconnect();
        client2.disconnect();
        done(new Error('Payouts not received within timeout'));
      }
    }, 15000);
  });
});
