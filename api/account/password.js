const { allowCors } = require('../../lib/vercel-api');
const { hashPassword, requireAuth, verifyPassword } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (allowCors(req, res)) return;

    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    try {
        const user = await requireAuth(req, res);
        if (!user) return;

        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');

        if (!currentPassword) {
            return res.status(400).json({ error: 'Informe a senha atual' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres' });
        }

        if (!(await verifyPassword(currentPassword, user.passwordHash))) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        user.passwordHash = await hashPassword(newPassword);
        await user.save();

        return res.json({ ok: true });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        return res.status(500).json({ error: 'Erro interno no servidor', details: error.message });
    }
};
