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
    const helpBtn = document.getElementById('help-btn');
    
    if (!popup) return;
    
    // Show popup initially
    popup.style.display = 'flex';
    
    // Close popup handlers
    const closePopup = () => {
        popup.style.display = 'none';
    };
    
    const openPopup = () => {
        popup.style.display = 'flex';
    };
    
    closeBtn.addEventListener('click', closePopup);
    okBtn.addEventListener('click', closePopup);
    
    // Help button to reopen popup
    if (helpBtn) {
        helpBtn.addEventListener('click', openPopup);
    }
    
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
        // Check if game is in progress
        if (gameUI && gameUI.gameState) {
            const status = gameUI.gameState.status;
            if (status === 'playing' || status === 'betting') {
                alert('ゲーム中は退出できません。\nゲームが終了するまでお待ちください。');
                return;
            }
        }
        
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
window.addEventListener('beforeunload', (e) => {
    // Warn if game is in progress
    if (gameUI && gameUI.gameState) {
        const status = gameUI.gameState.status;
        if (status === 'playing' || status === 'betting') {
            e.preventDefault();
            e.returnValue = 'ゲーム中です。本当に退出しますか？';
            return e.returnValue;
        }
    }
    
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
