const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./src/config/database');
const Message = require('./src/models/Message');
const app = express();
const port = process.env.PORT || 3000;

// Conectar a MongoDB
connectDB();

// Middleware para parsear JSON
app.use(bodyParser.json());

// Endpoint para recibir y responder a los eventos de webhook
app.post('/webhook', async (req, res) => {
    const body = req.body;

    // Verifica y maneja el evento del webhook de WhatsApp
    if (body.object) {
        console.log('Webhook received:', JSON.stringify(body, null, 2));

        // Procesa los mensajes aquí
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            try {
                for (const message of messages) {
                    // Filtra los mensajes que tienen el campo "from"
                    if (message.from) {
                        const newMessage = new Message({
                            recipient_phone: message.to || 'unknown',  // Ajustar según tu estructura
                            message_id: message.id,
                            display_phone_number: body.entry[0].changes[0].value.metadata.display_phone_number,
                            display_phone_number_id: body.entry[0].changes[0].value.metadata.phone_number_id,
                            conversation_id: message.context ? message.context.id : 'unknown',  // Ajustar según tu estructura
                            message_text: message.text.body,
                            type: message.type,
                            created_time: new Date(message.timestamp * 1000)  // Si el timestamp está en segundos
                        });
                        await newMessage.save();
                    }
                }
                res.status(200).send('EVENT_RECEIVED');
            } catch (error) {
                console.error('Error saving message:', error);
                res.status(500).send('Error saving message');
            }
        } else {
            res.status(200).send('EVENT_RECEIVED');
        }
    } else {
        // Si no se recibe un objeto esperado, responde con un error
        res.sendStatus(404);
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
