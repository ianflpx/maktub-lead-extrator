const { apifyRequest } = require('../../lib/apify');
const { allowCors } = require('../../lib/vercel-api');
const { requireAuth } = require('../../lib/auth');
const { recordApiUsage } = require('../../lib/usage');

async function getDatasetItems(req, res, user) {
    const datasetId = String(req.query?.datasetId || req.query?.id || '').trim();
    const runId = String(req.query?.runId || '').trim();
    const operation = String(req.query?.operation || 'dataset');

    if (!datasetId) {
        return res.status(400).json({ error: 'datasetId obrigatorio' });
    }

    const items = await apifyRequest(user, `/datasets/${encodeURIComponent(datasetId)}/items`, {
        headers: { Accept: 'application/json' },
        timeoutMs: 60000
    });

    if (runId) {
        await recordApiUsage({
            userId: user._id,
            provider: 'apify',
            operation,
            requestCount: 1,
            resultCount: Array.isArray(items) ? items.length : 0,
            runId,
            datasetId
        });
    }

    return res.status(200).json(items);
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;
        return getDatasetItems(req, res, user);
    } catch (error) {
        console.error('Erro ao ler dataset Apify:', error);
        return res.status(error.statusCode || 502).json({ error: error.message });
    }
};

module.exports.getDatasetItems = getDatasetItems;
