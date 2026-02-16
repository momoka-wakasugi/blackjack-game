const GameState = require('../src/server/game/GameState');
const Player = require('../src/server/game/Player');
const Card = require('../src/server/game/Card');

test('GameState - should initialize game state with correct properties', () => {
  const gameState = new GameState('room1');
  expect(gameState.roomId).toBe('room1');
  expect(gameState.status).toBe('waiting');
  expect(gameState.players).toEqual([]);
  expect(gameState.currentPlayerIndex).toBe(0);
  expect(gameState.winners).toEqual([]);
});

test('GameState - should add players to the game', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  expect(gameState.players).toHaveLength(2);
});

test('GameState - should remove player by id', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  const removed = gameState.removePlayer('p1');
  expect(removed).toBe(true);
  expect(gameState.players).toHaveLength(1);
  expect(gameState.getPlayer('p1')).toBeNull();
});

test('GameState - should get player by id', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  gameState.addPlayer(player1);
  const found = gameState.getPlayer('p1');
  expect(found).toBe(player1);
});

test('GameState - should return null for non-existent player', () => {
  const gameState = new GameState('room1');
  expect(gameState.getPlayer('nonexistent')).toBeNull();
});

test('GameState - should start game and deal initial cards', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  gameState.startGame();
  
  expect(gameState.status).toBe('playing');
  expect(gameState.gameStartTime).not.toBeNull();
  
  gameState.dealInitialCards();
  expect(player1.currentHand).toHaveLength(2);
  expect(player2.currentHand).toHaveLength(2);
  expect(gameState.dealer.hand).toHaveLength(2);
});

test('GameState - should hide dealer second card on initial deal', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  gameState.addPlayer(player1);
  gameState.startGame();
  gameState.dealInitialCards();
  expect(gameState.dealer.hand[1].hidden).toBe(true);
});

test('GameState - should reveal dealer cards', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  gameState.addPlayer(player1);
  gameState.startGame();
  gameState.dealInitialCards();
  gameState.revealDealerCard();
  expect(gameState.dealer.hand[0].hidden).toBe(false);
  expect(gameState.dealer.hand[1].hidden).toBe(false);
});

test('GameState - Dealer Ace handling: should calculate dealer hand with Ace as 11 (Requirement 6.4)', () => {
  const gameState = new GameState('room1');
  gameState.dealer.hand = [
    new Card('hearts', 'A'),
    new Card('diamonds', '9')
  ];
  const value = gameState.calculateDealerHandValue();
  expect(value).toBe(20);
});

test('GameState - Dealer Ace handling: should calculate dealer hand with Ace as 1 when busting (Requirement 6.4)', () => {
  const gameState = new GameState('room1');
  gameState.dealer.hand = [
    new Card('hearts', 'A'),
    new Card('diamonds', '9'),
    new Card('clubs', '5')
  ];
  const value = gameState.calculateDealerHandValue();
  expect(value).toBe(15);
});

test('GameState - Dealer Ace handling: should handle multiple Aces in dealer hand (Requirement 6.4)', () => {
  const gameState = new GameState('room1');
  gameState.dealer.hand = [
    new Card('hearts', 'A'),
    new Card('diamonds', 'A'),
    new Card('clubs', '9')
  ];
  const value = gameState.calculateDealerHandValue();
  expect(value).toBe(21);
});

test('GameState - should get current player', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  const current = gameState.getCurrentPlayer();
  expect(current).toBe(player1);
});

test('GameState - should move to next player', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  const next = gameState.nextPlayer();
  expect(next).toBe(player2);
  expect(gameState.currentPlayerIndex).toBe(1);
});

test('GameState - should return null when all players done', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  gameState.nextPlayer();
  const next = gameState.nextPlayer();
  expect(next).toBeNull();
});

test('GameState - should return true when all players stand or bust', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  player1.setStatus('stand');
  player2.setStatus('bust');
  expect(gameState.areAllPlayersDone()).toBe(true);
});

test('GameState - should return false when any player is still playing', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  player1.setStatus('stand');
  player2.setStatus('playing');
  expect(gameState.areAllPlayersDone()).toBe(false);
});

test('GameState - should determine winners when dealer busts', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  player1.handValue = 18;
  player1.setStatus('stand');
  player2.handValue = 20;
  player2.setStatus('stand');
  gameState.dealer.handValue = 22;
  
  gameState.determineWinners();
  expect(gameState.winners).toContain('p1');
  expect(gameState.winners).toContain('p2');
});

test('GameState - should not include busted players as winners', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  player1.handValue = 22;
  player1.setStatus('bust');
  player2.handValue = 20;
  player2.setStatus('stand');
  gameState.dealer.handValue = 19;
  
  gameState.determineWinners();
  expect(gameState.winners).not.toContain('p1');
  expect(gameState.winners).toContain('p2');
});

test('GameState - should determine winners based on higher value', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  gameState.addPlayer(player1);
  gameState.addPlayer(player2);
  
  player1.handValue = 18;
  player1.setStatus('stand');
  player2.handValue = 20;
  player2.setStatus('stand');
  gameState.dealer.handValue = 19;
  
  gameState.determineWinners();
  expect(gameState.winners).not.toContain('p1');
  expect(gameState.winners).toContain('p2');
});

test('GameState - should end game and set status to finished', () => {
  const gameState = new GameState('room1');
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  gameState.addPlayer(player1);
  gameState.startGame();
  gameState.endGame();
  
  expect(gameState.status).toBe('finished');
  expect(gameState.dealer.status).toBe('finished');
});
