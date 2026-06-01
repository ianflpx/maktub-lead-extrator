const { apifyRequest } = require('../../lib/apify');
const { allowCors } = require('../../lib/vercel-api');
const { requireAuth } = require('../../lib/auth');
const { apifyRawUsage, pickApifyCost, recordApiUsage } = require('../../lib/usage');

const FINISHED_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

async function getRunStatus(req, res, user) {
    const runId = String(req.query?.runId || req.query?.id || '').trim();
    const operation = String(req.query?.operation || 'run');

    if (!runId) {
        return res.status(400).json({ error: 'runId obrigatorio' });
    }

    const data = await apifyRequest(user, `/actor-runs/${encodeURIComponent(runId)}`);
    const run = data?.data || {};

    if (FINISHED_STATUSES.has(run.status)) {
        await recordApiUsage({
            userId: user._id,
            provider: 'apify',
            operation,
            status: run.status,
            requestCount: 1,
            runId: run.id || runId,
            datasetId: run.defaultDatasetId || '',
            estimatedCostUsd: pickApifyCost(run),
            rawUsage: apifyRawUsage(run),
            error: run.status === 'SUCCEEDED' ? '' : run.statusMessage || run.exitCode || ''
        });
    }

    return res.status(200).json(data);
}

async function startRun(req, res, user) {
    const actorId = String(req.body?.actorId || '').trim();
    const payload = req.body?.payload || {};
    const operation = String(req.body?.operation || actorId || 'run');

    if (!actorId) {
        return res.status(400).json({ error: 'actorId obrigatorio' });
    }

    const data = await apifyRequest(user, `/acts/${encodeURIComponent(actorId)}/runs`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    const run = data?.data || {};
    await recordApiUsage({
        userId: user._id,
        provider: 'apify',
        operation,
        status: run.status || 'READY',
        requestCount: 1,
        runId: run.id || '',
        datasetId: run.defaultDatasetId || '',
        rawUsage: {
            actorId,
            payload
        }
    });

    return res.status(200).json(data);
}

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        if (req.method === 'GET') return getRunStatus(req, res, user);
        return startRun(req, res, user);
    } catch (error) {
        console.error('Erro na rota de runs Apify:', error);
        return res.status(error.statusCode || 502).json({ error: error.message });
    }
};

module.exports.getRunStatus = getRunStatus;
