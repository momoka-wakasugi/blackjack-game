// Main game initialization script
let gameUI;
let socketClient;

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Game page loaded');
    
    // Show how-to-play popup on first visit
    showHowToPlayPopup();
    
    // Initialize UI and Socket components
    gameUI = new GameUI();
    socketClient = new SocketClient();
    
    // Connect UI and Socket
    socketClient.setGameUI(gameUI);
    
    // Setup exit button
    setupExitButton();
    
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
        gameUI.showMessage(`ベット配置: ${gameUI.currentBet.toLocaleString()}`);
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

// Show how-to-play popup
function showHowToPlayPopup() {
    const popup = document.getElementById('how-to-play-popup');
    const closeBtn = document.getElementById('close-popup-btn');
    const okBtn = document.getElementById('popup-ok-btn');
    
    if (!popup) return;
    
    // Show popup
    popup.style.display = 'flex';
    
    // Close popup handlers
    const closePopup = () => {
        popup.style.display = 'none';
    };
    
    closeBtn.addEventListener('click', closePopup);
    okBtn.addEventListener('click', closePopup);
    
    // Close on overlay click
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            closePopup();
        }
    });
}

// Setup exit button
function setupExitButton() {
    const exitBtn = document.getElementById('exit-room-btn');
    
    if (!exitBtn) return;
    
    exitBtn.addEventListener('click', () => {
        const confirmed = confirm('ルームから退出しますか？\n（残高などの情報は保持されません）');
        
        if (confirmed) {
            // Disconnect socket
            if (socketClient) {
                socketClient.disconnect();
            }
            
            // Redirect to room selection
            window.location.href = '/';
        }
    });
}

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
