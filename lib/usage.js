const { ApiUsageLog } = require('./models');

function pickApifyCost(run = {}) {
    const usageTotalUsd = Number(run.usageTotalUsd);
    if (Number.isFinite(usageTotalUsd)) return usageTotalUsd;

    const usageUsdValues = Object.values(run.usageUsd || {})
        .map(Number)
        .filter(Number.isFinite);

    if (usageUsdValues.length > 0) {
        return usageUsdValues.reduce((total, value) => total + value, 0);
    }

    return 0;
}

function apifyRawUsage(run = {}) {
    return {
        usageTotalUsd: run.usageTotalUsd,
        usageUsd: run.usageUsd,
        usage: run.usage,
        stats: run.stats,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt
    };
}

async function recordApiUsage(entry) {
    const cleanEntry = {
        ...entry
    };

    if (Object.prototype.hasOwnProperty.call(entry, 'estimatedCostUsd')) {
        cleanEntry.estimatedCostUsd = Number(entry.estimatedCostUsd || 0);
    }

    if (cleanEntry.provider === 'apify' && cleanEntry.runId) {
        return ApiUsageLog.findOneAndUpdate(
            {
                userId: cleanEntry.userId,
                provider: 'apify',
                runId: cleanEntry.runId
            },
            { $set: cleanEntry },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    return ApiUsageLog.create(cleanEntry);
}

module.exports = {
    apifyRawUsage,
    pickApifyCost,
    recordApiUsage
};
