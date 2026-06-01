const { User } = require('../../lib/models');
const { allowCors } = require('../../lib/vercel-api');
const { connectToDatabase } = require('../../lib/mongodb');
const { createSession, hashPassword, normalizeEmail, publicUser } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

    try {
        await connectToDatabase();
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');

        if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalido' });
        if (password.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(409).json({ error: 'Esse email ja esta cadastrado' });

        const user = await User.create({
            email,
            passwordHash: await hashPassword(password)
        });
        await createSession(res, user);

        return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
        console.error('Erro ao criar conta:', error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
};
