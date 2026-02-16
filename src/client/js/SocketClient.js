// SocketClient class for managing WebSocket communication
class SocketClient {
    constructor() {
        this.socket = io({
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            timeout: 10000
        });
        this.gameUI = null;
        this.roomId = this.extractRoomId();
        this.playerId = null;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.setupEventListeners();
        this.handleReconnection();
        this.connect();
    }
    
    extractRoomId() {
        const path = window.location.pathname;
        const match = path.match(/\/room\/(.+)/);
        return match ? match[1] : null;
    }
    
    setGameUI(gameUI) {
        this.gameUI = gameUI;
    }
    
    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket.id);
            this.playerId = this.socket.id;
            this.reconnectAttempts = 0;
            
            // If reconnecting, restore connection
            if (this.isReconnecting) {
                console.log('Reconnected successfully');
                this.isReconnecting = false;
                if (this.gameUI) {
                    this.gameUI.clearError();
                    this.gameUI.showMessage('サーバーに再接続しました');
                }
            }
            
            this.joinRoom();
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.isReconnecting = true;
            
            if (this.gameUI) {
                if (reason === 'io server disconnect') {
                    // Server disconnected the client
                    this.gameUI.showError('サーバーから切断されました。ページを再読み込みしてください。');
                } else if (reason === 'transport close' || reason === 'transport error') {
                    // Network issue
                    this.gameUI.showError('ネットワーク接続が切断されました。再接続を試みています...');
                } else if (reason === 'ping timeout') {
                    // Ping timeout
                    this.gameUI.showError('サーバーからの応答がありません。再接続を試みています...');
                } else {
                    // Other disconnection reasons
                    this.gameUI.showError('サーバーとの接続が切断されました。再接続を試みています...');
                }
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.reconnectAttempts++;
            
            if (this.gameUI) {
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.gameUI.showError('サーバーに接続できません。ページを再読み込みしてください。');
                } else if (!this.isReconnecting) {
                    this.gameUI.showError(`サーバーに接続できません。再試行中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                }
            }
        });
        
        this.socket.on('connect_timeout', () => {
            console.error('Connection timeout');
            if (this.gameUI) {
                this.gameUI.showError('サーバーへの接続がタイムアウトしました。再試行しています...');
            }
        });
        
        // Room events
        this.socket.on('joined-room', (data) => {
            console.log('Joined room successfully:', data);
            if (this.gameUI) {
                this.gameUI.onJoinedRoom(data);
            }
        });
        
        // Game state update - implements requirement 5.3, 8.4
        this.socket.on('game-state-update', (data) => {
            console.log('Game state updated:', data);
            if (this.gameUI) {
                this.gameUI.onGameStateUpdate(data);
            }
        });
        
        this.socket.on('player-joined', (data) => {
            console.log('Player joined:', data);
            if (this.gameUI) {
                this.gameUI.onPlayerJoined(data);
            }
        });
        
        this.socket.on('player-left', (data) => {
            console.log('Player left:', data);
            if (this.gameUI) {
                this.gameUI.onPlayerLeft(data);
            }
        });
        
        this.socket.on('game-started', (data) => {
            console.log('Game started:', data);
            if (this.gameUI) {
                this.gameUI.onGameStarted(data);
            }
        });
        
        this.socket.on('game-ended', (data) => {
            console.log('Game ended:', data);
            if (this.gameUI) {
                this.gameUI.onGameEnded(data);
            }
        });
        
        this.socket.on('ready-for-new-game', (data) => {
            console.log('Ready for new game:', data);
            if (this.gameUI) {
                this.gameUI.onReadyForNewGame(data);
            }
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            if (this.gameUI) {
                const errorMessage = this.getErrorMessage(error);
                this.gameUI.showError(errorMessage);
            }
        });
        
        this.socket.on('invalid-action', (data) => {
            console.error('Invalid action:', data);
            if (this.gameUI) {
                this.gameUI.showError(data.message || '無効なアクションです');
            }
        });
        
        // ベッティング関連イベント
        this.socket.on('betting-phase-started', (data) => {
            console.log('Betting phase started:', data);
            if (this.gameUI) {
                this.gameUI.onBettingPhaseStarted(data);
            }
        });
        
        this.socket.on('bet-placed', (data) => {
            console.log('Bet placed:', data);
            if (this.gameUI) {
                this.gameUI.onBetPlaced(data);
            }
        });
        
        this.socket.on('payout-result', (data) => {
            console.log('Payout result:', data);
            if (this.gameUI) {
                this.gameUI.onPayoutResult(data);
            }
        });
        
        this.socket.on('dealer-turn-start', (data) => {
            console.log('Dealer turn starting:', data);
            if (this.gameUI) {
                this.gameUI.showMessage('ディーラーのターン');
            }
        });
        
        this.socket.on('dealer-action', (data) => {
            console.log('Dealer action:', data);
            if (this.gameUI) {
                this.gameUI.animateDealerAction(data);
            }
        });
        
        this.socket.on('balance-updated', (data) => {
            console.log('Balance updated:', data);
            if (this.gameUI) {
                this.gameUI.onBalanceUpdated(data);
            }
        });
    }
    
    /**
     * Get user-friendly error message based on error code
     * Implements requirement 5.4 - Appropriate error messages
     */
    getErrorMessage(error) {
        const code = error.code;
        const defaultMessage = error.message || error.error || 'エラーが発生しました';
        
        const errorMessages = {
            'MISSING_ROOM_ID': 'ルームIDが指定されていません',
            'ROOM_NOT_FOUND': 'ルームが見つかりません',
            'ROOM_CREATION_FAILED': 'ルームを作成できませんでした',
            'JOIN_ROOM_FAILED': 'ルームに参加できませんでした',
            'JOIN_ROOM_ERROR': 'ルームへの参加中にエラーが発生しました',
            'NO_PLAYERS': 'プレイヤーが参加していません',
            'GAME_START_FAILED': 'ゲームを開始できませんでした',
            'START_GAME_ERROR': 'ゲーム開始中にエラーが発生しました',
            'INVALID_ACTION_DATA': '無効なアクションデータです',
            'GAME_NOT_STARTED': 'ゲームが開始されていません',
            'ACTION_PROCESSING_FAILED': 'アクションの処理に失敗しました',
            'ACTION_ERROR': 'アクション処理中にエラーが発生しました',
            'DEALER_TURN_ERROR': 'ディーラーターン処理中にエラーが発生しました',
            'INTERNAL_ERROR': 'サーバーエラーが発生しました。もう一度お試しください。',
            'CONNECTION_ERROR': '接続エラーが発生しました',
            'TIMEOUT_ERROR': '接続がタイムアウトしました'
        };
        
        return errorMessages[code] || defaultMessage;
    }
    
    connect() {
        if (!this.socket.connected) {
            this.socket.connect();
        }
    }
    
    disconnect() {
        if (this.socket.connected) {
            this.socket.disconnect();
        }
    }
    
    joinRoom() {
        if (this.roomId) {
            console.log(`Joining room: ${this.roomId}`);
            try {
                this.socket.emit('join-room', {
                    roomId: this.roomId,
                    playerId: this.playerId
                });
            } catch (error) {
                console.error('Error joining room:', error);
                if (this.gameUI) {
                    this.gameUI.showError('ルームへの参加中にエラーが発生しました');
                }
            }
        }
    }
    
    startGame() {
        console.log('Requesting game start');
        try {
            this.socket.emit('start-game', {
                roomId: this.roomId,
                playerId: this.playerId
            });
        } catch (error) {
            console.error('Error starting game:', error);
            if (this.gameUI) {
                this.gameUI.showError('ゲーム開始中にエラーが発生しました');
            }
        }
    }
    
    sendPlayerAction(action) {
        console.log(`Sending action: ${action}`);
        try {
            if (!this.isConnected()) {
                throw new Error('サーバーに接続されていません');
            }
            
            this.socket.emit('player-action', {
                roomId: this.roomId,
                playerId: this.playerId,
                action: action
            });
        } catch (error) {
            console.error('Error sending player action:', error);
            if (this.gameUI) {
                this.gameUI.showError('アクションの送信中にエラーが発生しました');
            }
        }
    }
    
    /**
     * ベッティングフェーズを開始
     */
    startBettingPhase() {
        console.log('Requesting betting phase start');
        try {
            if (!this.isConnected()) {
                throw new Error('サーバーに接続されていません');
            }
            
            this.socket.emit('start-betting', {
                roomId: this.roomId,
                playerId: this.playerId
            });
        } catch (error) {
            console.error('Error starting betting phase:', error);
            if (this.gameUI) {
                this.gameUI.showError('ベッティング開始中にエラーが発生しました');
            }
        }
    }
    
    /**
     * ベットを配置
     * @param {number} amount - ベット額
     */
    placeBet(amount) {
        console.log(`Placing bet: $${amount}`);
        try {
            if (!this.isConnected()) {
                throw new Error('サーバーに接続されていません');
            }
            
            this.socket.emit('place-bet', {
                roomId: this.roomId,
                playerId: this.playerId,
                amount: amount
            });
        } catch (error) {
            console.error('Error placing bet:', error);
            if (this.gameUI) {
                this.gameUI.showError('ベット配置中にエラーが発生しました');
            }
        }
    }
    
    /**
     * 残高リセットをリクエスト
     */
    resetBalance() {
        console.log('Requesting balance reset');
        try {
            if (!this.isConnected()) {
                throw new Error('サーバーに接続されていません');
            }
            
            this.socket.emit('reset-balance', {
                roomId: this.roomId,
                playerId: this.playerId
            });
        } catch (error) {
            console.error('Error resetting balance:', error);
            if (this.gameUI) {
                this.gameUI.showError('残高リセット中にエラーが発生しました');
            }
        }
    }
    
    // Auto-reconnection handling - implements requirement 5.3
    handleReconnection() {
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected after ${attemptNumber} attempts`);
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            
            if (this.gameUI) {
                this.gameUI.clearError();
                this.gameUI.showMessage('サーバーに再接続しました');
            }
            
            // Rejoin room to sync state
            this.joinRoom();
        });
        
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`Reconnection attempt ${attemptNumber}`);
            if (this.gameUI && attemptNumber <= this.maxReconnectAttempts) {
                this.gameUI.showError(`再接続を試みています... (${attemptNumber}/${this.maxReconnectAttempts}回目)`);
            }
        });
        
        this.socket.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
            if (this.gameUI) {
                this.gameUI.showError('再接続中にエラーが発生しました');
            }
        });
        
        this.socket.on('reconnect_failed', () => {
            console.error('Reconnection failed');
            this.isReconnecting = false;
            
            if (this.gameUI) {
                this.gameUI.showError('サーバーへの再接続に失敗しました。ページを再読み込みしてください。');
                
                // Show reload button
                const errorContainer = document.getElementById('error-message');
                if (errorContainer) {
                    const reloadButton = document.createElement('button');
                    reloadButton.textContent = 'ページを再読み込み';
                    reloadButton.className = 'btn btn-primary';
                    reloadButton.style.marginTop = '10px';
                    reloadButton.onclick = () => window.location.reload();
                    errorContainer.appendChild(reloadButton);
                }
            }
        });
    }
    
    // Retry connection with exponential backoff
    retryConnection(attempt = 1, maxAttempts = 3) {
        if (attempt > maxAttempts) {
            console.error('Max reconnection attempts reached');
            if (this.gameUI) {
                this.gameUI.showError('接続の再試行に失敗しました。ページを再読み込みしてください。');
            }
            return;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Retrying connection in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        
        setTimeout(() => {
            if (!this.socket.connected) {
                this.connect();
                this.retryConnection(attempt + 1, maxAttempts);
            }
        }, delay);
    }
    
    // Get connection status
    isConnected() {
        return this.socket.connected;
    }
    
    // Get player ID
    getPlayerId() {
        return this.playerId;
    }
    
    // Get room ID
    getRoomId() {
        return this.roomId;
    }
}
