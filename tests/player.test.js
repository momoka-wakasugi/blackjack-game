const Player = require('../src/server/game/Player');
const Card = require('../src/server/game/Card');

test('Player - should initialize player with correct properties', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  expect(player.id).toBe('player1');
  expect(player.name).toBe('Alice');
  expect(player.socketId).toBe('socket123');
  expect(player.isConnected).toBe(true);
  expect(player.currentHand).toEqual([]);
  expect(player.handValue).toBe(0);
  expect(player.status).toBe('waiting');
});

test('Player - Ace handling: should calculate hand value with Ace as 11 when not busting (Requirement 6.4)', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', 'A'));
  player.addCard(new Card('diamonds', '9'));
  expect(player.handValue).toBe(20); // A(11) + 9 = 20
});

test('Player - Ace handling: should calculate hand value with Ace as 1 when 11 would bust (Requirement 6.4)', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', 'A'));
  player.addCard(new Card('diamonds', '9'));
  player.addCard(new Card('clubs', '5'));
  expect(player.handValue).toBe(15); // A(1) + 9 + 5 = 15
});

test('Player - Ace handling: should handle multiple Aces correctly (Requirement 6.4)', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', 'A'));
  player.addCard(new Card('diamonds', 'A'));
  expect(player.handValue).toBe(12); // A(11) + A(1) = 12
});

test('Player - Ace handling: should handle multiple Aces with other cards (Requirement 6.4)', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', 'A'));
  player.addCard(new Card('diamonds', 'A'));
  player.addCard(new Card('clubs', '9'));
  expect(player.handValue).toBe(21); // A(11) + A(1) + 9 = 21
});

test('Player - should calculate hand value without Aces', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', '10'));
  player.addCard(new Card('diamonds', 'K'));
  expect(player.handValue).toBe(20);
});

test('Player - should handle blackjack (Ace + 10-value card)', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', 'A'));
  player.addCard(new Card('diamonds', 'K'));
  expect(player.handValue).toBe(21);
  expect(player.status).toBe('blackjack');
});

test('Player - should set status to bust when hand value exceeds 21', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', '10'));
  player.addCard(new Card('diamonds', 'K'));
  player.addCard(new Card('clubs', '5'));
  expect(player.status).toBe('bust');
});

test('Player - should set status to blackjack with 21 and 2 cards', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', 'A'));
  player.addCard(new Card('diamonds', 'Q'));
  expect(player.status).toBe('blackjack');
});

test('Player - should not set blackjack with 21 and more than 2 cards', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', '7'));
  player.addCard(new Card('diamonds', '7'));
  player.addCard(new Card('clubs', '7'));
  expect(player.handValue).toBe(21);
  expect(player.status).not.toBe('blackjack');
});

test('Player - should reset player hand and status', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', '10'));
  player.addCard(new Card('diamonds', 'K'));
  player.setStatus('stand');
  
  player.resetHand();
  
  expect(player.currentHand).toEqual([]);
  expect(player.handValue).toBe(0);
  expect(player.status).toBe('waiting');
});

test('Player - should return true when player is playing and connected', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.setStatus('playing');
  expect(player.canTakeAction()).toBe(true);
});

test('Player - should return false when player is not connected', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.setStatus('playing');
  player.setConnected(false);
  expect(player.canTakeAction()).toBe(false);
});

test('Player - should return false when player status is not playing', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.setStatus('stand');
  expect(player.canTakeAction()).toBe(false);
});

test('Player - should return client-safe player object', () => {
  const player = new Player('player1', 'Alice', 'socket123');
  player.addCard(new Card('hearts', '10'));
  const clientObj = player.toClientObject();
  
  expect(clientObj.id).toBe('player1');
  expect(clientObj.name).toBe('Alice');
  expect(clientObj.handValue).toBe(10);
  expect(clientObj.status).toBe('waiting');
  expect(clientObj.hand).toHaveLength(1);
});
