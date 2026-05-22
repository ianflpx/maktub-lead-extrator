const { connectToDatabase } = require('../lib/mongodb');
const { Empresa } = require('../lib/models');
const { allowCors } = require('../lib/vercel-api');

function normalizeEmpresas(empresas) {
    const validEmpresas = [];
    const seenUrls = new Set();

    empresas.forEach((empresa) => {
        const linkedinUrl = empresa.linkedinUrl || empresa.url;
        if (!linkedinUrl || seenUrls.has(linkedinUrl)) {
            return;
        }

        seenUrls.add(linkedinUrl);

        const cleanEmpresa = new Empresa({
            ...empresa,
            linkedinUrl,
            _maktubType: empresa._maktubType || empresa.type || empresa.industry
        }).toObject();

        delete cleanEmpresa._id;
        validEmpresas.push(cleanEmpresa);
    });

    return validEmpresas;
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            const empresas = await Empresa.find().sort({ extractedAt: -1 });
            return res.json(empresas);
        }

        if (req.method === 'POST') {
            if (!Array.isArray(req.body)) {
                return res.status(400).json({ error: 'Os dados devem ser um array de empresas' });
            }

            const empresas = normalizeEmpresas(req.body);
            const operations = empresas.map((empresa) => ({
                updateOne: {
                    filter: { linkedinUrl: empresa.linkedinUrl },
                    update: { $set: empresa },
                    upsert: true
                }
            }));

            if (operations.length > 0) {
                await Empresa.bulkWrite(operations);
            }

            return res.status(201).json({
                message: 'Empresas salvas com sucesso!',
                count: empresas.length
            });
        }

        return res.status(405).json({ error: 'Metodo nao permitido' });
    } catch (error) {
        console.error('Erro na API de empresas:', error);
        return res.status(500).json({
            error: 'Erro interno no servidor',
            details: error.message
        });
    }
};
