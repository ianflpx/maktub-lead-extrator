const linkedinAssetHost = /^(media|static)\.licdn\.com$/i;

function isLinkedInImageUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && linkedinAssetHost.test(url.hostname);
    } catch (_) {
        return false;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    try {
        const imageUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
        if (!isLinkedInImageUrl(imageUrl)) {
            return res.status(404).end();
        }

        const response = await fetch(imageUrl, {
            headers: {
                Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
            },
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
            return res.status(404).end();
        }

        res.setHeader('Content-Type', response.headers.get('content-type'));
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        console.error('Erro ao buscar imagem de perfil:', error);
        return res.status(404).end();
    }
};
