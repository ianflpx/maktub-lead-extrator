const APIFY_API = 'https://api.apify.com/v2';

function getApifyToken(user) {
    return String(user?.apiKeys?.apifyToken || '').trim();
}

function withToken(path, token) {
    const separator = path.includes('?') ? '&' : '?';
    return `${APIFY_API}${path}${separator}token=${encodeURIComponent(token)}`;
}

async function apifyRequest(user, path, options = {}) {
    const token = getApifyToken(user);
    if (!token) {
        const error = new Error('Apify API key ausente');
        error.statusCode = 400;
        throw error;
    }

    const response = await fetch(withToken(path, token), {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        signal: AbortSignal.timeout(options.timeoutMs || 30000)
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

    if (!response.ok) {
        const detail = body?.error?.message || body?.message || body || `HTTP ${response.status}`;
        const error = new Error(`Apify ${detail}`);
        error.statusCode = response.status;
        error.body = body;
        throw error;
    }

    return body;
}

module.exports = {
    apifyRequest,
    getApifyToken
};
