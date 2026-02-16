// Room selection functionality
const socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
});

let rooms = {};

// Join room function
function joinRoom(roomId) {
    // Check if room is available
    const room = rooms[roomId];
    if (room && room.isGameInProgress) {
        alert('このルームは現在ゲーム中です。ゲームが終了するまでお待ちください。');
        return;
    }
    
    // Redirect to game page with room ID
    window.location.href = `/room/${roomId}`;
}

// Update room information
function updateRoomInfo(roomsData) {
    if (!roomsData) return;
    
    rooms = roomsData;
    
    Object.keys(roomsData).forEach(roomId => {
        const room = roomsData[roomId];
        const roomCard = document.querySelector(`[data-room-id="${roomId}"]`);
        
        if (roomCard) {
            // Update player count
            const playerCountElement = roomCard.querySelector('.player-count');
            if (playerCountElement) {
                const maxPlayers = room.maxPlayers || 6;
                const currentPlayers = room.playerCount || 0;
                playerCountElement.textContent = `${currentPlayers}/${maxPlayers} プレイヤー`;
            }
            
            // Update room status
            const statusElement = roomCard.querySelector('.room-status');
            if (statusElement) {
                if (room.isGameInProgress) {
                    statusElement.textContent = 'ゲーム中';
                    statusElement.className = 'room-status playing';
                } else {
                    statusElement.textContent = '待機中';
                    statusElement.className = 'room-status waiting';
                }
            }
            
            // Update join button
            const joinButton = roomCard.querySelector('.join-btn');
            if (joinButton) {
                joinButton.disabled = room.isGameInProgress || room.playerCount >= (room.maxPlayers || 6);
            }
        }
    });
}

// Request room list update
function requestRoomList() {
    socket.emit('get-room-list');
}

// Initialize room selection page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Room selection page loaded');
    requestRoomList();
    
    // Request room list every 5 seconds
    setInterval(requestRoomList, 5000);
});

// Socket event listeners
socket.on('connect', () => {
    console.log('Connected to server');
    requestRoomList();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

// Listen for room updates
socket.on('room-list-update', (roomsData) => {
    console.log('Room list updated:', roomsData);
    updateRoomInfo(roomsData);
});

socket.on('room-list', (roomsData) => {
    console.log('Room list received:', roomsData);
    updateRoomInfo(roomsData);
});
