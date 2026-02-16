const Room = require('../src/server/game/Room');
const Player = require('../src/server/game/Player');

test('Room - should initialize room with correct properties', () => {
  const room = new Room('room1', 'Test Room', 6);
  expect(room.id).toBe('room1');
  expect(room.name).toBe('Test Room');
  expect(room.maxPlayers).toBe(6);
  expect(room.isGameInProgress).toBe(false);
  expect(room.gameState.roomId).toBe('room1');
});

test('Room - should add player to room', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  const added = room.addPlayer(player1);
  expect(added).toBe(true);
  expect(room.getPlayerCount()).toBe(1);
});

test('Room - should not add player when room is full', () => {
  const smallRoom = new Room('room2', 'Small Room', 1);
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  smallRoom.addPlayer(player1);
  const added = smallRoom.addPlayer(player2);
  expect(added).toBe(false);
});

test('Room - should not add player when game is in progress (Requirement 2.4)', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  room.addPlayer(player1);
  // プレイヤーにベットを配置
  player1.currentBet = 100;
  player1.hasBet = true;
  room.startGame();
  const added = room.addPlayer(player2);
  expect(added).toBe(false);
});

test('Room - should not add duplicate player', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  const added = room.addPlayer(player1);
  expect(added).toBe(false);
  expect(room.getPlayerCount()).toBe(1);
});

test('Room - should remove player from room', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  const removed = room.removePlayer('p1');
  expect(removed).toBe(true);
  expect(room.getPlayerCount()).toBe(0);
});

test('Room - should reset game when last player leaves during game', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  // プレイヤーにベットを配置
  player1.currentBet = 100;
  player1.hasBet = true;
  room.startGame();
  expect(room.isGameInProgress).toBe(true);
  
  room.removePlayer('p1');
  expect(room.isGameInProgress).toBe(false);
});

test('Room - should check if room is full', () => {
  const smallRoom = new Room('room2', 'Small Room', 2);
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  smallRoom.addPlayer(player1);
  expect(smallRoom.isFull()).toBe(false);
  smallRoom.addPlayer(player2);
  expect(smallRoom.isFull()).toBe(true);
});

test('Room - should check if room is empty', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  expect(room.isEmpty()).toBe(true);
  room.addPlayer(player1);
  expect(room.isEmpty()).toBe(false);
});

test('Room - should start game with at least one player (Requirement 2.1)', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  // プレイヤーにベットを配置
  player1.currentBet = 100;
  player1.hasBet = true;
  const started = room.startGame();
  expect(started).toBe(true);
  expect(room.isGameInProgress).toBe(true);
  expect(room.gameState.status).toBe('playing');
});

test('Room - should not start game without players', () => {
  const room = new Room('room1', 'Test Room', 6);
  const started = room.startGame();
  expect(started).toBe(false);
  expect(room.isGameInProgress).toBe(false);
});

test('Room - should not start game when already in progress', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  room.startGame();
  const started = room.startGame();
  expect(started).toBe(false);
});

test('Room - should end game', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  room.startGame();
  room.endGame();
  expect(room.isGameInProgress).toBe(false);
  expect(room.gameState.status).toBe('finished');
});

test('Room - should reset game state', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  room.startGame();
  room.resetGame();
  expect(room.isGameInProgress).toBe(false);
  expect(room.gameState.status).toBe('waiting');
});

test('Room - should preserve players when resetting game (Requirement 3.5)', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  const player2 = new Player('p2', 'Bob', 'socket2');
  
  room.addPlayer(player1);
  room.addPlayer(player2);
  // プレイヤーにベットを配置
  player1.currentBet = 100;
  player1.hasBet = true;
  player2.currentBet = 50;
  player2.hasBet = true;
  room.startGame();
  
  // Players should have cards after game starts
  expect(room.gameState.players.length).toBe(2);
  expect(room.gameState.players[0].currentHand.length).toBeGreaterThan(0);
  
  // Reset game
  room.resetGame();
  
  // Players should be preserved but with reset hands
  expect(room.gameState.players.length).toBe(2);
  expect(room.gameState.players[0].id).toBe('p1');
  expect(room.gameState.players[1].id).toBe('p2');
  expect(room.gameState.players[0].currentHand.length).toBe(0);
  expect(room.gameState.players[0].status).toBe('waiting');
  expect(room.isGameInProgress).toBe(false);
  expect(room.gameState.status).toBe('waiting');
});

test('Room - should return room information', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  const info = room.getRoomInfo();
  
  expect(info.id).toBe('room1');
  expect(info.name).toBe('Test Room');
  expect(info.playerCount).toBe(1);
  expect(info.maxPlayers).toBe(6);
  expect(info.isGameInProgress).toBe(false);
  expect(info.isFull).toBe(false);
});

test('Room - should return complete room state', () => {
  const room = new Room('room1', 'Test Room', 6);
  const player1 = new Player('p1', 'Alice', 'socket1');
  
  room.addPlayer(player1);
  const clientObj = room.toClientObject();
  
  expect(clientObj.id).toBe('room1');
  expect(clientObj.name).toBe('Test Room');
  expect(clientObj.maxPlayers).toBe(6);
  expect(clientObj.isGameInProgress).toBe(false);
  expect(clientObj.gameState).toBeDefined();
});
