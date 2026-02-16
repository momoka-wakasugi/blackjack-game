const fc = require('fast-check');
const Player = require('../src/server/game/Player');
const Card = require('../src/server/game/Card');

/**
 * Property-Based Tests for Ace Value Calculation
 * Feature: blackjack-multiplayer-game
 */

test('Property 14: Ace Value Optimal Calculation - Validates: Requirements 6.4', () => {
  /**
   * Property: Aces are calculated optimally (11 when possible, 1 when necessary)
   * 
   * This property verifies that:
   * 1. When hand total <= 21 with Ace as 11, Ace is counted as 11
   * 2. When hand total > 21 with Ace as 11, Ace is counted as 1
   * 3. Multiple Aces are handled correctly (at most one Ace as 11)
   * 4. Hand value is always optimal (maximum value without busting)
   */
  
  fc.assert(
    fc.property(
      // Generate arbitrary number of aces (0-4)
      fc.integer({ min: 0, max: 4 }),
      // Generate arbitrary number of non-ace cards (0-10)
      fc.integer({ min: 0, max: 10 }),
      // Generate arbitrary non-ace card values
      fc.array(fc.integer({ min: 2, max: 10 }), { minLength: 0, maxLength: 10 }),
      (aceCount, nonAceCardCount, nonAceValues) => {
        // Skip if no cards at all
        if (aceCount === 0 && nonAceCardCount === 0) {
          return true;
        }
        
        // Create a player
        const player = new Player('test-player', 'Test', 'socket-test');
        
        // Add aces to the hand
        for (let i = 0; i < aceCount; i++) {
          const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
          player.addCard(new Card(suits[i % 4], 'A'));
        }
        
        // Add non-ace cards to the hand
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        for (let i = 0; i < Math.min(nonAceCardCount, nonAceValues.length); i++) {
          const value = nonAceValues[i];
          let rank;
          if (value === 10) {
            // Randomly choose a 10-value card
            const tenValueRanks = ['10', 'J', 'Q', 'K'];
            rank = tenValueRanks[i % 4];
          } else {
            rank = value.toString();
          }
          const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
          player.addCard(new Card(suits[i % 4], rank));
        }
        
        const handValue = player.handValue;
        
        // Calculate expected optimal value manually
        let nonAceSum = 0;
        for (let i = 0; i < Math.min(nonAceCardCount, nonAceValues.length); i++) {
          nonAceSum += nonAceValues[i];
        }
        
        let expectedValue;
        if (aceCount === 0) {
          // No aces, just sum of non-ace cards
          expectedValue = nonAceSum;
        } else {
          // Try to use one Ace as 11, rest as 1
          const valueWithOneAceAs11 = nonAceSum + 11 + (aceCount - 1);
          if (valueWithOneAceAs11 <= 21) {
            expectedValue = valueWithOneAceAs11;
          } else {
            // All aces as 1
            expectedValue = nonAceSum + aceCount;
          }
        }
        
        // Verify the calculated hand value matches expected optimal value
        expect(handValue).toBe(expectedValue);
        
        // Verify hand value is always <= 21 or player is bust
        if (handValue > 21) {
          expect(player.status).toBe('bust');
        }
        
        // Verify that if we have aces and hand value <= 21, 
        // we're using the maximum possible value
        if (aceCount > 0 && handValue <= 21) {
          // Check if we could have used a higher value
          const maxPossibleValue = nonAceSum + 11 + (aceCount - 1);
          if (maxPossibleValue <= 21) {
            expect(handValue).toBe(maxPossibleValue);
          } else {
            // We should be using all aces as 1
            expect(handValue).toBe(nonAceSum + aceCount);
          }
        }
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});
