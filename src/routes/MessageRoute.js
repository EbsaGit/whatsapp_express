const express = require('express');
const Message = require('../models/Message');
const axios = require('axios');
const MessageRoute = express.Router();
const { formatInTimeZone } = require('date-fns-tz');

MessageRoute.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ recipient_phone: 1 });
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los mensajes' });
    }
});

MessageRoute.post('/messages/send_save', async (req, res) => {
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
            
            // Enviar el mensaje al WebSocket para que el frontend se actualice
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(guardarMensaje)); // Enviar el mensaje al frontend
                }
            });

            res.sendStatus(200);
        } catch (error) {
            //Enviar respuesta con error al frontend para indicar el fallo en el envío
            res.status(500).json({
                error: true,
                message: 'Error al enviar el mensaje.',
                details: error.response ? error.response.data : error.message
            });
        }
    } catch (error) {
        console.error("Error al enviar el mensaje:", error);
        res.sendStatus(403);
    }
});

module.exports = MessageRoute;

