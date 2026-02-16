// Main game initialization script
let gameUI;
let socketClient;

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Game page loaded');
    
    // Initialize UI and Socket components
    gameUI = new GameUI();
    socketClient = new SocketClient();
    
    // Connect UI and Socket
    socketClient.setGameUI(gameUI);
    
    // Override GameUI methods to use SocketClient
    gameUI.sendStartGame = () => {
        socketClient.startGame();
    };
    
    gameUI.sendPlayerAction = (action) => {
        socketClient.sendPlayerAction(action);
    };
    
    // ベッティング関連メソッドの統合
    gameUI.startBettingPhase = () => {
        socketClient.startBettingPhase();
    };
    
    gameUI.placeBet = () => {
        if (gameUI.currentBet === 0) {
            gameUI.showError('ベット額を選択してください');
            return;
        }
        
        if (gameUI.currentBet > gameUI.playerBalance) {
            gameUI.showError('残高が不足しています');
            return;
        }
        
        // SocketClientを通じてベットを送信
        socketClient.placeBet(gameUI.currentBet);
        
        // UIを更新
        if (gameUI.elements.placeBetBtn) {
            gameUI.elements.placeBetBtn.disabled = true;
        }
        gameUI.showMessage(`ベット配置: $${gameUI.currentBet.toLocaleString()}`);
    };
    
    gameUI.requestBalanceReset = () => {
        socketClient.resetBalance();
    };
    
    // Initialize with basic game state
    const initialGameState = {
        status: 'waiting',
        players: [],
        dealer: { hand: [], status: 'waiting' },
        currentPlayerIndex: -1
    };
    
    gameUI.updateDisplay(initialGameState);
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (socketClient) {
        socketClient.disconnect();
    }
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page hidden');
    } else {
        console.log('Page visible');
        // Ensure connection is active when page becomes visible
        if (socketClient && !socketClient.socket.connected) {
            socketClient.connect();
        }
    }
});