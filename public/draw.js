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
        if (username !== painter) {
          console.log('Emitting guess:', { room: currentRoom, guess, username });
          socket.emit('guess', { room: currentRoom, guess, username });
          const li = document.createElement('li');
          li.innerText = `${username} guessed: ${guess}`;
          document.getElementById('messages').appendChild(li);
          document.getElementById('guess').value = '';
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
        console.log('Session loaded:', { currentRoom, username });
        document.getElementById('room-name').innerText = currentRoom;
        document.getElementById('username').innerText = username;
        socket.emit('joinRoom', { username, room: currentRoom });
        hasJoinedRoom = true;
      } else if (!currentRoom || !username) {
        alert('Session expired. Please log in again.');
        window.location.href = '/';
      }
    });

    socket.on('joinSuccess', ({ username, room }) => {
      console.log('Re-joined room:', room);
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
      updateTimerDisplay();
      updateUserTable(data.userPoints);

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
      let timerElement = document.getElementById('game-timer');
      if (!timerElement) {
        timerElement = document.createElement('div');
        timerElement.id = 'game-timer';
        document.body.appendChild(timerElement);
      }

      const minutes = Math.floor(gameTimer / 60);
      const seconds = gameTimer % 60;
      timerElement.innerText = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
      if (gameTimer <= 0) {
        background(255);
      }
    }

    function updateUserTable(userPoints) {
      let tableContainer = document.getElementById('user-table-container');
      if (!tableContainer) {
        tableContainer = document.createElement('div');
        tableContainer.id = 'user-table-container';
        document.body.appendChild(tableContainer);
      }

      let table = document.getElementById('user-table');
      if (!table) {
        table = document.createElement('table');
        table.id = 'user-table';
        tableContainer.appendChild(table);
      }

      table.innerHTML = '';

      const headerRow = table.insertRow();
      const usernameHeader = headerRow.insertCell();
      const pointsHeader = headerRow.insertCell();
      usernameHeader.innerText = 'Username';
      pointsHeader.innerText = 'Points';

      for (const [username, points] of Object.entries(userPoints)) {
        const row = table.insertRow();
        const usernameCell = row.insertCell();
        const pointsCell = row.insertCell();
        usernameCell.innerText = username;
        pointsCell.innerText = points;
      }
    }

    socket.on('message', (msg) => {
      console.log('Received message:', msg);
      const li = document.createElement('li');
      li.innerText = msg;
      document.getElementById('messages').appendChild(li);
    });

    socket.on('systemNotification', (msg) => {
      console.log('Received system notification:', msg);
      const li = document.createElement('li');
      li.innerText = msg;
      li.style.fontStyle = 'italic';
      li.style.color = '#888';
      document.getElementById('messages').appendChild(li);
    });

    socket.on('guessMade', (data) => {
      console.log('Received guessMade:', data);
      if (data.username !== username) {
        const li = document.createElement('li');
        li.innerText = `${data.username} guessed: ${data.guess}`;
        document.getElementById('messages').appendChild(li);
      }
    });

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
          isWordPicked = true;
        };
        container.appendChild(btn);
      });
    });

    socket.on('draw', (data) => {
      console.log('Received draw:', data);
      strokeWeight(data.weight);
      stroke(data.color);
      line(data.x1, data.y1, data.x2, data.y2);
    });

    socket.on('clear', () => {
      console.log('Received clear event, clearing canvas');
      background(255);
    });

    socket.on('gameEndedPlayersLeft', () => {
      canvas.hide();
      slider.hide();
      picker.hide();

      document.getElementById('user-table-container').style.display = 'none';
      document.getElementById('game-timer').style.display = 'none';
      document.getElementById('word-display-container').style.display = 'none';

      if (!document.getElementById('center-table')) {
        let originalTable = document.getElementById('user-table');
        let centerTable = originalTable.cloneNode(true);

        centerTable.id = 'center-table';
        centerTable.style.position = 'absolute';
        centerTable.style.left = '50%';
        centerTable.style.top = '50%';
        centerTable.style.transform = 'translate(-50%, -50%)';
        centerTable.style.fontSize = '48px';
        centerTable.style.border = '2px solid black';
        centerTable.style.borderCollapse = 'collapse';
        centerTable.style.padding = '30px';

        document.body.appendChild(centerTable);
      }

      if (!document.getElementById('back-to-lobby-btn')) {
        let backButton = document.createElement('button');
        backButton.id = 'back-to-lobby-btn';
        backButton.textContent = 'Powrót do lobby';
        backButton.style.position = 'absolute';
        backButton.style.left = '50%';
        backButton.style.top = '60%';
        backButton.style.transform = 'translateX(-50%)';
        backButton.style.fontSize = '18px';
        backButton.style.borderRadius = '5px';
        backButton.style.cursor = 'pointer';

        backButton.onclick = function() {
          sessionStorage.removeItem('username');
          sessionStorage.removeItem('room');
          window.location.href = '/index.html';
        };

        document.body.appendChild(backButton);
      }
    });

    socket.on('gameEndedNoRoundsLeft', () => {
      canvas.hide();
      slider.hide();
      picker.hide();

      document.getElementById('user-table-container').style.display = 'none';
      document.getElementById('game-timer').style.display = 'none';
      document.getElementById('word-display-container').style.display = 'none';

      if (!document.getElementById('center-table')) {
        let originalTable = document.getElementById('user-table');
        let centerTable = originalTable.cloneNode(true);

        centerTable.id = 'center-table';
        centerTable.style.position = 'absolute';
        centerTable.style.left = '50%';
        centerTable.style.top = '50%';
        centerTable.style.transform = 'translate(-50%, -50%)';
        centerTable.style.fontSize = '48px';
        centerTable.style.border = '2px solid black';
        centerTable.style.borderCollapse = 'collapse';
        centerTable.style.padding = '30px';

        document.body.appendChild(centerTable);
      }

      if (!document.getElementById('back-to-lobby-btn')) {
        let backButton = document.createElement('button');
        backButton.id = 'back-to-lobby-btn';
        backButton.textContent = 'Powrót do lobby';
        backButton.style.position = 'absolute';
        backButton.style.left = '50%';
        backButton.style.top = '60%';
        backButton.style.transform = 'translateX(-50%)';
        backButton.style.fontSize = '18px';
        backButton.style.borderRadius = '5px';
        backButton.style.cursor = 'pointer';

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
      canvas.position(560, 110);
      slider = createSlider(1, 80, 40);
      slider.position(950, 845);
      canvas.style("z-index: -2");
      picker = createColorPicker();
      picker.position(1150, 845);
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

      if (mouseIsPressed && mouseY > 0 && mouseY < 700 && gameStarted && painter === username && isWordPicked) {
        console.log(isWordPicked);
        strokeWeight(w);
        stroke(kolg);
        line(pmouseX, pmouseY, mouseX, mouseY);
        if (currentRoom) {
          console.log('Emitting draw:', { room: currentRoom, x1: pmouseX, y1: pmouseY, x2: mouseX, y2: mouseY });
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

  if (gameStarted) {
    for (let i = 0; i < 6; i++) {
      if (mouseIsPressed) {
        if (mouseX > 50 + i * 25 && mouseX < 75 + i * 25 && mouseY > 720 && mouseY < 745) {
          kolhalation = kole[i * 2];
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