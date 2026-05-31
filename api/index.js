const crypto = require('crypto');  
const MODELS = {  
  deepseek: {  
    url: 'https://api.deepseek.com/v1/chat/completions',  
    key: process.env.DEEPSEEK_API_KEY || '',  
    model: 'deepseek-chat',  
  },  
};  
const DB = global.__DB || (global.__DB = { users: [], tokens: [] });  
function genKey() { return 'sk-' + crypto.randomBytes(24).toString('hex'); }  
function genCode() { return 'CHINA-' + crypto.randomBytes(4).toString('hex').toUpperCase(); }  
function calcCost(p, c) { return Math.ceil((p / 1000) * 0.02 + (c / 1000) * 0.02); }  
module.exports = async (req, res) => {  
  res.setHeader('Access-Control-Allow-Origin', '*');  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');  
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');  
  if (req.method === 'OPTIONS') return res.status(200).end();  
  const url = new URL(req.url, 'http://localhost');  
  const path = url.pathname.replace(/\/+$/, '') || '/';  
  const method = req.method;  
  const getUser = () => { const a = req.headers.authorization; return a ? DB.users.find(u => u.api_key === a.replace('Bearer ', '')) : null; };  
  try {  
    if (method === 'GET') {  
      if (path === '/api/' || path === '/api') return res.json({ status: 'ok', models: Object.keys(MODELS).filter(k => MODELS[k].key).length });  
      if (path === '/api/models') return res.json({ models: Object.keys(MODELS).filter(k => MODELS[k].key).map(k => ({ id: k, name: MODELS[k].model })) });  
      if (path === '/api/balance') { const u = getUser(); if (!u) return res.status(401).json({ error: 'Invalid API key' }); return res.json({ balance: u.balance, spent: u.spent }); }  
    }  
    if (method === 'POST') {  
      if (path === '/api/register') { const key = genKey(); DB.users.push({ id: crypto.randomUUID(), api_key: key, balance: 1000, spent: 0, email: req.body?.email || null }); return res.json({ api_key: key, balance: 1000 }); }  
      if (path === '/api/redeem') { const u = getUser(); if (!u) return res.status(401).json({ error: 'Invalid API key' }); const { code } = req.body || {}; if (!code) return res.status(400).json({ error: 'Missing code' }); const t = DB.tokens.find(x => x.code === code && !x.used); if (!t) return res.status(400).json({ error: 'Invalid code' }); t.used = true; u.balance += t.value; return res.json({ ok: true, added: t.value, balance: u.balance }); }  
      if (path === '/api/generate') { if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' }); const { count = 1, value = 1000 } = req.body || {}; const codes = []; for (let i = 0; i < count; i++) { const c = genCode(); DB.tokens.push({ id: crypto.randomUUID(), value, code: c, used: false }); codes.push({ code: c, value }); } return res.json({ count, codes }); }  
    }  
    return res.status(404).json({ error: `Not found: ${path}` });  
  } catch (e) { return res.status(500).json({ error: e.message }); }  
};  
