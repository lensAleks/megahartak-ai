// src/ucozApi.js
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import fetch from "node-fetch";

const oauth = OAuth({
  consumer: {
    key: process.env.UCOZ_CONSUMER_KEY,
    secret: process.env.UCOZ_CONSUMER_SECRET,
  },
  signature_method: "HMAC-SHA1",
  hash_function(baseString, key) {
    return crypto.createHmac("sha1", key).update(baseString).digest("base64");
  },
});

const token = {
  key: process.env.UCOZ_TOKEN,
  secret: process.env.UCOZ_TOKEN_SECRET,
};

/**
 * Загружаем страницу товаров из uCoz-магазина через uAPI.
 * page=allgoods — ОБЯЗАТЕЛЬНЫЙ параметр (список всех товаров).
 * pnum — номер страницы (в доке pnum=PAGE_NUM).
 */
export async function fetchGoodsPage({ pageNum = 1 } = {}) {
  // ВАЖНО: используется именно /uapi/shop/request
  const url = new URL(`${process.env.UCOZ_DOMAIN}/uapi/shop/request`);

  url.searchParams.set("page", "allgoods");          // обязательный
  url.searchParams.set("pnum", String(pageNum));     // номер страницы
  url.searchParams.set("format", "json");            // удобный формат

  const requestData = { url: url.toString(), method: "GET" };
  const headers = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await fetch(requestData.url, {
    method: "GET",
    headers,
  });

  const text = await response.text();

  if (!response.ok) {
    console.error("uAPI raw response:", text);
    throw new Error(`uAPI error ${response.status}: ${text}`);
  }

  // по доке ответ — JSON
  return JSON.parse(text);
}
