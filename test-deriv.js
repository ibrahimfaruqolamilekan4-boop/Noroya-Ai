const WebSocket = require('ws');
const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ ticks: "R_75" }));
});

ws.on('message', (data) => {
  console.log('Message:', data.toString());
  ws.close();
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
