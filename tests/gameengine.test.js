const GameEngine = require('../src/server/GameEngine');
const GameState = require('../src/server/game/GameState');
const Player = require('../src/server/game/Player');

describe('GameEngine', () => {
  let gameEngine;
  let gameState;

  beforeEach(() => {
    gameEngine = new GameEngine();
    gameState = new GameState('test-room');
  });

  describe('Player Action Processing (Requirements 6.2, 6.3)', () => {
    test('should process hit action and deal card', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      // Skip test if player got blackjack on initial deal
      if (player1.status === 'blackjack') {
        expect(player1.handValue).toBe(21);
        return;
      }

      const initialHandSize = player1.currentHand.length;
      const result = gameEngine.processPlayerAction(gameState, 'p1', 'hit');

      expect(result.success).toBe(true);
      expect(player1.currentHand.length).toBe(initialHandSize + 1);
      // Message can be either 'Card dealt' or 'Player busted' depending on the card
      expect(['Card dealt', 'Player busted']).toContain(result.message);
    });

    test('should process stand action and move to next player', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Skip test if player got blackjack on initial deal
      if (player1.status === 'blackjack') {
        expect(player1.handValue).toBe(21);
        return;
      }

      expect(gameState.currentPlayerIndex).toBe(0);
      
      const result = gameEngine.processPlayerAction(gameState, 'p1', 'stand');

      expect(result.success).toBe(true);
      expect(player1.status).toBe('stand');
      expect(result.nextPlayer).toBe('p2');
      expect(gameState.currentPlayerIndex).toBe(1);
    });

    test('should automatically move to next player when player busts', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Force player to bust by adding high cards
      while (player1.handValue <= 21) {
        const result = gameEngine.processPlayerAction(gameState, 'p1', 'hit');
        if (result.playerBusted) {
          expect(result.success).toBe(true);
          expect(player1.status).toBe('bust');
          expect(result.nextPlayer).toBe('p2');
          break;
        }
      }
    });

    test('should not process action when game is not in progress', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      // Don't start game

      const result = gameEngine.processPlayerAction(gameState, 'p1', 'hit');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Game is not in progress');
    });

    test('should not process action for non-existent player', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      const result = gameEngine.processPlayerAction(gameState, 'nonexistent', 'hit');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Player not found');
    });

    test('should not process action when not player\'s turn (Requirement 8.2)', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Try to make player 2 act when it's player 1's turn
      const result = gameEngine.processPlayerAction(gameState, 'p2', 'hit');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not player\'s turn');
    });

    test('should not process action for busted player', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      // Force player to bust
      while (player1.handValue <= 21) {
        gameEngine.processPlayerAction(gameState, 'p1', 'hit');
      }

      // Try to act after bust
      const result = gameEngine.processPlayerAction(gameState, 'p1', 'hit');

      expect(result.success).toBe(false);
    });

    test('should reject invalid action type', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      const result = gameEngine.processPlayerAction(gameState, 'p1', 'invalid');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid action type');
    });

    test('should handle empty deck gracefully', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      // Set player status to playing to allow action
      player1.setStatus('playing');
      // Set as current player
      gameState.currentPlayerIndex = 0;

      // Empty the deck
      while (!gameState.deck.isEmpty()) {
        gameState.deck.dealCard();
      }

      const result = gameEngine.processPlayerAction(gameState, 'p1', 'hit');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No cards left in deck');
    });
  });

  describe('Turn Management', () => {
    test('should correctly identify when all players are done', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      expect(gameEngine.shouldDealerPlay(gameState)).toBe(false);

      // Both players stand
      gameEngine.processPlayerAction(gameState, 'p1', 'stand');
      gameEngine.processPlayerAction(gameState, 'p2', 'stand');

      expect(gameEngine.shouldDealerPlay(gameState)).toBe(true);
    });

    test('should update game state correctly', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      const stateInfo = gameEngine.updateGameState(gameState);

      expect(stateInfo.status).toBe('playing');
      expect(stateInfo.currentPlayerIndex).toBe(0);
      expect(stateInfo.currentPlayer).toBe(player1);
      expect(stateInfo.allPlayersDone).toBe(false);
    });
  });

  describe('Action Validation (Requirement 8.2)', () => {
    test('should validate action is on valid turn', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Player 1's turn - should be valid
      const validation1 = gameEngine.validateAction(gameState, 'p1', 'hit');
      expect(validation1.valid).toBe(true);

      // Player 2's turn - should be invalid
      const validation2 = gameEngine.validateAction(gameState, 'p2', 'hit');
      expect(validation2.valid).toBe(false);
      expect(validation2.reason).toBe('Not player\'s turn');
    });

    test('should validate game is in progress', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      // Don't start game

      const validation = gameEngine.validateAction(gameState, 'p1', 'hit');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Game is not in progress');
    });

    test('should validate player exists', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      const validation = gameEngine.validateAction(gameState, 'nonexistent', 'hit');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Player not found');
    });

    test('should validate action type', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      const validation = gameEngine.validateAction(gameState, 'p1', 'invalid');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Invalid action type');
    });

    test('should validate player can take action', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Force player 1 to bust
      while (player1.handValue <= 21) {
        gameEngine.processPlayerAction(gameState, 'p1', 'hit');
      }

      // Now it's player 2's turn, but try to validate player 1's action
      // Player 1 is busted and it's not their turn
      const validation = gameEngine.validateAction(gameState, 'p1', 'hit');

      expect(validation.valid).toBe(false);
      // Could be either "Not player's turn" or "cannot take action"
      expect(['Not player\'s turn', 'Player cannot take action (bust or disconnected)']).toContain(validation.reason);
    });
  });

  describe('Available Actions', () => {
    test('should return available actions for current player', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      const actions = gameEngine.getAvailableActions(gameState, 'p1');

      expect(actions).toContain('hit');
      expect(actions).toContain('stand');
      expect(actions.length).toBe(2);
    });

    test('should return empty array for player not on turn', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Skip test if player1 got blackjack (which would make player2 the current player)
      if (player1.status === 'blackjack' || player1.status === 'stand') {
        expect(true).toBe(true);
        return;
      }

      const actions = gameEngine.getAvailableActions(gameState, 'p2');

      expect(actions).toEqual([]);
    });

    test('should return empty array when game not in progress', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);

      const actions = gameEngine.getAvailableActions(gameState, 'p1');

      expect(actions).toEqual([]);
    });
  });

  describe('Multiple Players Scenario', () => {
    test('should handle turn progression through multiple players', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      const player3 = new Player('p3', 'Charlie', 'socket3');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.addPlayer(player3);
      gameState.startGame();
      gameState.dealInitialCards();

      // Skip test if any player got blackjack on initial deal
      if (player1.status === 'blackjack' || player2.status === 'blackjack' || player3.status === 'blackjack') {
        expect(true).toBe(true);
        return;
      }

      // Player 1 stands
      let result = gameEngine.processPlayerAction(gameState, 'p1', 'stand');
      expect(result.success).toBe(true);
      expect(result.nextPlayer).toBe('p2');

      // Player 2 stands
      result = gameEngine.processPlayerAction(gameState, 'p2', 'stand');
      expect(result.success).toBe(true);
      expect(result.nextPlayer).toBe('p3');

      // Player 3 stands
      result = gameEngine.processPlayerAction(gameState, 'p3', 'stand');
      expect(result.success).toBe(true);
      expect(result.nextPlayer).toBeNull(); // All players done

      expect(gameEngine.shouldDealerPlay(gameState)).toBe(true);
    });
  });
});
