# Web Charades

A real-time multiplayer charades game built with JavaScript, Node.js, Express, and Socket.io.

## How to Install and Run locally

1. Clone the repository or navigate to your project folder:
```bash
cd path/to/project
```

2. Ensure Node.js and npm are installed:
```bash
node -v
npm -v
```

3. Install the project dependencies:
```bash
npm install
```

4. Start the server:
```bash
node server.js
```

5. Open your browser and go to:
```
http://localhost:3000
```

## Project Structure

- `server.js` — main server file, sets up Express and Socket.io.
- `public/` — contains client-side static files (HTML, CSS, JS).
- `words.json` — JSON file containing the list of words used in the game.

## Features

- Real-time communication using Socket.io.
- Multiple game rooms with independent states.
- User tracking and point scoring.
- Static file serving for client UI.

## Deployment

For deployment on platforms like Railway, make sure the `PORT` environment variable is used in `server.js`:

```js
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```
