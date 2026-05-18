const mongoose = require('mongoose');

// MongoDB Connection (Caching the connection to avoid multiple connections in serverless)
let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    
    // Na Vercel, o MONGODB_URI virá das variáveis de ambiente configuradas no painel
    const client = await mongoose.connect(process.env.MONGODB_URI);
    cachedDb = client;
    return client;
}

// Lead Schema
const leadSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    fullName: String,
    headline: String,
    location: Object,
    companyName: String,
    linkedinUrl: String,
    photo: String,
    publicIdentifier: String,
    extractedAt: { type: Date, default: Date.now }
});

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);

module.exports = async (req, res) => {
    // Habilitar CORS para a Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        await connectToDatabase();

        if (req.method === 'POST') {
            const leads = req.body;
            if (!Array.isArray(leads)) {
                return res.status(400).json({ error: 'Os dados devem ser um array de leads' });
            }

            const savedLeads = await Lead.insertMany(leads.map(lead => ({
                ...lead,
                fullName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
            })));

            return res.status(201).json({ 
                message: 'Leads salvos com sucesso!', 
                count: savedLeads.length 
            });
        } 
        
        if (req.method === 'GET') {
            const leads = await Lead.find().sort({ extractedAt: -1 }).limit(100);
            return res.json(leads);
        }

        return res.status(405).json({ error: 'Método não permitido' });

    } catch (error) {
        console.error('Erro na API:', error);
        return res.status(500).json({ error: 'Erro interno no servidor' });
    }
};
