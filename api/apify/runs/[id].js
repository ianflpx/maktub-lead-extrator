const { allowCors, getRouteParam } = require('../../../lib/vercel-api');
const { requireAuth } = require('../../../lib/auth');
const { getRunStatus } = require('../runs');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        const runId = getRouteParam(req, 'id');
        if (!runId) {
            return res.status(400).json({ error: 'runId obrigatorio' });
        }

        req.query = { ...(req.query || {}), runId };
        return getRunStatus(req, res, user);
    } catch (error) {
        console.error('Erro ao consultar run Apify:', error);
        return res.status(error.statusCode || 502).json({ error: error.message });
    }
};
