const GameEngine = require('../src/server/GameEngine');
const GameState = require('../src/server/game/GameState');
const Player = require('../src/server/game/Player');
const Card = require('../src/server/game/Card');

describe('Win Determination and Bust Processing (Requirements 6.1, 6.5, 3.4)', () => {
  let gameEngine;
  let gameState;

  beforeEach(() => {
    gameEngine = new GameEngine();
    gameState = new GameState('test-room');
  });

  describe('Bust Detection (Requirement 6.1)', () => {
    test('should detect player bust when hand value exceeds 21', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();

      // Manually add cards to force bust
      player1.addCard(new Card('hearts', 'K')); // 10
      player1.addCard(new Card('diamonds', 'Q')); // 10
      player1.addCard(new Card('clubs', '5')); // 5 = 25 total

      expect(player1.handValue).toBeGreaterThan(21);
      expect(player1.status).toBe('bust');
    });

    test('should detect dealer bust when hand value exceeds 21', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();
      gameState.dealInitialCards();

      // Manually set dealer to bust
      gameState.dealer.hand = [
        new Card('hearts', 'K'),
        new Card('diamonds', 'Q'),
        new Card('clubs', '5')
      ];
      gameState.dealer.handValue = gameState.calculateDealerHandValue();

      expect(gameState.dealer.handValue).toBeGreaterThan(21);
    });

    test('should automatically move to next player when player busts', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Force player 1 to bust
      while (player1.handValue <= 21) {
        const result = gameEngine.processPlayerAction(gameState, 'p1', 'hit');
        if (result.playerBusted) {
          expect(player1.status).toBe('bust');
          expect(result.nextPlayer).toBe('p2');
          expect(gameState.currentPlayerIndex).toBe(1);
          break;
        }
      }
    });
  });

  describe('Win Determination (Requirements 6.5, 3.4)', () => {
    test('should determine player wins when dealer busts', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();

      // Set player hands
      player1.currentHand = [new Card('hearts', '10'), new Card('diamonds', '8')];
      player1.handValue = 18;
      player1.setStatus('stand');

      player2.currentHand = [new Card('clubs', '9'), new Card('spades', '7')];
      player2.handValue = 16;
      player2.setStatus('stand');

      // Set dealer to bust
      gameState.dealer.hand = [
        new Card('hearts', 'K'),
        new Card('diamonds', 'Q'),
        new Card('clubs', '5')
      ];
      gameState.dealer.handValue = 25;
      gameState.dealer.status = 'bust';

      const result = gameEngine.determineWinners(gameState);

      expect(result.success).toBe(true);
      expect(result.winners).toContain('p1');
      expect(result.winners).toContain('p2');
      expect(result.winners.length).toBe(2);
    });

    test('should determine player wins when player has higher value than dealer', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      
      gameState.addPlayer(player1);
      gameState.startGame();

      // Player has 20
      player1.currentHand = [new Card('hearts', 'K'), new Card('diamonds', '10')];
      player1.handValue = 20;
      player1.setStatus('stand');

      // Dealer has 18
      gameState.dealer.hand = [new Card('clubs', '10'), new Card('spades', '8')];
      gameState.dealer.handValue = 18;
      gameState.dealer.status = 'stand';

      const result = gameEngine.determineWinners(gameState);

      expect(result.success).toBe(true);
      expect(result.winners).toContain('p1');
      expect(result.winners.length).toBe(1);
    });

    test('should determine dealer wins when dealer has higher value', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      
      gameState.addPlayer(player1);
      gameState.startGame();

      // Player has 18
      player1.currentHand = [new Card('hearts', '10'), new Card('diamonds', '8')];
      player1.handValue = 18;
      player1.setStatus('stand');

      // Dealer has 20
      gameState.dealer.hand = [new Card('clubs', 'K'), new Card('spades', '10')];
      gameState.dealer.handValue = 20;
      gameState.dealer.status = 'stand';

      const result = gameEngine.determineWinners(gameState);

      expect(result.success).toBe(true);
      expect(result.winners.length).toBe(0);
    });

    test('should handle push (tie) - no winner', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      
      gameState.addPlayer(player1);
      gameState.startGame();

      // Both have 19
      player1.currentHand = [new Card('hearts', '10'), new Card('diamonds', '9')];
      player1.handValue = 19;
      player1.setStatus('stand');

      gameState.dealer.hand = [new Card('clubs', 'K'), new Card('spades', '9')];
      gameState.dealer.handValue = 19;
      gameState.dealer.status = 'stand';

      const result = gameEngine.determineWinners(gameState);

      expect(result.success).toBe(true);
      expect(result.winners.length).toBe(0);
    });

    test('should not include busted players in winners even if dealer busts', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();

      // Player 1 busted
      player1.currentHand = [
        new Card('hearts', 'K'),
        new Card('diamonds', 'Q'),
        new Card('clubs', '5')
      ];
      player1.handValue = 25;
      player1.setStatus('bust');

      // Player 2 stands with 18
      player2.currentHand = [new Card('spades', '10'), new Card('hearts', '8')];
      player2.handValue = 18;
      player2.setStatus('stand');

      // Dealer busts
      gameState.dealer.hand = [
        new Card('clubs', 'K'),
        new Card('diamonds', 'Q'),
        new Card('spades', '5')
      ];
      gameState.dealer.handValue = 25;
      gameState.dealer.status = 'bust';

      const result = gameEngine.determineWinners(gameState);

      expect(result.success).toBe(true);
      expect(result.winners).not.toContain('p1');
      expect(result.winners).toContain('p2');
      expect(result.winners.length).toBe(1);
    });

    test('should handle multiple players with different outcomes', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      const player3 = new Player('p3', 'Charlie', 'socket3');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.addPlayer(player3);
      gameState.startGame();

      // Player 1 wins with 20
      player1.currentHand = [new Card('hearts', 'K'), new Card('diamonds', '10')];
      player1.handValue = 20;
      player1.setStatus('stand');

      // Player 2 loses with 17
      player2.currentHand = [new Card('clubs', '10'), new Card('spades', '7')];
      player2.handValue = 17;
      player2.setStatus('stand');

      // Player 3 busted
      player3.currentHand = [
        new Card('hearts', '10'),
        new Card('diamonds', '10'),
        new Card('clubs', '5')
      ];
      player3.handValue = 25;
      player3.setStatus('bust');

      // Dealer has 19
      gameState.dealer.hand = [new Card('hearts', '10'), new Card('diamonds', '9')];
      gameState.dealer.handValue = 19;
      gameState.dealer.status = 'stand';

      const result = gameEngine.determineWinners(gameState);

      expect(result.success).toBe(true);
      expect(result.winners).toContain('p1');
      expect(result.winners).not.toContain('p2');
      expect(result.winners).not.toContain('p3');
      expect(result.winners.length).toBe(1);
    });

    test('should set game status to finished after determining winners', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      gameState.addPlayer(player1);
      gameState.startGame();

      player1.currentHand = [new Card('hearts', '10'), new Card('diamonds', '9')];
      player1.handValue = 19;
      player1.setStatus('stand');

      gameState.dealer.hand = [new Card('clubs', '10'), new Card('spades', '8')];
      gameState.dealer.handValue = 18;
      gameState.dealer.status = 'stand';

      expect(gameState.status).toBe('playing');

      gameEngine.determineWinners(gameState);

      expect(gameState.status).toBe('finished');
    });

    test('should include player details in result', () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();

      player1.currentHand = [new Card('hearts', 'K'), new Card('diamonds', '10')];
      player1.handValue = 20;
      player1.setStatus('stand');

      player2.currentHand = [new Card('clubs', '10'), new Card('spades', '7')];
      player2.handValue = 17;
      player2.setStatus('stand');

      gameState.dealer.hand = [new Card('hearts', '10'), new Card('diamonds', '8')];
      gameState.dealer.handValue = 18;
      gameState.dealer.status = 'stand';

      const result = gameEngine.determineWinners(gameState);

      expect(result.players).toHaveLength(2);
      expect(result.players[0].id).toBe('p1');
      expect(result.players[0].isWinner).toBe(true);
      expect(result.players[1].id).toBe('p2');
      expect(result.players[1].isWinner).toBe(false);
      expect(result.dealerHandValue).toBe(18);
      expect(result.dealerStatus).toBe('finished');
    });
  });

  describe('Integration: Full Game Flow', () => {
    test('should complete full game from start to win determination', async () => {
      const player1 = new Player('p1', 'Alice', 'socket1');
      const player2 = new Player('p2', 'Bob', 'socket2');
      
      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
      gameState.dealInitialCards();

      // Player 1 stands
      gameEngine.processPlayerAction(gameState, 'p1', 'stand');

      // Player 2 stands
      gameEngine.processPlayerAction(gameState, 'p2', 'stand');

      // Check dealer should play
      expect(gameEngine.shouldDealerPlay(gameState)).toBe(true);

      // Play dealer turn
      const dealerAI = gameEngine.getDealerAI();
      dealerAI.setDealDelay(0); // No delay for test
      await gameEngine.playDealerTurn(gameState);

      // Determine winners
      const result = gameEngine.determineWinners(gameState);

      expect(result.success).toBe(true);
      expect(gameState.status).toBe('finished');
      expect(Array.isArray(result.winners)).toBe(true);
      expect(result.players).toHaveLength(2);
    });
  });
});
