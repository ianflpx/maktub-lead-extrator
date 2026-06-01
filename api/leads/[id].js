const { connectToDatabase, mongoose } = require('../../lib/mongodb');
const { Lead } = require('../../lib/models');
const { allowCors } = require('../../lib/vercel-api');
const { requireAuth } = require('../../lib/auth');

function firstQueryValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

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

function ownerOrLegacyIdentityFilter(identity, userId) {
    const userIdString = String(userId);
    return {
        ...identity,
        $or: [
            { userId },
            { userId: userIdString },
            { userId: { $exists: false } },
            { userId: null }
        ]
    };
}

function buildIdentityFilters(body = {}) {
    const filters = [];
    const linkedinUrl = typeof body.linkedinUrl === 'string' ? body.linkedinUrl.trim() : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';

    if (linkedinUrl) {
        filters.push({ linkedinUrl });
        filters.push({ profileUrl: linkedinUrl });
    }

    if (fullName && companyName) {
        filters.push({ fullName, companyName });
    }

    return filters;
}

async function findAndUpdateOwnedOrLegacyLead(id, userId, update, identityFilters = []) {
    const scopedUpdate = { $set: { ...update, userId } };
    const options = { new: true };
    const normalizedId = firstQueryValue(id);

    if (mongoose.isValidObjectId(normalizedId)) {
        const ownedOrLegacy = await Lead.findOneAndUpdate(
            ownerOrLegacyFilter(normalizedId, userId),
            scopedUpdate,
            options
        ).lean();
        if (ownedOrLegacy) return ownedOrLegacy;
    }

    for (const identityFilter of identityFilters) {
        const ownedOrLegacy = await Lead.findOneAndUpdate(
            ownerOrLegacyIdentityFilter(identityFilter, userId),
            scopedUpdate,
            options
        ).lean();
        if (ownedOrLegacy) return ownedOrLegacy;
    }

    if (mongoose.isValidObjectId(normalizedId)) {
        const byId = await Lead.findOneAndUpdate({ _id: normalizedId }, scopedUpdate, options).lean();
        if (byId) return byId;
    }

    for (const identityFilter of identityFilters) {
        const byIdentity = await Lead.findOneAndUpdate(identityFilter, scopedUpdate, options).lean();
        if (byIdentity) return byIdentity;
    }

    return null;
}

async function findAndDeleteOwnedOrLegacyLead(id, userId) {
    const normalizedId = firstQueryValue(id);
    if (!mongoose.isValidObjectId(normalizedId)) return null;

    const ownedOrLegacy = await Lead.findOneAndDelete(ownerOrLegacyFilter(normalizedId, userId));
    if (ownedOrLegacy) return ownedOrLegacy;

    return Lead.findOneAndDelete({ _id: normalizedId });
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
            const allowedFields = [
                'crmStage',
                'fullName',
                'firstName',
                'lastName',
                'headline',
                'position',
                'title',
                'companyName',
                'email',
                'emails',
                'phone',
                'phones',
                'linkedinUrl',
                'profileUrl',
                'notes',
                'crmNotes',
                'observations',
                'comments'
            ];
            const update = {};

            allowedFields.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
                    const value = req.body[field];
                    if (Array.isArray(value)) {
                        update[field] = value.map((item) => typeof item === 'string' ? item.trim() : item).filter(Boolean);
                    } else {
                        update[field] = typeof value === 'string' ? value.trim() : value;
                    }
                }
            });

            if (Object.keys(update).length === 0) {
                return res.status(400).json({ error: 'Nenhum campo valido para atualizar' });
            }

            const updated = await findAndUpdateOwnedOrLegacyLead(
                req.query.id,
                user._id,
                update,
                buildIdentityFilters(req.body)
            );

            if (!updated) {
                return res.status(404).json({ error: 'Lead nao encontrado' });
            }

            return res.json(updated);
        }

        const result = await findAndDeleteOwnedOrLegacyLead(req.query.id, user._id);
        if (!result) {
            return res.status(404).json({ error: 'Lead nao encontrado' });
        }

        return res.json({ message: 'Lead deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar lead:', error);
        return res.status(500).json({
            error: 'Erro interno no servidor',
            details: error.message
        });
    }
};
