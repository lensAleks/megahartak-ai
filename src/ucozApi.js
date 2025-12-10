// src/ucozApi.js
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import fetchModule from 'node-fetch';

// node-fetch@2 в ESM даёт объект с .default
const fetch = fetchModule.default || fetchModule;


console.log("🔥 Loaded NEW ucozApi.js — version 2");

// Инициализируем OAuth 1.0a с твоими ключами из env
const oauth = new OAuth({
  consumer: {
    key: process.env.UCOZ_CONSUMER_KEY,
    secret: process.env.UCOZ_CONSUMER_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  },
});

// Токен из env
const token = {
  key: process.env.UCOZ_TOKEN,
  secret: process.env.UCOZ_TOKEN_SECRET,
};

// Домен uCoz из env, без хвостового /
const UCOZ_DOMAIN = (process.env.UCOZ_DOMAIN || '').replace(/\/+$/, '');

function buildUrlWithParams(baseUrl, params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      usp.append(key, String(value));
    }
  }
  return `${baseUrl}?${usp.toString()}`;
}

/**
 * Получение страницы товаров из uCoz uAPI
 *
 * @param {Object} options
 * @param {string} options.page  - страница uAPI (по умолчанию allgoods)
 * @param {number} options.pnum  - номер страницы (1..N)
 * @param {number} options.rows  - кол-во товаров на страницу
 */
export async function fetchGoodsPage({ page = 'allgoods', pnum = 1, rows = 20 } = {}) {
  if (!UCOZ_DOMAIN) {
    throw new Error('UCOZ_DOMAIN env var is not set');
  }

  const baseUrl = `${UCOZ_DOMAIN}/uapi/shop/request`;

  // Параметры самого метода uAPI
  const params = {
    page,
    pnum,
    rows,
    format: 'json', // чтобы вернуть JSON
  };

  // Данные для расчёта подписи
  const requestData = {
    url: baseUrl,
    method: 'GET',
    data: params,
  };

  // oauth_* параметры (nonce, timestamp и т.д.)
  const oauthParams = oauth.authorize(requestData, token);

  // ВСЕ параметры, которые должны попасть в query и в подпись
  const allParams = { ...params, ...oauthParams };

  // Формируем финальный URL: /uapi/shop/request?page=allgoods&...&oauth_...
  const finalUrl = buildUrlWithParams(baseUrl, allParams);

  console.log('🔗 uAPI URL:', finalUrl);

  const res = await fetch(finalUrl);
  const text = await res.text();

  if (!res.ok) {
    console.error('uAPI error body:', text);
    throw new Error(`uAPI error ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Failed to parse uAPI response as JSON: ${e.message}. Raw response: ${text}`
    );
  }
}
