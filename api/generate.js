// api/generate.js (Vercel) - CORS-aware proxy to Gemini
import axios from 'axios';

/**
 * Helper: build CORS headers based on allowed origins env var.
 * - Set ALLOWED_ORIGINS="http://localhost:4200,https://your-site.com" in Vercel.
 * - For quick testing you may set ALLOWED_ORIGINS="*"
 */
function buildCorsHeaders(origin) {
  const env = process.env.ALLOWED_ORIGINS || '*';
  const allowed = env.split(',').map(s => s.trim()).filter(Boolean);
  const allowAll = allowed.includes('*');

  const originAllowed = allowAll || (!origin ? false : allowed.includes(origin));

  // Allowed request headers we must echo for preflight
  const allowHeaders = ['Content-Type', 'x-backend-key', 'authorization', 'x-requested-with'];

  return {
    'Access-Control-Allow-Origin': originAllowed ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': allowHeaders.join(', '),
    'Access-Control-Max-Age': '600' // cache preflight for 10 minutes
  };
}

const sendError = (res, status, msg, detail) => {
  res.status(status).json({ error: msg, detail });
};

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const corsHeaders = buildCorsHeaders(origin);

  // Always set CORS headers on the response
  for (const k of Object.keys(corsHeaders)) res.setHeader(k, corsHeaders[k]);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  // Basic auth check (if you use BACKEND_KEY)
  const incomingKey = req.headers['x-backend-key'];
  if (!incomingKey || incomingKey !== process.env.BACKEND_KEY) {
    return sendError(res, 401, 'Unauthorized: invalid backend key');
  }

  const apiKey = process.env.GEN_API_KEY;
  if (!apiKey) return sendError(res, 500, 'GEN_API_KEY not configured');

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `gemini-2.5-flash-image:generateContent?key=${apiKey}`;

    const googleResp = await axios.post(url, req.body, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'json',
      timeout: 120000
    });

    // forward status + body (CORS headers already set)
    res.status(googleResp.status).json(googleResp.data);
  } catch (err) {
    console.error('[backend] proxy error:', err?.message ?? err, err?.response?.data ?? '');
    const detail = err?.response?.data ?? err?.message ?? String(err);
    return sendError(res, 502, 'Proxy failed', detail);
  }
}
