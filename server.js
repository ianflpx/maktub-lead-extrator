const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(publicDir));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { family: 4 })
    .then(() => console.log('✅ Conectado ao MongoDB Atlas'))
    .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));

// Lead Schema - Flexível para aceitar dados do LinkedIn/Apify
const leadSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    fullName: String,
    headline: String,
    title: String, // Alternativa para headline
    location: mongoose.Schema.Types.Mixed,
    companyName: String,
    linkedinUrl: String,
    profileUrl: String, // Alternativa para linkedinUrl
    photo: String,
    profilePicture: String, // Alternativa para photo
    publicIdentifier: String,
    currentPosition: mongoose.Schema.Types.Mixed,
    tier: Number,
    extractedAt: { type: Date, default: Date.now }
}, {
    collection: 'leads',
    timestamps: true,
    strict: false
});

const Lead = mongoose.model('Lead', leadSchema);

// Empresa Schema
const empresaSchema = new mongoose.Schema({
    name: String,
    title: String, // fallback for name
    industry: String,
    type: String, // fallback for industry
    _maktubType: String,
    employeeCount: mongoose.Schema.Types.Mixed,
    staffCount: mongoose.Schema.Types.Mixed,
    employees: mongoose.Schema.Types.Mixed,
    location: mongoose.Schema.Types.Mixed,
    headquarters: String,
    country: String,
    linkedinUrl: { type: String, unique: true }, // usar linkedinUrl como chave
    url: String, // fallback
    logoUrl: String,
    logo: String,
    description: String,
    summary: String,
    extractedAt: { type: Date, default: Date.now }
}, {
    collection: 'empresas',
    timestamps: true,
    strict: false
});

const Empresa = mongoose.model('Empresa', empresaSchema);

// Routes
app.post('/api/leads', async (req, res) => {
    try {
        const leads = req.body;
        console.log(`📥 Recebida requisição para salvar ${Array.isArray(leads) ? leads.length : 0} leads`);

        if (!Array.isArray(leads)) {
            return res.status(400).json({ error: 'Os dados devem ser um array de leads' });
        }

        const normalizedLeads = leads.map(lead => {
            // Garante que o nome completo exista
            const fullName = lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
            
            // Garante que a empresa exista
            const companyName = lead.companyName || 
                               (lead.currentPosition && lead.currentPosition[0] ? lead.currentPosition[0].companyName : null) || 
                               'Não informada';

            return {
                ...lead,
                fullName,
                companyName
            };
        });

        const savedLeads = await Lead.insertMany(normalizedLeads);
        console.log(`✅ ${savedLeads.length} leads salvos com sucesso no MongoDB!`);

        res.status(201).json({ 
            message: 'Leads salvos com sucesso!', 
            count: savedLeads.length 
        });
    } catch (error) {
        console.error('❌ Erro ao salvar leads:', error);
        res.status(500).json({ error: 'Erro interno ao salvar leads', details: error.message });
    }
});

app.get('/api/leads', async (req, res) => {
    try {
        const leads = await Lead.find().sort({ extractedAt: -1 });
        res.json(leads);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar leads' });
    }
});

app.post('/api/empresas', async (req, res) => {
    try {
        const empresas = req.body;
        console.log(`📥 Recebida requisição para salvar ${Array.isArray(empresas) ? empresas.length : 0} empresas`);

        if (!Array.isArray(empresas)) {
            return res.status(400).json({ error: 'Os dados devem ser um array de empresas' });
        }

        const validEmpresas = [];
        const seenUrls = new Set();

        empresas.forEach(emp => {
            const url = emp.linkedinUrl || emp.url;
            if (url && !seenUrls.has(url)) {
                seenUrls.add(url);
                
                // Mongoose strict mode can be bypassed in some bulkWrite cases with $set.
                // We manually enforce the schema structure and remove arbitrary keys.
                const cleanEmp = new Empresa({
                    ...emp,
                    linkedinUrl: url,
                    _maktubType: emp._maktubType || emp.type || emp.industry 
                }).toObject();
                
                // Remove '_id' if present to prevent Mod on _id not allowed
                delete cleanEmp._id;

                validEmpresas.push(cleanEmp);
            }
        });

        const bulkOps = validEmpresas.map(emp => ({
            updateOne: {
                filter: { linkedinUrl: emp.linkedinUrl },
                update: { $set: emp },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            const result = await Empresa.bulkWrite(bulkOps);
            console.log(`✅ Empresas processadas: ${result.upsertedCount} novas, ${result.modifiedCount} atualizadas.`);
        } else {
            console.log(`⚠️ Nenhuma empresa válida com URL para salvar.`);
        }

        res.status(201).json({ message: 'Empresas salvas com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao salvar empresas:', error);
        res.status(500).json({ error: 'Erro interno ao salvar empresas', details: error.message });
    }
});

app.get('/api/empresas', async (req, res) => {
    try {
        const empresas = await Empresa.find().sort({ extractedAt: -1 });
        res.json(empresas);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar empresas' });
    }
});

app.delete('/api/empresas/:id', async (req, res) => {
    try {
        const result = await Empresa.findByIdAndDelete(req.params.id);
        if (!result) return res.status(404).json({ error: 'Empresa não encontrada' });
        res.json({ message: 'Empresa deletada com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar empresa', details: error.message });
    }
});

app.get('/api/empresas/urls', async (req, res) => {
    try {
        const empresas = await Empresa.find({}, { linkedinUrl: 1, url: 1, name: 1, _id: 0 });
        const urls = empresas.map(e => e.linkedinUrl || e.url || e.name).filter(Boolean);
        res.json(urls);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar URLs' });
    }
});

// Refresh expired LinkedIn logos in bulk
app.post('/api/empresas/refresh-logos', async (req, res) => {
    try {
        const empresas = await Empresa.find({ linkedinUrl: { $exists: true } });
        let updated = 0;
        let failed = 0;

        const fetchFreshLogo = async (linkedinUrl) => {
            try {
                const resp = await fetch(linkedinUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html'
                    },
                    signal: AbortSignal.timeout(8000)
                });
                if (!resp.ok) return null;
                const html = await resp.text();
                const match = html.match(/og:image"\s+content="([^"]+)"/);
                return match ? match[1].replace(/&amp;/g, '&') : null;
            } catch {
                return null;
            }
        };

        // Process in batches of 5 to avoid rate limiting
        for (let i = 0; i < empresas.length; i += 5) {
            const batch = empresas.slice(i, i + 5);
            await Promise.all(batch.map(async (emp) => {
                const freshLogo = await fetchFreshLogo(emp.linkedinUrl);
                if (freshLogo) {
                    await Empresa.updateOne({ _id: emp._id }, { $set: { logo: freshLogo, logoUrl: freshLogo } });
                    updated++;
                } else {
                    failed++;
                }
            }));
            // Small delay between batches
            if (i + 5 < empresas.length) await new Promise(r => setTimeout(r, 500));
        }

        res.json({ message: 'Logos atualizadas', updated, failed, total: empresas.length });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar logos', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Maktub rodando em http://localhost:${PORT}`);
});
