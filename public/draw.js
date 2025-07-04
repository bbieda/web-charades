let kolg = '#000000';
let j = 50;
let oldpickcolor;
let kole = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FF1493', '#FFFF00', '#4B0082', '#00FFFF', '#808080', '#5D2B07', '#FFA07A'];
let canvas;
let picker;
let slider;
let currentRoom = '';
let username = '';
let lastClearTime = 0;
let hasJoinedRoom = false;
let gameStarted = false;
let isCreator = false;
let painter = '';
let gameTimer = 90;
let isWordPicked = false;

const socket = io();

function sendGuess() {
  const guess = document.getElementById('guess').value.trim();
  if (guess && currentRoom && username) {
    if(username !== painter){
    console.log('Emitting guess:', { room: currentRoom, guess, username }); // Debug log
    socket.emit('guess', { room: currentRoom, guess, username });
    // Add local confirmation
    const li = document.createElement('li');
    li.innerText = `${username} guessed: ${guess}`;
    document.getElementById('messages').appendChild(li);
    document.getElementById('guess').value = '';
    const messagesEl = document.getElementById('messages');
    if (messagesEl) {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }// Use the reusable scroll function // Scroll to bottom after adding local guess
    }
  } else {
    alert('Please enter a guess or ensure you are logged in');
  }
}

function startGame() {
  if (isCreator && currentRoom) {
    socket.emit('startGame', { room: currentRoom });
  }
}

socket.on('connect', () => {
  console.log('Connected to Socket.IO server');
  currentRoom = sessionStorage.getItem('room') || '';
  username = sessionStorage.getItem('username') || '';
  if (currentRoom && username && !hasJoinedRoom) {
    console.log('Session loaded:', { currentRoom, username }); // Debug log
    document.getElementById('room-name').innerText = currentRoom;
    document.getElementById('username').innerText = username;
    // Re-join room to ensure socket is in the correct room
    socket.emit('joinRoom', { username, room: currentRoom });
    hasJoinedRoom = true;
  } else if (!currentRoom || !username) {
    alert('Session expired. Please log in again.');
    window.location.href = '/';
  }
});

// socket.on('joinError', (message) => {
//   const overlay = document.getElementById('error-overlay');
//   const errorMsg = document.getElementById('error-message');
//   if (overlay && errorMsg) {
//     errorMsg.innerText = message;
//     overlay.style.display = 'block';
//   } else {
//     // fallback
//     alert(message);
//     window.location.href = '/';
//   }
// });

// function goBackToLobby() {
//   sessionStorage.removeItem('username');
//   sessionStorage.removeItem('room');
//   window.location.href = '/';
// }

socket.on('joinSuccess', ({ username, room }) => {
  console.log('Re-joined room:', room); // Debug log
  sessionStorage.setItem('username', username);
  sessionStorage.setItem('room', room);
  currentRoom = room;
  document.getElementById('room-name').innerText = currentRoom;
  document.getElementById('username').innerText = username;
  hasJoinedRoom = true;
});

    socket.on('joinError', (message) => {
      alert(message);
      hasJoinedRoom = false;
      window.location.href = '/';
    });

socket.on('gameState', (data) => {
  gameStarted = data.gameStarted;
  isCreator = data.isCreator;
  painter = data.painter;
  gameTimer = data.gameTimer;
  isWordPicked = data.isWordPicked;
  // Update timer display
  updateTimerDisplay();

  // Update user points table
  updateUserTable(data.userPoints);

  // Show/hide start button based on creator status and game state
  let startButton = document.getElementById('start-button');
  if (!startButton && isCreator) {
    startButton = document.createElement('button');
    startButton.id = 'start-button';
    startButton.innerText = 'Start Game';
    startButton.onclick = startGame;
    document.body.appendChild(startButton);
  }

  if (startButton) {
    if (isCreator && !gameStarted && data.canStart) {
      startButton.style.display = 'inline-block';
      
    } else {
      startButton.style.display = 'none';
      
    }
  }

  console.log('Game state updated:', { gameStarted, isCreator, canStart: data.canStart, painter });
});

socket.on('gameStarted', () => {
  gameStarted = true;
  const startButton = document.getElementById('start-button');
  if (startButton) {
    startButton.style.display = 'none';
    console.log(painter);
  }
  document.getElementById('word-display-container').style.display = 'block';
  console.log('Game started!');
});

socket.on('gameEnded', () => {
  gameStarted = false;
  document.getElementById('word-display-container').style.display = 'none';
  document.getElementById('word-display').innerText = '';
  console.log('Game ended!');
});

socket.on('timerUpdate', (timeLeft) => {
  gameTimer = timeLeft;
  updateTimerDisplay();
});

socket.on('pointsUpdate', (userPoints) => {
  updateUserTable(userPoints);
});
    socket.on('wordUpdate', (data) => {
      const wordDisplay = document.getElementById('word-display');
      // Add spaces between underscores
      wordDisplay.innerText = data.word.split('').join(' ');
      // Show word display container for all players when game is started
      if (gameStarted) {
        document.getElementById('word-display-container').style.display = 'block';
      } else {
        document.getElementById('word-display-container').style.display = 'none';
      }
    });



function updateTimerDisplay() {
  const timerElement = document.getElementById('game-timer');
  if (timerElement) {
    const minutes = Math.floor(gameTimer / 60);
    const seconds = gameTimer % 60;
    timerElement.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

function updateUserTable(userPoints) {
  const container = document.getElementById('user-table-container');
  if (!container) return;

  // Tworzymy tabelę tylko jeśli nie istnieje
  let table = document.getElementById('user-table');
  if (!table) {
    table = document.createElement('table');
    table.id = 'user-table';
    container.appendChild(table);
    
    // Nagłówki tabeli
    const headerRow = table.insertRow();
    const usernameHeader = headerRow.insertCell();
    const pointsHeader = headerRow.insertCell();
    usernameHeader.innerText = 'Username';
    pointsHeader.innerText = 'Points';
    usernameHeader.classList.add('header-cell');
    pointsHeader.classList.add('header-cell');
  }

  // Czyszczenie istniejących wierszy (oprócz nagłówka)
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  // Sortowanie graczy według punktów (malejąco)
  const sortedPlayers = Object.entries(userPoints)
    .sort((a, b) => b[1] - a[1]);

  // Dodawanie graczy do tabeli
  for (const [username, points] of sortedPlayers) {
    const row = table.insertRow();
    const usernameCell = row.insertCell();
    const pointsCell = row.insertCell();
    
    usernameCell.innerText = username;
    pointsCell.innerText = points;
    
    // Podświetlenie aktualnego użytkownika
    if (username === sessionStorage.getItem('username')) {
      row.classList.add('current-user');
    }
  }
}


socket.on('message', (msg) => {
  console.log('Received message:', msg); // Debug log
  const li = document.createElement('li');
  li.innerText = msg;
  document.getElementById('messages').appendChild(li);
  const messagesEl = document.getElementById('messages');
  if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }// Use the reusable scroll function// Use the reusable scroll function
 });

socket.on('systemNotification', (msg) => {
  console.log('Received system notification:', msg); // Debug log
  const li = document.createElement('li');
  li.innerText = msg;
  li.style.fontStyle = 'italic';
  li.style.color = '#888';
  document.getElementById('messages').appendChild(li);
  const messagesEl = document.getElementById('messages');
  if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }// Use the reusable scroll function Use the reusable scroll function
});

socket.on('guessMade', (data) => {
  console.log('Received guessMade:', data); // Debug log
  // Only append if not the sender's guess to avoid duplication
  if (data.username !== username) {
    const li = document.createElement('li');
    li.innerText = `${data.username} guessed: ${data.guess}`;
    document.getElementById('messages').appendChild(li);
    const messagesEl = document.getElementById('messages');
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }// Use the reusable scroll function
  }
});

// Handle word options for drawing
socket.on('wordOptions', (words) => {
  console.log('Received word options:', words);

  let container = document.getElementById('word-selection');
  if (!container) {
    container = document.createElement('div');
    container.id = 'word-selection';
    document.body.appendChild(container);
  }

  container.innerHTML = '<p>Select a word to draw:</p>';

  words.forEach(word => {
    const btn = document.createElement('button');
    btn.innerText = word;
    btn.onclick = () => {
      socket.emit('selectWord', { room: currentRoom, word });
      container.remove();
      // Set isWordPicked to true when a word is selected
      isWordPicked = true;
    };
    container.appendChild(btn);
  });
});


socket.on('draw', (data) => {
  console.log('Received draw:', data); // Debug log
  strokeWeight(data.weight);
  stroke(data.color);
  line(data.x1, data.y1, data.x2, data.y2);
});

socket.on('fillSpace', (data) => {

    floodFill(data.x, data.y, data.color);
  
});

socket.on('clear', () => {
  console.log('Received clear event, clearing canvas');
  background(255);
});

socket.on('gameEndedPlayersLeft', () => {
  const overlay = document.createElement('div');
  overlay.className = 'end-game-overlay';
  document.body.appendChild(overlay);

  canvas.hide();
  slider.hide();
  picker.hide();

  document.getElementById('user-table-container').style.display = 'none';
  document.getElementById('game-timer').style.display = 'none';

  if (!document.getElementById('center-table')) {
    let originalTable = document.getElementById('user-table');
    let centerTable = originalTable.cloneNode(true);

    centerTable.id = 'center-table';
    centerTable.className = 'end-game-table'; // Dodajemy klasę dla stylowania
    document.body.appendChild(centerTable);
  }

  if (!document.getElementById('back-to-lobby-btn')) {
    let backButton = document.createElement('button');
    backButton.id = 'back-to-lobby-btn';
    backButton.textContent = 'Powrót do lobby';
    backButton.className = 'end-game-button'; // Dodajemy klasę dla stylowania
    
    backButton.onclick = function() {
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('room');
      window.location.href = '/index.html';
    };

    document.body.appendChild(backButton);
  }
});

socket.on('gameEndedNoRoundsLeft', () => {
  const overlay = document.createElement('div');
  overlay.className = 'end-game-overlay';
  document.body.appendChild(overlay);

  canvas.hide();
  slider.hide();
  picker.hide();

  document.getElementById('user-table-container').style.display = 'none';
  document.getElementById('game-timer').style.display = 'none';

  if (!document.getElementById('center-table')) {
    let originalTable = document.getElementById('user-table');
    let centerTable = originalTable.cloneNode(true);

    centerTable.id = 'center-table';
    centerTable.className = 'end-game-table'; // Dodajemy klasę dla stylowania
    document.body.appendChild(centerTable);
  }

  if (!document.getElementById('back-to-lobby-btn')) {
    let backButton = document.createElement('button');
    backButton.id = 'back-to-lobby-btn';
    backButton.textContent = 'Powrót do lobby';
    backButton.className = 'end-game-button'; // Dodajemy klasę dla stylowania
    
    backButton.onclick = function() {
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('room');
      window.location.href = '/index.html';
    };

    document.body.appendChild(backButton);
  }
});

function setup() {
  canvas = createCanvas(1200, 800);
  background(255);
  canvas.position(350, 150);
  slider = createSlider(1, 80, 40);
  slider.position(750, 895);
  canvas.style("z-index: -2");
  picker = createColorPicker();
  picker.position(625, 870);
  updateCursor(slider.value());
  canvas.style("z-index", "1");
  picker.style("z-index", "1");
  slider.style("z-index", "1");
}

function draw() {
  let w = slider.value();
  updateCursor(w);
  if (oldpickcolor != picker.value()) {
    kolg = picker.value();
  }

  // Only allow drawing if game has started
  if (mouseIsPressed && mouseY > 0 && mouseY < 700 && gameStarted && painter === username && isWordPicked) {
    console.log(isWordPicked);
    strokeWeight(w);
    stroke(kolg);
    line(pmouseX, pmouseY, mouseX, mouseY);
    if (currentRoom) {
      console.log('Emitting draw:', { room: currentRoom, x1: pmouseX, y1: pmouseY, x2: mouseX, y2: mouseY }); // Debug log
      socket.emit('draw', {
        room: currentRoom,
        x1: pmouseX,
        y1: pmouseY,
        x2: mouseX,
        y2: mouseY,
        color: kolg,
        weight: w
      });
    }
  }

  clearbackground();
  colors();
  strokeWeight(w);
  stroke(kolg);
  line(725, 750, 725, 750);

  let inSpecialZone = mouseX > 0 && mouseX < 1200 && mouseY > 690 && mouseY < 800;
  if (inSpecialZone || painter !== username) {
    cursor('default');
  }
}

function clearbackground() {
  if (mouseX > 225 && mouseX < 250 && mouseY > 720 && mouseY < 745 && painter === username) {

    if (mouseIsPressed && millis() - lastClearTime > 1000 && gameStarted) {
      console.log('Clearing canvas locally and emitting clear event for room:', currentRoom);
      background(255);
      lastClearTime = millis();
      if (currentRoom) {
        socket.emit('clear', { room: currentRoom });
      } else {
        console.log('Error: currentRoom is empty, cannot emit clear event');
      }
    }
  }
}

function colors() {
  oldpickcolor = picker.value();
  stroke(kolg);
  strokeWeight(6);
  fill(100);
  rect(3, 696, 1194, 101);
  for (let i = 0; i < 12; i += 2) {
    let h = 25;
    strokeWeight(1);
    stroke(0);
    fill(kole[i]);
    rect(j, 720, 25, 25);
    fill(kole[i + 1]);
    rect(j, 720 + h, 25, 25);
    j = j + 25;
    h = 0;
  }
  j = 50;

  fill(255);
  rect(225, 720, 25, 25);
  strokeWeight(1);
  stroke(255, 0, 0);
  line(225, 720, 250, 745);
  line(250, 720, 225, 745);

  // Only allow color selection if game has started
  if (gameStarted) {
    for (let i = 0; i < 6; i++) {
      if (mouseIsPressed) {
        if (mouseX > 50 + i * 25 && mouseX < 75 + i * 25 && mouseY > 720 && mouseY < 745) {
          kolg = kole[i * 2];
          picker.value(kolg);
        }
        if (mouseX > 50 + i * 25 && mouseX < 75 + i * 25 && mouseY > 745 && mouseY < 770) {
          kolg = kole[i * 2 + 1];
          picker.value(kolg);
        }
      }
    }
  }
}

function updateCursor(size) {
    
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="${kolg}" stroke="${kolg}" stroke-width="1"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2.5}" fill="none" stroke="white" stroke-width="1"/>
  </svg>`;
  const svgUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
  canvas.style('cursor', `url(${svgUrl}) ${size/2} ${size/2}, auto`);
  
}


let fillMode = false;

function addFillButton() {
  if (!document.getElementById('fill-button')) {
    const fillBtn = document.createElement('button');
    fillBtn.id = 'fill-button';
    fillBtn.innerHTML = '<img src="bucket.png" style="width: 20px; height: 20px;">';
    fillBtn.style.position = 'absolute';
    fillBtn.style.left = '700px';
    fillBtn.style.top = '885px';
    fillBtn.style.zIndex = '2';
    fillBtn.onclick = () => {
      fillMode = !fillMode;
      fillBtn.style.backgroundColor = fillMode ? '#ccc' : '';
      if (fillMode) {
        canvas.style('cursor', 'url("data:image/svg+xml;base64,' + btoa('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'><rect width=\'32\' height=\'32\' fill=\'none\'/><path d=\'M8 24l8-8 8 8-8 8z\' fill=\'#000\'/><rect x=\'14\' y=\'4\' width=\'4\' height=\'12\' fill=\'#000\'/></svg>') + '") 16 28, pointer');
      } else {
        updateCursor(slider.value());
      }
    };
    document.body.appendChild(fillBtn);
  }
}

function floodFill(x, y, fillColor) {
  loadPixels();
  const w = width;
  const h = height;
  const d = pixelDensity();
  const pixelsLength = 4 * w * h * d * d;

  function getColorAt(px, py) {
    const idx = 4 * ((py * d) * w * d + (px * d));
    return [
      pixels[idx],
      pixels[idx + 1],
      pixels[idx + 2],
      pixels[idx + 3]
    ];
  }

  function setColorAt(px, py, color) {
    for (let dx = 0; dx < d; dx++) {
      for (let dy = 0; dy < d; dy++) {
        const idx = 4 * (((py * d + dy) * w * d) + (px * d + dx));
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
        pixels[idx + 3] = color[3];
      }
    }
  }

  function colorsMatch(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
  }

  const startColor = getColorAt(x, y);
  const fillCol = color(fillColor);
  const fillArr = [red(fillCol), green(fillCol), blue(fillCol), 255];

  if (colorsMatch(startColor, fillArr)) return;

  const stack = [[x, y]];
  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const currColor = getColorAt(cx, cy);
    if (colorsMatch(currColor, startColor)) {
      setColorAt(cx, cy, fillArr);
      stack.push([cx + 1, cy]);
      stack.push([cx - 1, cy]);
      stack.push([cx, cy + 1]);
      stack.push([cx, cy - 1]);
    }
  }
  updatePixels();
}


const originalSetup = setup;
setup = function() {
  originalSetup();
  addFillButton();
};

const originalMousePressed = window.mousePressed;
window.mousePressed = function() {
  if (fillMode && mouseY > 0 && mouseY < 700 && gameStarted && painter === username && isWordPicked) {
    floodFill(mouseX, mouseY, kolg);
    console.log('Flood fill triggered at:', { x: mouseX, y: mouseY, color: kolg }); // Debug log
    if (currentRoom) {
      console.log('Emitting fillSpace:');
      socket.emit('fillSpace', {
        room: currentRoom,
        x: mouseX,
        y: mouseY,
        color: kolg
      });
    }
    fillMode = false;
    document.getElementById('fill-button').style.backgroundColor = '';
    updateCursor(slider.value());
    return;
  }
  if (typeof originalMousePressed === 'function') originalMousePressed();
};
