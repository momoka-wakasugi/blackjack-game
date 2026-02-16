/**
 * 配当計算のプロパティベーステスト
 * 
 * Feature: blackjack-multiplayer-game
 * Property 22: 配当計算の正確性
 * 
 * 検証対象: 要件 9.6, 9.7, 9.8, 9.9
 */

const fc = require('fast-check');
const BettingManager = require('../src/server/BettingManager');

describe('配当計算のプロパティベーステスト', () => {
  describe('プロパティ 22: 配当計算の正確性', () => {
    /**
     * **検証対象: 要件 9.6, 9.7, 9.8, 9.9**
     * 
     * 任意のベット額とゲーム結果に対して、通常勝利時は1:1配当、
     * ブラックジャック勝利時は3:2配当、引き分け時はベット額返却、
     * 敗北時はベット額没収が正しく計算される
     */
    test('通常勝利時の配当が1:1（等倍）である', () => {
      fc.assert(
        fc.property(
          // ベット額を生成（有効なチップ組み合わせ）
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
            
            // ベット額を計算
            const betAmount = chips.reduce((sum, chip) => sum + chip, 0);
            
            // 通常勝利の配当を計算
            const payout = bettingManager.calculatePayout(betAmount, 'win');
            
            // 配当がベット額の2倍（ベット額 + ベット額）であることを確認
            // 要件 9.6: 通常勝利時は1:1配当
            expect(payout).toBe(betAmount * 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('ブラックジャック勝利時の配当が3:2（1.5倍）である', () => {
      fc.assert(
        fc.property(
          // ベット額を生成（有効なチップ組み合わせ）
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
            
            // ベット額を計算
            const betAmount = chips.reduce((sum, chip) => sum + chip, 0);
            
            // ブラックジャック勝利の配当を計算
            const payout = bettingManager.calculatePayout(betAmount, 'blackjack');
            
            // 配当がベット額の2.5倍（ベット額 + ベット額 * 1.5）であることを確認
            // 要件 9.7: ブラックジャック勝利時は3:2配当
            expect(payout).toBe(betAmount * 2.5);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('引き分け（プッシュ）時にベット額が返却される', () => {
      fc.assert(
        fc.property(
          // ベット額を生成（有効なチップ組み合わせ）
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
            
            // ベット額を計算
            const betAmount = chips.reduce((sum, chip) => sum + chip, 0);
            
            // 引き分けの配当を計算
            const payout = bettingManager.calculatePayout(betAmount, 'push');
            
            // 配当がベット額と同じであることを確認（ベット額返却）
            // 要件 9.8: 引き分け時はベット額を返却
            expect(payout).toBe(betAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('敗北時にベット額が没収される（配当0）', () => {
      fc.assert(
        fc.property(
          // ベット額を生成（有効なチップ組み合わせ）
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
            
            // ベット額を計算
            const betAmount = chips.reduce((sum, chip) => sum + chip, 0);
            
            // 敗北の配当を計算
            const payout = bettingManager.calculatePayout(betAmount, 'lose');
            
            // 配当が0であることを確認（ベット額没収）
            // 要件 9.9: 敗北時はベット額を没収
            expect(payout).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('全ての結果タイプで配当計算が一貫している', () => {
      fc.assert(
        fc.property(
          // ベット額を生成
          fc.integer({ min: 1, max: 10000 }),
          // 結果タイプを生成
          fc.oneof(
            fc.constant('win'),
            fc.constant('blackjack'),
            fc.constant('push'),
            fc.constant('lose')
          ),
          (betAmount, result) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 配当を計算
            const payout = bettingManager.calculatePayout(betAmount, result);
            
            // 配当が数値であることを確認
            expect(typeof payout).toBe('number');
            expect(isFinite(payout)).toBe(true);
            expect(payout).toBeGreaterThanOrEqual(0);
            
            // 結果タイプに応じた配当を確認
            switch (result) {
              case 'win':
                // 1:1配当: ベット額の2倍
                expect(payout).toBe(betAmount * 2);
                break;
              case 'blackjack':
                // 3:2配当: ベット額の2.5倍
                expect(payout).toBe(betAmount * 2.5);
                break;
              case 'push':
                // ベット額返却
                expect(payout).toBe(betAmount);
                break;
              case 'lose':
                // ベット額没収
                expect(payout).toBe(0);
                break;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('配当計算が冪等性を持つ', () => {
      fc.assert(
        fc.property(
          // ベット額を生成
          fc.integer({ min: 1, max: 10000 }),
          // 結果タイプを生成
          fc.oneof(
            fc.constant('win'),
            fc.constant('blackjack'),
            fc.constant('push'),
            fc.constant('lose')
          ),
          (betAmount, result) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 同じ入力で複数回配当を計算
            const payout1 = bettingManager.calculatePayout(betAmount, result);
            const payout2 = bettingManager.calculatePayout(betAmount, result);
            const payout3 = bettingManager.calculatePayout(betAmount, result);
            
            // 全ての結果が同じであることを確認（冪等性）
            expect(payout1).toBe(payout2);
            expect(payout2).toBe(payout3);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('無効な結果タイプに対して安全に処理される', () => {
      fc.assert(
        fc.property(
          // ベット額を生成
          fc.integer({ min: 1, max: 10000 }),
          // 無効な結果タイプを生成
          fc.oneof(
            fc.constant('invalid'),
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(123),
            fc.constant({}),
            fc.constant([])
          ),
          (betAmount, invalidResult) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 無効な結果タイプで配当を計算
            const payout = bettingManager.calculatePayout(betAmount, invalidResult);
            
            // デフォルトで0が返されることを確認
            expect(payout).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('配当計算の数学的関係性が正しい', () => {
      fc.assert(
        fc.property(
          // ベット額を生成
          fc.integer({ min: 1, max: 10000 }),
          (betAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 各結果の配当を計算
            const payoutWin = bettingManager.calculatePayout(betAmount, 'win');
            const payoutBlackjack = bettingManager.calculatePayout(betAmount, 'blackjack');
            const payoutPush = bettingManager.calculatePayout(betAmount, 'push');
            const payoutLose = bettingManager.calculatePayout(betAmount, 'lose');
            
            // 配当の大小関係を確認
            // ブラックジャック > 通常勝利 > 引き分け > 敗北
            expect(payoutBlackjack).toBeGreaterThan(payoutWin);
            expect(payoutWin).toBeGreaterThan(payoutPush);
            expect(payoutPush).toBeGreaterThan(payoutLose);
            
            // 具体的な比率を確認
            // ブラックジャック配当 = 通常勝利配当 * 1.25
            expect(payoutBlackjack).toBe(payoutWin * 1.25);
            
            // 通常勝利配当 = 引き分け配当 * 2
            expect(payoutWin).toBe(payoutPush * 2);
            
            // 敗北配当 = 0
            expect(payoutLose).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('小数点を含むベット額でも正確に配当が計算される', () => {
      fc.assert(
        fc.property(
          // 小数点を含むベット額を生成
          fc.double({ min: 0.01, max: 10000, noNaN: true }),
          (betAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 各結果の配当を計算
            const payoutWin = bettingManager.calculatePayout(betAmount, 'win');
            const payoutBlackjack = bettingManager.calculatePayout(betAmount, 'blackjack');
            const payoutPush = bettingManager.calculatePayout(betAmount, 'push');
            const payoutLose = bettingManager.calculatePayout(betAmount, 'lose');
            
            // 配当が正しく計算されることを確認
            expect(payoutWin).toBeCloseTo(betAmount * 2, 10);
            expect(payoutBlackjack).toBeCloseTo(betAmount * 2.5, 10);
            expect(payoutPush).toBeCloseTo(betAmount, 10);
            expect(payoutLose).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('極端に大きなベット額でも配当計算が正確である', () => {
      fc.assert(
        fc.property(
          // 大きなベット額を生成
          fc.integer({ min: 1000000, max: 100000000 }),
          (betAmount) => {
            // BettingManagerを作成
            const bettingManager = new BettingManager();
            
            // 各結果の配当を計算
            const payoutWin = bettingManager.calculatePayout(betAmount, 'win');
            const payoutBlackjack = bettingManager.calculatePayout(betAmount, 'blackjack');
            const payoutPush = bettingManager.calculatePayout(betAmount, 'push');
            const payoutLose = bettingManager.calculatePayout(betAmount, 'lose');
            
            // 配当が正しく計算されることを確認
            expect(payoutWin).toBe(betAmount * 2);
            expect(payoutBlackjack).toBe(betAmount * 2.5);
            expect(payoutPush).toBe(betAmount);
            expect(payoutLose).toBe(0);
            
            // オーバーフローが発生していないことを確認
            expect(isFinite(payoutWin)).toBe(true);
            expect(isFinite(payoutBlackjack)).toBe(true);
            expect(isFinite(payoutPush)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
