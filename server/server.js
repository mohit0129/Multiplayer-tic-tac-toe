const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = {};

wss.on('connection', (ws) => {
  let roomId;

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const { type, roomId: roomCode, board, currentPlayer, playerName, emoji } = data;

    if (type === 'join') {
      roomId = roomCode;
      if (!rooms[roomId]) {
        rooms[roomId] = { players: [], board: ['', '', '', '', '', '', '', '', ''], currentPlayer: 'X', playerNames: [], playerSymbols: {} };
      }
      if (rooms[roomId].players.length < 2) {
        rooms[roomId].players.push(ws);
        rooms[roomId].playerNames.push(playerName);

        if (rooms[roomId].players.length === 2) {
          const symbols = ['X', 'O'];
          const randomIndex = Math.floor(Math.random() * 2);
          rooms[roomId].playerSymbols[0] = symbols[randomIndex];
          rooms[roomId].playerSymbols[1] = symbols[1 - randomIndex];

          rooms[roomId].players.forEach((client, index) => {
            client.send(JSON.stringify({
              type: 'start',
              opponentName: rooms[roomId].playerNames[1 - index],
              currentPlayer: rooms[roomId].currentPlayer,
              symbol: rooms[roomId].playerSymbols[index]
            }));
          });
        }
      } else {
        ws.send(JSON.stringify({ type: 'full' }));
        ws.close();
      }
    }

    if (type === 'move') {
      rooms[roomId].board = board;
      const result = checkWinner(rooms[roomId].board);

      if (result) {
        rooms[roomId].players.forEach((client, index) => {
          client.send(JSON.stringify({
            type: 'move',
            board: rooms[roomId].board,
            winner: result.winner,
            combination: result.combination
          }));
        });
      } else {
        rooms[roomId].currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        rooms[roomId].players.forEach((client, index) => {
          client.send(JSON.stringify({
            type: 'move',
            board: rooms[roomId].board,
            currentPlayer: rooms[roomId].currentPlayer
          }));
        });
      }
    } else if (type === 'restartRequest') {
      rooms[roomId].players.forEach((client, index) => {
        if (client !== ws) {
          client.send(JSON.stringify({ type: 'opponentReady' }));
        }
      });
    } else if (type === 'restart') {
      rooms[roomId].board = ['', '', '', '', '', '', '', '', ''];
      rooms[roomId].currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
      rooms[roomId].players.forEach((client, index) => {
        client.send(JSON.stringify({ type: 'restart' }));
      });
    } else if (type === 'leaveRoom') {
      if (rooms[roomId]) {
        rooms[roomId].players = rooms[roomId].players.filter(client => client !== ws);
        rooms[roomId].players.forEach(client => client.send(JSON.stringify({ type: 'opponentLeft' })));
      }
    } else if (type === 'emoji') {
      rooms[roomId].players.forEach(client => {
        if (client !== ws) {
          client.send(JSON.stringify({ type: 'emoji', emoji, playerName }));
        }
      });
    }
  });

  ws.on('close', () => {
    handlePlayerLeft(ws, roomId);
  });
});

function handlePlayerLeft(ws, roomId) {
  if (roomId && rooms[roomId]) {
    const playerIndex = rooms[roomId].players.indexOf(ws);
    rooms[roomId].players.splice(playerIndex, 1);
    const remainingPlayer = rooms[roomId].players[0];

    if (remainingPlayer) {
      remainingPlayer.send(JSON.stringify({
        type: 'opponentLeft',
        message: 'Your opponent has left. You win!'
      }));
    }

    if (rooms[roomId].players.length === 0) {
      delete rooms[roomId];
    }
  }
}

function checkWinner(board) {
  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const combination of winningCombinations) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], combination };
    }
  }
  return null;
}

console.log("Server listening on port", wss.options.port);