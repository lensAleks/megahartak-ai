// src/ucozApi.js
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import fetch from "node-fetch";

// Настраиваем OAuth 1.0a (как требует uAPI)
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

// Токен, который ты создала в uAPI
const token = {
  key: process.env.UCOZ_TOKEN,
  secret: process.env.UCOZ_TOKEN_SECRET,
};

/**
 * Загружает страницу товаров из uCoz-магазина.
 * page=allgoods — список всех товаров, пейджинг через pnum.
 */
export async function fetchGoodsPage({ pageNum = 1 } = {}) {
  // 1. Сначала собираем URL с бизнес-параметрами (page/pnum/format)
  const url = new URL(`${process.env.UCOZ_DOMAIN}/uapi/shop/request`);
  url.searchParams.set("page", "allgoods");
  url.searchParams.set("pnum", String(pageNum));
  url.searchParams.set("format", "json");

  // 2. Данные для подписи — уже с page/pnum внутри
  const requestData = {
    url: url.toString(),
    method: "GET",
  };

  // 3. Считаем oauth_* с учётом этих параметров
  const oauthParams = oauth.authorize(requestData, token);

  // 4. Кладём oauth_* в query string (классический OAuth 1.0),
  //    а НЕ в заголовок Authorization — именно этого хочет uAPI
  for (const [key, value] of Object.entries(oauthParams)) {
    url.searchParams.set(key, value);
  }

  // 5. Отправляем запрос без Authorization header
  const response = await fetch(url.toString(), { method: "GET" });
  const text = await response.text();

  if (!response.ok) {
    console.error("uAPI raw response:", text);
    throw new Error(`uAPI error ${response.status}: ${text}`);
  }

  // uAPI возвращает JSON
  return JSON.parse(text);
}
