// ucozApi.js
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

export async function fetchGoodsPage({ pageNum = 1, perPage = 20 } = {}) {
  const url = new URL(`${process.env.UCOZ_DOMAIN}/uapi/shop/goods`);
  url.searchParams.set("page", "allgoods");
  url.searchParams.set("format", "json");
  url.searchParams.set("p", String(pageNum));
  url.searchParams.set("rows", String(perPage));

  const requestData = { url: url.toString(), method: "GET" };
  const headers = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await fetch(requestData.url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("uAPI error " + response.status);
  }

  const data = await response.json();
  return data;
}
