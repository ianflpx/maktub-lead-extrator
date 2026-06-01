const { connectToDatabase } = require('../lib/mongodb');
const { ApiUsageLog } = require('../lib/models');
const { allowCors } = require('../lib/vercel-api');
const { requireAuth } = require('../lib/auth');

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

async function summarize(userId, since) {
    const rows = await ApiUsageLog.aggregate([
        {
            $match: {
                userId,
                createdAt: { $gte: since }
            }
        },
        {
            $group: {
                _id: '$provider',
                calls: { $sum: '$requestCount' },
                results: { $sum: '$resultCount' },
                estimatedCostUsd: { $sum: '$estimatedCostUsd' }
            }
        }
    ]);

    return rows.reduce((summary, row) => {
        summary[row._id] = {
            calls: row.calls || 0,
            results: row.results || 0,
            estimatedCostUsd: row.estimatedCostUsd || 0
        };
        summary.total.estimatedCostUsd += row.estimatedCostUsd || 0;
        summary.total.calls += row.calls || 0;
        summary.total.results += row.results || 0;
        return summary;
    }, {
        total: {
            calls: 0,
            results: 0,
            estimatedCostUsd: 0
        }
    });
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        await connectToDatabase();
        const user = await requireAuth(req, res);
        if (!user) return;

        const page = Math.max(1, Number.parseInt(req.query?.page || '1', 10) || 1);
        const limit = Math.min(20, Math.max(1, Number.parseInt(req.query?.limit || '20', 10) || 20));
        const skip = (page - 1) * limit;
        const now = new Date();

        const dateFilter = req.query?.dateFilter || 'today';
        const dateFromParam = req.query?.dateFrom;
        const dateToParam = req.query?.dateTo;

        let createdAtFilter = null;
        if (dateFilter === 'today') {
            createdAtFilter = { $gte: startOfDay(now) };
        } else if (dateFilter === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            createdAtFilter = { $gte: startOfDay(yesterday), $lt: startOfDay(now) };
        } else if (dateFilter === '7days') {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            createdAtFilter = { $gte: startOfDay(d) };
        } else if (dateFilter === '30days') {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            createdAtFilter = { $gte: startOfDay(d) };
        } else if (dateFilter === 'custom' && dateFromParam) {
            const from = new Date(dateFromParam);
            createdAtFilter = { $gte: from };
            if (dateToParam) {
                const to = new Date(dateToParam);
                to.setDate(to.getDate() + 1);
                createdAtFilter.$lt = to;
            }
        }

        const tableFilter = {
            userId: user._id,
            status: 'SUCCEEDED',
            estimatedCostUsd: { $gt: 0 }
        };
        if (createdAtFilter) tableFilter.createdAt = createdAtFilter;
        const [latest, totalItems] = await Promise.all([
            ApiUsageLog.find(tableFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ApiUsageLog.countDocuments(tableFilter)
        ]);

        return res.status(200).json({
            today: await summarize(user._id, startOfDay(now)),
            month: await summarize(user._id, startOfMonth(now)),
            latest,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.max(1, Math.ceil(totalItems / limit))
            }
        });
    } catch (error) {
        console.error('Erro ao consultar uso:', error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
};
