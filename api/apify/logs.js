const { apifyRequest } = require('../../lib/apify');
const { allowCors } = require('../../lib/vercel-api');
const { requireAuth } = require('../../lib/auth');

async function getRunLog(req, res, user) {
    const runId = String(req.query?.runId || req.query?.id || '').trim();

    if (!runId) {
        return res.status(400).json({ error: 'runId obrigatorio' });
    }

    const text = await apifyRequest(user, `/logs/${encodeURIComponent(runId)}`, {
        headers: { Accept: 'text/plain' }
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(String(text || ''));
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;
        return getRunLog(req, res, user);
    } catch (error) {
        console.error('Erro ao ler log Apify:', error);
        return res.status(error.statusCode || 502).json({ error: error.message });
    }
};

module.exports.getRunLog = getRunLog;
