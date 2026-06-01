const { User } = require('../../lib/models');
const { allowCors } = require('../../lib/vercel-api');
const { connectToDatabase } = require('../../lib/mongodb');
const { createSession, normalizeEmail, publicUser, verifyPassword } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

    try {
        await connectToDatabase();
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');
        const user = await User.findOne({ email });

        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Email ou senha invalidos' });
        }

        await createSession(res, user);
        return res.json({ user: publicUser(user) });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
};
