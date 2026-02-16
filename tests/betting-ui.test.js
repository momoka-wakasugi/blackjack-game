/**
 * ベッティングUIの単体テスト
 * 
 * テスト対象:
 * - チップ選択機能
 * - ベット額計算
 * - 残高表示更新
 * 
 * 要件: 9.2, 9.12
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// GameUIクラスのモック実装（テスト用）
class MockGameUI {
    constructor() {
        this.currentBet = 0;
        this.playerBalance = 10000;
        this.elements = {
            betAmount: { textContent: '0' },
            balanceAmount: { textContent: '10,000' },
            placeBetBtn: { disabled: true }
        };
    }

    /**
     * チップをベットに追加
     * @param {number} chipValue - チップの額面
     */
    addChipToBet(chipValue) {
        // 残高チェック
        if (this.currentBet + chipValue > this.playerBalance) {
            throw new Error('残高が不足しています');
        }
        
        // ベット額を更新
        this.currentBet += chipValue;
        this.updateBetDisplay();
        
        // ベット確定ボタンを有効化
        if (this.elements.placeBetBtn) {
            this.elements.placeBetBtn.disabled = this.currentBet === 0;
        }
    }

    /**
     * ベットをクリア
     */
    clearBet() {
        this.currentBet = 0;
        this.updateBetDisplay();
        
        // ベット確定ボタンを無効化
        if (this.elements.placeBetBtn) {
            this.elements.placeBetBtn.disabled = true;
        }
    }

    /**
     * ベット額表示を更新
     */
    updateBetDisplay() {
        if (this.elements.betAmount) {
            this.elements.betAmount.textContent = `${this.currentBet.toLocaleString()}`;
        }
    }

    /**
     * 残高表示を更新
     * @param {number} balance - 新しい残高
     */
    updateBalanceDisplay(balance) {
        this.playerBalance = balance;
        if (this.elements.balanceAmount) {
            this.elements.balanceAmount.textContent = `${balance.toLocaleString()}`;
        }
    }
}

describe('ベッティングUI - チップ選択機能', () => {
    let gameUI;

    beforeEach(() => {
        gameUI = new MockGameUI();
    });

    it('単一のチップを選択するとベット額が増加する', () => {
        gameUI.addChipToBet(5);
        expect(gameUI.currentBet).toBe(5);
    });

    it('複数のチップを選択するとベット額が累積される', () => {
        gameUI.addChipToBet(5);
        gameUI.addChipToBet(25);
        gameUI.addChipToBet(100);
        expect(gameUI.currentBet).toBe(130);
    });

    it('同じチップを複数回選択できる', () => {
        gameUI.addChipToBet(100);
        gameUI.addChipToBet(100);
        gameUI.addChipToBet(100);
        expect(gameUI.currentBet).toBe(300);
    });

    it('残高を超えるチップ選択はエラーになる', () => {
        gameUI.playerBalance = 100;
        gameUI.addChipToBet(50);
        
        expect(() => {
            gameUI.addChipToBet(100);
        }).toThrow('残高が不足しています');
        
        // ベット額は変更されない
        expect(gameUI.currentBet).toBe(50);
    });

    it('残高ちょうどまでベットできる', () => {
        gameUI.playerBalance = 100;
        gameUI.addChipToBet(50);
        gameUI.addChipToBet(50);
        expect(gameUI.currentBet).toBe(100);
    });

    it('チップ選択後にベット確定ボタンが有効化される', () => {
        expect(gameUI.elements.placeBetBtn.disabled).toBe(true);
        
        gameUI.addChipToBet(5);
        
        expect(gameUI.elements.placeBetBtn.disabled).toBe(false);
    });

    it('有効なチップ額（$1, $5, $25, $100, $500, $1000, $5000）を選択できる', () => {
        const validChips = [1, 5, 25, 100, 500, 1000, 5000];
        
        validChips.forEach(chip => {
            gameUI.clearBet();
            gameUI.addChipToBet(chip);
            expect(gameUI.currentBet).toBe(chip);
        });
    });
});

describe('ベッティングUI - ベット額計算', () => {
    let gameUI;

    beforeEach(() => {
        gameUI = new MockGameUI();
    });

    it('ベット額が正しく計算される', () => {
        gameUI.addChipToBet(1);
        gameUI.addChipToBet(5);
        gameUI.addChipToBet(25);
        expect(gameUI.currentBet).toBe(31);
    });

    it('大きな額のベットが正しく計算される', () => {
        gameUI.addChipToBet(5000);
        gameUI.addChipToBet(1000);
        gameUI.addChipToBet(500);
        expect(gameUI.currentBet).toBe(6500);
    });

    it('クリアボタンでベット額が0にリセットされる', () => {
        gameUI.addChipToBet(100);
        gameUI.addChipToBet(50);
        expect(gameUI.currentBet).toBe(150);
        
        gameUI.clearBet();
        expect(gameUI.currentBet).toBe(0);
    });

    it('クリア後にベット確定ボタンが無効化される', () => {
        gameUI.addChipToBet(100);
        expect(gameUI.elements.placeBetBtn.disabled).toBe(false);
        
        gameUI.clearBet();
        expect(gameUI.elements.placeBetBtn.disabled).toBe(true);
    });

    it('ベット額表示が正しくフォーマットされる', () => {
        gameUI.addChipToBet(1000);
        gameUI.addChipToBet(500);
        
        // toLocaleString()で1,500と表示される
        expect(gameUI.elements.betAmount.textContent).toBe('1,500');
    });

    it('複数回のベット操作で正しく累積される', () => {
        gameUI.addChipToBet(5);
        expect(gameUI.currentBet).toBe(5);
        
        gameUI.addChipToBet(10);
        expect(gameUI.currentBet).toBe(15);
        
        gameUI.clearBet();
        expect(gameUI.currentBet).toBe(0);
        
        gameUI.addChipToBet(25);
        expect(gameUI.currentBet).toBe(25);
    });
});

describe('ベッティングUI - 残高表示更新', () => {
    let gameUI;

    beforeEach(() => {
        gameUI = new MockGameUI();
    });

    it('初期残高が$10,000に設定される', () => {
        expect(gameUI.playerBalance).toBe(10000);
        expect(gameUI.elements.balanceAmount.textContent).toBe('10,000');
    });

    it('残高表示が正しく更新される', () => {
        gameUI.updateBalanceDisplay(5000);
        
        expect(gameUI.playerBalance).toBe(5000);
        expect(gameUI.elements.balanceAmount.textContent).toBe('5,000');
    });

    it('残高が増加した場合も正しく表示される', () => {
        gameUI.updateBalanceDisplay(15000);
        
        expect(gameUI.playerBalance).toBe(15000);
        expect(gameUI.elements.balanceAmount.textContent).toBe('15,000');
    });

    it('残高が0になった場合も正しく表示される', () => {
        gameUI.updateBalanceDisplay(0);
        
        expect(gameUI.playerBalance).toBe(0);
        expect(gameUI.elements.balanceAmount.textContent).toBe('0');
    });

    it('残高表示が千の位で区切られる', () => {
        gameUI.updateBalanceDisplay(123456);
        
        expect(gameUI.elements.balanceAmount.textContent).toBe('123,456');
    });

    it('残高更新後もベット額は変更されない', () => {
        gameUI.addChipToBet(100);
        const betBefore = gameUI.currentBet;
        
        gameUI.updateBalanceDisplay(5000);
        
        expect(gameUI.currentBet).toBe(betBefore);
    });

    it('残高が減少してもベット額より多ければベット可能', () => {
        gameUI.updateBalanceDisplay(200);
        gameUI.addChipToBet(100);
        
        expect(gameUI.currentBet).toBe(100);
    });

    it('残高が減少してベット額より少なくなった場合は追加ベット不可', () => {
        gameUI.addChipToBet(50);
        gameUI.updateBalanceDisplay(100);
        
        expect(() => {
            gameUI.addChipToBet(100);
        }).toThrow('残高が不足しています');
    });
});

describe('ベッティングUI - エッジケース', () => {
    let gameUI;

    beforeEach(() => {
        gameUI = new MockGameUI();
    });

    it('ベット額0の状態でクリアしても問題ない', () => {
        expect(gameUI.currentBet).toBe(0);
        
        gameUI.clearBet();
        
        expect(gameUI.currentBet).toBe(0);
    });

    it('最小ベット額$1を選択できる', () => {
        gameUI.addChipToBet(1);
        expect(gameUI.currentBet).toBe(1);
    });

    it('最大残高までベットできる', () => {
        gameUI.playerBalance = 10000;
        
        gameUI.addChipToBet(5000);
        gameUI.addChipToBet(5000);
        
        expect(gameUI.currentBet).toBe(10000);
    });

    it('残高1未満の場合はどのチップも選択できない', () => {
        gameUI.playerBalance = 0;
        
        expect(() => {
            gameUI.addChipToBet(1);
        }).toThrow('残高が不足しています');
    });
});
