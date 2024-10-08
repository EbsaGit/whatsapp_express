const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Importa cors
const connectDB = require('./src/config/database');
const { initWebSocket, getWebSocket } = require('./src/config/websocket');
const Message = require('./src/models/Message');
const Chat = require('./src/models/Chat');
const http = require('http'); // Importar http para crear servidor
const WebSocket = require('ws');
const { formatInTimeZone } = require('date-fns-tz');

const app = express();
const port = process.env.PORT || 3000;

const VERIFY_TOKEN = "holamundo94";

// Conectar a MongoDB
connectDB();

// Middleware para parsear JSON
app.use(bodyParser.json());

// Habilitar CORS para todas las rutas
app.use(cors());

// Crear servidor HTTP
const server = http.createServer(app);

initWebSocket(server);

const MessageRoute = require('./src/routes/MessageRoute');
const ZohoRoute = require('./src/routes/ZohoRoute');
const imageRoutes = require('./src/routes/ImageRoutes');

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Uso de las rutas
app.use('/api', MessageRoute);
app.use('/api', ZohoRoute);
app.use('/api', imageRoutes);

// Endpoint para recibir y responder a los eventos de webhook
app.post('/webhook', async (req, res) => {
    const body = req.body;
    // Verifica y maneja el evento del webhook de WhatsApp
    if (body.object) {

        // Procesa los mensajes aquí
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const messages = body.entry[0].changes[0].value.messages;
            console.log('Webhook received');
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

                        let newMessage;
                        if (message.type == "text") {
                            newMessage = new Message({
                                recipient_phone: message.from || 'unknown',
                                message_id: message.id,
                                display_phone_number: body.entry[0].changes[0].value.metadata.display_phone_number,
                                display_phone_number_id: body.entry[0].changes[0].value.metadata.phone_number_id,
                                conversation_id: message.context ? message.context.id : 'unknown',
                                message_text: message.text.body,
                                type: "cliente",
                                contact: body.entry[0].changes[0].value.contacts[0].profile.name,
                                created_time: createdTime
                            });
                        } else if (message.type == "image") {
                            newMessage = new Message({
                                recipient_phone: message.from || 'unknown',
                                message_id: message.id,
                                display_phone_number: body.entry[0].changes[0].value.metadata.display_phone_number,
                                display_phone_number_id: body.entry[0].changes[0].value.metadata.phone_number_id,
                                conversation_id: message.context ? message.context.id : 'unknown',
                                media_id: message.image.id,
                                tipo_media: message.type,
                                type: "cliente",
                                contact: body.entry[0].changes[0].value.contacts[0].profile.name,
                                created_time: createdTime
                            });
                        } else if (message.type == "document") {
                            newMessage = new Message({
                                recipient_phone: message.from || 'unknown',
                                message_id: message.id,
                                display_phone_number: body.entry[0].changes[0].value.metadata.display_phone_number,
                                display_phone_number_id: body.entry[0].changes[0].value.metadata.phone_number_id,
                                conversation_id: message.context ? message.context.id : 'unknown',
                                media_id: message.document.id,
                                file_name: message.document.filename,
                                tipo_media: message.type,
                                type: "cliente",
                                contact: body.entry[0].changes[0].value.contacts[0].profile.name,
                                created_time: createdTime
                            });
                        }

                        const guardarMensaje = await newMessage.save();
                        console.log(guardarMensaje);
                        let contact = body.entry[0].changes[0].value.contacts[0].profile.name;
                        let phone = message.from;
                        await handleChatMessage(phone, contact);
                        console.log("Enviando e WS....");
                        const wss = getWebSocket();
                        // Emitir el mensaje nuevo a través del WebSocket
                        wss.clients.forEach((client) => {
                            if (client.readyState === WebSocket.OPEN) {
                                // Transformar el mensaje al formato requerido
                                const formattedMessage = {
                                    text: guardarMensaje.message_text,
                                    sender: guardarMensaje.type === "meta" ? "sent" : "received",
                                    recipient_phone: guardarMensaje.recipient_phone,
                                    contact: guardarMensaje.contact,
                                    time: new Date(guardarMensaje.created_time), // Asegurarse de formatear la fecha correctamente
                                    message_id: guardarMensaje.message_id,
                                    media_id: guardarMensaje.media_id,
                                    tipo_media: guardarMensaje.tipo_media,
                                    file_name: guardarMensaje.file_name || '', // Nombre del archivo si aplica
                                };
                                console.log("mensaje:", formattedMessage);
                                console.log("Client:", client);
                                // Enviar el mensaje formateado al cliente WebSocket
                                client.send(JSON.stringify(formattedMessage));
                            }
                        });
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

// Función para crear o actualizar chat
async function handleChatMessage(phone, contact) {
    try {
        let chat = await Chat.findOne({ phone: phone });

        if (chat) {
            // Si el chat ya existe, actualiza lastResponseTime y contact
            chat.lastResponseTime = Date.now();
            chat.unreadMessages = true;
            await chat.save();
        } else {
            // Si no existe, crea un nuevo registro
            const newChat = new Chat({
                phone: phone,
                contact: contact,
                lastResponseTime: Date.now(),
                unreadMessages: true
            });
            await newChat.save();
        }
    } catch (error) {
        console.error("Error al crear el chat:", error);
    }
}

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

// Iniciar el servidor en el puerto especificado
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
