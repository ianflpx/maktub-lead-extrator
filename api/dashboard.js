const { connectToDatabase } = require('../lib/mongodb');
const { Empresa, Lead, ApiUsageLog } = require('../lib/models');
const { allowCors } = require('../lib/vercel-api');
const { requireAuth } = require('../lib/auth');

function buildDateFilter(from, to) {
    if (!from && !to) return null;
    const filter = {};
    if (from) filter.$gte = new Date(from);
    if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.$lte = end;
    }
    return filter;
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo nao permitido' });

    try {
        await connectToDatabase();
        const user = await requireAuth(req, res);
        if (!user) return;

        const uid = user._id;
        const { from, to } = req.query;
        const dateRange = buildDateFilter(from, to);

        const extractedAtFilter = dateRange ? { extractedAt: dateRange } : {};
        const createdAtFilter = dateRange ? { createdAt: dateRange } : {};

        const [
            totalCompanies,
            totalLeads,
            totalLeadsWithEmail,
            companiesByType,
            totalCostResult,
        ] = await Promise.all([
            Empresa.countDocuments({ userId: uid, ...extractedAtFilter }),
            Lead.countDocuments({ userId: uid, ...extractedAtFilter }),
            Lead.countDocuments({ userId: uid, ...extractedAtFilter, email: { $exists: true, $nin: ['', null] } }),
            Empresa.aggregate([
                { $match: { userId: uid, ...extractedAtFilter } },
                { $group: { _id: { $ifNull: ['$_maktubType', 'Outros'] }, count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            ApiUsageLog.aggregate([
                { $match: { userId: uid, ...createdAtFilter } },
                { $group: { _id: null, total: { $sum: '$estimatedCostUsd' } } }
            ]),
        ]);

        return res.json({
            totalCompanies,
            totalLeads,
            totalLeadsWithEmail,
            totalCostUsd: totalCostResult[0]?.total ?? 0,
            companiesByType: companiesByType.map(g => ({ type: g._id, count: g.count })),
        });
    } catch (error) {
        console.error('Erro no dashboard:', error);
        return res.status(500).json({ error: 'Erro interno', details: error.message });
    }
};
