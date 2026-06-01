const { findIcypeasEmail } = require('../lib/icypeas-email');
const { allowCors } = require('../lib/vercel-api');
const { requireAuth } = require('../lib/auth');
const { recordApiUsage } = require('../lib/usage');

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;
        const token = req.body?.token || user.apiKeys?.icypeasToken || '';
        const result = await findIcypeasEmail({
            token,
            lead: req.body?.lead || {}
        });

        await recordApiUsage({
            userId: user._id,
            provider: 'icypeas',
            operation: 'email-search',
            status: result.status || '',
            requestCount: 1,
            resultCount: result.email ? 1 : 0,
            estimatedCostUsd: result.email ? 0.005 : 0,
            rawUsage: {
                searchId: result.id,
                emailFound: Boolean(result.email),
                phoneFound: Boolean(result.phone)
            }
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Erro ao consultar Icypeas:', error);
        return res.status(502).json({ error: error.message });
    }
};
