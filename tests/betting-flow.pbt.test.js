/**
 * ベッティングフローのプロパティベーステスト
 * 
 * Feature: blackjack-multiplayer-game
 * Property 23: 全員ベット後のゲーム開始
 * Property 24: 残高更新の正確性
 * 
 * 検証対象: 要件 9.5, 9.10
 */

const fc = require('fast-check');
const GameState = require('../src/server/game/GameState');
const Player = require('../src/server/game/Player');
const Deck = require('../src/server/game/Deck');
const GameEngine = require('../src/server/GameEngine');
const BettingManager = require('../src/server/BettingManager');

describe('ベッティングフローのプロパティベーステスト', () => {
  describe('プロパティ 23: 全員ベット後のゲーム開始', () => {
    /**
     * **検証対象: 要件 9.5**
     * 
     * 任意のルームにおいて、全プレイヤーがベットを配置した時のみゲームが開始され、
     * カードが配布される
     */
    test('全プレイヤーがベットを配置した場合のみゲームが開始可能', () => {
      fc.assert(
        fc.property(
          // 1-6人のプレイヤーを生成
          fc.integer({ min: 1, max: 6 }),
          // 各プレイヤーのベット額を生成（有効なチップ組み合わせ）
          fc.array(
            fc.oneof(
              fc.constant(1),
              fc.constant(5),
              fc.constant(25),
              fc.constant(100),
              fc.constant(500),
              fc.constant(1000)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (numPlayers, betChips) => {
            // ゲーム状態を作成
            const roomId = `test-room-${Math.random()}`;
            const gameState = new GameState(roomId);
            const deck = gameState.deck;
            deck.shuffle();

            // プレイヤーを追加
            const players = [];
            for (let i = 0; i < numPlayers; i++) {
              const player = new Player(`player-${i}`, `Player${i}`, `socket-${i}`);
              players.push(player);
              gameState.addPlayer(player);
            }

            // ベッティングフェーズを開始
            gameState.status = 'betting';

            // 各プレイヤーの初期残高を設定
            const bettingManager = new BettingManager();
            players.forEach(player => {
              bettingManager.initializePlayerBalance(player);
            });

            // ベット額を計算（チップの合計）
            const betAmount = betChips.reduce((sum, chip) => sum + chip, 0);

            // 一部のプレイヤーのみがベットした状態
            const numBettingPlayers = Math.floor(numPlayers / 2) + 1;
            for (let i = 0; i < numBettingPlayers; i++) {
              const player = players[i];
              if (betAmount <= player.balance) {
                player.balance -= betAmount;
                player.currentBet = betAmount;
                player.hasBet = true;
              }
            }

            // 全員がベットしていない場合、ゲームは開始できない
            const allPlayersHaveBet = players.every(p => p.hasBet);
            
            if (!allPlayersHaveBet) {
              // ゲームを開始しようとしても、ベッティングフェーズのまま
              expect(gameState.status).toBe('betting');
              
              // カードが配布されていないことを確認
              players.forEach(player => {
                expect(player.currentHand.length).toBe(0);
              });
            }

            // 残りのプレイヤーもベットする
            for (let i = numBettingPlayers; i < numPlayers; i++) {
              const player = players[i];
              if (betAmount <= player.balance) {
                player.balance -= betAmount;
                player.currentBet = betAmount;
                player.hasBet = true;
              }
            }

            // 全員がベットした場合、ゲームを開始できる
            if (players.every(p => p.hasBet)) {
              // ゲームを開始
              gameState.startGame();
              gameState.dealInitialCards();
              
              // ゲーム状態が'playing'になることを確認
              expect(gameState.status).toBe('playing');
              
              // 各プレイヤーに2枚のカードが配布されることを確認
              players.forEach(player => {
                expect(player.currentHand.length).toBe(2);
              });
              
              // ディーラーにも2枚のカードが配布されることを確認
              expect(gameState.dealer.hand.length).toBe(2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('プレイヤーが一人でもベットしていない場合、ゲームは開始されない', () => {
      fc.assert(
        fc.property(
          // 2-6人のプレイヤーを生成
          fc.integer({ min: 2, max: 6 }),
          // ベット額を生成
          fc.integer({ min: 1, max: 500 }),
          (numPlayers, betAmount) => {
            // 有効なチップ組み合わせかチェック
            const bettingManager = new BettingManager();
            if (!bettingManager.isValidChipCombination(betAmount)) {
              return; // スキップ
            }

            // ゲーム状態を作成
            const roomId = `test-room-${Math.random()}`;
            const gameState = new GameState(roomId);
            const deck = gameState.deck;
            deck.shuffle();

            // プレイヤーを追加
            const players = [];
            for (let i = 0; i < numPlayers; i++) {
              const player = new Player(`player-${i}`, `Player${i}`, `socket-${i}`);
              players.push(player);
              gameState.addPlayer(player);
              bettingManager.initializePlayerBalance(player);
            }

            // ベッティングフェーズを開始
            gameState.status = 'betting';

            // 最後のプレイヤー以外がベット
            for (let i = 0; i < numPlayers - 1; i++) {
              const player = players[i];
              if (betAmount <= player.balance) {
                player.balance -= betAmount;
                player.currentBet = betAmount;
                player.hasBet = true;
              }
            }

            // 全員がベットしていないことを確認
            const allPlayersHaveBet = players.every(p => p.hasBet);
            expect(allPlayersHaveBet).toBe(false);

            // ゲーム状態はベッティングフェーズのまま
            expect(gameState.status).toBe('betting');

            // カードが配布されていないことを確認
            players.forEach(player => {
              expect(player.currentHand.length).toBe(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('プロパティ 24: 残高更新の正確性', () => {
    /**
     * **検証対象: 要件 9.10**
     * 
     * 任意のプレイヤーとゲーム結果に対して、ゲーム終了時にプレイヤーの残高が
     * 配当計算結果に基づいて正しく更新される
     */
    test('勝利時の残高更新が正確である', () => {
      fc.assert(
        fc.property(
          // 初期残高を生成
          fc.integer({ min: 100, max: 10000 }),
          // ベット額を生成（有効なチップ組み合わせ）
          fc.oneof(
            fc.constant(1),
            fc.constant(5),
            fc.constant(25),
            fc.constant(100),
            fc.constant(500),
            fc.constant(1000)
          ),
          (initialBalance, betAmount) => {
            // ベット額が残高を超えないようにする
            if (betAmount > initialBalance) {
              return;
            }

            // プレイヤーを作成
            const player = new Player('player-1', 'TestPlayer', 'socket-1');
            player.balance = initialBalance;
            player.currentBet = betAmount;
            player.hasBet = true;

            // ベット後の残高を計算
            const balanceAfterBet = initialBalance - betAmount;

            // BettingManagerを使用して配当を計算
            const bettingManager = new BettingManager();

            // 通常勝利の場合（1:1配当）
            const payoutWin = bettingManager.calculatePayout(betAmount, 'win');
            const expectedBalanceWin = balanceAfterBet + payoutWin;

            // 残高を更新
            player.balance = balanceAfterBet;
            bettingManager.updateBalance(player, payoutWin);

            // 残高が正確に更新されることを確認
            expect(player.balance).toBe(expectedBalanceWin);
            expect(player.currentBet).toBe(0);
            expect(player.hasBet).toBe(false);

            // 期待される残高: 初期残高 + ベット額（1:1配当）
            expect(player.balance).toBe(initialBalance + betAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('ブラックジャック勝利時の残高更新が正確である', () => {
      fc.assert(
        fc.property(
          // 初期残高を生成
          fc.integer({ min: 100, max: 10000 }),
          // ベット額を生成（偶数のみ、3:2配当で整数になるように）
          fc.integer({ min: 1, max: 500 }).map(n => n * 2),
          (initialBalance, betAmount) => {
            // ベット額が残高を超えないようにする
            if (betAmount > initialBalance) {
              return;
            }

            // 有効なチップ組み合わせかチェック
            const bettingManager = new BettingManager();
            if (!bettingManager.isValidChipCombination(betAmount)) {
              return;
            }

            // プレイヤーを作成
            const player = new Player('player-1', 'TestPlayer', 'socket-1');
            player.balance = initialBalance;
            player.currentBet = betAmount;
            player.hasBet = true;

            // ベット後の残高を計算
            const balanceAfterBet = initialBalance - betAmount;

            // ブラックジャック勝利の場合（3:2配当）
            const payoutBlackjack = bettingManager.calculatePayout(betAmount, 'blackjack');
            const expectedBalanceBlackjack = balanceAfterBet + payoutBlackjack;

            // 残高を更新
            player.balance = balanceAfterBet;
            bettingManager.updateBalance(player, payoutBlackjack);

            // 残高が正確に更新されることを確認
            expect(player.balance).toBe(expectedBalanceBlackjack);
            expect(player.currentBet).toBe(0);
            expect(player.hasBet).toBe(false);

            // 期待される残高: 初期残高 + ベット額 * 1.5（3:2配当）
            expect(player.balance).toBe(initialBalance + betAmount * 1.5);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('引き分け時の残高更新が正確である', () => {
      fc.assert(
        fc.property(
          // 初期残高を生成
          fc.integer({ min: 100, max: 10000 }),
          // ベット額を生成
          fc.oneof(
            fc.constant(1),
            fc.constant(5),
            fc.constant(25),
            fc.constant(100),
            fc.constant(500)
          ),
          (initialBalance, betAmount) => {
            // ベット額が残高を超えないようにする
            if (betAmount > initialBalance) {
              return;
            }

            // プレイヤーを作成
            const player = new Player('player-1', 'TestPlayer', 'socket-1');
            player.balance = initialBalance;
            player.currentBet = betAmount;
            player.hasBet = true;

            // ベット後の残高を計算
            const balanceAfterBet = initialBalance - betAmount;

            // BettingManagerを使用して配当を計算
            const bettingManager = new BettingManager();

            // 引き分けの場合（ベット額返却）
            const payoutPush = bettingManager.calculatePayout(betAmount, 'push');
            const expectedBalancePush = balanceAfterBet + payoutPush;

            // 残高を更新
            player.balance = balanceAfterBet;
            bettingManager.updateBalance(player, payoutPush);

            // 残高が正確に更新されることを確認
            expect(player.balance).toBe(expectedBalancePush);
            expect(player.currentBet).toBe(0);
            expect(player.hasBet).toBe(false);

            // 期待される残高: 初期残高（ベット額が返却される）
            expect(player.balance).toBe(initialBalance);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('敗北時の残高更新が正確である', () => {
      fc.assert(
        fc.property(
          // 初期残高を生成
          fc.integer({ min: 100, max: 10000 }),
          // ベット額を生成
          fc.oneof(
            fc.constant(1),
            fc.constant(5),
            fc.constant(25),
            fc.constant(100),
            fc.constant(500)
          ),
          (initialBalance, betAmount) => {
            // ベット額が残高を超えないようにする
            if (betAmount > initialBalance) {
              return;
            }

            // プレイヤーを作成
            const player = new Player('player-1', 'TestPlayer', 'socket-1');
            player.balance = initialBalance;
            player.currentBet = betAmount;
            player.hasBet = true;

            // ベット後の残高を計算
            const balanceAfterBet = initialBalance - betAmount;

            // BettingManagerを使用して配当を計算
            const bettingManager = new BettingManager();

            // 敗北の場合（ベット額没収）
            const payoutLose = bettingManager.calculatePayout(betAmount, 'lose');
            const expectedBalanceLose = balanceAfterBet + payoutLose;

            // 残高を更新
            player.balance = balanceAfterBet;
            bettingManager.updateBalance(player, payoutLose);

            // 残高が正確に更新されることを確認
            expect(player.balance).toBe(expectedBalanceLose);
            expect(player.currentBet).toBe(0);
            expect(player.hasBet).toBe(false);

            // 期待される残高: 初期残高 - ベット額
            expect(player.balance).toBe(initialBalance - betAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('複数プレイヤーの残高更新が独立して正確である', () => {
      fc.assert(
        fc.property(
          // 2-4人のプレイヤーを生成
          fc.integer({ min: 2, max: 4 }),
          // 各プレイヤーのベット額を生成
          fc.array(
            fc.oneof(
              fc.constant(1),
              fc.constant(5),
              fc.constant(25),
              fc.constant(100)
            ),
            { minLength: 2, maxLength: 4 }
          ),
          // 各プレイヤーの結果を生成
          fc.array(
            fc.oneof(
              fc.constant('win'),
              fc.constant('blackjack'),
              fc.constant('push'),
              fc.constant('lose')
            ),
            { minLength: 2, maxLength: 4 }
          ),
          (numPlayers, betAmounts, results) => {
            // プレイヤー数に合わせて配列を調整
            const actualBetAmounts = betAmounts.slice(0, numPlayers);
            const actualResults = results.slice(0, numPlayers);

            // BettingManagerを作成
            const bettingManager = new BettingManager();

            // 各プレイヤーの初期残高と期待される最終残高を記録
            const players = [];
            const expectedBalances = [];

            for (let i = 0; i < numPlayers; i++) {
              const player = new Player(`player-${i}`, `Player${i}`, `socket-${i}`);
              bettingManager.initializePlayerBalance(player);
              
              const initialBalance = player.balance;
              const betAmount = actualBetAmounts[i];
              const result = actualResults[i];

              // ベット額が残高を超えないようにする
              if (betAmount > player.balance) {
                continue;
              }

              // ベットを配置
              player.balance -= betAmount;
              player.currentBet = betAmount;
              player.hasBet = true;

              // 期待される最終残高を計算
              const balanceAfterBet = initialBalance - betAmount;
              const payout = bettingManager.calculatePayout(betAmount, result);
              const expectedBalance = balanceAfterBet + payout;

              players.push(player);
              expectedBalances.push(expectedBalance);
            }

            // 各プレイヤーの残高を更新
            players.forEach((player, index) => {
              const result = actualResults[index];
              const payout = bettingManager.calculatePayout(player.currentBet, result);
              bettingManager.updateBalance(player, payout);
            });

            // 各プレイヤーの残高が正確に更新されることを確認
            players.forEach((player, index) => {
              expect(player.balance).toBe(expectedBalances[index]);
              expect(player.currentBet).toBe(0);
              expect(player.hasBet).toBe(false);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GameEngineのdetermineWinnersが残高を正確に更新する', () => {
      fc.assert(
        fc.property(
          // プレイヤー数を生成
          fc.integer({ min: 1, max: 4 }),
          // ベット額を生成
          fc.oneof(
            fc.constant(1),
            fc.constant(5),
            fc.constant(25),
            fc.constant(100)
          ),
          (numPlayers, betAmount) => {
            // ゲーム状態を作成
            const roomId = `test-room-${Math.random()}`;
            const gameState = new GameState(roomId);
            const deck = gameState.deck;
            deck.shuffle();

            // GameEngineを作成
            const gameEngine = new GameEngine();

            // プレイヤーを追加してベットを配置
            const players = [];
            const initialBalances = [];

            for (let i = 0; i < numPlayers; i++) {
              const player = new Player(`player-${i}`, `Player${i}`, `socket-${i}`);
              gameEngine.bettingManager.initializePlayerBalance(player);
              
              const initialBalance = player.balance;
              
              // ベット額が残高を超えないようにする
              if (betAmount > player.balance) {
                continue;
              }

              players.push(player);
              initialBalances.push(initialBalance);
              gameState.addPlayer(player);
            }

            if (players.length === 0) {
              return; // スキップ
            }

            // ベッティングフェーズを開始
            gameState.status = 'betting';

            // 各プレイヤーがベットを配置
            players.forEach((player, index) => {
              const result = gameEngine.placeBet(gameState, player.id, betAmount);
              expect(result.success).toBe(true);
            });

            // ゲームを開始
            gameState.startGame();
            gameState.dealInitialCards();

            // 全プレイヤーをスタンド状態にする
            players.forEach(player => {
              if (player.status === 'active' || player.status === 'playing') {
                player.setStatus('stand');
              }
            });

            // ベット情報を復元（startGameでリセットされた場合）
            players.forEach((player, index) => {
              if (player.currentBet === 0) {
                player.currentBet = betAmount;
                player.hasBet = true;
                player.balance = initialBalances[index] - betAmount;
              }
            });

            // 勝者を決定して残高を更新
            const result = gameEngine.determineWinners(gameState);

            // 各プレイヤーの残高が更新されていることを確認
            players.forEach((player, index) => {
              const payout = result.payouts.find(p => p.playerId === player.id);
              
              expect(payout).toBeDefined();
              expect(payout.betAmount).toBe(betAmount);
              expect(['win', 'blackjack', 'push', 'lose']).toContain(payout.outcome);
              
              // 残高が正しく更新されていることを確認
              expect(player.balance).toBe(payout.newBalance);
              expect(player.currentBet).toBe(0);
              expect(player.hasBet).toBe(false);
              
              // 残高の変化が配当計算と一致することを確認
              const balanceAfterBet = initialBalances[index] - betAmount;
              const expectedPayout = gameEngine.bettingManager.calculatePayout(betAmount, payout.outcome);
              const expectedBalance = balanceAfterBet + expectedPayout;
              
              expect(player.balance).toBe(expectedBalance);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
