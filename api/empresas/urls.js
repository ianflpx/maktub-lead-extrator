const { connectToDatabase } = require('../../lib/mongodb');
const { Empresa } = require('../../lib/models');
const { allowCors } = require('../../lib/vercel-api');

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        await connectToDatabase();

        const empresas = await Empresa.find({}, {
            linkedinUrl: 1,
            url: 1,
            name: 1,
            _id: 0
        });
        const urls = empresas
            .map((empresa) => empresa.linkedinUrl || empresa.url || empresa.name)
            .filter(Boolean);

        return res.json(urls);
    } catch (error) {
        console.error('Erro ao buscar URLs de empresas:', error);
        return res.status(500).json({
            error: 'Erro interno no servidor',
            details: error.message
        });
    }
};
