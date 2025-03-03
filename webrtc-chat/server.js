const express = require('express');
const https = require('https');
const fs = require('fs');
const WebSocket = require('ws');
const app = express();

const server = https.createServer({
    cert: fs.readFileSync('/etc/ssl/certs/selfsigned.crt'),
    key: fs.readFileSync('/etc/ssl/private/selfsigned.key')
}, app);

const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

wss.on('connection', ws => {
    ws.on('message', message => {
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

server.listen(3000, () => console.log('Сервер запущен на https://localhost:3000'));
