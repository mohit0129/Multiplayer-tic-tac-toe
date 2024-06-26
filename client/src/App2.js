import React, { useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import './App.css';

let socket;
let roomId;
let currentPlayer;
let playerSymbol;
let playerName;
let opponentName;
let board = ['', '', '', '', '', '', '', '', ''];
let readyToRestart = { player: false, opponent: false };
let winCount = 0;
let lossCount = 0;
let tieCount = 0;

const App = () => {
  const [gameState, setGameState] = useState({
    board: ['', '', '', '', '', '', '', '', ''],
    status: '',
    showGame: false,
    showRoomManagement: true,
    showRoomCode: false,
    showLoading: false,
    winCount: 0,
    lossCount: 0,
    tieCount: 0,
    opponentJoined: false,
    isCreator: false,
    playerName: '',
    opponentName: '',
    playerSymbol: '',
    opponentSymbol: '',
  });

  const makeMove = (index) => {
    if (board[index] === '' && currentPlayer === playerSymbol) {
      board[index] = playerSymbol;
      socket.send(JSON.stringify({ type: 'move', board: board, currentPlayer: playerSymbol }));
    }
  };

  const renderBoard = useCallback((winningCombination = [], result = null) => {
    setGameState((prevState) => ({
      ...prevState,
      board: board.map((cell, index) => ({
        value: cell,
        isWinningCell: winningCombination.includes(index),
        winner: result === playerSymbol ? 'winner' : result !== playerSymbol ? 'loser' : null,
      })),
      status: result ? (result === playerSymbol ? 'You Win!' : 'You Lose!') : (currentPlayer === playerSymbol ? 'Your turn.' : `Waiting for ${opponentName}'s move...`)
    }));
  }, []);

  const createRoom = async () => {
    while (!roomId) {
      roomId = Math.floor(Math.random() * 9000) + 1000;
    }

    while (!playerName) {
      playerName = localStorage.getItem('playerName') || await Swal.fire({
        title: 'Enter Your Name',
        input: 'text',
        inputAttributes: {
          autocapitalize: 'off'
        },
        showCancelButton: false,
        confirmButtonText: 'Submit',
        showLoaderOnConfirm: true,
        preConfirm: (name) => {
          if (name) {
            localStorage.setItem('playerName', name);
            return name;
          } else {
            Swal.showValidationMessage('Name is required');
            return false;
          }
        }
      }).then((result) => result.value);
    }

    initializeWebSocket();
    setGameState((prevState) => ({
      ...prevState,
      showRoomManagement: false,
      status: `Room created. Waiting for opponent...`,
      showRoomCode: true,
      isCreator: true
    }));
  };

  const joinRoom = async () => {
    while (!roomId) {
      roomId = await Swal.fire({
        title: 'Enter Room Code',
        input: 'text',
        inputAttributes: {
          autocapitalize: 'off'
        },
        showCancelButton: false,
        confirmButtonText: 'Join',
        showLoaderOnConfirm: true,
        preConfirm: (name) => {
          if (name) {
            return name;
          } else {
            Swal.showValidationMessage('Room code is required');
            return false;
          }
        }
      }).then((result) => result.value);
    }

    while (!playerName) {
      playerName = localStorage.getItem('playerName') || await Swal.fire({
        title: 'Enter Your Name',
        input: 'text',
        inputAttributes: {
          autocapitalize: 'off'
        },
        showCancelButton: false,
        confirmButtonText: 'Submit',
        showLoaderOnConfirm: true,
        preConfirm: (name) => {
          if (name) {
            localStorage.setItem('playerName', name);
            return name;
          } else {
            Swal.showValidationMessage('Name is required');
            return false;
          }
        }
      }).then((result) => result.value);
    }
    
    initializeWebSocket();
    setGameState((prevState) => ({
      ...prevState,
      showRoomManagement: false,
      status: `Joined room ${roomId}. Waiting for the game to start...`
    }));
  };

  const initializeWebSocket = () => {
    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', roomId: roomId, playerName: playerName }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'start') {
        opponentName = message.opponentName;
        currentPlayer = message.currentPlayer;
        playerSymbol = message.symbol;
        const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';

        setGameState((prevState) => ({
          ...prevState,
          status: currentPlayer === playerSymbol ? 'Your turn.' : `Waiting for ${opponentName}'s move...`,
          showRoomCode: false,
          opponentJoined: true,
          showGame: true,
          playerName: playerName,
          opponentName: opponentName,
          playerSymbol: playerSymbol,
          opponentSymbol: opponentSymbol
        }));
      } else if (message.type === 'move') {
        board = message.board;
        const result = message.winner;
        const combination = message.combination;

        if (result) {
          if (result === playerSymbol) {
            winCount++;
          } else if (result !== playerSymbol) {
            lossCount++;
          } else {
            tieCount++;
          }

          renderBoard(combination, result);
          updateGameStats();

          Swal.fire({
            title: result === playerSymbol ? 'You Win!' : 'You Lose!',
            text: `Result: ${result === playerSymbol ? 'Victory!' : 'Defeat.'}`,
            icon: result === playerSymbol ? 'success' : 'error',
            confirmButtonText: 'OK'
          }).then(() => {
            promptRestart();
          });
        } else if (!board.includes('')) {
          tieCount++;
          renderBoard();
          updateGameStats();

          Swal.fire({
            title: 'It\'s a tie!',
            text: 'The game is a draw.',
            icon: 'info',
            confirmButtonText: 'OK'
          }).then(() => {
            promptRestart();
          });
        } else {
          const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';
          currentPlayer = currentPlayer === playerSymbol ? opponentSymbol : playerSymbol;
          renderBoard();

          setGameState((prevState) => ({
            ...prevState,
            showLoading: currentPlayer !== playerSymbol,
            status: currentPlayer === playerSymbol ? `Your turn.` : `Waiting for ${opponentName}'s move...`
          }));
        }
      } else if (message.type === 'restart') {
        readyToRestart = { player: false, opponent: false };
        board = ['', '', '', '', '', '', '', '', ''];
        renderBoard();
        setGameState((prevState) => ({
          ...prevState,
          showLoading: false,
          status: 'Game restarted.'
        }));
      } else if (message.type === 'opponentReady') {
        readyToRestart.opponent = true;
        checkReadyToRestart();
      } else if (message.type === 'opponentLeft') {
        setGameState((prevState) => ({
          ...prevState,
          status: 'Your opponent has left. You win!'
        }));
        winCount++;
      }
    };

    socket.onclose = (event) => {
      console.error('WebSocket is closed now.', event);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error observed:', error);
    };
  };

  const updateGameStats = () => {
    setGameState((prevState) => ({
      ...prevState,
      winCount: winCount,
      lossCount: lossCount,
      tieCount: tieCount
    }));
  };

  const promptRestart = () => {
    Swal.fire({
      title: 'Do you want to play again?',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Yes',
      denyButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        readyToRestart.player = true;
        socket.send(JSON.stringify({ type: 'restartRequest', roomId: roomId }));
        checkReadyToRestart();
      } else {
        socket.close();
        board = ['', '', '', '', '', '', '', '', ''];
        setGameState((prevState) => ({
          ...prevState,
          showGame: false,
          showRoomManagement: true
        }));
      }
    });
  };

  const checkReadyToRestart = () => {
    if (readyToRestart.player && readyToRestart.opponent) {
      socket.send(JSON.stringify({ type: 'restart' }));
      readyToRestart.player = false;
      readyToRestart.opponent = false;

      board = ['', '', '', '', '', '', '', '', ''];
      setGameState((prevState) => ({
        ...prevState,
        board: board,
        showLoading: false,
        status: currentPlayer === playerSymbol ? `Your turn.` : `Waiting for ${opponentName}'s move...`,
        showGame: true
      }));
    }
  };

  const copyRoomCode = () => {
    const roomCodeText = document.getElementById('room-code-text');
    navigator.clipboard.writeText(roomCodeText.innerText)
      .then(() => {
        Swal.fire('Room code copied to clipboard');
      })
      .catch((err) => {
        console.error('Could not copy text: ', err);
      });
  };

  const exitRoom = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: 'leaveRoom' }));
    }
    localStorage.removeItem('roomId');
    socket.close();
    window.location.href = '/';
  };

return (
  <div id="app" className="App">
    <header className="App-header">
      <h1>Tic Tac Toe</h1>
    </header>
    
    {gameState.showRoomManagement && (
      <div id="room-management" className="card room-management">
        <button className="btn" onClick={joinRoom}>Join Room</button>
        <button className="btn" onClick={createRoom}>Create Room</button>
      </div>
    )}
    
    {gameState.showRoomCode && (
      <div id="room-code" className="card room-code">
        Room Code: <span id="room-code-text">{roomId}</span>
        <button className="btn" onClick={copyRoomCode}>Copy</button>
        <div id="loading" className="loading"><div className="loader"></div><h3>Waiting for opponent...</h3></div>
        <div id="exit-room">
          <button className="btn" onClick={exitRoom}>Exit Room</button>
        </div>
      </div>
    )}
    
    {gameState.showLoading && (
      <div id="loading" className="loading">
        <div className="loader"></div>
        <p>Loading...</p>
        <div id="status">{gameState.status}</div>
      </div>
    )}

    {gameState.showGame && (
      <div id="game" className="card game">
        <div id="game-container" className="game-container">
          <div id="board" className="game-board">
            {gameState.board.map((cell, index) => (
              <div
                key={index}
                className={`cell ${cell.isWinningCell ? 'winning-cell' : ''} ${cell.winner === 'winner' ? 'winner' : cell.winner === 'loser' ? 'loser' : ''}`}
                onClick={() => makeMove(index)}
              >
                {cell.value}
              </div>
            ))}
          </div>
          <div id="game-info" className="game-info">
            <div id="game-stats" className="game-stats">
              <h2>
                <span className={currentPlayer === playerSymbol ? 'green-text' : ''}>{gameState.playerName}</span> vs{' '}
                <span className={currentPlayer !== playerSymbol ? 'red-text' : ''}>{gameState.opponentName}</span>
              </h2>
              <p>Your Symbol: {gameState.playerSymbol}</p>
              <div>Wins: <span id="win-count">{gameState.winCount}</span></div>
              <div>Losses: <span id="loss-count">{gameState.lossCount}</span></div>
              <div>Ties: <span id="tie-count">{gameState.tieCount}</span></div>
              <p>{gameState.status}</p>
              {gameState.showLoading && (
                <div>
                  <div id="loading">
                    <div className="loader"></div>
                  </div>
                  <div id="status">{gameState.status}</div>
                </div>
              )}
            </div>
            <div id="exit-room">
              <button className="btn" onClick={exitRoom}>Exit Room</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

};

export default App;


// import React, { useState, useCallback } from 'react';
// import Swal from 'sweetalert2';
// import './App.css';

// let socket;
// let roomId;
// let currentPlayer;
// let playerSymbol;
// let playerName;
// let opponentName;
// let board = ['', '', '', '', '', '', '', '', ''];
// let readyToRestart = { player: false, opponent: false };
// let winCount = 0;
// let lossCount = 0;
// let tieCount = 0;

// const App = () => {
  // const [gameState, setGameState] = useState({
    // board: ['', '', '', '', '', '', '', '', ''],
    // status: '',
    // showGame: false,
    // showRoomManagement: true,
    // showRoomCode: false,
    // showLoading: false,
    // winCount: 0,
    // lossCount: 0,
    // tieCount: 0,
    // opponentJoined: false,
    // isCreator: false,
    // playerName: '',
    // opponentName: '',
    // playerSymbol: '',
    // opponentSymbol: '',
  // });

  // const makeMove = (index) => {
    // if (board[index] === '' && currentPlayer === playerSymbol) {
      // board[index] = playerSymbol;
      // socket.send(JSON.stringify({ type: 'move', board: board, currentPlayer: playerSymbol }));
    // }
  // };

  // const renderBoard = useCallback((winningCombination = [], result = null) => {
    // setGameState((prevState) => ({
      // ...prevState,
      // board: board.map((cell, index) => ({
        // value: cell,
        // isWinningCell: winningCombination.includes(index),
        // winner: result === playerSymbol ? 'winner' : result !== playerSymbol ? 'loser' : null,
      // })),
      // status: result ? (result === playerSymbol ? 'You Win!' : 'You Lose!') : (currentPlayer === playerSymbol ? 'Your turn.' : `Waiting for ${opponentName}'s move...`)
    // }));
  // }, []);

  // const createRoom = async () => {
    // while (!roomId) {
      // roomId = Math.floor(Math.random() * 9000) + 1000;
    // }

    // while (!playerName) {
      // playerName = localStorage.getItem('playerName') || await Swal.fire({
        // title: 'Enter Your Name',
        // input: 'text',
        // inputAttributes: {
          // autocapitalize: 'off'
        // },
        // showCancelButton: false,
        // confirmButtonText: 'Submit',
        // showLoaderOnConfirm: true,
        // preConfirm: (name) => {
          // if (name) {
            // localStorage.setItem('playerName', name);
            // return name;
          // } else {
            // Swal.showValidationMessage('Name is required');
            // return false;
          // }
        // }
      // }).then((result) => result.value);
    // }

    // initializeWebSocket();
    // setGameState((prevState) => ({
      // ...prevState,
      // showRoomManagement: false,
      // status: `Room created. Waiting for opponent...`,
      // showRoomCode: true,
      // isCreator: true
    // }));
  // };

  // const joinRoom = async () => {
    // while (!roomId) {
      // roomId = await Swal.fire({
        // title: 'Enter Room Code',
        // input: 'text',
        // inputAttributes: {
          // autocapitalize: 'off'
        // },
        // showCancelButton: false,
        // confirmButtonText: 'Join',
        // showLoaderOnConfirm: true,
        // preConfirm: (name) => {
          // if (name) {
            // return name;
          // } else {
            // Swal.showValidationMessage('Room code is required');
            // return false;
          // }
        // }
      // }).then((result) => result.value);
    // }

    // while (!playerName) {
      // playerName = localStorage.getItem('playerName') || await Swal.fire({
        // title: 'Enter Your Name',
        // input: 'text',
        // inputAttributes: {
          // autocapitalize: 'off'
        // },
        // showCancelButton: false,
        // confirmButtonText: 'Submit',
        // showLoaderOnConfirm: true,
        // preConfirm: (name) => {
          // if (name) {
            // localStorage.setItem('playerName', name);
            // return name;
          // } else {
            // Swal.showValidationMessage('Name is required');
            // return false;
          // }
        // }
      // }).then((result) => result.value);
    // }
    
    // initializeWebSocket();
    // setGameState((prevState) => ({
      // ...prevState,
      // showRoomManagement: false,
      // status: `Joined room ${roomId}. Waiting for the game to start...`
    // }));
  // };

  // const initializeWebSocket = () => {
    // socket = new WebSocket('ws://localhost:8080');

    // socket.onopen = () => {
      // socket.send(JSON.stringify({ type: 'join', roomId: roomId, playerName: playerName }));
    // };

    // socket.onmessage = (event) => {
      // const message = JSON.parse(event.data);
      // if (message.type === 'start') {
        // opponentName = message.opponentName;
        // currentPlayer = message.currentPlayer;
        // playerSymbol = message.symbol;
        // const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';

        // setGameState((prevState) => ({
          // ...prevState,
          // status: currentPlayer === playerSymbol ? 'Your turn.' : `Waiting for ${opponentName}'s move...`,
          // showRoomCode: false,
          // opponentJoined: true,
          // showGame: true,
          // playerName: playerName,
          // opponentName: opponentName,
          // playerSymbol: playerSymbol,
          // opponentSymbol: opponentSymbol
        // }));
      // } else if (message.type === 'move') {
        // board = message.board;
        // const result = message.winner;
        // const combination = message.combination;

        // if (result) {
          // if (result === playerSymbol) {
            // winCount++;
          // } else if (result !== playerSymbol) {
            // lossCount++;
          // } else {
            // tieCount++;
          // }

          // renderBoard(combination, result);
          // updateGameStats();

          // Swal.fire({
            // title: result === playerSymbol ? 'You Win!' : 'You Lose!',
            // text: `Result: ${result === playerSymbol ? 'Victory!' : 'Defeat.'}`,
            // icon: result === playerSymbol ? 'success' : 'error',
            // confirmButtonText: 'OK'
          // }).then(() => {
            // promptRestart();
          // });
        // } else if (!board.includes('')) {
          // tieCount++;
          // renderBoard();
          // updateGameStats();

          // Swal.fire({
            // title: 'It\'s a tie!',
            // text: 'The game is a draw.',
            // icon: 'info',
            // confirmButtonText: 'OK'
          // }).then(() => {
            // promptRestart();
          // });
        // } else {
          // const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';
          // currentPlayer = currentPlayer === playerSymbol ? opponentSymbol : playerSymbol;
          // renderBoard();

          // setGameState((prevState) => ({
            // ...prevState,
            // showLoading: currentPlayer !== playerSymbol,
            // status: currentPlayer === playerSymbol ? `Your turn.` : `Waiting for ${opponentName}'s move...`
          // }));
        // }
      // } else if (message.type === 'restart') {
        // readyToRestart = { player: false, opponent: false };
        // board = ['', '', '', '', '', '', '', '', ''];
        // renderBoard();
        // setGameState((prevState) => ({
          // ...prevState,
          // showLoading: false,
          // status: 'Game restarted.'
        // }));
      // } else if (message.type === 'opponentReady') {
        // readyToRestart.opponent = true;
        // checkReadyToRestart();
      // } else if (message.type === 'opponentLeft') {
        // setGameState((prevState) => ({
          // ...prevState,
          // status: 'Your opponent has left. You win!'
        // }));
        // winCount++;
      // }
    // };

    // socket.onclose = (event) => {
      // console.error('WebSocket is closed now.', event);
    // };

    // socket.onerror = (error) => {
      // console.error('WebSocket error observed:', error);
    // };
  // };

  // const updateGameStats = () => {
    // setGameState((prevState) => ({
      // ...prevState,
      // winCount: winCount,
      // lossCount: lossCount,
      // tieCount: tieCount
    // }));
  // };

  // const promptRestart = () => {
    // Swal.fire({
      // title: 'Do you want to play again?',
      // showDenyButton: true,
      // showCancelButton: true,
      // confirmButtonText: 'Yes',
      // denyButtonText: 'No'
    // }).then((result) => {
      // if (result.isConfirmed) {
        // readyToRestart.player = true;
        // socket.send(JSON.stringify({ type: 'restartRequest', roomId: roomId }));
        // checkReadyToRestart();
      // } else {
        // socket.close();
        // board = ['', '', '', '', '', '', '', '', ''];
        // setGameState((prevState) => ({
          // ...prevState,
          // showGame: false,
          // showRoomManagement: true
        // }));
      // }
    // });
  // };

  // const checkReadyToRestart = () => {
    // if (readyToRestart.player && readyToRestart.opponent) {
      // socket.send(JSON.stringify({ type: 'restart' }));
      // readyToRestart.player = false;
      // readyToRestart.opponent = false;

      // board = ['', '', '', '', '', '', '', '', ''];
      // setGameState((prevState) => ({
        // ...prevState,
        // board: board,
        // showLoading: false,
        // status: currentPlayer === playerSymbol ? `Your turn.` : `Waiting for ${opponentName}'s move...`,
        // showGame: true
      // }));
    // }
  // };

  // const copyRoomCode = () => {
    // navigator.clipboard.writeText(roomId);
    // Swal.fire({
      // title: 'Room code copied!',
      // text: 'Share this code with your friend to join the game.',
      // icon: 'info',
      // confirmButtonText: 'OK'
    // });
  // };

  // const leaveRoom = () => {
    // socket.close();
    // setGameState((prevState) => ({
      // ...prevState,
      // showRoomManagement: true,
      // showRoomCode: false,
      // showGame: false,
      // opponentJoined: false,
      // playerName: '',
      // opponentName: '',
      // playerSymbol: '',
      // opponentSymbol: ''
    // }));
    // roomId = null;
    // currentPlayer = null;
    // playerSymbol = null;
    // playerName = null;
    // opponentName = null;
    // board = ['', '', '', '', '', '', '', '', ''];
  // };

  // return (
    // <div className="App">
      // <header className="App-header">
        // <h1>Tic Tac Toe</h1>
      // </header>
      // {gameState.showRoomManagement && (
        // <div className="room-management">
          // <button onClick={createRoom}>Create Room</button>
          // <button onClick={joinRoom}>Join Room</button>
        // </div>
      // )}
      // {gameState.showRoomCode && (
        // <div className="room-code">
          // <p>Room Code: {roomId}</p>
          // <button onClick={copyRoomCode}>Copy Code</button>
        // </div>
      // )}
      // {gameState.showLoading && (
        // <div className="loading">
          // <p>Loading...</p>
        // </div>
      // )}
      // {gameState.showGame && (
        // <div className="game">
          // <div className="game-info">
            // <p>{gameState.status}</p>
            // <div className="game-stats">
              // <p>Wins: {gameState.winCount}</p>
              // <p>Losses: {gameState.lossCount}</p>
              // <p>Ties: {gameState.tieCount}</p>
            // </div>
          // </div>
          // <div className="game-board">
            // {gameState.board.map((cell, index) => (
              // <div
                // key={index}
                // className={`cell ${cell.winner} ${cell.isWinningCell ? 'winning-cell' : ''}`}
                // onClick={() => makeMove(index)}
              // >
                // {cell.value}
              // </div>
            // ))}
          // </div>
          // <button onClick={leaveRoom}>Leave Room</button>
        // </div>
      // )}
    // </div>
  // );
// };

// export default App;