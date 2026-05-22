const { connectToDatabase } = require('../lib/mongodb');
const { Lead } = require('../lib/models');
const { allowCors } = require('../lib/vercel-api');

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    try {
        await connectToDatabase();

        if (req.method === 'POST') {
            const leads = req.body;
            if (!Array.isArray(leads)) {
                return res.status(400).json({ error: 'Os dados devem ser um array de leads' });
            }

            const savedLeads = await Lead.insertMany(leads.map((lead) => ({
                ...lead,
                fullName: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
                companyName: lead.companyName
                    || (lead.currentPosition && lead.currentPosition[0] ? lead.currentPosition[0].companyName : null)
                    || 'Nao informada'
            })));

            return res.status(201).json({
                message: 'Leads salvos com sucesso!',
                count: savedLeads.length
            });
        }

        if (req.method === 'GET') {
            const leads = await Lead.find().sort({ extractedAt: -1 }).limit(100);
            return res.json(leads);
        }

        return res.status(405).json({ error: 'Metodo nao permitido' });
    } catch (error) {
        console.error('Erro na API de leads:', error);
        return res.status(500).json({
            error: 'Erro interno no servidor',
            details: error.message
        });
    }
};
