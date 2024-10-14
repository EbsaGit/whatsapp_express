const axios = require("axios");
const express = require("express");

const ZohoRoute = express.Router();

//Server-based Applications "Whatsapp_dev"
const v_client_id = "1000.IPKDV3NR9Y1HJZ3RQA2K0IR97BS2JB";
const v_client_secret = "ff9572e084d37550aa2c36b1fbb586b641b85e2701";
const v_refresh_token = "1000.e66d3a8914472f929ce4591acedfab74.65d7a33e2054734c069eea5381f86377";

ZohoRoute.get("/zoho/getAccessToken", async (req, res) => {
  const body = req.body;

  const v_ClientID = body.v_ClientID; //"1000.8S674ZZJFLIVGRUE1DBA9I49P3DOTL";
  const v_ClientSecret = body.v_ClientSecret; //"5a5396ca1db5be47520d5bb919316035dcb62cf8e9";
  const v_RefreshToken = body.v_RefreshToken; //"1000.5b8a61978c11b4e8f7953c257eaeb368.3e30762e1d790c2462b0931f1757ce6c";

  const v_GrantType = "refresh_token";
  const v_EndPoint = "https://accounts.zoho.com/oauth/v2/token";
  const v_RedirectUri = "https://www.zoho.com/books";

  const url = v_EndPoint;
  const fields = {
    refresh_token: v_RefreshToken,
    client_id: v_ClientID,
    client_secret: v_ClientSecret,
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

    res.status(200).send(response.data);
  } catch (error) {
    console.error("Error fetching access token:", error);
    res.status(error.response ? error.response.status : 500).send({
      error: error.response ? error.response.data : 'Error desconocido',
    });
  }
});

ZohoRoute.post('/exchange-token/:code', async (req, res) => {
  const { code } = req.params;
  const clientId = '1000.IPKDV3NR9Y1HJZ3RQA2K0IR97BS2JB';
  const clientSecret = 'ff9572e084d37550aa2c36b1fbb586b641b85e2701';
  const redirectUri = 'http://localhost:4200/chats';

  const data = {
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  };

  try {
    const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', new URLSearchParams(data), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    res.status(200).send(response.data);
  } catch (error) {
    res.status(500).json({ message: 'Error al intercambiar el código por token', error: error.response.data });
  }
});

ZohoRoute.post('/get-user-data/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const response = await axios.get("https://accounts.zoho.com/oauth/user/info", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (response.data.Email) {      
      //Obtiene el access_token
      const access_token = await getAccessToken();
      const crmUsers = await axios.get('https://www.zohoapis.com/crm/v2/users', {
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
      });
  
      const users = crmUsers.data.users;
      const user = users.find(user => user.email === response.data.Email);
  
      if (user) {        
        response.data.Role = user.role.name;
        response.data.Profile = user.profile.name;
        response.data.Active = user.status;
      } else {
        console.log('No se encontró un usuario con ese email');
      }
    }
    res.status(200).send(response.data);

  } catch (error) {
    res.status(500).json({ message: 'Error al obtener datos del usuario', error: error.response.data });
  }
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


module.exports = ZohoRoute;
