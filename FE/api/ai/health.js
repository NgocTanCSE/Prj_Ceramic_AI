/**
 * FE/api/ai/health.js — Serverless health endpoint
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim() !== '');

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: 'deepseek',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    keyConfigured: hasDeepSeek,
    runtime: 'nodejs',
    version: '2026.10',
  });
}
