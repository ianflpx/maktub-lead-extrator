const { connectToDatabase } = require('../../lib/mongodb');
const { Empresa } = require('../../lib/models');
const { allowCors } = require('../../lib/vercel-api');
const { requireAuth } = require('../../lib/auth');

function ownerOrLegacyFilter(id, userId) {
    const userIdString = String(userId);
    return {
        _id: id,
        $or: [
            { userId },
            { userId: userIdString },
            { userId: { $exists: false } },
            { userId: null }
        ]
    };
}

async function findAndUpdateOwnedOrListedCompany(id, userId, update) {
    const options = { new: true };
    const scopedUpdate = { $set: { ...update, userId } };

    const ownedOrLegacy = await Empresa.findOneAndUpdate(
        ownerOrLegacyFilter(id, userId),
        scopedUpdate,
        options
    );
    if (ownedOrLegacy) return ownedOrLegacy;

    return Empresa.findOneAndUpdate({ _id: id }, scopedUpdate, options);
}

async function findAndDeleteOwnedOrListedCompany(id, userId) {
    const ownedOrLegacy = await Empresa.findOneAndDelete(ownerOrLegacyFilter(id, userId));
    if (ownedOrLegacy) return ownedOrLegacy;

    return Empresa.findOneAndDelete({ _id: id });
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    if (!['DELETE', 'PATCH'].includes(req.method)) {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        await connectToDatabase();
        const user = await requireAuth(req, res);
        if (!user) return;

        if (req.method === 'PATCH') {
            const allowedFields = {};
            if (Object.prototype.hasOwnProperty.call(req.body || {}, 'isClient')) {
                allowedFields.isClient = Boolean(req.body.isClient);
            }

            if (Object.keys(allowedFields).length === 0) {
                return res.status(400).json({ error: 'Nenhum campo valido para atualizar' });
            }

            const updated = await findAndUpdateOwnedOrListedCompany(req.query.id, user._id, allowedFields);

            if (!updated) {
                return res.status(404).json({ error: 'Empresa nao encontrada' });
            }

            return res.json(updated);
        }

        const result = await findAndDeleteOwnedOrListedCompany(req.query.id, user._id);
        if (!result) {
            return res.status(404).json({ error: 'Empresa nao encontrada' });
        }

        return res.json({ message: 'Empresa deletada com sucesso' });
    } catch (error) {
        console.error('Erro ao processar empresa:', error);
        return res.status(500).json({
            error: 'Erro interno no servidor',
            details: error.message
        });
    }
};
