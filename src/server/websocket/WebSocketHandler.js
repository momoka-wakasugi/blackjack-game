const GameEngine = require('../GameEngine');
const RoomManager = require('../RoomManager');
const Player = require('../game/Player');

/**
 * WebSocketHandler class for managing WebSocket communication
 * Implements requirements 1.2, 1.3, 1.4, 5.3, 8.4
 */
class WebSocketHandler {
  constructor(io) {
    this.io = io;
    this.gameEngine = new GameEngine();
    this.roomManager = new RoomManager();
    
    // Initialize default rooms
    this.initializeDefaultRooms();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize default rooms (Room 1, Room 2, Room 3)
   * Implements requirement 4.1
   */
  initializeDefaultRooms() {
    this.roomManager.createRoom('room1', 'ルーム1');
    this.roomManager.createRoom('room2', 'ルーム2');
    this.roomManager.createRoom('room3', 'ルーム3');
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('新しいクライアントが接続しました:', socket.id);

      // エラーハンドリングラッパー関数
      const wrapHandler = (handler) => {
        return async (data) => {
          try {
            await handler(socket, data);
          } catch (error) {
            console.error('イベントハンドラーでエラーが発生しました:', error);
            socket.emit('error', {
              message: 'サーバーエラーが発生しました。もう一度お試しください。',
              code: 'INTERNAL_ERROR'
            });
          }
        };
      };

      // プレイヤー参加処理
      socket.on('join-room', wrapHandler(this.handleJoinRoom.bind(this)));

      // プレイヤーアクション処理
      socket.on('player-action', wrapHandler(this.handlePlayerAction.bind(this)));

      // ゲーム開始処理
      socket.on('start-game', wrapHandler(this.handleStartGame.bind(this)));

      // ルームリスト取得
      socket.on('get-room-list', wrapHandler(this.handleGetRoomList.bind(this)));

      // ベッティング関連イベント
      socket.on('start-betting', wrapHandler(this.handleStartBetting.bind(this)));
      socket.on('place-bet', wrapHandler(this.handlePlaceBet.bind(this)));
      socket.on('reset-balance', wrapHandler(this.handleResetBalance.bind(this)));

      // 接続切断処理
      socket.on('disconnect', () => this.handleDisconnect(socket));

      // 接続エラー処理
      socket.on('error', (error) => {
        console.error('Socket接続エラー:', error);
        socket.emit('error', {
          message: '接続エラーが発生しました',
          code: 'CONNECTION_ERROR'
        });
      });

      // タイムアウト処理
      socket.on('connect_timeout', () => {
        console.error('Socket接続タイムアウト:', socket.id);
        socket.emit('error', {
          message: '接続がタイムアウトしました',
          code: 'TIMEOUT_ERROR'
        });
      });
    });

    // サーバーレベルのエラーハンドリング
    this.io.engine.on('connection_error', (error) => {
      console.error('Engine接続エラー:', error);
    });
  }

  /**
   * Broadcast room list update to all connected clients
   */
  broadcastRoomListUpdate() {
    const roomList = this.roomManager.getRoomList();
    
    // Convert array to object keyed by room ID
    const roomsObject = {};
    roomList.forEach(room => {
      roomsObject[room.id] = room;
    });
    
    this.io.emit('room-list-update', roomsObject);
  }

  /**
   * Handle player joining a room
   * Implements requirements 1.2, 1.3 - Add player to room and notify others
   * Enhanced with security validation (requirement 8.3)
   * @param {Socket} socket - The socket connection
   * @param {object} data - Join data containing roomId and playerId
   */
  handleJoinRoom(socket, data) {
    try {
      const { roomId, playerId, playerName } = data;

      // Enhanced input validation (requirement 8.3)
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        socket.emit('error', {
          message: 'ルームIDが指定されていません',
          code: 'MISSING_ROOM_ID'
        });
        return;
      }

      // Validate input lengths to prevent attacks
      if (roomId.length > 100) {
        socket.emit('error', {
          message: 'ルームIDが長すぎます',
          code: 'ROOM_ID_TOO_LONG'
        });
        return;
      }

      if (playerName && playerName.length > 50) {
        socket.emit('error', {
          message: 'プレイヤー名が長すぎます',
          code: 'PLAYER_NAME_TOO_LONG'
        });
        return;
      }

      // Prevent special characters that could cause issues
      if (/[<>\"']/.test(roomId)) {
        socket.emit('error', {
          message: 'ルームIDに無効な文字が含まれています',
          code: 'INVALID_ROOM_ID_FORMAT'
        });
        return;
      }

      // Get or create room
      let room = this.roomManager.getRoom(roomId);
      if (!room) {
        room = this.roomManager.createRoom(roomId, `ルーム ${roomId}`);
        if (!room) {
          socket.emit('error', {
            message: 'ルームを作成できませんでした',
            code: 'ROOM_CREATION_FAILED'
          });
          return;
        }
      }

      // Sanitize player name
      const sanitizedPlayerName = playerName 
        ? playerName.trim().substring(0, 50)
        : `プレイヤー${socket.id.substring(0, 4)}`;

      // Check if player already exists in room (reconnection scenario)
      let player = room.getPlayer(playerId || socket.id);
      
      if (player) {
        // Player reconnecting - update socket ID and connection status
        player.socketId = socket.id;
        player.setConnected(true);
        console.log(`プレイヤー ${player.name} が再接続しました (残高: $${player.balance})`);
      } else {
        // Create new player
        player = new Player(
          playerId || socket.id,
          sanitizedPlayerName,
          socket.id
        );
        
        // Initialize balance for new player (requirement 9.1)
        this.gameEngine.bettingManager.initializePlayerBalance(player);
        console.log(`新しいプレイヤー ${player.name} を作成しました (初期残高: $${player.balance})`);
      }

      // Add player to room (will skip if already exists)
      const result = this.roomManager.addPlayerToRoom(roomId, player);

      if (!result.success) {
        socket.emit('error', {
          message: result.message,
          code: 'JOIN_ROOM_FAILED'
        });
        return;
      }

      // Join socket.io room
      socket.join(roomId);

      // Store room info in socket
      socket.roomId = roomId;
      socket.playerId = player.id;

      // Send current game state to the joining player
      const gameState = room.gameState;
      socket.emit('joined-room', {
        roomId: roomId,
        playerId: player.id,
        gameState: gameState ? this.serializeGameState(gameState) : null,
        players: room.getPlayers().map(p => ({
          id: p.id,
          name: p.name,
          isConnected: p.isConnected
        }))
      });

      // Notify other players in the room (requirement 1.3)
      socket.to(roomId).emit('player-joined', {
        player: {
          id: player.id,
          name: player.name,
          isConnected: player.isConnected
        },
        playerCount: room.getPlayerCount()
      });

      // Broadcast room list update to all clients
      this.broadcastRoomListUpdate();

      console.log(`プレイヤー ${player.name} がルーム ${roomId} に参加しました`);
    } catch (error) {
      console.error('ルーム参加処理でエラーが発生しました:', error);
      socket.emit('error', {
        message: 'ルームへの参加中にエラーが発生しました',
        code: 'JOIN_ROOM_ERROR'
      });
    }
  }

  /**
   * Handle player action (hit or stand)
   * Enhanced with comprehensive validation (requirement 8.3)
   * @param {Socket} socket - The socket connection
   * @param {object} data - Action data containing roomId, playerId, and action
   */
  handlePlayerAction(socket, data) {
    try {
      const { roomId, playerId, action } = data;

      // Comprehensive input validation (requirement 8.3)
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        socket.emit('error', {
          message: 'ルームIDが無効です',
          code: 'INVALID_ROOM_ID'
        });
        return;
      }

      if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
        socket.emit('error', {
          message: 'プレイヤーIDが無効です',
          code: 'INVALID_PLAYER_ID'
        });
        return;
      }

      if (!action || typeof action !== 'string' || action.trim() === '') {
        socket.emit('error', {
          message: 'アクションが無効です',
          code: 'INVALID_ACTION'
        });
        return;
      }

      // Prevent injection attacks - validate input lengths
      if (roomId.length > 100 || playerId.length > 100 || action.length > 20) {
        socket.emit('error', {
          message: '入力データが長すぎます',
          code: 'INPUT_TOO_LONG'
        });
        return;
      }

      // Validate action is from the correct socket (prevent impersonation)
      if (socket.playerId && socket.playerId !== playerId) {
        socket.emit('error', {
          message: '認証エラー: プレイヤーIDが一致しません',
          code: 'AUTHENTICATION_ERROR'
        });
        return;
      }

      // Validate socket is in the correct room
      if (socket.roomId && socket.roomId !== roomId) {
        socket.emit('error', {
          message: '認証エラー: ルームIDが一致しません',
          code: 'ROOM_MISMATCH'
        });
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', {
          message: 'ルームが見つかりません',
          code: 'ROOM_NOT_FOUND'
        });
        return;
      }

      const gameState = room.gameState;
      if (!gameState) {
        socket.emit('error', {
          message: 'ゲームが開始されていません',
          code: 'GAME_NOT_STARTED'
        });
        return;
      }

      // Use GameEngine's comprehensive validation (requirement 8.2, 8.3)
      const validation = this.gameEngine.validateAction(gameState, playerId, action);
      if (!validation.valid) {
        socket.emit('error', {
          message: validation.reason,
          code: 'ACTION_VALIDATION_FAILED'
        });
        return;
      }

      // Process the action
      const result = this.gameEngine.processPlayerAction(gameState, playerId, action);

      if (!result.success) {
        socket.emit('error', {
          message: result.message,
          code: 'ACTION_PROCESSING_FAILED'
        });
        return;
      }

      // Broadcast updated game state to all players in the room (requirement 5.3, 8.4)
      this.broadcastGameState(roomId, gameState);

      // Check if dealer should play
      if (this.gameEngine.shouldDealerPlay(gameState)) {
        this.playDealerTurnAsync(roomId, gameState);
      }
    } catch (error) {
      console.error('プレイヤーアクション処理でエラーが発生しました:', error);
      socket.emit('error', {
        message: 'アクション処理中にエラーが発生しました',
        code: 'ACTION_ERROR'
      });
    }
  }

  /**
   * Handle game start request
   * Enhanced with security validation (requirement 8.3)
   * @param {Socket} socket - The socket connection
   * @param {object} data - Start game data containing roomId
   */
  handleStartGame(socket, data) {
    try {
      const { roomId } = data;

      // Enhanced input validation (requirement 8.3)
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        socket.emit('error', {
          message: 'ルームIDが指定されていません',
          code: 'MISSING_ROOM_ID'
        });
        return;
      }

      // Validate input length
      if (roomId.length > 100) {
        socket.emit('error', {
          message: 'ルームIDが長すぎます',
          code: 'ROOM_ID_TOO_LONG'
        });
        return;
      }

      // Validate socket is in the room (prevent unauthorized game start)
      if (socket.roomId !== roomId) {
        socket.emit('error', {
          message: '認証エラー: このルームでゲームを開始する権限がありません',
          code: 'UNAUTHORIZED_START'
        });
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', {
          message: 'ルームが見つかりません',
          code: 'ROOM_NOT_FOUND'
        });
        return;
      }

      // Check if game can start (at least one player)
      if (room.getPlayerCount() === 0) {
        socket.emit('error', {
          message: 'プレイヤーが参加していません',
          code: 'NO_PLAYERS'
        });
        return;
      }

      // Prevent starting if game is already in progress
      if (room.isGameInProgress) {
        socket.emit('error', {
          message: 'ゲームは既に進行中です',
          code: 'GAME_ALREADY_IN_PROGRESS'
        });
        return;
      }

      // Start the game
      const started = room.startGame();
      if (!started) {
        socket.emit('error', {
          message: 'ゲームを開始できませんでした',
          code: 'GAME_START_FAILED'
        });
        return;
      }

      const gameState = room.gameState;

      // Broadcast game started to all players in the room
      this.io.to(roomId).emit('game-started', {
        gameState: this.serializeGameState(gameState)
      });

      // Broadcast initial game state
      this.broadcastGameState(roomId, gameState);

      // Broadcast room list update to all clients
      this.broadcastRoomListUpdate();

      console.log(`ルーム ${roomId} でゲームが開始されました`);
    } catch (error) {
      console.error('ゲーム開始処理でエラーが発生しました:', error);
      socket.emit('error', {
        message: 'ゲーム開始中にエラーが発生しました',
        code: 'START_GAME_ERROR'
      });
    }
  }

  /**
   * Handle room list request
   * Implements requirement 4.2 - Display available rooms and player counts
   * @param {Socket} socket - The socket connection
   */
  handleGetRoomList(socket) {
    const roomList = this.roomManager.getRoomList();
    
    // Convert array to object keyed by room ID for easier client access
    const roomsObject = {};
    roomList.forEach(room => {
      roomsObject[room.id] = room;
    });
    
    socket.emit('room-list', roomsObject);
  }

  /**
   * Handle start betting request
   * Implements requirement 9.2 - Display betting interface before game
   * @param {Socket} socket - The socket connection
   * @param {object} data - Request data containing roomId
   */
  handleStartBetting(socket, data) {
    try {
      const { roomId } = data;

      // Input validation
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        socket.emit('error', {
          message: 'ルームIDが指定されていません',
          code: 'MISSING_ROOM_ID'
        });
        return;
      }

      // Validate socket is in the room
      if (socket.roomId !== roomId) {
        socket.emit('error', {
          message: '認証エラー: このルームでベッティングを開始する権限がありません',
          code: 'UNAUTHORIZED_BETTING'
        });
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', {
          message: 'ルームが見つかりません',
          code: 'ROOM_NOT_FOUND'
        });
        return;
      }

      // Check if there are players
      if (room.getPlayerCount() === 0) {
        socket.emit('error', {
          message: 'プレイヤーが参加していません',
          code: 'NO_PLAYERS'
        });
        return;
      }

      // Check if game is already in progress
      if (room.isGameInProgress) {
        socket.emit('error', {
          message: 'ゲームは既に進行中です',
          code: 'GAME_ALREADY_IN_PROGRESS'
        });
        return;
      }

      // Start betting phase
      const started = room.startBettingPhase();
      if (!started) {
        socket.emit('error', {
          message: 'ベッティングフェーズを開始できませんでした',
          code: 'BETTING_START_FAILED'
        });
        return;
      }

      // Broadcast betting phase started to all players in the room
      // Send each player their current balance individually
      const players = room.getPlayers();
      players.forEach(player => {
        const playerSocket = this.findPlayerSocket(roomId, player.id);
        if (playerSocket) {
          playerSocket.emit('betting-phase-started', {
            balance: player.balance
          });
        }
      });

      console.log(`ルーム ${roomId} でベッティングフェーズが開始されました`);
    } catch (error) {
      console.error('ベッティング開始処理でエラーが発生しました:', error);
      socket.emit('error', {
        message: 'ベッティング開始中にエラーが発生しました',
        code: 'START_BETTING_ERROR'
      });
    }
  }

  /**
   * Handle place bet request
   * Implements requirement 9.2 - Accept and validate bets
   * @param {Socket} socket - The socket connection
   * @param {object} data - Bet data containing roomId, playerId, and amount
   */
  handlePlaceBet(socket, data) {
    try {
      const { roomId, playerId, amount } = data;

      // Input validation
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        socket.emit('error', {
          message: 'ルームIDが無効です',
          code: 'INVALID_ROOM_ID'
        });
        return;
      }

      if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
        socket.emit('error', {
          message: 'プレイヤーIDが無効です',
          code: 'INVALID_PLAYER_ID'
        });
        return;
      }

      if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
        socket.emit('error', {
          message: 'ベット額が無効です',
          code: 'INVALID_BET_AMOUNT'
        });
        return;
      }

      // Validate socket ownership
      if (socket.playerId !== playerId) {
        socket.emit('error', {
          message: '認証エラー: プレイヤーIDが一致しません',
          code: 'AUTHENTICATION_ERROR'
        });
        return;
      }

      if (socket.roomId !== roomId) {
        socket.emit('error', {
          message: '認証エラー: ルームIDが一致しません',
          code: 'ROOM_MISMATCH'
        });
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', {
          message: 'ルームが見つかりません',
          code: 'ROOM_NOT_FOUND'
        });
        return;
      }

      const gameState = room.gameState;
      if (!gameState) {
        socket.emit('error', {
          message: 'ゲーム状態が見つかりません',
          code: 'GAME_STATE_NOT_FOUND'
        });
        return;
      }

      // Place bet using GameEngine
      const result = this.gameEngine.placeBet(gameState, playerId, amount);

      // Send result to the player
      socket.emit('bet-placed', result);

      if (result.success) {
        // Notify other players that this player has placed a bet
        socket.to(roomId).emit('player-bet-placed', {
          playerId: playerId,
          playerName: gameState.getPlayer(playerId)?.name
        });

        // Check if all players have bet
        if (room.allPlayersHaveBet()) {
          // Start the game automatically
          const gameStarted = room.startGame();
          
          if (gameStarted) {
            // Broadcast game started to all players
            this.io.to(roomId).emit('game-started', {
              gameState: this.serializeGameState(gameState)
            });

            // Broadcast initial game state
            this.broadcastGameState(roomId, gameState);

            // Check if all players have blackjack or are done
            // If so, start dealer's turn immediately
            if (gameState.currentPlayerIndex === -1) {
              console.log(`ルーム ${roomId} で全プレイヤーがブラックジャック、ディーラーのターンを開始`);
              setTimeout(() => {
                this.playDealerTurnAsync(roomId, gameState);
              }, 1000);
            }

            console.log(`ルーム ${roomId} で全員がベットし、ゲームが開始されました`);
          }
        }
      }

      console.log(`プレイヤー ${playerId} がベット配置: $${amount}, 成功: ${result.success}`);
    } catch (error) {
      console.error('ベット配置処理でエラーが発生しました:', error);
      socket.emit('error', {
        message: 'ベット配置中にエラーが発生しました',
        code: 'PLACE_BET_ERROR'
      });
    }
  }

  /**
   * Handle reset balance request
   * Implements requirement 9.11 - Reset balance when insufficient
   * @param {Socket} socket - The socket connection
   * @param {object} data - Request data containing roomId and playerId
   */
  handleResetBalance(socket, data) {
    try {
      const { roomId, playerId } = data;

      // Input validation
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        socket.emit('error', {
          message: 'ルームIDが無効です',
          code: 'INVALID_ROOM_ID'
        });
        return;
      }

      if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
        socket.emit('error', {
          message: 'プレイヤーIDが無効です',
          code: 'INVALID_PLAYER_ID'
        });
        return;
      }

      // Validate socket ownership
      if (socket.playerId !== playerId) {
        socket.emit('error', {
          message: '認証エラー: プレイヤーIDが一致しません',
          code: 'AUTHENTICATION_ERROR'
        });
        return;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', {
          message: 'ルームが見つかりません',
          code: 'ROOM_NOT_FOUND'
        });
        return;
      }

      const player = room.getPlayer(playerId);
      if (!player) {
        socket.emit('error', {
          message: 'プレイヤーが見つかりません',
          code: 'PLAYER_NOT_FOUND'
        });
        return;
      }

      // Reset balance using BettingManager
      this.gameEngine.bettingManager.resetBalance(player);

      // Send updated balance to the player
      socket.emit('balance-updated', {
        balance: player.balance
      });

      console.log(`プレイヤー ${playerId} の残高がリセットされました: $${player.balance}`);
    } catch (error) {
      console.error('残高リセット処理でエラーが発生しました:', error);
      socket.emit('error', {
        message: '残高リセット中にエラーが発生しました',
        code: 'RESET_BALANCE_ERROR'
      });
    }
  }

  /**
   * Handle player disconnect
   * Implements requirement 1.4 - Remove player from room and notify others
   * @param {Socket} socket - The socket connection
   */
  handleDisconnect(socket) {
    console.log('クライアントが切断されました:', socket.id);

    const roomId = socket.roomId;
    const playerId = socket.playerId;

    if (!roomId || !playerId) {
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      return;
    }

    // Remove player from room
    const removed = this.roomManager.removePlayerFromRoom(roomId, playerId);

    if (removed) {
      // Notify other players in the room (requirement 1.4)
      socket.to(roomId).emit('player-left', {
        playerId: playerId,
        playerCount: room.getPlayerCount()
      });

      // Broadcast room list update to all clients
      this.broadcastRoomListUpdate();

      // If game is in progress, broadcast updated state
      const gameState = room.gameState;
      if (gameState && gameState.status === 'playing') {
        this.broadcastGameState(roomId, gameState);

        // Check if dealer should play (if all remaining players are done)
        if (this.gameEngine.shouldDealerPlay(gameState)) {
          this.playDealerTurnAsync(roomId, gameState);
        }
      }

      console.log(`プレイヤー ${playerId} がルーム ${roomId} から退出しました`);
    }
  }

  /**
   * Broadcast game state to all players in a room
   * Implements requirements 5.3, 8.4 - Real-time state synchronization
   * @param {string} roomId - The room ID
   * @param {GameState} gameState - The game state to broadcast
   */
  broadcastGameState(roomId, gameState) {
    this.io.to(roomId).emit('game-state-update', {
      gameState: this.serializeGameState(gameState)
    });
  }

  /**
   * Play dealer turn asynchronously
   * @param {string} roomId - The room ID
   * @param {GameState} gameState - The game state
   */
  async playDealerTurnAsync(roomId, gameState) {
    try {
      // Small delay before dealer starts
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Notify clients that dealer is starting
      this.io.to(roomId).emit('dealer-turn-start', {
        message: 'ディーラーのターン開始'
      });

      const result = await this.gameEngine.playDealerTurn(gameState);

      if (result.success) {
        // Send each dealer action to clients for animation
        if (result.actions && result.actions.length > 0) {
          for (const action of result.actions) {
            this.io.to(roomId).emit('dealer-action', {
              action: action.action,
              card: action.card,
              handValue: action.handValue
            });
            // Wait a bit between actions for animation
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
        
        // Broadcast updated state after dealer plays
        this.broadcastGameState(roomId, gameState);

        // Determine winners and calculate payouts
        const winResult = this.gameEngine.determineWinners(gameState);
        
        // Get payouts from winResult (already calculated in determineWinners)
        const payouts = winResult.payouts || [];

        // Get room to update its state
        const room = this.roomManager.getRoom(roomId);
        if (room) {
          room.endGame();
        }

        // Broadcast game ended with results
        this.io.to(roomId).emit('game-ended', {
          winners: winResult.winners,
          dealerHandValue: winResult.dealerHandValue,
          dealerStatus: winResult.dealerStatus,
          players: winResult.players,
          gameState: this.serializeGameState(gameState)
        });

        // Send payout results to each player individually (requirement 9.10)
        payouts.forEach(payout => {
          const playerSocket = this.findPlayerSocket(roomId, payout.playerId);
          if (playerSocket) {
            playerSocket.emit('payout-result', payout);
          }
        });

        // Broadcast room list update to all clients
        this.broadcastRoomListUpdate();

        console.log(`ルーム ${roomId} のゲームが終了しました`);

        // Implements requirement 3.5 - Allow new game start after 5 seconds
        setTimeout(() => {
          if (room) {
            room.resetGame();
            
            // Broadcast that room is ready for new game
            this.io.to(roomId).emit('ready-for-new-game', {
              gameState: this.serializeGameState(room.gameState)
            });
            
            // Broadcast room list update
            this.broadcastRoomListUpdate();
            
            console.log(`ルーム ${roomId} が新しいゲームの準備完了`);
          }
        }, 5000);
      } else {
        throw new Error('ディーラーターンの処理に失敗しました');
      }
    } catch (error) {
      console.error('ディーラーターンでエラーが発生しました:', error);
      this.io.to(roomId).emit('error', {
        message: 'ゲーム処理中にエラーが発生しました',
        code: 'DEALER_TURN_ERROR'
      });
      
      // Try to recover by resetting the game
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        room.resetGame();
        this.io.to(roomId).emit('ready-for-new-game', {
          gameState: this.serializeGameState(room.gameState)
        });
      }
    }
  }

  /**
   * Find a player's socket in a room
   * @param {string} roomId - The room ID
   * @param {string} playerId - The player ID
   * @returns {Socket|null} The socket or null if not found
   */
  findPlayerSocket(roomId, playerId) {
    const sockets = this.io.sockets.adapter.rooms.get(roomId);
    if (!sockets) return null;

    for (const socketId of sockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && socket.playerId === playerId) {
        return socket;
      }
    }
    return null;
  }

  /**
   * Serialize game state for transmission
   * @param {GameState} gameState - The game state to serialize
   * @returns {object} Serialized game state
   */
  serializeGameState(gameState) {
    if (!gameState) {
      return null;
    }

    return {
      roomId: gameState.roomId,
      status: gameState.status,
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        hand: p.currentHand,
        handValue: p.handValue,
        status: p.status,
        isConnected: p.isConnected
      })),
      dealer: {
        hand: gameState.dealer.hand,
        handValue: gameState.dealer.handValue,
        status: gameState.dealer.status
      },
      currentPlayerIndex: gameState.currentPlayerIndex,
      currentPlayer: gameState.getCurrentPlayer() ? {
        id: gameState.getCurrentPlayer().id,
        name: gameState.getCurrentPlayer().name
      } : null,
      winners: gameState.winners,
      gameStartTime: gameState.gameStartTime,
      lastActionTime: gameState.lastActionTime
    };
  }

  /**
   * Get room manager instance (for testing)
   * @returns {RoomManager} The room manager instance
   */
  getRoomManager() {
    return this.roomManager;
  }

  /**
   * Get game engine instance (for testing)
   * @returns {GameEngine} The game engine instance
   */
  getGameEngine() {
    return this.gameEngine;
  }
}

module.exports = WebSocketHandler;
