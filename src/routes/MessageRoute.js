module.exports = (wss) => {
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

    //Retorna lista agrupada de chats
    MessageRoute.get('/messages/grouped', async (req, res) => {
        try {
            // Obtener todos los mensajes de la colección ordenados por fecha
            const messages = await Message.find().sort({ created_time: 1 });

            // Agrupar los mensajes por recipient_phone
            const groupedChats = messages.reduce((groupedChats, record) => {
                const phone = record.recipient_phone;

                // Si no existe un grupo para ese número de teléfono, crearlo
                if (!groupedChats[phone]) {
                    groupedChats[phone] = {
                        name: record.contact,
                        phone: phone,
                        messages: [],
                    };
                }

                // Agregar el mensaje a la lista de mensajes del grupo
                groupedChats[phone].messages.push({
                    text: record.message_text,
                    sender: record.type === "meta" ? "sent" : "received",
                    time: new Date(record.created_time),
                    message_id: record.message_id,
                    media_id: record.media_id,
                    tipo_media: record.tipo_media,
                    file_name: record.file_name || '',
                });

                return groupedChats;
            }, {});

            // Convertir el objeto agrupado a un array de chats
            const groupedChatsArray = Object.values(groupedChats);

            // Enviar el resultado como respuesta
            res.status(200).json(groupedChatsArray);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los mensajes agrupados' });
        }
    });

    //Retorna los ultimos 20 mensjaes de cada recipient_phone en un solo array
    MessageRoute.get('/messages/latest-combined', async (req, res) => {
        try {
            const lastMessages = await Message.aggregate([
                {
                    $sort: { created_time: -1 } // Ordenar por created_time en orden descendente
                },
                {
                    $group: {
                        _id: "$recipient_phone", // Agrupar por recipient_phone
                        messages: { $push: "$$ROOT" } // Agregar todos los mensajes al grupo
                    }
                },
                {
                    $project: {
                        recipient_phone: "$_id", // Renombrar _id a recipient_phone
                        messages: { $slice: ["$messages", 20] } // Obtener los últimos 20 mensajes
                    }
                }
            ]);

            // Juntar todos los arrays de mensajes en un solo array
            const combinedMessages = lastMessages.reduce((acc, group) => {
                return acc.concat(group.messages); // Agregar mensajes al array acumulador
            }, []);

            // Retornar el listado combinado de mensajes
            res.status(200).json(combinedMessages);
        } catch (error) {
            console.error("Error al obtener los últimos mensajes combinados:", error);
            res.status(500).json({ error: 'Error al obtener los últimos mensajes combinados' });
        }
    });

    //Obtiene los registros de un recipient_phone con paginacion
    MessageRoute.get('/messages/:phone/paginated', async (req, res) => {
        const { phone } = req.params;
        const { page = 1, limit = 20 } = req.query; // Parámetros para paginación

        try {
            // Buscar los mensajes del número de teléfono solicitado
            const messages = await Message.find({ recipient_phone: phone })
                .sort({ created_time: -1 }) // Ordena los mensajes por la fecha de creación
                .skip((page - 1) * limit) // Saltar los mensajes de las páginas anteriores
                .limit(parseInt(limit)); // Limitar la cantidad de mensajes a recuperar

            // Transformar los mensajes al formato requerido
            const formattedMessages = messages.map((record) => ({
                text: record.message_text,
                sender: record.type === "meta" ? "sent" : "received",
                time: new Date(record.created_time), // Formato de tiempo
                message_id: record.message_id,
                media_id: record.media_id,
                tipo_media: record.tipo_media,
                file_name: record.file_name || '', // Nombre del archivo si aplica
            }));

            res.status(200).json(formattedMessages.reverse());
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener los mensajes paginados' });
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

                // Emitir el mensaje nuevo a través del WebSocket
                console.log("WSS: ", wss);
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        // Transformar el mensaje al formato requerido
                        const formattedMessage = {
                            text: guardarMensaje.message_text,
                            sender: guardarMensaje.type === "meta" ? "sent" : "received",
                            time: new Date(guardarMensaje.created_time), // Asegurarse de formatear la fecha correctamente
                            message_id: guardarMensaje.message_id,
                            media_id: guardarMensaje.media_id,
                            tipo_media: guardarMensaje.tipo_media,
                            file_name: guardarMensaje.file_name || '', // Nombre del archivo si aplica
                        };

                        // Enviar el mensaje formateado al cliente WebSocket
                        client.send(JSON.stringify(formattedMessage));
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

    return MessageRoute;
};