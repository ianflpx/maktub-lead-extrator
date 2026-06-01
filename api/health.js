const { connectToDatabase, mongoose } = require('../lib/mongodb');
const { allowCors } = require('../lib/vercel-api');

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        await connectToDatabase();

        return res.json({
            ok: true,
            mongodb: 'connected',
            readyState: mongoose.connection.readyState
        });
    } catch (error) {
        console.error('Erro no health check:', error);
        return res.status(500).json({
            ok: false,
            mongodb: 'disconnected',
            details: error.message
        });
    }
};
