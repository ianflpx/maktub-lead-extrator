const { allowCors } = require('../../lib/vercel-api');
const { clearSessionCookie, requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

    const user = await requireAuth(req, res);
    if (user) {
        user.sessionTokenHash = '';
        await user.save();
    }

    clearSessionCookie(res);
    return res.json({ ok: true });
};
