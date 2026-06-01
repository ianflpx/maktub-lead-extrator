const crypto = require('crypto');
const { promisify } = require('util');
const { connectToDatabase } = require('./mongodb');
const { User } = require('./models');

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'maktub_session';

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, 64);
    return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
    const [salt, hash] = String(storedHash || '').split(':');
    if (!salt || !hash) return false;

    const derived = await scrypt(password, salt, 64);
    const storedBuffer = Buffer.from(hash, 'hex');
    return storedBuffer.length === derived.length && crypto.timingSafeEqual(storedBuffer, derived);
}

function parseCookies(req) {
    return String(req.headers.cookie || '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((cookies, part) => {
            const index = part.indexOf('=');
            if (index === -1) return cookies;
            cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
            return cookies;
        }, {});
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}${secure}`);
}

function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

async function createSession(res, user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.sessionTokenHash = hashToken(token);
    await user.save();
    setSessionCookie(res, token);
}

async function getSessionUser(req) {
    await connectToDatabase();
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    return User.findOne({ sessionTokenHash: hashToken(token) });
}

async function requireAuth(req, res) {
    const user = await getSessionUser(req);
    if (!user) {
        res.status(401).json({ error: 'Login necessario' });
        return null;
    }
    return user;
}

function publicUser(user) {
    return {
        id: String(user._id),
        email: user.email,
        createdAt: user.createdAt,
        hasApiKeys: {
            apifyToken: Boolean(user.apiKeys?.apifyToken),
            icypeasToken: Boolean(user.apiKeys?.icypeasToken),
            linkedinCookie: Boolean(user.apiKeys?.linkedinCookie)
        }
    };
}

module.exports = {
    clearSessionCookie,
    createSession,
    getSessionUser,
    hashPassword,
    normalizeEmail,
    publicUser,
    requireAuth,
    verifyPassword
};
