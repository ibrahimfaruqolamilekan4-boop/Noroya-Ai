const WebSocket = require('ws');

const derivAppId = process.env.VITE_DERIV_APP_ID || "1089";
const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${derivAppId}`;
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  ws.send(JSON.stringify({ ticks: "R_75" }));
});
ws.on('message', (data) => {
  console.log(data.toString());
  ws.close();
});
