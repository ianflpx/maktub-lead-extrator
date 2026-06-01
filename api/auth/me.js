const { allowCors } = require('../../lib/vercel-api');
const { getSessionUser, publicUser } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo nao permitido' });

    try {
        const user = await getSessionUser(req);
        if (!user) return res.status(401).json({ error: 'Login necessario' });
        return res.json({ user: publicUser(user) });
    } catch (error) {
        console.error('Erro ao buscar sessao:', error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
};
