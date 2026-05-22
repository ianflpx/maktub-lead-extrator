const ICYPEAS_API = 'https://app.icypeas.com/api';
const PENDING_STATUSES = new Set(['NONE', 'SCHEDULED', 'IN_PROGRESS']);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function pickEmail(searchItem) {
    const emailItem = searchItem?.results?.emails?.[0]
        || searchItem?.emails?.[0]
        || null;

    if (typeof emailItem === 'string') {
        return emailItem;
    }

    return emailItem?.email || '';
}

function pickPhones(searchItem) {
    const phones = searchItem?.results?.phones || searchItem?.phones || [];
    return phones
        .map(phone => typeof phone === 'string' ? phone : (phone?.phone || phone?.number || ''))
        .filter(Boolean);
}

async function icypeasRequest(token, path, options = {}) {
    const response = await fetch(`${ICYPEAS_API}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: token,
            ...(options.headers || {})
        },
        signal: AbortSignal.timeout(15000)
    });

    let data = null;
    try {
        data = await response.json();
    } catch (_) {}

    if (!response.ok) {
        const detail = data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(`Icypeas ${detail}`);
    }

    return data;
}

async function findIcypeasEmail({ token, lead }) {
    const firstname = (lead?.firstName || '').trim();
    const lastname = (lead?.lastName || '').trim();
    const domainOrCompany = (lead?.companyDomain || lead?.companyName || '').trim();

    if (!token) {
        throw new Error('Icypeas API key ausente');
    }

    if ((!firstname && !lastname) || !domainOrCompany) {
        return {
            status: 'INVALID_INPUT',
            email: '',
            emails: [],
            phones: []
        };
    }

    const created = await icypeasRequest(token, '/email-search', {
        method: 'POST',
        body: JSON.stringify({
            firstname,
            lastname,
            domainOrCompany
        })
    });

    const id = created?.item?._id;
    if (!id) {
        return {
            status: created?.item?.status || 'NO_SEARCH_ID',
            email: '',
            emails: [],
            phones: [],
            raw: created
        };
    }

    let searchItem = null;
    for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt > 0) {
            await sleep(1800);
        }

        const result = await icypeasRequest(token, '/bulk-single-searchs/read', {
            method: 'POST',
            body: JSON.stringify({ id })
        });

        searchItem = result?.items?.[0] || null;
        if (searchItem && !PENDING_STATUSES.has(searchItem.status)) {
            break;
        }
    }

    const email = pickEmail(searchItem);
    const phones = pickPhones(searchItem);

    return {
        id,
        status: searchItem?.status || created?.item?.status || 'PENDING',
        email,
        emails: email ? [email] : [],
        phone: phones[0] || '',
        phones
    };
}

module.exports = {
    findIcypeasEmail
};
