const fc = require('fast-check');
const GameEngine = require('../src/server/GameEngine');
const GameState = require('../src/server/game/GameState');
const Player = require('../src/server/game/Player');

/**
 * Property-Based Tests for Player Action Processing
 * Feature: blackjack-multiplayer-game
 */

test('Property 13: Player Action Processing - Validates: Requirements 6.2, 6.3', () => {
  /**
   * Property: Player actions are processed correctly
   * 
   * This property verifies that:
   * 1. Hit action deals exactly one card from deck and adds to hand
   * 2. Stand action ends player's turn and moves to next player or dealer
   * 3. Actions update game state appropriately
   * 4. Turn progression follows correct order
   */
  
  fc.assert(
    fc.property(
      // Generate number of players (1-6)
      fc.integer({ min: 1, max: 6 }),
      // Generate sequence of actions for each player
      fc.array(
        fc.constantFrom('hit', 'stand'),
        { minLength: 1, maxLength: 10 }
      ),
      (playerCount, actions) => {
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
        
        // Track initial state
        let currentPlayerIndex = 0;
        
        // Process actions
        for (const action of actions) {
          // Skip if all players are done
          if (gameState.areAllPlayersDone()) {
            break;
          }
          
          const currentPlayer = gameState.getCurrentPlayer();
          if (!currentPlayer || !currentPlayer.canTakeAction()) {
            break;
          }
          
          const playerId = currentPlayer.id;
          const handSizeBefore = currentPlayer.currentHand.length;
          const deckCountBefore = gameState.deck.getRemainingCount();
          const playerIndexBefore = gameState.currentPlayerIndex;
          
          // Process the action
          const result = gameEngine.processPlayerAction(gameState, playerId, action);
          
          // Verify action was processed
          expect(result.success).toBe(true);
          
          if (action === 'hit') {
            // Property 13.1: Hit deals exactly one card
            if (!result.playerBusted || currentPlayer.currentHand.length > handSizeBefore) {
              expect(currentPlayer.currentHand.length).toBe(handSizeBefore + 1);
              expect(gameState.deck.getRemainingCount()).toBe(deckCountBefore - 1);
            }
            
            // If player busted, they should be marked as bust
            if (currentPlayer.handValue > 21) {
              expect(currentPlayer.status).toBe('bust');
              // Turn should move to next player automatically
              expect(gameState.currentPlayerIndex).toBeGreaterThan(playerIndexBefore);
            }
          } else if (action === 'stand') {
            // Property 13.2: Stand ends turn and moves to next
            expect(currentPlayer.status).toBe('stand');
            
            // Hand size should not change
            expect(currentPlayer.currentHand.length).toBe(handSizeBefore);
            
            // Deck count should not change
            expect(gameState.deck.getRemainingCount()).toBe(deckCountBefore);
            
            // Turn should move to next player
            expect(gameState.currentPlayerIndex).toBe(playerIndexBefore + 1);
            
            // Verify next player is correct
            if (result.nextPlayer) {
              const nextPlayer = gameState.getPlayer(result.nextPlayer);
              expect(nextPlayer).not.toBeNull();
              expect(gameState.getCurrentPlayer()).toBe(nextPlayer);
            } else {
              // All players done
              expect(gameState.currentPlayerIndex).toBeGreaterThanOrEqual(playerCount);
            }
          }
          
          // Verify game state consistency
          expect(gameState.status).toBe('playing');
          expect(gameState.lastActionTime).toBeInstanceOf(Date);
        }
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});

test('Property 17: Action Validation - Validates: Requirements 8.2', () => {
  /**
   * Property: Actions are validated and only processed on valid turns
   * 
   * This property verifies that:
   * 1. Actions are only processed when it's the player's turn
   * 2. Invalid turn actions are rejected
   * 3. Actions from non-existent players are rejected
   * 4. Actions when game is not in progress are rejected
   * 5. Invalid action types are rejected
   */
  
  fc.assert(
    fc.property(
      // Generate number of players (2-6)
      fc.integer({ min: 2, max: 6 }),
      // Generate player index attempting action
      fc.integer({ min: 0, max: 10 }),
      // Generate action type
      fc.constantFrom('hit', 'stand', 'invalid', 'double', 'split'),
      // Generate game state
      fc.constantFrom('waiting', 'playing', 'finished'),
      (playerCount, attemptingPlayerIndex, action, gameStatus) => {
        const gameEngine = new GameEngine();
        const gameState = new GameState('test-room');
        
        // Create and add players
        const players = [];
        for (let i = 0; i < playerCount; i++) {
          const player = new Player(`p${i}`, `Player ${i}`, `socket-${i}`);
          gameState.addPlayer(player);
          players.push(player);
        }
        
        // Set game status
        if (gameStatus === 'playing') {
          gameState.startGame();
          gameState.dealInitialCards();
        } else {
          gameState.status = gameStatus;
        }
        
        // Determine which player is attempting the action
        const attemptingPlayerId = attemptingPlayerIndex < playerCount 
          ? `p${attemptingPlayerIndex}` 
          : `nonexistent-${attemptingPlayerIndex}`;
        
        const currentPlayer = gameState.getCurrentPlayer();
        const isCurrentPlayer = currentPlayer && currentPlayer.id === attemptingPlayerId;
        const playerExists = attemptingPlayerIndex < playerCount;
        const isValidAction = action === 'hit' || action === 'stand';
        const isGamePlaying = gameStatus === 'playing';
        
        // Validate the action
        const validation = gameEngine.validateAction(gameState, attemptingPlayerId, action);
        
        // Property 17.1: Validation correctly identifies valid/invalid scenarios
        if (!isGamePlaying) {
          // Game not in progress - should be invalid
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('Game is not in progress');
        } else if (!playerExists) {
          // Player doesn't exist - should be invalid
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('Player not found');
        } else if (!isCurrentPlayer) {
          // Not player's turn - should be invalid
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('Not player\'s turn');
        } else if (!isValidAction) {
          // Invalid action type - should be invalid
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('Invalid action type');
        } else {
          // All conditions met - should be valid
          const player = gameState.getPlayer(attemptingPlayerId);
          if (player && player.canTakeAction()) {
            expect(validation.valid).toBe(true);
          } else {
            expect(validation.valid).toBe(false);
          }
        }
        
        // Property 17.2: Process action and verify it respects validation
        const result = gameEngine.processPlayerAction(gameState, attemptingPlayerId, action);
        
        if (validation.valid) {
          // Valid action should succeed
          expect(result.success).toBe(true);
        } else {
          // Invalid action should fail
          expect(result.success).toBe(false);
          expect(result.message).toBeTruthy();
        }
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});


