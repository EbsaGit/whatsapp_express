const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Endpoint para recibir y responder a los eventos de webhook
app.post('/webhook', (req, res) => {
    const body = req.body;

    // Verificar que el evento tiene el campo "challenge"
    if (body.challenge) {
        res.status(200).send(body.challenge);
    } else {
        res.status(400).send('No challenge provided');
    }
});

// Endpoint para la verificación del webhook
app.get('/webhook', (req, res) => {
    // Verificar el token
    const VERIFY_TOKEN = 'holamundo94';

    // Parsear los parámetros de la solicitud
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verificar que el token y el modo son correctos
    if (mode && token === VERIFY_TOKEN) {
        // Responder con el challenge token
        res.status(200).send(challenge);
    } else {
        // Responder con un error si la verificación falla
        res.sendStatus(403);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
