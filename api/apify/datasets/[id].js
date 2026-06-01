const { allowCors, getRouteParam } = require('../../../lib/vercel-api');
const { requireAuth } = require('../../../lib/auth');
const { getDatasetItems } = require('../datasets');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        const datasetId = getRouteParam(req, 'id');
        if (!datasetId) {
            return res.status(400).json({ error: 'datasetId obrigatorio' });
        }

        req.query = { ...(req.query || {}), datasetId };
        return getDatasetItems(req, res, user);
    } catch (error) {
        console.error('Erro ao ler dataset Apify:', error);
        return res.status(error.statusCode || 502).json({ error: error.message });
    }
};
