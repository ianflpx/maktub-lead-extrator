const { allowCors } = require('../../lib/vercel-api');
const { publicUser, requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            return res.json({
                apifyToken: user.apiKeys?.apifyToken || '',
                icypeasToken: user.apiKeys?.icypeasToken || '',
                linkedinCookie: user.apiKeys?.linkedinCookie || ''
            });
        }

        if (req.method === 'PUT') {
            user.apiKeys = {
                apifyToken: String(req.body?.apifyToken || '').trim(),
                icypeasToken: String(req.body?.icypeasToken || '').trim(),
                linkedinCookie: String(req.body?.linkedinCookie || '').trim()
            };
            await user.save();
            return res.json({ user: publicUser(user) });
        }

        return res.status(405).json({ error: 'Metodo nao permitido' });
    } catch (error) {
        console.error('Erro ao gerenciar chaves:', error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
};
