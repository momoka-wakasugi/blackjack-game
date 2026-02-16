const DealerAI = require('../src/server/DealerAI');
const GameState = require('../src/server/game/GameState');
const Player = require('../src/server/game/Player');

describe('DealerAI', () => {
  let dealerAI;
  let gameState;

  beforeEach(() => {
    dealerAI = new DealerAI();
    dealerAI.setDealDelay(0); // No delay for tests
    gameState = new GameState('test-room');
  });

  describe('shouldHit (Requirements 3.2, 3.3)', () => {
    test('should hit when hand value is 16 or below', () => {
      expect(dealerAI.shouldHit(16)).toBe(true);
      expect(dealerAI.shouldHit(15)).toBe(true);
      expect(dealerAI.shouldHit(10)).toBe(true);
      expect(dealerAI.shouldHit(0)).toBe(true);
    });

    test('should stand when hand value is 17 or above', () => {
      expect(dealerAI.shouldHit(17)).toBe(false);
      expect(dealerAI.shouldHit(18)).toBe(false);
      expect(dealerAI.shouldHit(20)).toBe(false);
      expect(dealerAI.shouldHit(21)).toBe(false);
    });
  });

  describe('shouldStartDealerTurn (Requirement 3.1)', () => {
    test('should start when all players are done and game is playing', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Initially, not all players are done
      expect(dealerAI.shouldStartDealerTurn(gameState)).toBe(false);

      // Both players stand
      player1.setStatus('stand');
      player2.setStatus('stand');

      // Now dealer should start
      expect(dealerAI.shouldStartDealerTurn(gameState)).toBe(true);
    });

    test('should not start when game is not playing', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      player1.setStatus('stand');

      // Game not started
      expect(dealerAI.shouldStartDealerTurn(gameState)).toBe(false);
    });

    test('should not start when players are still playing', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Skip test if player2 got blackjack on initial deal
      if (player2.status === 'blackjack') {
        expect(player2.handValue).toBe(21);
        return;
      }

      // Only one player done
      player1.setStatus('stand');

      expect(dealerAI.shouldStartDealerTurn(gameState)).toBe(false);
    });

    test('should start when all players busted', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Both players bust
      player1.setStatus('bust');
      player2.setStatus('bust');

      expect(dealerAI.shouldStartDealerTurn(gameState)).toBe(true);
    });
  });

  describe('playDealerTurn (Requirements 3.1, 3.2, 3.3)', () => {
    test('should hit until reaching 17 or above', async () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();
      player1.setStatus('stand');

      const result = await dealerAI.playDealerTurn(gameState);

      expect(result.success).toBe(true);
      expect(gameState.dealer.handValue).toBeGreaterThanOrEqual(17);
      expect(['stand', 'bust']).toContain(gameState.dealer.status);
    });

    test('should reveal dealer card at start of turn', async () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();
      player1.setStatus('stand');

      // Dealer's second card should be hidden initially
      expect(gameState.dealer.hand[1].hidden).toBe(true);

      await dealerAI.playDealerTurn(gameState);

      // All cards should be revealed
      gameState.dealer.hand.forEach(card => {
        expect(card.hidden).toBe(false);
      });
    });

    test('should stop when busting', async () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();
      player1.setStatus('stand');

      const result = await dealerAI.playDealerTurn(gameState);

      if (gameState.dealer.handValue > 21) {
        expect(gameState.dealer.status).toBe('bust');
        expect(result.dealerStatus).toBe('bust');
      }
    });

    test('should stand when reaching 17 without busting', async () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();
      player1.setStatus('stand');

      const result = await dealerAI.playDealerTurn(gameState);

      if (gameState.dealer.handValue <= 21) {
        expect(gameState.dealer.status).toBe('stand');
        expect(result.dealerStatus).toBe('stand');
      }
    });

    test('should return action history', async () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();
      player1.setStatus('stand');

      const result = await dealerAI.playDealerTurn(gameState);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.actions)).toBe(true);
      expect(result.finalHandValue).toBe(gameState.dealer.handValue);
    });

    test('should handle empty deck gracefully', async () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();
      player1.setStatus('stand');

      // Empty the deck
      while (!gameState.deck.isEmpty()) {
        gameState.deck.dealCard();
      }

      const result = await dealerAI.playDealerTurn(gameState);

      // Should complete without error
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should allow setting deal delay', () => {
      dealerAI.setDealDelay(500);
      const config = dealerAI.getConfig();
      expect(config.dealDelay).toBe(500);
    });

    test('should have correct default configuration', () => {
      const config = dealerAI.getConfig();
      expect(config.hitThreshold).toBe(17);
      expect(config.dealDelay).toBe(0); // Set to 0 in beforeEach
    });
  });
});
