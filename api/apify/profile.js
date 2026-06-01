const { apifyRequest } = require('../../lib/apify');
const { allowCors } = require('../../lib/vercel-api');
const { requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        const data = await apifyRequest(user, '/users/me');
        return res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao validar Apify:', error);
        return res.status(error.statusCode || 502).json({ error: error.message });
    }
};
