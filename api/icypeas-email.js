const { findIcypeasEmail } = require('../lib/icypeas-email');
const { allowCors } = require('../lib/vercel-api');

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    try {
        return res.status(200).json(await findIcypeasEmail({
            token: req.body?.token || '',
            lead: req.body?.lead || {}
        }));
    } catch (error) {
        console.error('Erro ao consultar Icypeas:', error);
        return res.status(502).json({ error: error.message });
    }
};
