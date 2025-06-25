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

const socket = io();

function sendGuess() {
  const guess = document.getElementById('guess').value.trim();
  if (guess && currentRoom && username) {
    console.log('Emitting guess:', { room: currentRoom, guess, username }); // Debug log
    socket.emit('guess', { room: currentRoom, guess, username });
    // Add local confirmation
    const li = document.createElement('li');
    li.innerText = `${username} guessed: ${guess}`;
    document.getElementById('messages').appendChild(li);
    document.getElementById('guess').value = '';
  } else {
    alert('Please enter a guess or ensure you are logged in');
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

socket.on('message', (msg) => {
  console.log('Received message:', msg); // Debug log
  const li = document.createElement('li');
  li.innerText = msg;
  document.getElementById('messages').appendChild(li);
});

socket.on('systemNotification', (msg) => {
  console.log('Received system notification:', msg); // Debug log
  const li = document.createElement('li');
  li.innerText = msg;
  li.style.fontStyle = 'italic';
  li.style.color = '#888';
  document.getElementById('messages').appendChild(li);
});

socket.on('guessMade', (data) => {
  console.log('Received guessMade:', data); // Debug log
  // Only append if not the sender's guess to avoid duplication
  if (data.username !== username) {
    const li = document.createElement('li');
    li.innerText = `${data.username} guessed: ${data.guess}`;
    document.getElementById('messages').appendChild(li);
  }
});

socket.on('draw', (data) => {
  console.log('Received draw:', data); // Debug log
  strokeWeight(data.weight);
  stroke(data.color);
  line(data.x1, data.y1, data.x2, data.y2);
});

socket.on('clear', () => {
  console.log('Received clear event, clearing canvas');
  background(255);
});

function setup() {
  canvas = createCanvas(1200, 800);
  background(255);
  canvas.position(560, 110);
  slider = createSlider(1, 80, 40);
  slider.position(800, 840);
  canvas.style("z-index: -2");
  picker = createColorPicker();
  picker.position(700, 840);
  updateCursor(slider.value());
}

function draw() {
  let w = slider.value();
  updateCursor(w);
  if (oldpickcolor != picker.value()) {
    kolg = picker.value();
  }
  if (mouseIsPressed && mouseY > 0 && mouseY < 700) {
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

  let inSpecialZone = mouseX > 0 && mouseX < 1200 && mouseY > 680 && mouseY < 800;
  if (inSpecialZone) {
    cursor('default');
  }
}

function clearbackground() {
  if (mouseX > 225 && mouseX < 250 && mouseY > 720 && mouseY < 745) {
    if (mouseIsPressed && millis() - lastClearTime > 1000) {
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

  for (let i = 0; i < 6; i++) {
    if (mouseIsPressed) {
      if (mouseX > 50 + i * 25 && mouseX < 75 + i * 25 && mouseY > 720 && mouseY < 745) {
        kolg = kole[i * 2];
      }
      if (mouseX > 50 + i * 25 && mouseX < 75 + i * 25 && mouseY > 745 && mouseY < 770) {
        kolg = kole[i * 2 + 1];
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