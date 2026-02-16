// GameUI class for managing the game interface
class GameUI {
    constructor() {
        this.gameState = null;
        this.playerId = null;
        this.roomId = this.extractRoomId();
        this.currentBet = 0; // 現在のベット額
        this.playerBalance = 1000; // プレイヤーの残高
        
        // DOM elements
        this.elements = {
            roomName: document.getElementById('room-name'),
            playerCount: document.getElementById('player-count'),
            dealerHand: document.getElementById('dealer-hand'),
            dealerValue: document.getElementById('dealer-value'),
            playersGrid: document.getElementById('players-grid'),
            waitingArea: document.getElementById('waiting-area'),
            startGameBtn: document.getElementById('start-betting-btn'),
            actionButtons: document.getElementById('action-buttons'),
            hitBtn: document.getElementById('hit-btn'),
            standBtn: document.getElementById('stand-btn'),
            statusMessage: document.getElementById('status-message'),
            // ベッティング関連要素
            balanceDisplay: document.getElementById('balance-display'),
            balanceAmount: document.getElementById('balance-amount'),
            betAmount: document.getElementById('bet-amount'),
            bettingArea: document.getElementById('betting-area'),
            chipButtons: document.querySelectorAll('.chip-btn'),
            clearBetBtn: document.getElementById('clear-bet-btn'),
            placeBetBtn: document.getElementById('place-bet-btn'),
            payoutResult: document.getElementById('payout-result'),
            payoutTitle: document.getElementById('payout-title'),
            payoutMessage: document.getElementById('payout-message'),
            payoutAmount: document.getElementById('payout-amount')
        };
        
        this.initializeEventListeners();
    }
    
    extractRoomId() {
        const path = window.location.pathname;
        const match = path.match(/\/room\/(.+)/);
        return match ? match[1] : null;
    }
    
    initializeEventListeners() {
        // Start betting button
        if (this.elements.startGameBtn) {
            this.elements.startGameBtn.addEventListener('click', () => {
                this.startBettingPhase();
            });
        }
        
        // Action buttons
        if (this.elements.hitBtn) {
            this.elements.hitBtn.addEventListener('click', () => {
                this.sendPlayerAction('hit');
            });
        }
        
        if (this.elements.standBtn) {
            this.elements.standBtn.addEventListener('click', () => {
                this.sendPlayerAction('stand');
            });
        }
        
        // ベッティング関連イベントリスナー
        this.initializeBettingListeners();
    }
    
    /**
     * ベッティング関連のイベントリスナーを初期化
     */
    initializeBettingListeners() {
        // チップボタンのクリックイベント
        if (this.elements.chipButtons) {
            this.elements.chipButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const chipValue = parseInt(btn.dataset.value);
                    this.addChipToBet(chipValue);
                });
            });
        }
        
        // クリアボタン
        if (this.elements.clearBetBtn) {
            this.elements.clearBetBtn.addEventListener('click', () => {
                this.clearBet();
            });
        }
        
        // ベット確定ボタン
        if (this.elements.placeBetBtn) {
            this.elements.placeBetBtn.addEventListener('click', () => {
                this.placeBet();
            });
        }
    }
    
    // Update the entire game display
    updateDisplay(gameState) {
        this.gameState = gameState;
        
        if (this.elements.roomName) {
            this.elements.roomName.textContent = `ルーム ${this.roomId}`;
        }
        
        if (this.elements.playerCount) {
            const playerCount = gameState.players ? gameState.players.length : 0;
            this.elements.playerCount.textContent = `${playerCount} プレイヤー`;
        }
        
        this.updateGameStatus(gameState.status);
        this.updateStartButton(gameState);
        this.updateActionButtons(gameState);
        
        // Update dealer and players display
        if (gameState.dealer) {
            this.updateDealerHand(gameState.dealer);
        }
        
        if (gameState.players) {
            this.updatePlayersDisplay(gameState.players);
        }
    }
    
    updateGameStatus(status) {
        if (!this.elements.statusMessage) return;
        
        const statusMessages = {
            'waiting': 'ゲーム開始を待っています',
            'playing': 'ゲーム進行中',
            'finished': 'ゲーム終了'
        };
        
        this.elements.statusMessage.textContent = statusMessages[status] || 'ゲーム状態不明';
    }
    
    updateStartButton(gameState) {
        if (!this.elements.startGameBtn) return;
        
        const hasPlayers = gameState.players && gameState.players.length > 0;
        const isWaiting = gameState.status === 'waiting';
        
        console.log('updateStartButton:', {
            hasPlayers,
            playerCount: gameState.players ? gameState.players.length : 0,
            isWaiting,
            status: gameState.status
        });
        
        this.elements.startGameBtn.disabled = !hasPlayers || !isWaiting;
        
        if (gameState.status === 'playing') {
            this.elements.waitingArea.style.display = 'none';
        } else {
            this.elements.waitingArea.style.display = 'block';
        }
    }
    
    updateActionButtons(gameState) {
        if (!this.elements.actionButtons) return;
        
        const isPlaying = gameState.status === 'playing';
        const isMyTurn = this.isMyTurn(gameState);
        
        if (isPlaying) {
            this.elements.actionButtons.style.display = 'flex';
            
            // Check if current player has 21 - disable actions
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            const has21 = currentPlayer && currentPlayer.handValue === 21;
            
            this.elements.hitBtn.disabled = !isMyTurn || has21;
            this.elements.standBtn.disabled = !isMyTurn || has21;
            
            // Update status message for turn indication
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
    
    isMyTurn(gameState) {
        if (!gameState.players || gameState.players.length === 0) {
            return false;
        }
        
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        return currentPlayer && currentPlayer.id === this.playerId;
    }
    
    // Update dealer's hand display
    updateDealerHand(dealer) {
        if (!this.elements.dealerHand || !dealer) return;
        
        this.elements.dealerHand.innerHTML = '';
        
        if (dealer.hand && dealer.hand.length > 0) {
            dealer.hand.forEach((card, index) => {
                const cardElement = this.createCardElement(card);
                this.elements.dealerHand.appendChild(cardElement);
            });
        }
        
        // Update dealer's hand value
        if (this.elements.dealerValue) {
            if (dealer.status === 'waiting' || !dealer.hand || dealer.hand.length === 0) {
                this.elements.dealerValue.textContent = '-';
            } else {
                const value = this.calculateHandValue(dealer.hand);
                this.elements.dealerValue.textContent = value;
            }
        }
    }
    
    /**
     * Animate dealer action (card reveal)
     * @param {object} data - {action, card, handValue}
     */
    animateDealerAction(data) {
        console.log('Animating dealer action:', data);
        
        if (!this.elements.dealerHand) return;
        
        if (data.action === 'hit' && data.card) {
            // Create new card element with animation
            const cardElement = this.createCardElement(data.card);
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.5) translateY(-50px)';
            cardElement.style.transition = 'all 0.5s ease-out';
            
            this.elements.dealerHand.appendChild(cardElement);
            
            // Trigger animation
            setTimeout(() => {
                cardElement.style.opacity = '1';
                cardElement.style.transform = 'scale(1) translateY(0)';
            }, 50);
            
            // Update hand value
            if (this.elements.dealerValue && data.handValue) {
                setTimeout(() => {
                    this.elements.dealerValue.textContent = data.handValue;
                }, 300);
            }
        }
    }
    
    // Update players display
    updatePlayersDisplay(players) {
        if (!this.elements.playersGrid || !players) return;
        
        this.elements.playersGrid.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerCard = this.createPlayerCard(player, index);
            this.elements.playersGrid.appendChild(playerCard);
        });
    }
    
    // Create a card element
    createCardElement(card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        
        if (card.hidden) {
            cardDiv.classList.add('hidden');
            return cardDiv;
        }
        
        // Add suit class for color
        const suitClass = card.suit.toLowerCase();
        cardDiv.classList.add(suitClass);
        
        // Card rank
        const rankDiv = document.createElement('div');
        rankDiv.className = 'card-rank';
        rankDiv.textContent = card.rank;
        
        // Card suit symbol
        const suitDiv = document.createElement('div');
        suitDiv.className = 'card-suit';
        suitDiv.textContent = this.getSuitSymbol(card.suit);
        
        cardDiv.appendChild(rankDiv);
        cardDiv.appendChild(suitDiv);
        
        return cardDiv;
    }
    
    // Get suit symbol
    getSuitSymbol(suit) {
        const symbols = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };
        return symbols[suit.toLowerCase()] || suit;
    }
    
    // Create player card element
    createPlayerCard(player, index) {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        playerCard.dataset.playerId = player.id;
        
        // Add status classes
        if (player.id === this.playerId && this.gameState.currentPlayerIndex === index) {
            playerCard.classList.add('current-player');
        }
        
        if (player.status === 'bust') {
            playerCard.classList.add('bust');
        } else if (player.status === 'stand') {
            playerCard.classList.add('stand');
        } else if (player.status === 'blackjack') {
            playerCard.classList.add('blackjack');
        }
        
        // Player name
        const nameDiv = document.createElement('div');
        nameDiv.className = 'player-name';
        nameDiv.textContent = player.name || `プレイヤー ${index + 1}`;
        if (player.id === this.playerId) {
            nameDiv.textContent += ' (あなた)';
        }
        
        // Player hand
        const handDiv = document.createElement('div');
        handDiv.className = 'hand';
        
        if (player.hand && player.hand.length > 0) {
            player.hand.forEach(card => {
                const cardElement = this.createCardElement(card);
                handDiv.appendChild(cardElement);
            });
        }
        
        // Hand value
        const valueDiv = document.createElement('div');
        valueDiv.className = 'hand-value';
        if (player.hand && player.hand.length > 0) {
            const value = this.calculateHandValue(player.hand);
            valueDiv.textContent = `合計: ${value}`;
        } else {
            valueDiv.textContent = '-';
        }
        
        // Player status
        const statusDiv = document.createElement('div');
        statusDiv.className = 'player-status';
        statusDiv.textContent = this.getPlayerStatusText(player.status);
        
        playerCard.appendChild(nameDiv);
        playerCard.appendChild(handDiv);
        playerCard.appendChild(valueDiv);
        playerCard.appendChild(statusDiv);
        
        return playerCard;
    }
    
    // Get player status text
    getPlayerStatusText(status) {
        const statusTexts = {
            'waiting': '待機中',
            'playing': 'プレイ中',
            'stand': 'スタンド',
            'bust': 'バスト',
            'blackjack': 'ブラックジャック！'
        };
        return statusTexts[status] || '';
    }
    
    // Calculate hand value (with Ace handling)
    calculateHandValue(hand) {
        if (!hand || hand.length === 0) return 0;
        
        let value = 0;
        let aces = 0;
        
        hand.forEach(card => {
            if (card.hidden) return;
            
            if (card.rank === 'A') {
                aces++;
                value += 11;
            } else if (['K', 'Q', 'J'].includes(card.rank)) {
                value += 10;
            } else {
                value += parseInt(card.rank);
            }
        });
        
        // Adjust for Aces
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }
        
        return value;
    }
    
    // Send start game request
    sendStartGame() {
        console.log('Sending start game request');
        // This will be implemented when SocketClient is integrated
    }
    
    /**
     * ベッティングフェーズを開始
     * 注: 実際の送信処理はgame.jsでオーバーライドされます
     */
    startBettingPhase() {
        console.log('Starting betting phase');
        // この処理はgame.jsでオーバーライドされます
    }
    
    /**
     * チップをベットに追加
     * @param {number} chipValue - チップの額面
     */
    addChipToBet(chipValue) {
        // 残高チェック
        if (this.currentBet + chipValue > this.playerBalance) {
            this.showError('残高が不足しています');
            return;
        }
        
        // ベット額を更新
        this.currentBet += chipValue;
        this.updateBetDisplay();
        
        // ベット確定ボタンを有効化
        if (this.elements.placeBetBtn) {
            this.elements.placeBetBtn.disabled = this.currentBet === 0;
        }
        
        console.log(`Added chip: ${chipValue}, Current bet: ${this.currentBet}`);
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
        
        console.log('Bet cleared');
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
    
    /**
     * ベットを配置
     * 注: 実際の送信処理はgame.jsでオーバーライドされます
     */
    placeBet() {
        if (this.currentBet === 0) {
            this.showError('ベット額を選択してください');
            return;
        }
        
        if (this.currentBet > this.playerBalance) {
            this.showError('残高が不足しています');
            return;
        }
        
        console.log(`Placing bet: ${this.currentBet}`);
        
        // この処理はgame.jsでオーバーライドされます
    }
    
    /**
     * ベッティングエリアを表示
     */
    showBettingArea() {
        if (this.elements.bettingArea) {
            this.elements.bettingArea.style.display = 'block';
        }
        if (this.elements.waitingArea) {
            this.elements.waitingArea.style.display = 'none';
        }
        
        // ベットをリセット
        this.clearBet();
    }
    
    /**
     * ベッティングエリアを非表示
     */
    hideBettingArea() {
        if (this.elements.bettingArea) {
            this.elements.bettingArea.style.display = 'none';
        }
    }

    
    /**
     * 配当結果を表示（大きな画面オーバーレイ付き）
     * @param {object} result - 配当結果 {outcome, payout, newBalance}
     */
    showPayoutResult(result) {
        console.log('showPayoutResult called with:', result);
        
        // 大きな結果オーバーレイを表示
        const overlay = document.getElementById('result-overlay');
        const resultTitle = document.getElementById('result-title');
        const resultChips = document.getElementById('result-chips');
        const resultSubtitle = document.getElementById('result-subtitle');
        
        console.log('Overlay elements:', { overlay, resultTitle, resultChips, resultSubtitle });
        
        if (overlay && resultTitle && resultChips && resultSubtitle) {
            // 前のクラスをクリア
            overlay.className = 'result-overlay';
            
            let title = '';
            let subtitle = '';
            let chipsText = '';
            let overlayClass = '';
            
            switch (result.outcome) {
                case 'blackjack':
                    title = 'BLACKJACK!';
                    subtitle = '3:2配当獲得！';
                    chipsText = `+$${Math.abs(result.payout).toLocaleString()}`;
                    overlayClass = 'blackjack';
                    break;
                case 'win':
                    title = 'WIN!';
                    subtitle = 'おめでとうございます！';
                    chipsText = `+$${Math.abs(result.payout).toLocaleString()}`;
                    overlayClass = 'win';
                    break;
                case 'push':
                    title = 'PUSH';
                    subtitle = '引き分け';
                    chipsText = `$${this.currentBet.toLocaleString()}`;
                    overlayClass = 'push';
                    break;
                case 'lose':
                    title = 'LOSE...';
                    subtitle = '次回頑張りましょう';
                    chipsText = `-$${Math.abs(result.payout).toLocaleString()}`;
                    overlayClass = 'lose';
                    break;
            }
            
            console.log('Setting overlay content:', { title, chipsText, subtitle, overlayClass });
            
            resultTitle.textContent = title;
            resultChips.textContent = chipsText;
            resultSubtitle.textContent = subtitle;
            overlay.classList.add(overlayClass);
            
            // オーバーレイを表示
            overlay.style.display = 'flex';
            console.log('Overlay displayed');
            
            // 3秒後に非表示
            setTimeout(() => {
                overlay.style.display = 'none';
                console.log('Overlay hidden');
            }, 3000);
        } else {
            console.error('Overlay elements not found!');
        }
        
        // 残高を更新
        this.updateBalanceDisplay(result.newBalance);
        
        // 小さい配当結果も更新（既存の機能）
        if (!this.elements.payoutResult) return;
        
        // 結果に応じてスタイルを変更
        this.elements.payoutResult.classList.remove('lose', 'push');
        
        let title = '結果';
        let message = '';
        let amountText = '';
        
        switch (result.outcome) {
            case 'blackjack':
                title = 'ブラックジャック！';
                message = '3:2の配当を獲得しました！';
                amountText = `+${result.payout.toLocaleString()}`;
                break;
            case 'win':
                title = '勝利！';
                message = '1:1の配当を獲得しました！';
                amountText = `+${result.payout.toLocaleString()}`;
                break;
            case 'push':
                title = '引き分け';
                message = 'ベット額が返却されます';
                amountText = `${result.payout.toLocaleString()}`;
                this.elements.payoutResult.classList.add('push');
                break;
            case 'lose':
                title = '敗北';
                message = 'ベット額を失いました';
                amountText = `-${this.currentBet.toLocaleString()}`;
                this.elements.payoutResult.classList.add('lose');
                break;
        }
        
        if (this.elements.payoutTitle) {
            this.elements.payoutTitle.textContent = title;
        }
        if (this.elements.payoutMessage) {
            this.elements.payoutMessage.textContent = message;
        }
        if (this.elements.payoutAmount) {
            this.elements.payoutAmount.textContent = amountText;
        }
        
        // 配当結果を表示
        this.elements.payoutResult.style.display = 'block';
        
        // 5秒後に非表示
        setTimeout(() => {
            if (this.elements.payoutResult) {
                this.elements.payoutResult.style.display = 'none';
            }
        }, 5000);
    }
    
    /**
     * 配当結果を非表示
     */
    hidePayoutResult() {
        if (this.elements.payoutResult) {
            this.elements.payoutResult.style.display = 'none';
        }
    }
    
    // Send player action
    sendPlayerAction(action) {
        console.log(`Sending player action: ${action}`);
        // This will be implemented when SocketClient is integrated
    }
    
    // Display error message
    showError(message) {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = `エラー: ${message}`;
            this.elements.statusMessage.style.color = '#f44336';
        }
    }
    
    // Clear error message
    clearError() {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.style.color = '#FFD700';
        }
    }
    
    // Show success message
    showMessage(message) {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = message;
            this.elements.statusMessage.style.color = '#4CAF50';
            
            // Clear message after 3 seconds
            setTimeout(() => {
                if (this.gameState) {
                    this.updateGameStatus(this.gameState.status);
                }
            }, 3000);
        }
    }
    
    // Handle joined room event
    onJoinedRoom(data) {
        console.log('Joined room:', data);
        this.playerId = data.playerId;
        
        if (data.gameState) {
            console.log('Received game state:', data.gameState);
            this.updateDisplay(data.gameState);
        } else {
            console.warn('No game state received');
        }
        
        this.showMessage('ルームに参加しました');
    }
    
    // Handle player joined event
    onPlayerJoined(data) {
        console.log('Player joined:', data);
        
        if (this.elements.playerCount) {
            this.elements.playerCount.textContent = `${data.playerCount} プレイヤー`;
        }
        
        this.showMessage(`${data.player.name} が参加しました`);
    }
    
    // Handle player left event
    onPlayerLeft(data) {
        console.log('Player left:', data);
        
        if (this.elements.playerCount) {
            this.elements.playerCount.textContent = `${data.playerCount} プレイヤー`;
        }
        
        this.showMessage('プレイヤーが退出しました');
    }
    
    // Handle game started event
    onGameStarted(data) {
        console.log('Game started:', data);
        
        if (data.gameState) {
            this.updateDisplay(data.gameState);
        }
        
        this.showMessage('ゲームが開始されました！');
    }
    
    // Handle game ended event
    onGameEnded(data) {
        console.log('Game ended:', data);
        
        if (data.gameState) {
            this.updateDisplay(data.gameState);
        }
        
        // Display winners
        if (data.winners && data.winners.length > 0) {
            const isWinner = data.winners.includes(this.playerId);
            if (isWinner) {
                this.showMessage('勝利！おめでとうございます！');
            } else {
                this.showMessage('ゲーム終了');
            }
        } else {
            this.showMessage('ゲーム終了');
        }
        
        // Show message about waiting for new game
        setTimeout(() => {
            this.showMessage('5秒後に新しいゲームを開始できます...');
        }, 1000);
    }
    
    // Handle ready for new game event
    onReadyForNewGame(data) {
        console.log('Ready for new game:', data);
        
        if (data.gameState) {
            this.updateDisplay(data.gameState);
        }
        
        this.showMessage('新しいゲームを開始できます！');
    }
    
    // Handle game state update
    onGameStateUpdate(data) {
        console.log('Game state update:', data);
        
        if (data.gameState) {
            this.updateDisplay(data.gameState);
        }
    }
    
    /**
     * ベッティングフェーズ開始イベントを処理
     * @param {object} data - イベントデータ
     */
    onBettingPhaseStarted(data) {
        console.log('Betting phase started:', data);
        
        // ベッティングエリアを表示
        this.showBettingArea();
        
        // 残高を更新
        if (data.balance !== undefined) {
            this.updateBalanceDisplay(data.balance);
        }
        
        this.showMessage('ベットを配置してください');
    }
    
    /**
     * ベット配置成功イベントを処理
     * @param {object} data - イベントデータ {success, newBalance, currentBet}
     */
    onBetPlaced(data) {
        console.log('Bet placed:', data);
        
        if (data.success) {
            // 残高を更新
            this.updateBalanceDisplay(data.newBalance);
            
            // ベッティングエリアを非表示
            this.hideBettingArea();
            
            this.showMessage('ベットが確定しました。他のプレイヤーを待っています...');
        } else {
            this.showError(data.reason || 'ベット配置に失敗しました');
            
            // ベット確定ボタンを再度有効化
            if (this.elements.placeBetBtn) {
                this.elements.placeBetBtn.disabled = false;
            }
        }
    }
    
    /**
     * 配当結果イベントを処理
     * @param {object} data - 配当結果データ {outcome, payout, newBalance}
     */
    onPayoutResult(data) {
        console.log('onPayoutResult called with:', data);
        
        // 配当結果を表示
        this.showPayoutResult(data);
        
        // 残高不足チェック
        if (data.newBalance < 1) {
            setTimeout(() => {
                this.showBalanceResetOption();
            }, 3500); // オーバーレイが消えた後に表示
        }
    }
    
    /**
     * 残高更新イベントを処理
     * @param {object} data - 残高データ {balance}
     */
    onBalanceUpdated(data) {
        console.log('Balance updated:', data);
        
        if (data.balance !== undefined) {
            this.updateBalanceDisplay(data.balance);
        }
    }
    
    /**
     * 残高リセットオプションを表示
     */
    showBalanceResetOption() {
        if (!this.elements.statusMessage) return;
        
        this.elements.statusMessage.innerHTML = `
            残高が不足しています。
            <button id="reset-balance-btn" style="margin-left: 10px; padding: 5px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                残高をリセット
            </button>
        `;
        
        const resetBtn = document.getElementById('reset-balance-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.requestBalanceReset();
            });
        }
    }
    
    /**
     * 残高リセットをリクエスト
     */
    requestBalanceReset() {
        console.log('Requesting balance reset');
        // この処理はgame.jsでSocketClientと統合されます
    }
}
