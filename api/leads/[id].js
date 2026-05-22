const { connectToDatabase } = require('../../lib/mongodb');
const { Lead } = require('../../lib/models');
const { allowCors } = require('../../lib/vercel-api');

module.exports = async (req, res) => {
    if (allowCors(req, res)) {
        return;
    }

    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        await connectToDatabase();

        const result = await Lead.findByIdAndDelete(req.query.id);
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
