function allowCors(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }

    return false;
}

function getRouteParam(req, name) {
    const candidates = [req.query?.[name], req.params?.[name]];
    for (const candidate of candidates) {
        const value = Array.isArray(candidate) ? candidate[0] : candidate;
        const cleanValue = String(value || '').trim();
        if (cleanValue) return cleanValue;
    }

    const url = String(req.url || '');
    const [pathname] = url.split('?');
    const parts = pathname.split('/').filter(Boolean);
    return String(parts[parts.length - 1] || '').trim();
}

module.exports = {
    allowCors,
    getRouteParam
};
