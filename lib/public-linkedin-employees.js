function decodeHtml(value = '') {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeCompanyUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !/(^|\.)linkedin\.com$/i.test(url.hostname)) {
            return '';
        }

        const match = url.pathname.match(/^\/company\/[^/]+/i);
        if (!match) {
            return '';
        }

        return `https://www.linkedin.com${match[0]}/`;
    } catch (_) {
        return '';
    }
}

function parsePublicEmployees(html) {
    const employees = [];
    const seen = new Set();
    const cards = html.matchAll(/<a\b[^>]+href="([^"]+linkedin\.com\/in\/[^"?]+)[^"]*"[^>]*data-tracking-control-name="org-employees"[\s\S]*?<\/a>/gi);

    for (const card of cards) {
        const cardHtml = card[0];
        const linkedinUrl = decodeHtml(card[1]).replace(/^http:/, 'https:');
        const nameMatch = cardHtml.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
        const imageMatch = cardHtml.match(/<img\b[^>]+data-delayed-url="([^"]+)"/i);
        const fullName = decodeHtml(nameMatch ? nameMatch[1] : '');
        const publicIdentifier = linkedinUrl.match(/\/in\/([^/?#]+)/i)?.[1] || '';

        if (!fullName || !publicIdentifier || seen.has(publicIdentifier)) {
            continue;
        }

        seen.add(publicIdentifier);
        const nameParts = fullName.split(' ');
        employees.push({
            firstName: nameParts.shift() || '',
            lastName: nameParts.join(' '),
            fullName,
            publicIdentifier,
            linkedinUrl,
            profilePicture: imageMatch ? decodeHtml(imageMatch[1]) : '',
            _publicLinkedinFallback: true
        });
    }

    return employees;
}

async function fetchPublicLinkedInEmployees(linkedinUrl) {
    const companyUrl = normalizeCompanyUrl(linkedinUrl);
    if (!companyUrl) {
        return [];
    }

    const response = await fetch(companyUrl, {
        headers: {
            Accept: 'text/html',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        return [];
    }

    return parsePublicEmployees(await response.text());
}

module.exports = {
    fetchPublicLinkedInEmployees,
    parsePublicEmployees
};
