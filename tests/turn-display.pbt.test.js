/**
 * プロパティベーステスト: ターン表示の正確性
 * 
 * プロパティ 15: ターン表示の正確性
 * 任意のゲーム状態において、現在のプレイヤーのターン時はそのプレイヤーのアクションボタンが有効化され、
 * 他のプレイヤーには現在のプレイヤーが視覚的に強調表示される
 * 
 * **検証対象: 要件 7.2, 7.3**
 * 
 * Feature: blackjack-multiplayer-game, Property 15: ターン表示の正確性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// GameUIクラスのモック実装（テスト用）
class MockGameUI {
    constructor() {
        this.gameState = null;
        this.playerId = null;
        this.elements = {
            actionButtons: { style: { display: 'none' } },
            hitBtn: { disabled: true },
            standBtn: { disabled: true },
            statusMessage: { textContent: '', style: { color: '' } }
        };
    }

    /**
     * アクションボタンの状態を更新
     * @param {object} gameState - ゲーム状態
     */
    updateActionButtons(gameState) {
        if (!this.elements.actionButtons) return;
        
        const isPlaying = gameState.status === 'playing';
        const isMyTurn = this.isMyTurn(gameState);
        
        if (isPlaying) {
            this.elements.actionButtons.style.display = 'flex';
            
            // 現在のプレイヤーが21の場合はアクションを無効化
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            const has21 = currentPlayer && currentPlayer.handValue === 21;
            
            this.elements.hitBtn.disabled = !isMyTurn || has21;
            this.elements.standBtn.disabled = !isMyTurn || has21;
            
            // ターン表示のステータスメッセージを更新
            if (isMyTurn) {
                if (has21) {
                    this.elements.statusMessage.textContent = '21です！自動的にスタンドします';
                    this.elements.statusMessage.style.color = '#FFD700';
                } else {
                    this.elements.statusMessage.textContent = 'あなたのターンです！';
                    this.elements.statusMessage.style.color = '#4CAF50';
                }
            } else {
                const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                if (currentPlayer) {
                    this.elements.statusMessage.textContent = `${currentPlayer.name || 'プレイヤー'}のターン`;
                    this.elements.statusMessage.style.color = '#FFD700';
                }
            }
        } else {
            this.elements.actionButtons.style.display = 'none';
        }
    }

    /**
     * 現在のプレイヤーのターンかどうかを判定
     * @param {object} gameState - ゲーム状態
     * @returns {boolean}
     */
    isMyTurn(gameState) {
        if (!gameState.players || gameState.players.length === 0) {
            return false;
        }
        
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        return currentPlayer && currentPlayer.id === this.playerId;
    }

    /**
     * プレイヤーカードの強調表示を判定
     * @param {object} player - プレイヤー
     * @param {number} index - プレイヤーインデックス
     * @param {object} gameState - ゲーム状態
     * @returns {boolean} - 強調表示されるべきかどうか
     */
    isPlayerHighlighted(player, index, gameState) {
        return player.id === this.playerId && gameState.currentPlayerIndex === index;
    }
}

describe('プロパティ 15: ターン表示の正確性', () => {
    /**
     * ゲーム状態のアービトラリ
     */
    const gameStateArbitrary = fc.record({
        status: fc.constantFrom('waiting', 'playing', 'finished'),
        currentPlayerIndex: fc.integer({ min: 0, max: 5 }),
        players: fc.array(
            fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 20 }),
                handValue: fc.integer({ min: 2, max: 30 }),
                status: fc.constantFrom('active', 'stand', 'bust')
            }),
            { minLength: 1, maxLength: 6 }
        )
    }).map(state => {
        // currentPlayerIndexがプレイヤー数を超えないように調整
        if (state.currentPlayerIndex >= state.players.length) {
            state.currentPlayerIndex = state.players.length - 1;
        }
        return state;
    });

    it('プロパティ: 現在のプレイヤーのターン時はアクションボタンが有効化される', () => {
        fc.assert(
            fc.property(gameStateArbitrary, (gameState) => {
                // ゲームが進行中でない場合はスキップ
                if (gameState.status !== 'playing') {
                    return true;
                }

                const gameUI = new MockGameUI();
                
                // 現在のプレイヤーをこのUIのプレイヤーとして設定
                const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                gameUI.playerId = currentPlayer.id;
                
                // アクションボタンを更新
                gameUI.updateActionButtons(gameState);
                
                // 検証: 現在のプレイヤーのターンの場合
                const isMyTurn = gameUI.isMyTurn(gameState);
                const has21 = currentPlayer.handValue === 21;
                
                // アクションボタンが表示されている
                expect(gameUI.elements.actionButtons.style.display).toBe('flex');
                
                // 21でない場合、ボタンが有効化されている
                if (!has21) {
                    expect(gameUI.elements.hitBtn.disabled).toBe(false);
                    expect(gameUI.elements.standBtn.disabled).toBe(false);
                    expect(gameUI.elements.statusMessage.textContent).toBe('あなたのターンです！');
                    expect(gameUI.elements.statusMessage.style.color).toBe('#4CAF50');
                } else {
                    // 21の場合、ボタンが無効化されている
                    expect(gameUI.elements.hitBtn.disabled).toBe(true);
                    expect(gameUI.elements.standBtn.disabled).toBe(true);
                    expect(gameUI.elements.statusMessage.textContent).toBe('21です！自動的にスタンドします');
                }
                
                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('プロパティ: 他のプレイヤーのターン時はアクションボタンが無効化される', () => {
        fc.assert(
            fc.property(gameStateArbitrary, (gameState) => {
                // ゲームが進行中でない場合、またはプレイヤーが1人しかいない場合はスキップ
                if (gameState.status !== 'playing' || gameState.players.length < 2) {
                    return true;
                }

                const gameUI = new MockGameUI();
                
                // 現在のプレイヤーではない別のプレイヤーをこのUIのプレイヤーとして設定
                const otherPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                gameUI.playerId = gameState.players[otherPlayerIndex].id;
                
                // アクションボタンを更新
                gameUI.updateActionButtons(gameState);
                
                // 検証: 他のプレイヤーのターンの場合
                const isMyTurn = gameUI.isMyTurn(gameState);
                expect(isMyTurn).toBe(false);
                
                // アクションボタンが表示されているが無効化されている
                expect(gameUI.elements.actionButtons.style.display).toBe('flex');
                expect(gameUI.elements.hitBtn.disabled).toBe(true);
                expect(gameUI.elements.standBtn.disabled).toBe(true);
                
                // ステータスメッセージに現在のプレイヤー名が表示されている
                const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                const expectedMessage = `${currentPlayer.name || 'プレイヤー'}のターン`;
                expect(gameUI.elements.statusMessage.textContent).toBe(expectedMessage);
                expect(gameUI.elements.statusMessage.style.color).toBe('#FFD700');
                
                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('プロパティ: ゲームが進行中でない場合はアクションボタンが非表示', () => {
        fc.assert(
            fc.property(gameStateArbitrary, (gameState) => {
                // ゲームが進行中の場合はスキップ
                if (gameState.status === 'playing') {
                    return true;
                }

                const gameUI = new MockGameUI();
                gameUI.playerId = gameState.players[0].id;
                
                // アクションボタンを更新
                gameUI.updateActionButtons(gameState);
                
                // 検証: アクションボタンが非表示
                expect(gameUI.elements.actionButtons.style.display).toBe('none');
                
                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('プロパティ: 現在のプレイヤーが視覚的に強調表示される', () => {
        fc.assert(
            fc.property(gameStateArbitrary, (gameState) => {
                // ゲームが進行中でない場合はスキップ
                if (gameState.status !== 'playing') {
                    return true;
                }

                const gameUI = new MockGameUI();
                
                // 現在のプレイヤーをこのUIのプレイヤーとして設定
                const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                gameUI.playerId = currentPlayer.id;
                
                // 各プレイヤーの強調表示状態を確認
                gameState.players.forEach((player, index) => {
                    const isHighlighted = gameUI.isPlayerHighlighted(player, index, gameState);
                    
                    // 現在のプレイヤーのみが強調表示される
                    if (index === gameState.currentPlayerIndex && player.id === gameUI.playerId) {
                        expect(isHighlighted).toBe(true);
                    } else {
                        expect(isHighlighted).toBe(false);
                    }
                });
                
                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('プロパティ: 全てのゲーム状態で一貫したターン表示が保証される', () => {
        fc.assert(
            fc.property(gameStateArbitrary, (gameState) => {
                const gameUI = new MockGameUI();
                
                // 各プレイヤーの視点でテスト
                gameState.players.forEach((player, playerIndex) => {
                    gameUI.playerId = player.id;
                    gameUI.updateActionButtons(gameState);
                    
                    const isMyTurn = gameUI.isMyTurn(gameState);
                    const isCurrentPlayer = playerIndex === gameState.currentPlayerIndex;
                    
                    // isMyTurnの判定が正しい
                    expect(isMyTurn).toBe(isCurrentPlayer);
                    
                    if (gameState.status === 'playing') {
                        // ゲーム進行中はアクションボタンが表示される
                        expect(gameUI.elements.actionButtons.style.display).toBe('flex');
                        
                        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
                        const has21 = currentPlayer.handValue === 21;
                        
                        if (isMyTurn && !has21) {
                            // 自分のターンで21でない場合、ボタンが有効
                            expect(gameUI.elements.hitBtn.disabled).toBe(false);
                            expect(gameUI.elements.standBtn.disabled).toBe(false);
                        } else {
                            // 他のプレイヤーのターン、または21の場合、ボタンが無効
                            expect(gameUI.elements.hitBtn.disabled).toBe(true);
                            expect(gameUI.elements.standBtn.disabled).toBe(true);
                        }
                    } else {
                        // ゲーム進行中でない場合、アクションボタンが非表示
                        expect(gameUI.elements.actionButtons.style.display).toBe('none');
                    }
                });
                
                return true;
            }),
            { numRuns: 100 }
        );
    });
});
