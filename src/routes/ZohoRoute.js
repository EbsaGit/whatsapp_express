const axios = require("axios");
const express = require("express");

const ZohoRoute = express.Router();

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

module.exports = ZohoRoute;
