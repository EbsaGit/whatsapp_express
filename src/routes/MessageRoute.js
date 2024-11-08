const express = require('express');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const axios = require('axios');
const MessageRoute = express.Router();
const { formatInTimeZone } = require('date-fns-tz');
const { getWebSocket } = require('../config/websocket');
const WebSocket = require('ws');

//Server-based Applications "Whatsapp_dev"
const v_client_id = "1000.IPKDV3NR9Y1HJZ3RQA2K0IR97BS2JB";
const v_client_secret = "ff9572e084d37550aa2c36b1fbb586b641b85e2701";
const v_refresh_token = "1000.e66d3a8914472f929ce4591acedfab74.65d7a33e2054734c069eea5381f86377";
// Endpoint de Zoho CRM
const zohoCRMBaseURL = 'https://www.zohoapis.com/crm/v2';

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

        res.status(200).json(formattedMessages);
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
        console.log("Mensaje enviado Response:", data);

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

            await handleChatMessage(guardarMensaje.recipient_phone);

            // Emitir el mensaje nuevo a través del WebSocket
            const wss = getWebSocket();
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
                        file_name: guardarMensaje.file_name || '',
                    };

                    // Enviar el mensaje formateado al cliente WebSocket
                    //Comentado por ahora
                    //client.send(JSON.stringify(formattedMessage));
                }
            });
            res.status(200).json(guardarMensaje);
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

//Función para crear o actualizar chat
async function handleChatMessage(phone) {
    try {
        let chat = await Chat.findOne({ phone: phone });

        if (!chat) {
            //Buscar en CRM y si no existe crea
            const zcrm = await zcrmReg(phone);
            const zcrm_lead_id = zcrm.data.zcrm_lead_id;
            const zcrm_contact_id = zcrm.data.zcrm_lead_id;
            const zcrm_lead_owner = zcrm.data.zcrm_lead_owner;
            const zcrm_contact_owner = zcrm.data.zcrm_contact_owner;
            // Si no existe, crea un nuevo registro
            const newChat = new Chat({
                phone: phone,
                contact: phone,
                zcrm_lead_id: zcrm_lead_id,
                zcrm_contact_id: zcrm_contact_id,
                zcrm_lead_owner: zcrm_lead_owner,
                zcrm_contact_owner: zcrm_contact_owner
            });
            await newChat.save();
        }
    } catch (error) {
        console.error("Error al crear el chat:", error);
    }
}

//Funcion para crear Lead/Contacto en Zoho
async function zcrmReg(phone) {
    try {
        //Obtiene el access_token
        const access_token = await getAccessToken();

        // Encabezados para la autenticación
        const headers = {
            Authorization: `Bearer ${access_token}`
        };

        // Inicializar variables de respuesta
        let zcrm_lead_id = null;
        let zcrm_contact_id = null;
        let zcrm_lead_owner = null;
        let zcrm_contact_owner = null;

        // Buscar en Leads
        const leadsResponse = await axios.get(`${zohoCRMBaseURL}/Leads/search?phone=${mobileNumber}`, { headers });
        const leadData = leadsResponse.data.data?.[0]; // Obtener el primer resultado si existe
        if (leadData) {
            zcrm_lead_id = leadData.id;
            zcrm_lead_owner = leadData.Owner.id; // El campo 'Owner' puede variar, asegúrate de que esté presente
        }

        // Buscar en Contactos
        const contactsResponse = await axios.get(`${zohoCRMBaseURL}/Contacts/search?phone=${mobileNumber}`, { headers });
        const contactData = contactsResponse.data.data?.[0]; // Obtener el primer resultado si existe
        if (contactData) {
            zcrm_contact_id = contactData.id;
            zcrm_contact_owner = contactData.Owner.id; // El campo 'Owner' puede variar, asegúrate de que esté presente
        }

        // Construir el objeto con la estructura solicitada
        const result = {
            data: {
                zcrm_lead_id: zcrm_lead_id || null,
                zcrm_contact_id: zcrm_contact_id || null,
                zcrm_lead_owner: zcrm_lead_owner || null,
                zcrm_contact_owner: zcrm_contact_owner || null
            }
        };

        return result;
    } catch (error) {
        console.log("Error al crear registro en crm");
        throw error;
    }
}

// Retorna lista agrupada de chats con el último mensaje de cada uno, ordenada por el tiempo del último mensaje
MessageRoute.get('/messages/chats', async (req, res) => {
    try {
        // Obtener todos los registros de la colección 'chats'
        const chats = await Chat.find();

        // Para cada chat, obtener el último mensaje asociado
        const groupedChats = await Promise.all(chats.map(async (chat) => {
            // Obtener el último mensaje de la colección 'messages' para cada chat
            const lastMessage = await Message.findOne({ recipient_phone: chat.phone })
                .sort({ created_time: -1 }); // Obtener el último mensaje

            // Calcular si el chat está activo (dentro de las 24 horas de lastResponseTime)
            let chatActivo = false;
            if (chat.lastResponseTime) {
                const timeDiff = new Date() - new Date(chat.lastResponseTime);
                const hoursDiff = timeDiff / (1000 * 60 * 60); // Diferencia en horas
                chatActivo = hoursDiff <= 24; // Si la diferencia es menor o igual a 24 horas, es true
            }

            return {
                name: chat.contact,
                phone: chat.phone,
                messages: lastMessage ? [
                    {
                        text: lastMessage.message_text,
                        sender: lastMessage.type === "meta" ? "sent" : "received",
                        time: new Date(lastMessage.created_time),
                        message_id: lastMessage.message_id,
                        media_id: lastMessage.media_id,
                        tipo_media: lastMessage.tipo_media,
                        file_name: lastMessage.file_name || '',
                    }
                ] : [], // Si no hay mensajes, se retorna una lista vacía
                lastMessageTime: lastMessage ? new Date(lastMessage.created_time) : null,
                chatActivo: chatActivo, // Si han pasado más de 24 horas, será false, si no, true
                unreadMessages: chat.unreadMessages ? chat.unreadMessages : false,
            };
        }));

        // Ordenar los chats por el tiempo del último mensaje (campo 'lastMessageTime')
        const sortedChats = groupedChats.sort((a, b) => {
            if (!a.lastMessageTime) return 1;  // Si el chat A no tiene mensajes, va después
            if (!b.lastMessageTime) return -1; // Si el chat B no tiene mensajes, va después
            return b.lastMessageTime - a.lastMessageTime; // Ordenar de más reciente a más antiguo
        });

        // Enviar el resultado como respuesta en el mismo formato que el endpoint '/messages/grouped'
        res.status(200).json(sortedChats);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los chats agrupados con el último mensaje' });
    }
});

// Marca Chat como leido
MessageRoute.put('/messages/chats/mark-as-read/:phone', (req, res) => {
    const { phone } = req.params;
    Chat.updateOne({ phone }, { unreadMessages: false })
        .then(() => res.status(200).json({ message: 'Chat marked as read' }))
        .catch((error) => res.status(500).json({ error }));
});

const getAccessToken = async () => {

    const v_GrantType = "refresh_token";
    const v_EndPoint = "https://accounts.zoho.com/oauth/v2/token";
    const v_RedirectUri = "https://www.zoho.com/books";

    const url = v_EndPoint;
    const fields = {
        refresh_token: v_refresh_token,
        client_id: v_client_id,
        client_secret: v_client_secret,
        redirect_uri: v_RedirectUri,
        grant_type: v_GrantType,
    };

    const fieldsString = Object.keys(fields)
        .map(
            (key) => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key])}`
        )
        .join("&");

    try {
        const response = await axios.post(url, fieldsString, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        return response.data.access_token;
    } catch (error) {
        console.error("Error fetching access token:", error);
        return "error";
    }
}

module.exports = MessageRoute;