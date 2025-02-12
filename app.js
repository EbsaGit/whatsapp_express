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
//Server-based Applications "Whatsapp_dev"
const v_client_id = "1000.IPKDV3NR9Y1HJZ3RQA2K0IR97BS2JB";
const v_client_secret = "ff9572e084d37550aa2c36b1fbb586b641b85e2701";
const v_refresh_token = "1000.e66d3a8914472f929ce4591acedfab74.65d7a33e2054734c069eea5381f86377";
// Endpoint de Zoho CRM
const zohoCRMBaseURL = 'https://www.zohoapis.com/crm/v2';

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

app.post('/webhook/leads', async (req, res) => {
    const body = req.body;
    console.log("Body: ", body);

    // Validar que el campo recibido es `leadgen`
    if (body.field === 'leadgen' && body.value && body.value.leadgen_id) {
        const leadgenId = body.value.leadgen_id;
        const adId = body.value.ad_id;
        const formId = body.value.form_id;
        const pageId = body.value.page_id;
        const adgroupId = body.value.adgroup_id;
        const accessToken = 'EAAPEpuKfZAOIBO1S1ulgTVstag8S9n1RvvUg5evX6hrufVYfCTAStVaNwWgUfF4QIFu7AIIA20znSHDG4qor1oDeS0jHK9ojfnZApm048ggBrybAzsox58AxIjS6YZCNJaLEk5V3q8XlJF1lr6s6TpFzQYJXOh3ZA2QwnQ51ZBEpFmOirHbE58BQ68bxzHVOefwu86NKvoctDoYp8WwuTNb9q9wZDZD'; // Reemplaza con tu token de acceso

        try {
            // 1. Obtener los detalles del lead
            const leadDetails = await axios.get(`https://graph.facebook.com/v17.0/${leadgenId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'field_data,ad_id,form_id,created_time'
                }
            });
            const leadData = leadDetails.data;
            console.log("Detalles del lead: ", leadData);

            // 2. (Opcional) Obtener más información sobre la página
            const pageDetails = await axios.get(`https://graph.facebook.com/v17.0/${pageId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'name,category,about'
                }
            });
            console.log("Detalles de la página: ", pageDetails.data);

            // Obtener más información sobre el anuncio
            const adDetails = await axios.get(`https://graph.facebook.com/v17.0/${adId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'name,status,creative'
                }
            });
            console.log("Detalles del anuncio: ", adDetails.data);

            // Obtener más información sobre el formulario
            const formDetails = await axios.get(`https://graph.facebook.com/v17.0/${formId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'name,questions'
                }
            });
            console.log("Detalles del formulario: ", formDetails.data);

            // Obtener más información sobre el grupo de anuncios (ad set)
            const adgroupDetails = await axios.get(`https://graph.facebook.com/v17.0/${adgroupId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'name,status,campaign_id'
                }
            });
            console.log("Detalles del grupo de anuncios: ", adgroupDetails.data);

            // 3. Enviar los datos a Zoho CRM
            const zohoAccessToken = 'YOUR_ZOHO_ACCESS_TOKEN'; // Reemplaza con tu token de acceso a Zoho CRM

            const zohoResponse = await axios.post(
                'https://www.zohoapis.com/crm/v2/Leads',
                {
                    data: [
                        {
                            Last_Name: 'Nombre del lead', // Mapea los datos del lead
                            Email: 'email@example.com',   // Mapea los datos que necesites
                            // Agrega más campos de Zoho según sea necesario
                        }
                    ]
                },
                {
                    headers: {
                        Authorization: `Zoho-oauthtoken ${zohoAccessToken}`
                    }
                }
            );

            console.log("Respuesta de Zoho CRM: ", zohoResponse.data);
            res.status(200).json({ message: 'Lead procesado y enviado a Zoho CRM' });

        } catch (error) {
            console.error("Error al procesar el lead: ", error);
            res.status(500).json({ error: error.message });
        }
    } else {
        console.log("body", body);
        res.status(400).json({ message: 'Formato de evento no soportado' });
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
            //Buscar en CRM y si no existe crea
            const zcrm = await zcrmReg(phone, contact);
            const zcrm_lead_id = zcrm.data.zcrm_lead_id;
            const zcrm_contact_id = zcrm.data.zcrm_lead_id;
            const zcrm_lead_owner = zcrm.data.zcrm_lead_owner;
            const zcrm_contact_owner = zcrm.data.zcrm_contact_owner;
            // Si no existe, crea un nuevo registro
            const newChat = new Chat({
                phone: phone,
                contact: contact,
                lastResponseTime: Date.now(),
                unreadMessages: true,
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

async function zcrmReg(phone, contact) {
    try {
        const access_token = await getAccessToken();

        const headers = {
            Authorization: `Bearer ${access_token}`
        };

        //Inicializa variables de respuesta
        let zcrm_lead_id = null;
        let zcrm_contact_id = null;
        let zcrm_lead_owner = null;
        let zcrm_contact_owner = null;

        //Busca en Leads
        const leadsResponse = await axios.get(`${zohoCRMBaseURL}/Leads/search?Mobile=${phone}`, { headers });
        const leadData = leadsResponse.data.data?.[0];
        if (leadData) {
            zcrm_lead_id = leadData.id;
            zcrm_lead_owner = leadData.Owner.id;
        }

        //Busca en Contactos
        const contactsResponse = await axios.get(`${zohoCRMBaseURL}/Contacts/search?Mobile=${phone}`, { headers });
        const contactData = contactsResponse.data.data?.[0];
        if (contactData) {
            zcrm_contact_id = contactData.id;
            zcrm_contact_owner = contactData.Owner.id;
        }

        //Si no encuentra ni en Leads ni en Contacts, crea un Lead
        if (!zcrm_lead_id && !zcrm_contact_id) {
            //Map nuevo Lead
            const newLeadData = {
                data: [
                    {
                        "Last_Name": contact,
                        "Mobile": phone,
                        "Company": "",
                        "Lead_Source": "Whatsapp - Dev",
                        "Rubro": "",
                        "Unidad": "Zoho"
                    }
                ]
            };

            const leadCreationResponse = await axios.post(`${zohoCRMBaseURL}/Leads`, newLeadData, { headers });
            const createdLead = leadCreationResponse.data?.[0].details;

            if (createdLead) {
                zcrm_lead_id = createdLead.id;
                zcrm_lead_owner = createdLead.Created_By.id;
            }
        }

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

// Endpoint para la verificación del webhook de Leads
app.get('/webhook/leads', (req, res) => {
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
