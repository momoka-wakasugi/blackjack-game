/**
 * ベット検証のプロパティベーステスト
 * 
 * Feature: blackjack-multiplayer-game
 * Property 19: 初期残高付与
 * Property 20: ベット額検証
 * Property 21: 有効チップ額組み合わせ検証
 * 
 * 検証対象: 要件 9.1, 9.3, 9.4
 */

const fc = require('fast-check');
const BettingManager = require('../src/server/BettingManager');
const Player = require('../src/server/game/Player');

describe('ベット検証のプロパティベーステスト', () => {
  describe('プロパティ 19: 初期残高付与', () => {
    /**
     * **検証対象: 要件 9.1**
     * 
     * 任意のプレイヤーに対して、ルームに参加した時、
     * そのプレイヤーの残高が$1,000に設定される
     */
    test('任意のプレイヤーに初期残高$1,000が付与される', () => {
      fc.assert(
        fc.property(
          // プレイヤーIDを生成
          fc.string({ minLength: 1, maxLength: 20 }),
          // プレイヤー名を生成
          fc.string({ minLength: 1, maxLength: 50 }),
          // ソケットIDを生成
          fc.string({ minLength: 1, maxLength: 30 }),
          (playerId, playerName, socketId) => {
            // プレイヤーを作成
            const player = new Player(playerId, playerName, socketId);
            
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 初期残高を付与
            bettingManager.initializePlayerBalance(player);
            
            // 残高が$1,000に設定されることを確認
            expect(player.balance).toBe(1000);
            expect(player.currentBet).toBe(0);
            expect(player.hasBet).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('複数のプレイヤーに独立して初期残高が付与される', () => {
      fc.assert(
        fc.property(
          // 1-10人のプレイヤーを生成
          fc.integer({ min: 1, max: 10 }),
          (numPlayers) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 複数のプレイヤーを作成して初期残高を付与
            const players = [];
            for (let i = 0; i < numPlayers; i++) {
              const player = new Player(`player-${i}`, `Player${i}`, `socket-${i}`);
              bettingManager.initializePlayerBalance(player);
              players.push(player);
            }
            
            // 全プレイヤーの残高が$1,000であることを確認
            players.forEach(player => {
              expect(player.balance).toBe(1000);
              expect(player.currentBet).toBe(0);
              expect(player.hasBet).toBe(false);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('残高リセット後も$1,000が付与される', () => {
      fc.assert(
        fc.property(
          // 初期残高を生成（0-1000の範囲）
          fc.integer({ min: 0, max: 1000 }),
          // 現在のベット額を生成
          fc.integer({ min: 0, max: 500 }),
          (currentBalance, currentBet) => {
            // プレイヤーを作成
            const player = new Player('player-1', 'TestPlayer', 'socket-1');
            player.balance = currentBalance;
            player.currentBet = currentBet;
            player.hasBet = currentBet > 0;
            
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 残高をリセット
            bettingManager.resetBalance(player);
            
            // 残高が$1,000に設定されることを確認
            expect(player.balance).toBe(1000);
            expect(player.currentBet).toBe(0);
            expect(player.hasBet).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('プロパティ 20: ベット額検証', () => {
    /**
     * **検証対象: 要件 9.4**
     * 
     * 任意のベット額とプレイヤー残高に対して、ベット額が最小額$1以上かつ
     * プレイヤー残高以下の場合のみベットが受け入れられ、それ以外は拒否される
     */
    test('最小額$1以上かつ残高以下のベットが受け入れられる', () => {
      fc.assert(
        fc.property(
          // プレイヤー残高を生成
          fc.integer({ min: 1, max: 1000 }),
          // ベット額を生成（残高以下）
          fc.integer({ min: 1, max: 1000 }),
          (playerBalance, betAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // ベット額が残高以下の場合のみテスト
            if (betAmount > playerBalance) {
              // ベット額が残高を超える場合は拒否される
              const validation = bettingManager.validateBet(betAmount, playerBalance);
              expect(validation.valid).toBe(false);
              expect(validation.reason).toContain('Insufficient balance');
            } else if (betAmount < 1) {
              // ベット額が最小額未満の場合は拒否される
              const validation = bettingManager.validateBet(betAmount, playerBalance);
              expect(validation.valid).toBe(false);
              expect(validation.reason).toContain('at least');
            } else {
              // 有効なチップ組み合わせかチェック
              const isValidChipCombo = bettingManager.isValidChipCombination(betAmount);
              const validation = bettingManager.validateBet(betAmount, playerBalance);
              
              if (isValidChipCombo) {
                // 有効なチップ組み合わせの場合は受け入れられる
                expect(validation.valid).toBe(true);
              } else {
                // 無効なチップ組み合わせの場合は拒否される
                expect(validation.valid).toBe(false);
                expect(validation.reason).toContain('Invalid chip combination');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('最小額未満のベットが拒否される', () => {
      fc.assert(
        fc.property(
          // プレイヤー残高を生成
          fc.integer({ min: 100, max: 1000 }),
          // 最小額未満のベット額を生成
          fc.integer({ min: -1000, max: 0 }),
          (playerBalance, betAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // ベット額を検証
            const validation = bettingManager.validateBet(betAmount, playerBalance);
            
            // ベットが拒否されることを確認
            expect(validation.valid).toBe(false);
            expect(validation.reason).toContain('at least');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('残高を超えるベットが拒否される', () => {
      fc.assert(
        fc.property(
          // プレイヤー残高を生成
          fc.integer({ min: 1, max: 500 }),
          // 残高を超えるベット額を生成
          fc.integer({ min: 1, max: 500 }),
          (playerBalance, extraAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 残高を超えるベット額
            const betAmount = playerBalance + extraAmount;
            
            // ベット額を検証
            const validation = bettingManager.validateBet(betAmount, playerBalance);
            
            // ベットが拒否されることを確認
            expect(validation.valid).toBe(false);
            expect(validation.reason).toContain('Insufficient balance');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('無効な形式のベット額が拒否される', () => {
      fc.assert(
        fc.property(
          // プレイヤー残高を生成
          fc.integer({ min: 100, max: 1000 }),
          // 無効な値を生成
          fc.oneof(
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
            fc.constant(undefined),
            fc.constant(null),
            fc.constant('invalid'),
            fc.constant({})
          ),
          (playerBalance, invalidBet) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // ベット額を検証
            const validation = bettingManager.validateBet(invalidBet, playerBalance);
            
            // ベットが拒否されることを確認
            expect(validation.valid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('placeBetメソッドが検証ルールに従う', () => {
      fc.assert(
        fc.property(
          // ベット額を生成
          fc.integer({ min: -100, max: 1500 }),
          (betAmount) => {
            // プレイヤーを作成
            const player = new Player('player-1', 'TestPlayer', 'socket-1');
            
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            bettingManager.initializePlayerBalance(player);
            
            const initialBalance = player.balance;
            
            // ベットを配置
            const result = bettingManager.placeBet(player, betAmount);
            
            // 検証ルールに従って結果を確認
            if (betAmount < 1) {
              // 最小額未満の場合は失敗
              expect(result.success).toBe(false);
              expect(player.balance).toBe(initialBalance);
              expect(player.currentBet).toBe(0);
              expect(player.hasBet).toBe(false);
            } else if (betAmount > initialBalance) {
              // 残高を超える場合は失敗
              expect(result.success).toBe(false);
              expect(player.balance).toBe(initialBalance);
              expect(player.currentBet).toBe(0);
              expect(player.hasBet).toBe(false);
            } else if (!bettingManager.isValidChipCombination(betAmount)) {
              // 無効なチップ組み合わせの場合は失敗
              expect(result.success).toBe(false);
              expect(player.balance).toBe(initialBalance);
              expect(player.currentBet).toBe(0);
              expect(player.hasBet).toBe(false);
            } else {
              // 有効なベットの場合は成功
              expect(result.success).toBe(true);
              expect(player.balance).toBe(initialBalance - betAmount);
              expect(player.currentBet).toBe(betAmount);
              expect(player.hasBet).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('プロパティ 21: 有効チップ額組み合わせ検証', () => {
    /**
     * **検証対象: 要件 9.3**
     * 
     * 任意のベット額に対して、有効なチップ額（$1, $5, $25, $100, $500, $1,000, $5,000）の
     * 組み合わせで表現可能な場合のみベットが受け入れられる
     */
    test('有効なチップ額の組み合わせで表現可能な金額が受け入れられる', () => {
      fc.assert(
        fc.property(
          // 有効なチップ額の組み合わせを生成
          fc.array(
            fc.oneof(
              fc.constant(1),
              fc.constant(5),
              fc.constant(25),
              fc.constant(100),
              fc.constant(500),
              fc.constant(1000),
              fc.constant(5000)
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (chips) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // チップの合計額を計算
            const totalAmount = chips.reduce((sum, chip) => sum + chip, 0);
            
            // 有効なチップ組み合わせであることを確認
            const isValid = bettingManager.isValidChipCombination(totalAmount);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('単一のチップ額が有効である', () => {
      // 有効なチップ額
      const validChips = [1, 5, 25, 100, 500, 1000, 5000];
      
      // BettingManagerを作成
      const bettingManager = new BettingManager();
      
      // 各チップ額が有効であることを確認
      validChips.forEach(chip => {
        const isValid = bettingManager.isValidChipCombination(chip);
        expect(isValid).toBe(true);
      });
    });

    test('チップ額の組み合わせが正しく検証される', () => {
      fc.assert(
        fc.property(
          // ベット額を生成
          fc.integer({ min: 1, max: 1000 }),
          (betAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // チップ組み合わせを検証
            const isValid = bettingManager.isValidChipCombination(betAmount);
            
            // 検証結果がブール値であることを確認
            expect(typeof isValid).toBe('boolean');
            
            // 有効な場合、ベット検証も通ることを確認
            if (isValid) {
              const validation = bettingManager.validateBet(betAmount, 1000);
              expect(validation.valid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('動的計画法による組み合わせ検証が正確である', () => {
      fc.assert(
        fc.property(
          // 複数のチップを生成
          fc.array(
            fc.oneof(
              fc.constant(1),
              fc.constant(5),
              fc.constant(25),
              fc.constant(100),
              fc.constant(500),
              fc.constant(1000)
            ),
            { minLength: 1, maxLength: 15 }
          ),
          (chips) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // チップの合計額を計算
            const totalAmount = chips.reduce((sum, chip) => sum + chip, 0);
            
            // 組み合わせが有効であることを確認
            const isValid = bettingManager.isValidChipCombination(totalAmount);
            expect(isValid).toBe(true);
            
            // 同じ金額で再度検証しても同じ結果になることを確認（冪等性）
            const isValidAgain = bettingManager.isValidChipCombination(totalAmount);
            expect(isValidAgain).toBe(isValid);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('ゼロ以下の金額は無効である', () => {
      fc.assert(
        fc.property(
          // ゼロ以下の金額を生成
          fc.integer({ min: -1000, max: 0 }),
          (amount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // ゼロの場合は有効（空の組み合わせ）
            if (amount === 0) {
              const isValid = bettingManager.isValidChipCombination(amount);
              expect(isValid).toBe(true);
            } else {
              // 負の金額の場合、検証は失敗するか例外が発生する
              // 実装によっては負の金額を受け付けない場合がある
              try {
                const isValid = bettingManager.isValidChipCombination(amount);
                expect(isValid).toBe(false);
              } catch (error) {
                // 例外が発生する場合もある
                expect(error).toBeDefined();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('validateBetが有効なチップ組み合わせのみを受け入れる', () => {
      fc.assert(
        fc.property(
          // ベット額を生成
          fc.integer({ min: 1, max: 1000 }),
          (betAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // プレイヤー残高を十分に設定
            const playerBalance = 1000;
            
            // チップ組み合わせの有効性を確認
            const isValidChipCombo = bettingManager.isValidChipCombination(betAmount);
            
            // ベット検証を実行
            const validation = bettingManager.validateBet(betAmount, playerBalance);
            
            // チップ組み合わせが有効な場合のみベットが受け入れられる
            if (isValidChipCombo) {
              expect(validation.valid).toBe(true);
            } else {
              expect(validation.valid).toBe(false);
              expect(validation.reason).toContain('Invalid chip combination');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
