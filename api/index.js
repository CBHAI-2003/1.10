const crypto = require('crypto');

// === 配置 ===
// DEEPSEEK_API_KEY 和 ADMIN_KEY 在 Vercel 环境变量里设置

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

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method;

  const getUser = () => {
    const a = req.headers.authorization;
    return a ? DB.users.find(u => u.api_key === a.replace('Bearer ', '')) : null;
  };

  try {
    if (method === 'GET' && (path === '/api/' || path === '/api')) {
      return res.json({
        name: 'China AI Gateway',
        status: 'running',
        models: Object.keys(MODELS).filter(k => MODELS[k].key).length,
        endpoints: [
          'GET /api/  - this page',
          'GET /api/models - list models',
          'POST /api/register - get API key',
          'GET /api/balance - check balance',
          'POST /api/redeem - redeem code',
          'POST /api/generate - admin: create codes',
          'POST /api/webhook - LemonSqueezy callback',
        ],
      });
    }

    if (method === 'GET' && path === '/api/models') {
      const list = Object.keys(MODELS).filter(k => MODELS[k].key).map(k => ({ id: k, name: MODELS[k].model }));
      return res.json({ models: list });
    }

    if (method === 'POST' && path === '/api/register') {
      const key = genKey();
      DB.users.push({ id: crypto.randomUUID(), api_key: key, balance: 1000, spent: 0, email: req.body?.email || null, created_at: new Date().toISOString() });
      return res.json({ api_key: key, balance: 1000, note: '$10 free credit!' });
    }

    if (method === 'GET' && path === '/api/balance') {
      const u = getUser();
      if (!u) return res.status(401).json({ error: 'Invalid API key' });
      return res.json({ balance: u.balance, spent: u.spent });
    }

    if (method === 'POST' && path === '/api/redeem') {
      const u = getUser();
      if (!u) return res.status(401).json({ error: 'Invalid API key' });
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Missing code' });
      const t = DB.tokens.find(x => x.code === code && !x.used);
      if (!t) return res.status(400).json({ error: 'Invalid code' });
      t.used = true;
      u.balance += t.value;
      return res.json({ ok: true, added: t.value, balance: u.balance });
    }

    if (method === 'POST' && path === '/api/generate') {
      if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
      const { count = 1, value = 1000 } = req.body || {};
      const codes = [];
      for (let i = 0; i < count; i++) {
        const c = genCode();
        DB.tokens.push({ id: crypto.randomUUID(), value, code: c, used: false });
        codes.push({ code: c, value });
      }
      return res.json({ count, codes });
    }

    if (method === 'POST' && path === '/api/webhook') {
      const data = req.body?.data?.attributes || {};
      const amt = Math.max(Math.round((data.total || 0) * 100), 1000);
      const c = genCode();
      DB.tokens.push({ id: crypto.randomUUID(), value: amt, code: c, used: false });
      const email = data.user_email;
      if (email) {
        const u = DB.users.find(x => x.email === email);
        if (u) { u.balance += amt; const t = DB.tokens.find(x => x.code === c); if (t) t.used = true; }
      }
      return res.json({ ok: true });
    }

    return res.status(404).json({ error: 'Not found', path, try: 'GET /api/' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
