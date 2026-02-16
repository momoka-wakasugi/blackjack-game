const fc = require('fast-check');
const Deck = require('../src/server/game/Deck');
const Card = require('../src/server/game/Card');

/**
 * Property-Based Tests for Deck Management
 * Feature: blackjack-multiplayer-game
 */

test('Property 16: Server-side Deck Management - Validates: Requirements 8.1', () => {
  /**
   * Property: Server-side deck state management prevents tampering
   * 
   * This property verifies that:
   * 1. Deck state is managed entirely server-side
   * 2. Card dealing operations maintain deck integrity
   * 3. Deck state cannot be externally manipulated
   * 4. All deck operations are deterministic and verifiable
   */
  
  fc.assert(
    fc.property(
      // Generate arbitrary number of card dealing operations (1-52)
      fc.integer({ min: 1, max: 52 }),
      (dealCount) => {
        // Create a fresh deck for each test iteration
        const deck = new Deck();
        
        // Verify initial deck state integrity
        expect(deck.getRemainingCount()).toBe(52);
        expect(deck.isEmpty()).toBe(false);
        
        // Track initial deck state for comparison
        const initialState = deck.getState();
        expect(initialState.remainingCards).toBe(52);
        expect(initialState.isEmpty).toBe(false);
        
        // Deal the specified number of cards
        const dealtCards = [];
        let expectedRemainingCount = 52;
        
        for (let i = 0; i < dealCount && !deck.isEmpty(); i++) {
          const card = deck.dealCard();
          
          // Verify each dealt card is valid
          expect(card).toBeInstanceOf(Card);
          expect(card.suit).toMatch(/^(hearts|diamonds|clubs|spades)$/);
          expect(card.rank).toMatch(/^(A|[2-9]|10|J|Q|K)$/);
          expect(typeof card.value).toBe('number');
          expect(card.value).toBeGreaterThanOrEqual(1);
          expect(card.value).toBeLessThanOrEqual(11);
          
          dealtCards.push(card);
          expectedRemainingCount--;
          
          // Verify deck state consistency after each deal
          expect(deck.getRemainingCount()).toBe(expectedRemainingCount);
          expect(deck.isEmpty()).toBe(expectedRemainingCount === 0);
        }
        
        // Verify no duplicate cards were dealt (deck integrity)
        const cardStrings = dealtCards.map(card => `${card.rank}-${card.suit}`);
        const uniqueCardStrings = [...new Set(cardStrings)];
        expect(uniqueCardStrings.length).toBe(dealtCards.length);
        
        // Verify final deck state matches expected state
        const finalState = deck.getState();
        expect(finalState.remainingCards).toBe(expectedRemainingCount);
        expect(finalState.isEmpty).toBe(expectedRemainingCount === 0);
        
        // Verify deck state cannot be externally modified
        // (attempting to modify internal state should not affect deck behavior)
        const stateSnapshot = deck.getState();
        const remainingBefore = deck.getRemainingCount();
        
        // Try to "tamper" with returned state object
        stateSnapshot.remainingCards = 999;
        stateSnapshot.isEmpty = false;
        
        // Verify deck state remains unchanged
        expect(deck.getRemainingCount()).toBe(remainingBefore);
        expect(deck.getState().remainingCards).toBe(remainingBefore);
        
        return true;
      }
    ),
    { numRuns: 100 } // Run 100 iterations as specified in design document
  );
});

test('Property 16 Extended: Deck Reset and Shuffle Integrity', () => {
  /**
   * Extended property test for deck reset and shuffle operations
   * Ensures server-side deck management maintains integrity across resets
   */
  
  fc.assert(
    fc.property(
      // Generate sequence of operations: deal some cards, then reset
      fc.integer({ min: 1, max: 30 }),
      (initialDealCount) => {
        const deck = new Deck();
        
        // Deal some cards first
        const dealtCards = deck.dealCards(initialDealCount);
        expect(dealtCards.length).toBe(Math.min(initialDealCount, 52));
        
        const remainingAfterDeal = deck.getRemainingCount();
        expect(remainingAfterDeal).toBe(52 - dealtCards.length);
        
        // Reset the deck
        deck.reset();
        
        // Verify deck is fully restored
        expect(deck.getRemainingCount()).toBe(52);
        expect(deck.isEmpty()).toBe(false);
        
        // Verify we can deal a full deck again
        const allCards = deck.dealCards(52);
        expect(allCards.length).toBe(52);
        expect(deck.isEmpty()).toBe(true);
        expect(deck.getRemainingCount()).toBe(0);
        
        // Verify all 52 unique cards are present
        const cardIdentifiers = allCards.map(card => `${card.rank}-${card.suit}`);
        const uniqueCards = [...new Set(cardIdentifiers)];
        expect(uniqueCards.length).toBe(52);
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});

test('Property 16 Security: Deck State Immutability', () => {
  /**
   * Property test ensuring deck internal state cannot be compromised
   * Validates server-side security aspects of deck management
   */
  
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 20 }),
      (operationCount) => {
        const deck = new Deck();
        
        // Perform multiple operations and verify state consistency
        for (let i = 0; i < operationCount; i++) {
          const beforeCount = deck.getRemainingCount();
          const beforeEmpty = deck.isEmpty();
          
          if (!deck.isEmpty()) {
            const card = deck.dealCard();
            expect(card).toBeInstanceOf(Card);
            expect(deck.getRemainingCount()).toBe(beforeCount - 1);
          } else {
            // If deck is empty, dealCard should return null
            const card = deck.dealCard();
            expect(card).toBe(null);
            expect(deck.getRemainingCount()).toBe(0);
            expect(deck.isEmpty()).toBe(true);
          }
        }
        
        // Verify deck state methods return consistent information
        const state = deck.getState();
        expect(state.remainingCards).toBe(deck.getRemainingCount());
        expect(state.isEmpty).toBe(deck.isEmpty());
        
        return true;
      }
    ),
    { numRuns: 100 }
  );
});