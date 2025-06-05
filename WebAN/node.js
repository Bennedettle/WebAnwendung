// Einfacher Node.js WebSocket-Server für "Vier gewinnt"

const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

const rooms = new Map(); // z.B. 'vier-gewinnt' => [clients]

console.log('WebSocket-Server läuft auf ws://localhost:8080');

server.on('connection', (socket) => {
  socket.on('message', (data) => {
    if (!data) return;
    try {
      const msg = JSON.parse(data);
      const type = msg[0];

      if (type === '*enter-room*') {
        const roomName = msg[1];
        if (!rooms.has(roomName)) rooms.set(roomName, []);

        const clients = rooms.get(roomName);
        socket.room = roomName;
        socket.clientId = clients.length;
        clients.push(socket);

        // Begrüßung
        socket.send(JSON.stringify(['*client-id*', socket.clientId]));

        // Wenn mehr als 2 Clients: keine weiteren zulassen (optional)
        if (clients.length > 2) {
          socket.send(JSON.stringify(['*error*', ['Zu viele Spieler in diesem Raum.']]));
        }

      } else if (type === 'move') {
        const [_, col, color] = msg;
        broadcastToRoom(socket.room, JSON.stringify(['move', col, color]));
      }
    } catch (e) {
      console.error('Ungültige Nachricht:', data);
    }
  });

  socket.on('close', () => {
    if (socket.room) {
      const clients = rooms.get(socket.room);
      if (clients) {
        const index = clients.indexOf(socket);
        if (index >= 0) clients.splice(index, 1);
        if (clients.length === 0) rooms.delete(socket.room);
      }
    }
  });
});

function broadcastToRoom(roomName, message) {
  const clients = rooms.get(roomName) || [];
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}