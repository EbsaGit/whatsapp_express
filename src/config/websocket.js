const WebSocket = require('ws');
let wss = null;
             
const initWebSocket = async (server) => {
  try {
    wss = new WebSocket.Server({ server });
    // Manejo de conexión
    wss.on('connection', (ws) => {
        console.log('Nuevo cliente conectado por WebSocket.');
        ws.on('message', (message) => {
            console.log(`Mensaje recibido del cliente WebSocket: ${message}`);
        });
        ws.on('close', () => {
            console.log('Cliente WebSocket desconectado.');
        });
    });
  } catch (err) {
    console.error('Error al conectar WebSocket');
  }
};

const getWebSocket = () => {
    return wss;
};

module.exports = { initWebSocket, getWebSocket };