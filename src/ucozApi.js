const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const fetch = require('node-fetch');

const oauth = OAuth({
  consumer: {
    key: process.env.UCOZ_CONSUMER_KEY,
    secret: process.env.UCOZ_CONSUMER_SECRET
  },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  }
});

const token = {
  key: process.env.UCOZ_TOKEN,
  secret: process.env.UCOZ_TOKEN_SECRET
};

async function fetchGoodsPage({ pageNum = 1, perPage = 20 }) {
  const url = new URL(`${process.env.UCOZ_DOMAIN}/uapi/shop/request`);
  url.searchParams.set("page", "allgoods");   // ОБЯЗАТЕЛЬНО
  url.searchParams.set("pnum", String(pageNum)); // номер страницы
  url.searchParams.set("format", "json"); // чтобы ответ точно был JSON

  const requestData = { url: url.toString(), method: 'GET' };
  const headers = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await fetch(requestData.url, { method: 'GET', headers });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`uAPI error ${response.status}: ${text}`);
  }

  return await response.json();
}

module.exports = { fetchGoodsPage };
