// api/generate.js
import axios from 'axios';

const sendError = (res, status, msg, detail) => {
  res.status(status).json({ error: msg, detail });
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  // backend auth check
  const incomingKey = req.headers['x-backend-key'];
  if (!incomingKey || incomingKey !== process.env.BACKEND_KEY) {
    return sendError(res, 401, 'Unauthorized: invalid backend key');
  }

  const apiKey = process.env.GEN_API_KEY;
  if (!apiKey) {
    return sendError(res, 500, 'GEN_API_KEY missing on server');
  }

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `gemini-2.5-flash-image:generateContent?key=${apiKey}`;

    const googleResp = await axios.post(url, req.body, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'json',
      timeout: 120000
    });

    return res.status(googleResp.status).json(googleResp.data);
  } catch (err) {
    console.error('[backend] error:', err?.message, err?.response?.data);
    const detail = err?.response?.data ?? err?.message ?? String(err);
    return sendError(res, 502, 'Proxy failed', detail);
  }
}
