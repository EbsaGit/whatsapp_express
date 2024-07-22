const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./src/config/database');
const Message = require('./src/models/Message');
const axios = require('axios');
const { formatInTimeZone } = require('date-fns-tz'); // Importa formatInTimeZone
const app = express();
const port = process.env.PORT || 3000;

const VERIFY_TOKEN = "holamundo94";

// Conectar a MongoDB
connectDB();

// Middleware para parsear JSON
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

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
                        console.log("entro en message.from")
                        const createdTime = formatInTimeZone(
                            new Date(message.timestamp * 1000),
                            'America/Asuncion',
                            'yyyy-MM-dd HH:mm:ssXXX'
                        );

                        const newMessage = new Message({
                            recipient_phone: message.from || 'unknown',  // Ajustar según tu estructura
                            message_id: message.id,
                            display_phone_number: body.entry[0].changes[0].value.metadata.display_phone_number,
                            display_phone_number_id: body.entry[0].changes[0].value.metadata.phone_number_id,
                            conversation_id: message.context ? message.context.id : 'unknown',  // Ajustar según tu estructura
                            message_text: message.text.body,
                            type: "cliente",
                            contact: body.entry[0].changes[0].value.contacts[0].profile.name,
                            created_time: createdTime  // Formateado a la zona horaria de Asunción, Paraguay
                        });
                        const guardarMensaje = await newMessage.save();
                        console.log(guardarMensaje);
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

app.post('/api/message/send_save', async (req, res) => {
    const body = req.body;

    const text = body.text;
    const phoneRecipiest = body.phoneRecipiest;
    const Phone_Number_ID = body.Phone_Number_ID;
    const display_phone_number = body.display_phone_number;
    const accessToken = body.accessToken;

    const url = `https://graph.facebook.com/v20.0/${Phone_Number_ID}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneRecipiest,
        type: "text",
        text: {
            preview_url: true,
            body: text,
        },
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            }
        });

        const data = response.data;
        console.log("Mensaje enviado:", data);

        try {
            const createdTime = formatInTimeZone(
                new Date(),
                'America/Asuncion',
                'yyyy-MM-dd HH:mm:ssXXX'
            );

            const newMessage = new Message({
                recipient_phone: phoneRecipiest || 'unknown',  // Ajustar según tu estructura
                message_id: data.messages[0].id,
                display_phone_number: display_phone_number,
                display_phone_number_id: Phone_Number_ID,
                conversation_id: 'unknown',  // Ajustar según tu estructura
                message_text: text,
                type: "meta",
                contact: "Corporativo",
                created_time: createdTime  // Formateado a la zona horaria de Asunción, Paraguay
            });
            const guardarMensaje = await newMessage.save();
            console.log(guardarMensaje);

            res.sendStatus(200);
        } catch (error) {
            res.sendStatus(403);
        }
    } catch (error) {
        console.error("Error al enviar el mensaje:", error);
        res.sendStatus(403);
    }
});

app.get('/api/messages', async (req, res) => {
    try {
      const messages = await Message.find().sort({ recipient_phone: 1 });
      res.status(200).json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener los mensajes' });
    }
  });

// Endpoint para la verificación del webhook
app.get('/webhook', (req, res) => {
    // Verificar el token
    console.log(req.body);

    // Parsear los parámetros de la solicitud
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    console.log(req.query);

    // Verificar que el token y el modo son correctos
    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        // Responder con un error si la verificación falla
        res.sendStatus(403);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
