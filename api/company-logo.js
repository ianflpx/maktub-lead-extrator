const { connectToDatabase } = require('../lib/mongodb');
const { Empresa } = require('../lib/models');

const linkedinMediaHost = /(^|\.)media\.licdn\.com$/i;

function isLinkedInLogoUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && linkedinMediaHost.test(url.hostname);
    } catch (_) {
        return false;
    }
}

function decodeHtmlEntities(value) {
    return value.replace(/&amp;/g, '&');
}

async function findFreshLinkedInLogo(linkedinUrl) {
    if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/')) {
        return '';
    }

    const response = await fetch(linkedinUrl, {
        headers: {
            Accept: 'text/html',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
        },
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
        return '';
    }

    const html = await response.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const freshLogo = match ? decodeHtmlEntities(match[1]) : '';

    return isLinkedInLogoUrl(freshLogo) ? freshLogo : '';
}

async function fetchLogo(logoUrl) {
    if (!isLinkedInLogoUrl(logoUrl)) {
        return null;
    }

    const response = await fetch(logoUrl, {
        headers: {
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
        },
        signal: AbortSignal.timeout(8000)
    });

    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
        return null;
    }

    return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type')
    };
}

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    try {
        let logoUrl = Array.isArray(req.query.logo) ? req.query.logo[0] : req.query.logo;
        let linkedinUrl = Array.isArray(req.query.linkedin) ? req.query.linkedin[0] : req.query.linkedin;
        const companyId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

        if (!isLinkedInLogoUrl(logoUrl) && companyId) {
            await connectToDatabase();

            const company = await Empresa.findById(companyId, {
                linkedinUrl: 1,
                logo: 1,
                logoUrl: 1
            });

            if (!company) {
                return res.status(404).end();
            }

            logoUrl = company.logoUrl || company.logo || '';
            linkedinUrl = company.linkedinUrl || linkedinUrl;
        }

        let logo = await fetchLogo(logoUrl);

        if (!logo) {
            const freshLogoUrl = await findFreshLinkedInLogo(linkedinUrl);
            logo = await fetchLogo(freshLogoUrl);

            if (logo && companyId && freshLogoUrl !== logoUrl) {
                logoUrl = freshLogoUrl;
                await connectToDatabase();
                await Empresa.updateOne(
                    { _id: companyId },
                    { $set: { logo: freshLogoUrl, logoUrl: freshLogoUrl } }
                );
            }
        }

        if (!logo) {
            return res.status(404).end();
        }

        res.setHeader('Content-Type', logo.contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).send(logo.body);
    } catch (error) {
        console.error('Erro ao buscar logo de empresa:', error);
        return res.status(404).end();
    }
};
