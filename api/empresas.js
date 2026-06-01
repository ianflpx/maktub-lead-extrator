const { connectToDatabase } = require('../lib/mongodb');
const { Empresa } = require('../lib/models');
const { allowCors } = require('../lib/vercel-api');
const { requireAuth } = require('../lib/auth');

let legacyIndexChecked = false;

function firstUrl(...values) {
    return values.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()))?.trim() || '';
}

async function dropLegacyLinkedinIndex() {
    if (legacyIndexChecked) return;
    legacyIndexChecked = true;
    try {
        await Empresa.collection.dropIndex('linkedinUrl_1');
    } catch (error) {
        if (error.codeName !== 'IndexNotFound') {
            console.warn('Nao foi possivel remover indice legado linkedinUrl_1:', error.message);
        }
    }
}

function normalizeEmpresas(empresas, userId) {
    const validEmpresas = [];
    const seenUrls = new Set();

    empresas.forEach((empresa) => {
        const linkedinUrl = empresa.linkedinUrl || empresa.url;
        if (!linkedinUrl || seenUrls.has(linkedinUrl)) {
            return;
        }

        seenUrls.add(linkedinUrl);

        const logoUrl = firstUrl(
            empresa.logoUrl,
            empresa.logo,
            empresa.companyLogoUrl,
            empresa.companyLogo,
            empresa.imageUrl,
            empresa.image,
            empresa.pictureUrl,
            empresa.picture
        );

        const cleanEmpresa = new Empresa({
            ...empresa,
            userId,
            linkedinUrl,
            _maktubType: empresa._maktubType || empresa.type || empresa.industry
        }).toObject();

        if (logoUrl) {
            cleanEmpresa.logo = logoUrl;
            cleanEmpresa.logoUrl = logoUrl;
        } else {
            delete cleanEmpresa.logo;
            delete cleanEmpresa.logoUrl;
        }

        delete cleanEmpresa._id;
        delete cleanEmpresa.isClient;
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
        await dropLegacyLinkedinIndex();
        const user = await requireAuth(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const empresas = await Empresa.find({ userId: user._id })
                .select('_id name title industry type _maktubType location headquarters country employeeCount staffCount employees linkedinUrl url website websiteUrl logo logoUrl description summary isClient extractedAt updatedAt')
                .sort({ extractedAt: -1 })
                .limit(1000)
                .lean();
            return res.json(empresas);
        }

        if (req.method === 'POST') {
            if (!Array.isArray(req.body)) {
                return res.status(400).json({ error: 'Os dados devem ser um array de empresas' });
            }

            const empresas = normalizeEmpresas(req.body, user._id);
            const operations = empresas.map((empresa) => ({
                updateOne: {
                    filter: { userId: user._id, linkedinUrl: empresa.linkedinUrl },
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
