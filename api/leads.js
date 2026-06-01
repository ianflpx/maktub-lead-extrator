const { connectToDatabase } = require('../lib/mongodb');
const { Lead } = require('../lib/models');
const { allowCors } = require('../lib/vercel-api');
const { requireAuth } = require('../lib/auth');

function firstUrl(...values) {
    return values.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()))?.trim() || '';
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    try {
        await connectToDatabase();
        const user = await requireAuth(req, res);
        if (!user) return;

        if (req.method === 'POST') {
            const leads = req.body;
            if (!Array.isArray(leads)) {
                return res.status(400).json({ error: 'Os dados devem ser um array de leads' });
            }

            const normalizedLeads = leads.map((lead) => {
                const photoUrl = firstUrl(
                    lead.photo,
                    lead.profilePicture,
                    lead.profilePictureUrl,
                    lead.picture,
                    lead.pictureUrl,
                    lead.image,
                    lead.imageUrl,
                    lead.avatar,
                    lead.avatarUrl
                );
                const normalizedLead = {
                    ...lead,
                    userId: user._id,
                    fullName: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
                    companyName: lead.companyName
                        || (lead.currentPosition && lead.currentPosition[0] ? lead.currentPosition[0].companyName : null)
                        || 'Nao informada'
                };

                if (photoUrl) {
                    normalizedLead.photo = photoUrl;
                    normalizedLead.profilePicture = photoUrl;
                } else {
                    delete normalizedLead.photo;
                    delete normalizedLead.profilePicture;
                    delete normalizedLead.profilePictureUrl;
                    delete normalizedLead.picture;
                    delete normalizedLead.pictureUrl;
                    delete normalizedLead.image;
                    delete normalizedLead.imageUrl;
                    delete normalizedLead.avatar;
                    delete normalizedLead.avatarUrl;
                }

                return normalizedLead;
            });
            const savedLeads = await Lead.bulkWrite(normalizedLeads.map((lead) => {
                const { _id, ...leadUpdate } = lead;
                return {
                    updateOne: {
                        filter: lead.linkedinUrl
                            ? { userId: user._id, linkedinUrl: lead.linkedinUrl }
                            : { userId: user._id, fullName: lead.fullName, companyName: lead.companyName },
                        update: { $set: leadUpdate },
                        upsert: true
                    }
                };
            }));

            return res.status(201).json({
                message: 'Leads salvos com sucesso!',
                count: savedLeads.modifiedCount + savedLeads.upsertedCount
            });
        }

        if (req.method === 'GET') {
            const leads = await Lead.find({ userId: user._id })
                .select('_id fullName firstName lastName headline position title companyName companyLinkedinUrl linkedinUrl profileUrl photo profilePicture publicIdentifier email emails phone phones location tier crmStage notes crmNotes observations comments extractedAt createdAt updatedAt')
                .sort({ extractedAt: -1 })
                .limit(500)
                .lean();
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
