const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { formatInTimeZone } = require('date-fns-tz');
const path = require('path');
const Message = require('../models/Message')

const imageRoutes = express.Router();

// Configurar Multer para almacenar archivos en una carpeta temporal
const upload = multer({ dest: 'uploads/' });

imageRoutes.post("/upload-image/:PHONE_NUMBER_ID/:recipient_phone", upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No se proporcionó ningún archivo.");
    }

    const authHeader = req.headers['authorization'];
    const ACCESS_TOKEN = authHeader && authHeader.split(' ')[1]; // Asumiendo que el token es del tipo "Bearer token"
    const PHONE_NUMBER_ID = req.params.PHONE_NUMBER_ID;
    const RECIPIENT_PHONE = req.params.recipient_phone;

    const filePath = req.file.path; // Usa la ruta del archivo directamente desde multer
    const fileStream = fs.createReadStream(filePath);

    const form = new FormData();

    form.append('file', fileStream, {
        contentType: req.file.mimetype,
        filename: req.file.originalname,
    });

    form.append('messaging_product', 'whatsapp');

    try {
        const mediaResponse = await axios.post(`https://graph.facebook.com/v13.0/${PHONE_NUMBER_ID}/media`, form, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                ...form.getHeaders()
            }
        });

        const mediaId = mediaResponse.data.id;
        const createdTime = formatInTimeZone(
            new Date(),
            'America/Asuncion',
            'yyyy-MM-dd HH:mm:ssXXX'
        );

        

        // Ahora envía el mensaje con la imagen usando el media_id
        const messageResponse = await axios.post(`https://graph.facebook.com/v13.0/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            to: RECIPIENT_PHONE,
            type: "image",
            image: {
                id: mediaId
            }
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(messageResponse.data);

        const NewMediaMessage = new Message({
            recipient_phone: RECIPIENT_PHONE || 'unknown',  // Ajustar según tu estructura
            message_id: messageResponse.data.messages[0].id,
            display_phone_number: "15556242830",
            display_phone_number_id: PHONE_NUMBER_ID,
            conversation_id: 'unknown',  // Ajustar según tu estructura
            /*message_text: ,*/
            type: "meta",
            contact: "Corporativo",
            created_time: createdTime, // Formateado a la zona horaria de Asunción, Paraguay
            media_id :mediaId,
        })

        const guardarMensaje = await NewMediaMessage.save();

        console.log(guardarMensaje);

        res.send({send: messageResponse.data, image_id: mediaId, mongoDB: guardarMensaje});

    } catch (error) {
        res.status(500).send(error.response ? error.response.data : error.message);
    } finally {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error al eliminar el archivo temporal:', err);
        });
    }
});

// Nueva ruta para recuperar la URL de la imagen usando media_id
imageRoutes.get("/get-media-url/:PHONE_NUMBER_ID/:media_id", async (req, res) => {
    const authHeader = req.headers['authorization'];
    const ACCESS_TOKEN = authHeader && authHeader.split(' ')[1];
    const PHONE_NUMBER_ID = req.params.PHONE_NUMBER_ID;
    const MEDIA_ID = req.params.media_id;

    try {
        const response = await axios.get(`https://graph.facebook.com/v13.0/${MEDIA_ID}`, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            params: {
                'phone_number_id': PHONE_NUMBER_ID
            }
        });

        const mediaUrl = response.data.url;
        res.send({ url: mediaUrl });
    } catch (error) {
        res.status(500).send(error.response ? error.response.data : error.message);
    }
});



// Nueva ruta para descargar la imagen usando media_id
imageRoutes.get("/download-image/:PHONE_NUMBER_ID/:media_id", async (req, res) => {
    const authHeader = req.headers['authorization'];
    const ACCESS_TOKEN = authHeader && authHeader.split(' ')[1];
    const PHONE_NUMBER_ID = req.params.PHONE_NUMBER_ID;
    const MEDIA_ID = req.params.media_id;

    try {
        // Primero, obtener la URL de la imagen
        const response = await axios.get(`https://graph.facebook.com/v13.0/${MEDIA_ID}`, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            params: {
                'phone_number_id': PHONE_NUMBER_ID
            }
        });

        const mediaUrl = response.data.url;

        // Descargar la imagen desde la URL
        const imageResponse = await axios({
            url: mediaUrl,
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            method: 'GET',
            responseType: 'stream'
        });

        // Ajustar los encabezados de la respuesta para la descarga del archivo
        res.setHeader('Content-Disposition', `attachment; filename="${MEDIA_ID}.jpg"`);
        res.setHeader('Content-Type', imageResponse.headers['content-type']);

        // Enviar el contenido de la imagen como una respuesta al cliente
        imageResponse.data.pipe(res);
    } catch (error) {
        res.status(500).send(error.response ? error.response.data : error.message);
    }
});


imageRoutes.get('/proxy-image/:media_id', async (req, res) => {
    const ACCESS_TOKEN = req.query.access_token;  // Tomar el token de acceso desde los parámetros de la URL
    const MEDIA_ID = req.params.media_id;

    if (!ACCESS_TOKEN) {
        return res.status(400).send('Access token is required');
    }

    try {
        // Obtener la URL del medio
        const response = await axios.get(`https://graph.facebook.com/v13.0/${MEDIA_ID}`, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        });

        const mediaUrl = response.data.url;

        // Descargar la imagen desde la URL y servirla
        const imageResponse = await axios({
            url: mediaUrl,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        });

        res.setHeader('Content-Type', imageResponse.headers['content-type']);
        imageResponse.data.pipe(res);
    } catch (error) {
        res.status(500).send(error.response ? error.response.data : error.message);
    }
});

//upload file 

imageRoutes.post("/upload-file/:PHONE_NUMBER_ID/:recipient_phone", upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No se proporcionó ningún archivo.");
    }

    const authHeader = req.headers['authorization'];
    const ACCESS_TOKEN = authHeader && authHeader.split(' ')[1]; 
    const PHONE_NUMBER_ID = req.params.PHONE_NUMBER_ID;
    const RECIPIENT_PHONE = req.params.recipient_phone;

    const filePath = req.file.path; 
    const fileStream = fs.createReadStream(filePath);

    const form = new FormData();
    form.append('file', fileStream, {
        contentType: req.file.mimetype,
        filename: req.file.originalname,
    });

    form.append('messaging_product', 'whatsapp');

    try {
        const mediaResponse = await axios.post(`https://graph.facebook.com/v13.0/${PHONE_NUMBER_ID}/media`, form, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                ...form.getHeaders()
            }
        });

        const mediaId = mediaResponse.data.id;
        const createdTime = formatInTimeZone(new Date(), 'America/Asuncion', 'yyyy-MM-dd HH:mm:ssXXX');

        // Determinar el tipo de mensaje según el tipo MIME del archivo
        let messageType = 'document';
        let messagePayload = {
            id: mediaId,
            filename: req.file.originalname,
        };

        if (req.file.mimetype.startsWith('image/')) {
            messageType = 'image';
            messagePayload = { id: mediaId };
        } else if (req.file.mimetype.startsWith('video/')) {
            messageType = 'video';
            messagePayload = { id: mediaId };
        } else if (req.file.mimetype.startsWith('audio/')) {
            messageType = 'audio';
            messagePayload = { id: mediaId };
        } else if (req.file.mimetype.endsWith('/pdf')) {
            messageType = 'document';
            messagePayload = { id: mediaId, filename: req.file.originalname };
        }

        // Enviar el mensaje con el archivo usando el media_id
        const messageResponse = await axios.post(`https://graph.facebook.com/v13.0/${PHONE_NUMBER_ID}/messages`, {
            messaging_product: "whatsapp",
            to: RECIPIENT_PHONE,
            type: messageType,
            [messageType]: messagePayload
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(messageResponse.data);

        const NewMediaMessage = new Message({
            recipient_phone: RECIPIENT_PHONE || 'unknown', 
            message_id: messageResponse.data.messages[0].id,
            display_phone_number: "15556242830",
            display_phone_number_id: PHONE_NUMBER_ID,
            conversation_id: 'unknown',
            type: "meta",
            contact: "Corporativo",
            created_time: createdTime,
            media_id: mediaId,
            tipo_media: messageType,
            file_name: messagePayload.filename,
        });

        const guardarMensaje = await NewMediaMessage.save();

        console.log(guardarMensaje);

        res.send({send: messageResponse.data, media_id: mediaId, mongoDB: guardarMensaje});


    } catch (error) {
        res.status(500).send(error.response ? error.response.data : error.message);
    } finally {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error al eliminar el archivo temporal:', err);
        });
    }
});


//end file

module.exports = imageRoutes;
