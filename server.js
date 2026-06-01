const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { connectToDatabase } = require('./lib/mongodb');
const { Empresa } = require('./lib/models');
const { requireAuth } = require('./lib/auth');

dotenv.config({ quiet: true });

const leadsHandler = require('./api/leads');
const leadByIdHandler = require('./api/leads/[id]');
const empresasHandler = require('./api/empresas');
const empresaByIdHandler = require('./api/empresas/[id]');
const empresaUrlsHandler = require('./api/empresas/urls');
const companyLogoHandler = require('./api/company-logo');
const profileImageHandler = require('./api/profile-image');
const publicLinkedinEmployeesHandler = require('./api/public-linkedin-employees');
const icypeasEmailHandler = require('./api/icypeas-email');
const apifyProfileHandler = require('./api/apify/profile');
const apifyRunsHandler = require('./api/apify/runs');
const apifyRunByIdHandler = require('./api/apify/runs/[id]');
const apifyDatasetsHandler = require('./api/apify/datasets');
const apifyDatasetByIdHandler = require('./api/apify/datasets/[id]');
const apifyLogsHandler = require('./api/apify/logs');
const apifyLogByIdHandler = require('./api/apify/logs/[id]');
const usageHandler = require('./api/usage');
const dashboardHandler = require('./api/dashboard');
const healthHandler = require('./api/health');
const authRegisterHandler = require('./api/auth/register');
const authLoginHandler = require('./api/auth/login');
const authLogoutHandler = require('./api/auth/logout');
const authMeHandler = require('./api/auth/me');
const accountApiKeysHandler = require('./api/account/api-keys');
const accountPasswordHandler = require('./api/account/password');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(publicDir));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

function runVercelHandler(handler) {
    return (req, res) => handler(req, res);
}

function runVercelIdHandler(handler) {
    return (req, res) => {
        req.query = {
            ...req.query,
            id: req.params.id
        };
        return handler(req, res);
    };
}

app.all('/api/health', runVercelHandler(healthHandler));
app.all('/api/auth/register', runVercelHandler(authRegisterHandler));
app.all('/api/auth/login', runVercelHandler(authLoginHandler));
app.all('/api/auth/logout', runVercelHandler(authLogoutHandler));
app.all('/api/auth/me', runVercelHandler(authMeHandler));
app.all('/api/account/api-keys', runVercelHandler(accountApiKeysHandler));
app.all('/api/account/password', runVercelHandler(accountPasswordHandler));
app.all('/api/leads', runVercelHandler(leadsHandler));
app.all('/api/leads/:id', runVercelIdHandler(leadByIdHandler));
app.all('/api/empresas', runVercelHandler(empresasHandler));
app.all('/api/empresas/urls', runVercelHandler(empresaUrlsHandler));
app.patch('/api/empresas/:id', async (req, res) => {
    try {
        await connectToDatabase();
        const user = await requireAuth(req, res);
        if (!user) return;

        if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'isClient')) {
            return res.status(400).json({ error: 'Nenhum campo valido para atualizar' });
        }

        const updated = await Empresa.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    isClient: Boolean(req.body.isClient),
                    userId: user._id
                }
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Empresa nao encontrada' });
        }

        return res.json(updated);
    } catch (error) {
        console.error('Erro ao atualizar empresa:', error);
        return res.status(500).json({
            error: 'Erro interno no servidor',
            details: error.message
        });
    }
});
app.all('/api/empresas/:id', runVercelIdHandler(empresaByIdHandler));
app.all('/api/company-logo', runVercelHandler(companyLogoHandler));
app.all('/api/profile-image', runVercelHandler(profileImageHandler));
app.all('/api/public-linkedin-employees', runVercelHandler(publicLinkedinEmployeesHandler));
app.all('/api/icypeas-email', runVercelHandler(icypeasEmailHandler));
app.all('/api/apify/profile', runVercelHandler(apifyProfileHandler));
app.all('/api/apify/runs', runVercelHandler(apifyRunsHandler));
app.all('/api/apify/runs/:id', runVercelIdHandler(apifyRunByIdHandler));
app.all('/api/apify/datasets', runVercelHandler(apifyDatasetsHandler));
app.all('/api/apify/datasets/:id', runVercelIdHandler(apifyDatasetByIdHandler));
app.all('/api/apify/logs', runVercelHandler(apifyLogsHandler));
app.all('/api/apify/logs/:id', runVercelIdHandler(apifyLogByIdHandler));
app.all('/api/usage', runVercelHandler(usageHandler));
app.all('/api/dashboard', runVercelHandler(dashboardHandler));

app.use('/api', (req, res) => {
    res.status(404).json({ error: `Rota API nao encontrada: ${req.originalUrl}` });
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor Maktub rodando em http://localhost:${PORT}`);
});
