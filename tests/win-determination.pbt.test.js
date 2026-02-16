const fc = require('fast-check');
const GameEngine = require('../src/server/GameEngine');
const GameState = require('../src/server/game/GameState');
const Player = require('../src/server/game/Player');
const Card = require('../src/server/game/Card');

/**
 * Property-Based Tests for Win Determination and Bust Processing
 * Feature: blackjack-multiplayer-game
 */

test('Property 8: Win Determination and Result Notification - Validates: Requirements 6.5, 3.4', () => {
  /**
   * Property: Win determination follows blackjack rules and results are notified
   * 
   * This property verifies that:
   * 1. When dealer busts, all non-busted players win
   * 2. When dealer doesn't bust, players with higher value than dealer win
   * 3. Players with equal value to dealer result in push (no winner)
   * 4. Players with lower value than dealer lose
   * 5. Busted players never win
   * 6. Game status is set to finished after determination
   * 7. Results include all necessary information for notification
   */
  
  fc.assert(
    fc.property(
      // Generate number of players (1-6)
      fc.integer({ min: 1, max: 6 }),
      // Generate dealer hand value (1-30 to cover bust scenarios)
      fc.integer({ min: 1, max: 30 }),
      // Generate player hand values
      fc.array(
        fc.record({
          handValue: fc.integer({ min: 1, max: 30 }),
          isBust: fc.boolean()
        }),
        { minLength: 1, maxLength: 6 }
      ),
      (playerCount, dealerValue, playerStates) => {
        // Ensure we have the right number of player states
        const states = [];
        for (let i = 0; i < playerCount; i++) {
          if (i < playerStates.length) {
            states.push(playerStates[i]);
          } else {
            // Default state for missing players
            states.push({ handValue: 18, isBust: false });
          }
        }
        
        const gameEngine = new GameEngine();
        const gameState = new GameState('test-room');
        
        // Start game first
        gameState.status = 'playing';
        gameState.gameStartTime = new Date();
        
        // Create and add players with specific hand values
        const players = [];
        for (let i = 0; i < playerCount; i++) {
          const player = new Player(`p${i}`, `Player ${i}`, `socket-${i}`);
          gameState.addPlayer(player);
          players.push(player);
          
          // Set player hand value and status
          const state = states[i];
          player.handValue = state.handValue;
          
          if (state.isBust || state.handValue > 21) {
            player.setStatus('bust');
          } else {
            player.setStatus('stand');
          }
          
          // Create mock hand to match the value
          player.currentHand = [new Card('hearts', 'K')]; // Mock card
        }
        
        // Set dealer hand value and status
        gameState.dealer.handValue = dealerValue;
        gameState.dealer.status = dealerValue > 21 ? 'bust' : 'stand';
        gameState.dealer.hand = [new Card('hearts', 'K')]; // Mock card
        
        // Mark all players as done
        gameState.currentPlayerIndex = playerCount;
        
        // Determine winners
        const result = gameEngine.determineWinners(gameState);
        
        // Debug: Log the scenario for the failing case
        // console.log('Dealer:', dealerValue, 'Players:', states.map((s, i) => `P${i}:${s.handValue}`), 'Winners:', result.winners);
        
        // Property 8.1: Result structure is correct
        expect(result.success).toBe(true);
        expect(Array.isArray(result.winners)).toBe(true);
        expect(result.dealerHandValue).toBe(dealerValue);
        expect(result.dealerStatus).toBe('finished');
        expect(Array.isArray(result.players)).toBe(true);
        expect(result.players.length).toBe(playerCount);
        
        // Property 8.2: Game status is finished
        expect(gameState.status).toBe('finished');
        
        const dealerBust = dealerValue > 21;
        
        // Property 8.3: Win determination follows blackjack rules
        for (let i = 0; i < playerCount; i++) {
          const player = players[i];
          const state = states[i];
          const playerBust = player.status === 'bust' || state.handValue > 21;
          const isWinner = result.winners.includes(player.id);
          
          // Property 8.3.1: Busted players never win
          if (playerBust) {
            expect(isWinner).toBe(false);
          }
          
          // Property 8.3.2: If dealer busts, non-busted players win
          if (dealerBust && !playerBust) {
            expect(isWinner).toBe(true);
          }
          
          // Property 8.3.3: If dealer doesn't bust and player doesn't bust
          if (!dealerBust && !playerBust) {
            if (state.handValue > dealerValue) {
              // Player has higher value - should win
              expect(isWinner).toBe(true);
            } else {
              // Player has equal or lower value - should not win (push or lose)
              expect(isWinner).toBe(false);
            }
          }
          
          // Property 8.4: Player details in result match actual state
          const playerResult = result.players.find(p => p.id === player.id);
          expect(playerResult).toBeDefined();
          expect(playerResult.name).toBe(player.name);
          expect(playerResult.handValue).toBe(player.handValue);
          expect(playerResult.status).toBe(player.status);
          expect(playerResult.isWinner).toBe(isWinner);
        }
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});

test('Property 12: Bust Judgment Processing - Validates: Requirements 6.1', () => {
  /**
   * Property: Players are automatically marked as bust when hand value exceeds 21
   * 
   * This property verifies that:
   * 1. When a player's hand value exceeds 21, they are marked as bust
   * 2. Bust status is set immediately after the hand value exceeds 21
   * 3. Busted players cannot take further actions
   * 4. Turn automatically moves to next player when a player busts
   * 5. Busted players are excluded from winners even if dealer busts
   */
  
  fc.assert(
    fc.property(
      // Generate number of players (1-6)
      fc.integer({ min: 1, max: 6 }),
      // Generate which player will bust (index)
      fc.integer({ min: 0, max: 5 }),
      // Generate number of hits before bust check
      fc.integer({ min: 0, max: 5 }),
      (playerCount, bustPlayerIndex, hitsBeforeBust) => {
        const gameEngine = new GameEngine();
        const gameState = new GameState('test-room');
        
        // Create and add players
        const players = [];
        for (let i = 0; i < playerCount; i++) {
          const player = new Player(`p${i}`, `Player ${i}`, `socket-${i}`);
          gameState.addPlayer(player);
          players.push(player);
        }
        
        // Start game and deal initial cards
        gameState.startGame();
        gameState.dealInitialCards();
        
        // Select the player who will bust (if index is valid)
        if (bustPlayerIndex >= playerCount) {
          // Skip this test case if bust player index is out of range
          return true;
        }
        
        const bustPlayer = players[bustPlayerIndex];
        
        // Move to the bust player's turn
        while (gameState.currentPlayerIndex < bustPlayerIndex) {
          const currentPlayer = gameState.getCurrentPlayer();
          if (currentPlayer && currentPlayer.canTakeAction()) {
            gameEngine.processPlayerAction(gameState, currentPlayer.id, 'stand');
          } else {
            break;
          }
        }
        
        // Verify we're at the correct player
        if (gameState.getCurrentPlayer()?.id !== bustPlayer.id) {
          return true; // Skip if we couldn't get to the right player
        }
        
        // Force the player to have cards that will bust on next hit
        // Set hand to high value (e.g., 20) so next card will likely bust
        bustPlayer.currentHand = [
          new Card('hearts', 'K'),
          new Card('diamonds', 'K')
        ];
        bustPlayer.handValue = 20;
        
        const handValueBefore = bustPlayer.handValue;
        const playerIndexBefore = gameState.currentPlayerIndex;
        
        // Hit until bust or max hits reached
        let hitCount = 0;
        let bustDetected = false;
        
        while (hitCount < hitsBeforeBust + 3 && bustPlayer.canTakeAction()) {
          const result = gameEngine.processPlayerAction(gameState, bustPlayer.id, 'hit');
          hitCount++;
          
          // Property 12.1: If hand value exceeds 21, player is marked as bust
          if (bustPlayer.handValue > 21) {
            expect(bustPlayer.status).toBe('bust');
            bustDetected = true;
            
            // Property 12.2: Bust is detected immediately
            expect(result.playerBusted).toBe(true);
            
            // Property 12.3: Turn moves to next player automatically
            expect(gameState.currentPlayerIndex).toBeGreaterThan(playerIndexBefore);
            
            // Property 12.4: Busted player cannot take further actions
            expect(bustPlayer.canTakeAction()).toBe(false);
            
            break;
          }
        }
        
        // If player busted, verify they don't win even if dealer busts
        if (bustDetected) {
          // Set all other players to stand
          for (let i = 0; i < playerCount; i++) {
            if (i !== bustPlayerIndex && players[i].status === 'playing') {
              players[i].setStatus('stand');
              players[i].handValue = 19;
            }
          }
          
          // Set dealer to bust
          gameState.dealer.handValue = 25;
          gameState.dealer.status = 'bust';
          gameState.dealer.hand = [
            new Card('hearts', 'K'),
            new Card('diamonds', 'Q'),
            new Card('clubs', '5')
          ];
          
          // Determine winners
          const result = gameEngine.determineWinners(gameState);
          
          // Property 12.5: Busted players are excluded from winners
          expect(result.winners).not.toContain(bustPlayer.id);
          
          // Property 12.6: Non-busted players win when dealer busts
          for (let i = 0; i < playerCount; i++) {
            if (i !== bustPlayerIndex) {
              expect(result.winners).toContain(players[i].id);
            }
          }
        }
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});
