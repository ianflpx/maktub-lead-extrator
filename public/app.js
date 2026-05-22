let APIFY_TOKEN = localStorage.getItem('apify_token') || '';
let ICYPEAS_TOKEN = localStorage.getItem('icypeas_token') || '';
let LINKEDIN_COOKIE = localStorage.getItem('linkedin_cookie') || '';
const EMPLOYEES_ACTOR_ID = 'harvestapi~linkedin-company-employees';
const PROFILE_SEARCH_ACTOR_ID = 'harvestapi~linkedin-profile-search';
const COMPANY_ACTOR_ID = 'harvestapi~linkedin-company-search';

const COMPANY_TYPE_KEYWORDS = {
    "Operator": "apostas esportivas cassino online bet brasil operadora sportsbook bets licenciado",
    "Game Provider": "game provider casino games studio slot developer iGaming content live casino virtual sports",
    "Aggregator / Platform": "game aggregator iGaming platform white label casino turnkey PAM sportsbook platform B2B"
};

const QUERY_SETS = {
    "Operator": [
        // Termos curtos que aparecem no NOME da empresa (como o LinkedIn realmente busca)
        "casino",
        "cassino",
        "gambling",
        "gaming",
        "lottery",
        "loteria",
        "sweepstakes",
        "slots",
        "bingo",
        // Combinações curtas por mercado
        "casino brasil",
        "casino latam",
        "gaming brasil",
        "casino online",
        // Por jurisdição
        "casino malta",
        "gaming malta",
        "casino curacao",
        "gaming gibraltar",
        "gaming isle of man",
        // Termos de nicho cassino
        "crypto casino",
        "social casino",
        "sweeps casino",
        "live casino",
        "online casino"
    ],
    "Game Provider": [
        // Termos que aparecem no nome de studios/providers
        "game studio",
        "games studio",
        "gaming studio",
        "casino games",
        "slot games",
        "game provider",
        "games provider",
        "igaming studio",
        "casino software",
        "gaming software",
        // Nichos específicos
        "live casino",
        "live dealer",
        "crash game",
        "instant games",
        "virtual sports",
        "fish game",
        "lottery game",
        "bingo game",
        "keno game",
        "table games",
        // Por tecnologia
        "html5 games",
        "mobile casino",
        "rng casino",
        "provably fair",
        // Studios conhecidos por região
        "game studio latam",
        "gaming studio brasil",
        "casino studio malta",
        "game developer igaming"
    ],
    "Aggregator / Platform": [
        // Termos que aparecem no nome de plataformas B2B
        "igaming platform",
        "casino platform",
        "betting platform",
        "sportsbook platform",
        "white label casino",
        "white label betting",
        "turnkey casino",
        "turnkey sportsbook",
        "game aggregator",
        "casino aggregator",
        // Back-office e gestão
        "casino management",
        "player management",
        "bonus engine",
        "risk management igaming",
        "pam igaming",
        "crm igaming",
        // SaaS / Tech
        "igaming saas",
        "betting api",
        "casino api",
        "odds provider",
        "odds feed",
        "trading igaming"
    ]
};

const INDUSTRY_IDS = {
    "Operator": ["4", "43", "96"],
    "Game Provider": ["4", "115"],
    "Aggregator / Platform": ["4", "115", "96"]
};

// UI Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const logoIcon = document.getElementById('collapsedLogo');
const form = document.getElementById('extractForm');
const companyInput = document.getElementById('companyInput');
const linkedinUrlInput = document.getElementById('linkedinUrlInput');
const roleInput = document.getElementById('roleInput');
const searchBtn = document.getElementById('searchBtn');
const resultsBody = document.getElementById('resultsBody');
const totalLeadsEl = document.getElementById('totalLeads');
const pullDataBtn = document.getElementById('pullDataBtn');
const motorStatusText = document.getElementById('motorStatusText');
const motorSubtext = document.getElementById('motorSubtext');
const statusCard = document.getElementById('leadStatusCard');

// UI Elements (Company Search)
const companyExtractForm = document.getElementById('companyExtractForm');
const companyCountryInput = document.getElementById('companyCountryInput');
const companyTypeInput = document.getElementById('companyTypeInput');
const companySizeInput = document.getElementById('companySizeInput');
const companyCountInput = document.getElementById('companyCountInput');
const companyKeywordsInput = document.getElementById('companyKeywordsInput');
const companySearchBtn = document.getElementById('companySearchBtn');
const companyResultsBody = document.getElementById('companyResultsBody');
const totalCompaniesEl = document.getElementById('totalCompanies');
const exportCompanyBtn = document.getElementById('exportCompanyBtn');
const companyMotorStatusText = document.getElementById('companyMotorStatusText');
const companyMotorSubtext = document.getElementById('companyMotorSubtext');
const companyStatusCard = document.getElementById('companyStatusCard');

// Views & Navigation
const searchView = document.getElementById('search-view');
const companySearchView = document.getElementById('company-search-view');
const connectionView = document.getElementById('connection-view');
const historyView = document.getElementById('history-view');
const companyHistoryView = document.getElementById('company-history-view');
const navSearch = document.getElementById('nav-search');
const navCompanySearch = document.getElementById('nav-company-search');
const navConnection = document.getElementById('nav-connection');
const navHistory = document.getElementById('nav-history');
const navCompanyHistory = document.getElementById('nav-company-history');

// History UI Elements
const historyResultsBody = document.getElementById('historyResultsBody');
const historyTotalLeads = document.getElementById('historyTotalLeads');
const historyNameFilter = document.getElementById('historyNameFilter');
const historyCompanyFilter = document.getElementById('historyCompanyFilter');
const historySearchBtn = document.getElementById('historySearchBtn');
const historySpinner = document.getElementById('historySpinner');
const historyEmptyText = document.getElementById('historyEmptyText');

let globalHistoryLeads = [];

// Company History UI Elements
const companyHistoryResultsBody = document.getElementById('companyHistoryResultsBody');
const companyHistoryTotalCompanies = document.getElementById('companyHistoryTotalCompanies');
const companyHistoryNameFilter = document.getElementById('companyHistoryNameFilter');
const companyHistoryIndustryFilter = document.getElementById('companyHistoryIndustryFilter');
const companyHistorySearchBtn = document.getElementById('companyHistorySearchBtn');
let globalHistoryCompanies = [];

// Connection UI Elements
const connectionForm = document.getElementById('connectionForm');
const apiKeyInput = document.getElementById('apiKeyInput');
const refreshConnectionBtn = document.getElementById('refreshConnectionBtn');
const connectionStatusTitle = document.getElementById('connectionStatusTitle');
const connectionStatusText = document.getElementById('connectionStatusText');
const connectionStatusDot = document.getElementById('connectionStatusDot');
const connectionStatusCard = document.getElementById('connectionStatusCard');

let globalLeads = [];

// Toggle Sidebar
const toggleSidebar = () => {
    sidebar.classList.toggle('collapsed');

    // Switch arrow icon
    const icon = sidebarToggle.querySelector('i');
    if (icon) {
        if (sidebar.classList.contains('collapsed')) {
            icon.className = 'ph-bold ph-caret-right';
        } else {
            icon.className = 'ph-bold ph-caret-left';
        }
    }
};

if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
if (logoIcon) logoIcon.addEventListener('click', toggleSidebar);

// Navigation logic
function switchView(viewName) {
    if (searchView) searchView.style.display = 'none';
    if (companySearchView) companySearchView.style.display = 'none';
    if (connectionView) connectionView.style.display = 'none';
    if (historyView) historyView.style.display = 'none';
    if (companyHistoryView) companyHistoryView.style.display = 'none';

    if (navSearch) navSearch.classList.remove('active');
    if (navCompanySearch) navCompanySearch.classList.remove('active');
    if (navConnection) navConnection.classList.remove('active');
    if (navHistory) navHistory.classList.remove('active');
    if (navCompanyHistory) navCompanyHistory.classList.remove('active');

    if (viewName === 'company-search') {
        if (companySearchView) companySearchView.style.display = 'block';
        if (navCompanySearch) navCompanySearch.classList.add('active');
    } else if (viewName === 'search') {
        if (searchView) searchView.style.display = 'block';
        if (navSearch) navSearch.classList.add('active');
    } else if (viewName === 'connection') {
        if (connectionView) connectionView.style.display = 'block';
        if (navConnection) navConnection.classList.add('active');

        apiKeyInput.value = APIFY_TOKEN;
        checkApiConnection();
    } else if (viewName === 'history') {
        if (historyView) historyView.style.display = 'block';
        if (navHistory) navHistory.classList.add('active');

        fetchHistoryLeads();
    } else if (viewName === 'company-history') {
        if (companyHistoryView) companyHistoryView.style.display = 'block';
        if (navCompanyHistory) navCompanyHistory.classList.add('active');

        fetchHistoryCompanies();
    }

    if (window.innerWidth <= 768 && !sidebar.classList.contains('collapsed')) {
        toggleSidebar();
    }
}

// Initial View logic based on available navs
if (navCompanySearch) {
    // If the new nav is active in HTML, default to it
    switchView('company-search');
}

if (navCompanySearch) navCompanySearch.addEventListener('click', (e) => { e.preventDefault(); switchView('company-search'); });
if (navSearch) navSearch.addEventListener('click', (e) => { e.preventDefault(); switchView('search'); });
if (navConnection) navConnection.addEventListener('click', (e) => { e.preventDefault(); switchView('connection'); });
if (navHistory) navHistory.addEventListener('click', (e) => { e.preventDefault(); switchView('history'); });
if (navCompanyHistory) navCompanyHistory.addEventListener('click', (e) => { e.preventDefault(); switchView('company-history'); });

// Custom Select Logic
const companyTypeSelect = document.getElementById('companyTypeSelect');
const companyTypeTrigger = document.getElementById('companyTypeTrigger');
const companyTypePlaceholder = document.getElementById('companyTypePlaceholder');
const companyTypeInputHidden = document.getElementById('companyTypeInput');
const typeCheckboxes = document.querySelectorAll('#companyTypeDropdown input[type="checkbox"]');

// Company History Custom Select Logic
const companyHistoryTypeSelect = document.getElementById('companyHistoryTypeSelect');
const companyHistoryTypeTrigger = document.getElementById('companyHistoryTypeTrigger');
const companyHistoryTypePlaceholder = document.getElementById('companyHistoryTypePlaceholder');
const companyHistoryTypeInputHidden = document.getElementById('companyHistoryIndustryFilter');
const historyTypeCheckboxes = document.querySelectorAll('#companyHistoryTypeDropdown input[type="checkbox"]');

if (companyTypeTrigger) {
    companyTypeTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (countrySelect) countrySelect.classList.remove('active');
        if (typeof companySizeSelect !== 'undefined' && companySizeSelect) companySizeSelect.classList.remove('active');
        if (companyHistoryTypeSelect) companyHistoryTypeSelect.classList.remove('active');
        companyTypeSelect.classList.toggle('active');
    });
}

if (companyHistoryTypeTrigger) {
    companyHistoryTypeTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (companyTypeSelect) companyTypeSelect.classList.remove('active');
        companyHistoryTypeSelect.classList.toggle('active');
    });
}

// (Duplicate click listener removed here)

function updateTypeSelection() {
    const selected = Array.from(typeCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (selected.length === 0) {
        companyTypePlaceholder.textContent = 'Selecionar tipos...';
        companyTypeInputHidden.value = '';
    } else if (selected.length > 2) {
        companyTypePlaceholder.textContent = `${selected.length} tipos selecionados`;
        companyTypeInputHidden.value = selected.join(', ');
    } else {
        companyTypePlaceholder.textContent = selected.join(', ');
        companyTypeInputHidden.value = selected.join(', ');
    }
}

function updateHistoryTypeSelection() {
    const selected = Array.from(historyTypeCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (selected.length === 0) {
        companyHistoryTypePlaceholder.textContent = 'Selecionar tipos...';
        companyHistoryTypeInputHidden.value = '';
    } else if (selected.length > 2) {
        companyHistoryTypePlaceholder.textContent = `${selected.length} tipos selecionados`;
        companyHistoryTypeInputHidden.value = selected.join(', ');
    } else {
        companyHistoryTypePlaceholder.textContent = selected.join(', ');
        companyHistoryTypeInputHidden.value = selected.join(', ');
    }
    
    // Auto-trigger filter when selection changes
    filterHistoryCompanyTable();
}

document.querySelectorAll('#companyTypeDropdown .select-option, #companyHistoryTypeDropdown .select-option').forEach(option => {
    option.addEventListener('click', (e) => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        // Prevent manual toggle if clicking label or checkbox directly (browser handles those)
        if (checkbox && e.target !== checkbox && e.target.tagName !== 'LABEL') {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
});

typeCheckboxes.forEach(cb => {
    cb.addEventListener('change', updateTypeSelection);
});

historyTypeCheckboxes.forEach(cb => {
    cb.addEventListener('change', updateHistoryTypeSelection);
});

// Country Select Logic
const countrySelect = document.getElementById('countrySelect');
const countryTrigger = document.getElementById('countryTrigger');
const countryPlaceholder = document.getElementById('countryPlaceholder');
const countryInputHidden = document.getElementById('companyCountryInput');
const countryRadios = document.querySelectorAll('#countryDropdown input[type="radio"]');

if (countryTrigger) {
    countryTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (companyTypeSelect) companyTypeSelect.classList.remove('active');
        if (companySizeSelect) companySizeSelect.classList.remove('active');
        countrySelect.classList.toggle('active');
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (countrySelect && !countrySelect.contains(e.target)) {
        countrySelect.classList.remove('active');
    }
    if (companyTypeSelect && !companyTypeSelect.contains(e.target)) {
        companyTypeSelect.classList.remove('active');
    }
    if (companyHistoryTypeSelect && !companyHistoryTypeSelect.contains(e.target)) {
        companyHistoryTypeSelect.classList.remove('active');
    }
    if (typeof companySizeSelect !== 'undefined' && companySizeSelect && !companySizeSelect.contains(e.target)) {
        companySizeSelect.classList.remove('active');
    }
});

// Company Size Select Logic
const companySizeSelect = document.getElementById('companySizeSelect');
const companySizeTrigger = document.getElementById('companySizeTrigger');
const companySizePlaceholder = document.getElementById('companySizePlaceholder');
const companySizeInputHidden = document.getElementById('companySizeInput');
const sizeCheckboxes = document.querySelectorAll('#companySizeDropdown input[type="checkbox"]');

if (companySizeTrigger) {
    companySizeTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (countrySelect) countrySelect.classList.remove('active');
        if (companyTypeSelect) companyTypeSelect.classList.remove('active');
        companySizeSelect.classList.toggle('active');
    });
}

function updateSizeSelection() {
    const selected = Array.from(sizeCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (selected.length === 0) {
        companySizePlaceholder.textContent = 'Todos os tamanhos';
        companySizeInputHidden.value = '';
    } else if (selected.length > 2) {
        companySizePlaceholder.textContent = `${selected.length} tamanhos`;
        companySizeInputHidden.value = selected.join(',');
    } else {
        companySizePlaceholder.textContent = selected.join(', ');
        companySizeInputHidden.value = selected.join(',');
    }
}

document.querySelectorAll('#companySizeDropdown .select-option').forEach(option => {
    option.addEventListener('click', (e) => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        // Prevent manual toggle if clicking label or checkbox directly (browser handles those)
        if (checkbox && e.target !== checkbox && e.target.tagName !== 'LABEL') {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
});

sizeCheckboxes.forEach(cb => {
    cb.addEventListener('change', updateSizeSelection);
});

function updateCountrySelection() {
    const selected = Array.from(countryRadios).find(r => r.checked);
    if (selected) {
        const labelText = selected.nextElementSibling.textContent;
        countryPlaceholder.textContent = labelText;
        countryInputHidden.value = selected.value;
        countrySelect.classList.remove('active');
    }
}

document.querySelectorAll('#countryDropdown .select-option').forEach(option => {
    option.addEventListener('click', (e) => {
        const radio = option.querySelector('input[type="radio"]');
        // Prevent manual toggle if clicking label or radio directly (browser handles those)
        if (radio && e.target !== radio && e.target.tagName !== 'LABEL') {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        }
    });
});

countryRadios.forEach(radio => {
    radio.addEventListener('change', updateCountrySelection);
});

// Connection checking logic
async function checkApiConnection() {
    connectionStatusTitle.textContent = 'Verificando...';
    connectionStatusText.textContent = 'Testando a validade da API Key...';
    connectionStatusDot.className = 'status-dot';

    apiKeyInput.disabled = true;
    refreshConnectionBtn.disabled = true;

    // Checa Apify
    try {
        const response = await fetch('https://api.apify.com/v2/users/me?token=' + APIFY_TOKEN);
        if (response.ok) {
            const data = await response.json();
            connectionStatusTitle.textContent = 'Apify: Conectado';
            connectionStatusText.textContent = 'Autenticado como ' + (data.data.username || 'Usuário Apify');
            connectionStatusDot.className = 'status-dot online';
        } else {
            throw new Error('Chave inválida ou erro na API');
        }
    } catch (error) {
        connectionStatusTitle.textContent = 'Apify: Desconectado';
        connectionStatusText.textContent = 'A chave da API Apify é inválida ou expirou';
        connectionStatusDot.className = 'status-dot error';
    } finally {
        apiKeyInput.disabled = false;
        refreshConnectionBtn.disabled = false;
    }

    // Checa Icypeas
    const icypeasStatusEl = document.getElementById('icypeasStatusText');
    const icypeasKeyInput = document.getElementById('icypeasKeyInput');
    if (icypeasStatusEl && icypeasKeyInput) {
        icypeasKeyInput.value = ICYPEAS_TOKEN;
        if (ICYPEAS_TOKEN) {
            icypeasStatusEl.textContent = 'Icypeas Key configurada ✓';
            icypeasStatusEl.style.color = 'var(--success, #10b981)';
        } else {
            icypeasStatusEl.textContent = 'Icypeas Key não configurada';
            icypeasStatusEl.style.color = 'var(--danger, #ef4444)';
        }
    }

    // Checa cookie LinkedIn
    const linkedinCookieInput = document.getElementById('linkedinCookieInput');
    const linkedinCookieStatus = document.getElementById('linkedinCookieStatus');
    if (linkedinCookieInput) linkedinCookieInput.value = LINKEDIN_COOKIE;
    if (linkedinCookieStatus) {
        if (LINKEDIN_COOKIE) {
            linkedinCookieStatus.textContent = 'Cookie configurado ✓';
            linkedinCookieStatus.style.color = 'var(--success, #10b981)';
        } else {
            linkedinCookieStatus.textContent = 'Cookie não configurado — extração pode falhar';
            linkedinCookieStatus.style.color = 'var(--danger, #ef4444)';
        }
    }
}

if (connectionForm) {
    connectionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newApifyKey = apiKeyInput.value.trim();
        const icypeasKeyInput = document.getElementById('icypeasKeyInput');
        const newIcypeasKey = icypeasKeyInput ? icypeasKeyInput.value.trim() : '';
        const linkedinCookieInput = document.getElementById('linkedinCookieInput');
        const newLinkedinCookie = linkedinCookieInput ? linkedinCookieInput.value.trim() : '';

        if (newApifyKey) {
            APIFY_TOKEN = newApifyKey;
            localStorage.setItem('apify_token', newApifyKey);
        }
        if (newIcypeasKey) {
            ICYPEAS_TOKEN = newIcypeasKey;
            localStorage.setItem('icypeas_token', newIcypeasKey);
        }
        if (newLinkedinCookie) {
            LINKEDIN_COOKIE = newLinkedinCookie;
            localStorage.setItem('linkedin_cookie', newLinkedinCookie);
        }

        if (newApifyKey || newIcypeasKey || newLinkedinCookie) {
            showToast('Configurações salvas com sucesso!');
            checkApiConnection();
        }
    });
}

const toggleApiKey = document.getElementById('toggleApiKey');
if (toggleApiKey) {
    toggleApiKey.addEventListener('click', () => {
        const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        apiKeyInput.setAttribute('type', type);
        const icon = toggleApiKey.querySelector('i');
        if (type === 'text') {
            icon.classList.remove('ph-eye');
            icon.classList.add('ph-eye-slash');
        } else {
            icon.classList.remove('ph-eye-slash');
            icon.classList.add('ph-eye');
        }
    });
}

const toggleLinkedinCookie = document.getElementById('toggleLinkedinCookie');
if (toggleLinkedinCookie) {
    toggleLinkedinCookie.addEventListener('click', () => {
        const input = document.getElementById('linkedinCookieInput');
        if (!input) return;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        const icon = toggleLinkedinCookie.querySelector('i');
        icon.classList.toggle('ph-eye', type === 'password');
        icon.classList.toggle('ph-eye-slash', type === 'text');
    });
}

const toggleIcypeasKey = document.getElementById('toggleIcypeasKey');
if (toggleIcypeasKey) {
    toggleIcypeasKey.addEventListener('click', () => {
        const icypeasKeyInput = document.getElementById('icypeasKeyInput');
        if (!icypeasKeyInput) return;
        const type = icypeasKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        icypeasKeyInput.setAttribute('type', type);
        const icon = toggleIcypeasKey.querySelector('i');
        if (type === 'text') {
            icon.classList.remove('ph-eye');
            icon.classList.add('ph-eye-slash');
        } else {
            icon.classList.remove('ph-eye-slash');
            icon.classList.add('ph-eye');
        }
    });
}

if (refreshConnectionBtn) {
    refreshConnectionBtn.addEventListener('click', () => {
        checkApiConnection();
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.borderLeftColor = type === 'success' ? 'var(--brand-primary)' : 'var(--danger)';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function updateStatus(state, mainText, subText) {
    if (!statusCard) return;

    // Hide if finished or idle
    if (mainText === 'Finalizado' || mainText === 'Aguardando') {
        statusCard.style.display = 'none';
        return;
    }

    statusCard.style.display = 'flex';
    statusCard.className = 'stat-card panel status-card ' + state;
    if (motorStatusText) motorStatusText.textContent = mainText;
    if (motorSubtext) motorSubtext.textContent = subText;

    let dot = statusCard.querySelector('.status-dot');
    if (!dot) {
        dot = document.createElement('div');
        const container = document.createElement('div');
        container.className = 'status-dot-container';
        container.appendChild(dot);
        statusCard.insertBefore(container, statusCard.firstChild);
    }
    dot.className = 'status-dot ' + (state === 'active' ? 'running' : state === 'error' ? 'error' : 'online');
}

function renderTable(data) {
    if (data.length === 0) {
        resultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6">
                    <div class="empty-content">
                        <i class="las la-folder-open"></i>
                        <p>A busca não retornou resultados.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    resultsBody.innerHTML = '';

    data.forEach(profile => {
        const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Perfil LinkedIn';
        const title = profile.headline || profile.position || 'Não informado';
        const locationStr = profile.location ? (profile.location.linkedinText || profile.location.country || profile.location) : 'N/A';
        const companyLabel = (profile.currentPosition && profile.currentPosition[0] ? profile.currentPosition[0].companyName : null)
            || profile.companyName
            || '';
        const photoUrl = profile.photo || '';
        const profileUrl = profile.linkedinUrl || '#';

        const row = document.createElement('tr');

        // Avatar element
        let avatarHtml = `<div class="user-avatar" style="border-radius: 8px; width: 32px; height: 32px; font-size: 1rem;">${fullName.charAt(0).toUpperCase()}</div>`;
        if (photoUrl) {
            avatarHtml = `<div class="user-avatar" style="border-radius: 8px; overflow: hidden; width: 32px; height: 32px;"><img src="${photoUrl}" alt="${fullName}" onerror="this.style.display='none'" style="width: 100%; height: 100%; object-fit: cover;"></div>`;
        }

        const emailStr = (profile.emails && profile.emails.length > 0) ? profile.emails.join(', ') : (profile.email || 'N/A');
        const isoCode = getCountryISO(locationStr);
        const flagHtml = isoCode
            ? `<img src="https://flagcdn.com/w40/${isoCode}.png" srcset="https://flagcdn.com/w80/${isoCode}.png 2x" width="24" alt="${locationStr}" style="border-radius: 2px;">`
            : `<i class="las la-globe" style="font-size: 1.2rem; color: var(--text-muted);"></i>`;

        let tColor = '#ffeb3b', tBg = 'rgba(255, 235, 59, 0.1)', tBorder = 'rgba(255, 235, 59, 0.2)';
        if (profile.tier === 1) {
            tColor = '#10b981'; tBg = 'rgba(16, 185, 129, 0.15)'; tBorder = 'rgba(16, 185, 129, 0.3)';
        } else if (profile.tier === 2) {
            tColor = '#ff9800'; tBg = 'rgba(255, 152, 0, 0.15)'; tBorder = 'rgba(255, 152, 0, 0.3)';
        }
        const tierBadge = profile.tier ? `<span style="display:inline-block; margin-top: 4px; padding: 3px 6px; font-size: 0.65rem; border-radius: 2px; background: ${tBg}; color: ${tColor}; border: 1px solid ${tBorder};">Tier ${profile.tier}</span>` : '';
        const doubleConfirmedBadge = profile.doubleConfirmed ? `<span style="display:inline-block; margin-top: 4px; margin-left: 3px; padding: 3px 6px; font-size: 0.60rem; border-radius: 2px; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);" title="Confirmado em 2 fontes">✓✓ 2x</span>` : '';
        const phoneStr = profile.phone || profile.phones?.[0] || 'N/A';

        row.innerHTML = `
            <td style="text-align: center;" title="${locationStr}">
                <div style="display: flex; justify-content: center; align-items: center;">
                    ${flagHtml}
                </div>
            </td>
            <td>
                <div class="user-profile">
                    ${avatarHtml}
                    <div class="user-details" style="max-width: 200px;">
                        <strong style="font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${fullName}</strong>
                        ${profile.publicIdentifier
                            ? `<a href="${profileUrl}" target="_blank" style="font-size: 0.75rem; color: var(--brand-primary); text-decoration: none;">${profile.publicIdentifier}</a>`
                            : `<span style="font-size: 0.75rem; color: var(--text-muted);">LinkedIn</span>`}
                    </div>
                </div>
            </td>
            <td style="font-size: 0.85rem; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">
                ${title}<br>${tierBadge}${doubleConfirmedBadge}
            </td>
            <td><span style="color: var(--brand-primary); font-size: 0.85rem; font-weight: 500;">${companyLabel}</span></td>
            <td>
                <span style="color: var(--text-muted); font-size: 0.85rem; display: block;">
                    ${emailStr !== 'N/A' ? `<a href="mailto:${emailStr}" style="color: inherit; text-decoration: none;">📧 ${emailStr}</a>` : '📧 N/A'}
                </span>
                <span style="color: var(--text-muted); font-size: 0.80rem; display: block; margin-top: 2px;">
                    ${phoneStr !== 'N/A' ? `📞 ${phoneStr}` : ''}
                </span>
            </td>
            <td style="text-align: center;">
                ${profileUrl && profileUrl !== '#'
                    ? `<a href="${profileUrl}" target="_blank" class="btn btn-extract-action" style="font-size: 0.8rem; padding: 0.4rem 1rem; text-decoration: none; display: inline-block;">Ver Perfil</a>`
                    : `<span class="btn btn-extract-action" style="font-size: 0.8rem; padding: 0.4rem 1rem; display: inline-block; opacity: 0.4; cursor: not-allowed;">Sem Link</span>`
                }
            </td>
        `;
        resultsBody.appendChild(row);
    });
}

function setFormState(loading) {
    companyInput.disabled = loading;
    linkedinUrlInput.disabled = loading;
    roleInput.disabled = loading;
    searchBtn.disabled = loading;

    const btnContent = searchBtn.innerHTML;
    if (loading) {
        searchBtn.innerHTML = '<span style="display: flex; align-items: center; gap: 0.5rem;"><div class="spinner" style="margin: 0; width: 16px; height: 16px; border-width: 2px;"></div> Extraindo...</span>';
    } else {
        searchBtn.innerHTML = '<span><i class="las la-bolt"></i> Extrair Agora</span>';
    }
}

async function runExtractionPipeline(companyName, companyDomain = null, companyLinkedinUrl = null) {
    const resolvedUrl = companyLinkedinUrl || linkedinUrlInput.value.trim();
    if (!companyName && !resolvedUrl) return;

    switchView('search');
    if (companyName) companyInput.value = companyName;
    if (companyLinkedinUrl) linkedinUrlInput.value = companyLinkedinUrl;

    setFormState(true);
    updateStatus('active', 'Buscando Funcionários', 'Extraindo do LinkedIn...');
    resultsBody.innerHTML = `
        <tr class="empty-state">
            <td colspan="6">
                <div class="empty-content">
                    <div class="spinner" style="width: 40px; height: 40px; border-width: 3px; border-top-color: var(--brand-primary);"></div>
                    <p style="color: var(--brand-primary); margin-top: 1rem;">Processando informações... Isso pode levar alguns minutos.</p>
                </div>
            </td>
        </tr>
    `;

    try {
        // ── ETAPA 1: Buscar perfis básicos (modo Short) ──
        updateStatus('active', 'Buscando Funcionários', 'Extraindo perfis do LinkedIn...');

        const role = roleInput.value.trim();

        // URL do LinkedIn vem do campo dedicado, com fallback para companyLinkedinUrl (quando chamado via botão Extrair da lista de empresas)
        let linkedinCompanyUrl = companyLinkedinUrl || linkedinUrlInput.value.trim();
        if (linkedinCompanyUrl.includes('linkedin.com/company/') && !linkedinCompanyUrl.startsWith('http')) {
            linkedinCompanyUrl = `https://${linkedinCompanyUrl}`;
        }

        if (!linkedinCompanyUrl || !linkedinCompanyUrl.includes('linkedin.com/company/')) {
            showToast('Insira a URL do LinkedIn da empresa. Ex: https://www.linkedin.com/company/brbet/', 'error');
            updateStatus('error', 'URL inválida', 'Informe a URL do LinkedIn da empresa.');
            setFormState(false);
            return;
        }

        // Nome legível: usa o campo companyName se preenchido, senão extrai do slug da URL
        let displayCompanyName = companyName.trim();
        if (!displayCompanyName) {
            const slugMatch = linkedinCompanyUrl.match(/linkedin\.com\/company\/([^/]+)/);
            if (slugMatch) {
                displayCompanyName = slugMatch[1]
                    .split('-')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
            }
        }

        // Normaliza URL: remove /people/ se vier, garante barra final
        let companySlug = linkedinCompanyUrl.replace(/\/people\/?$/, '').replace(/\/?$/, '/');

        // Extrai slug curto da URL (ex: "betano" de ".../company/betano/")
        const slugMatch = companySlug.match(/linkedin\.com\/company\/([^/]+)/);
        const companySlugShort = slugMatch ? slugMatch[1] : companySlug;

        const runActor = async (actorId, payload) => {
            const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errBody = await res.text();
                let errMsg = `Falha ao iniciar (HTTP ${res.status})`;
                try { const j = JSON.parse(errBody); if (j.error?.message) errMsg = j.error.message; } catch (_) {}
                throw new Error(errMsg);
            }
            const runData = await res.json();
            const runId = runData.data.id;
            const datasetId = runData.data.defaultDatasetId;
            while (true) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                const statusData = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)).json();
                const status = statusData.data.status;
                if (status === 'SUCCEEDED') break;
                if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) throw new Error(`Actor falhou: ${status}`);
            }
            return await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`)).json();
        };

        // ── ETAPA 1: Rodar os dois actors em paralelo (double-check) ──
        updateStatus('active', 'Buscando Funcionários', 'Consultando 2 fontes simultâneas...');

        // Normaliza o cookie: garante formato "li_at=VALUE"
        const cookieStr = LINKEDIN_COOKIE
            ? (LINKEDIN_COOKIE.startsWith('li_at=') ? LINKEDIN_COOKIE : `li_at=${LINKEDIN_COOKIE}`)
            : null;

        // harvestapi~linkedin-profile-search
        const primaryPayload = {
            currentCompanies: [companySlug, companySlugShort],
            profileScraperMode: 'Short',
            maxResults: 60
        };
        if (role) primaryPayload.currentJobTitles = [role];
        if (cookieStr) primaryPayload.cookie = cookieStr;

        // harvestapi~linkedin-company-employees
        // aponta pra /people/ que é onde o LinkedIn lista os funcionários
        const peopleUrl = companySlug.replace(/\/?$/, '/') + 'people/';
        const fallbackPayload = {
            startUrls: [{ url: peopleUrl }],
            profileScraperMode: 'Short ($4 per 1k)',
            maxResults: 60
        };
        if (role) fallbackPayload.jobTitles = [role];
        if (cookieStr) fallbackPayload.cookie = cookieStr;

        console.log('[Pipeline] Payloads enviados:');
        console.log('[Pipeline] profile-search →', JSON.stringify(primaryPayload));
        console.log('[Pipeline] company-employees →', JSON.stringify(fallbackPayload));

        const [primaryItems, fallbackItems] = await Promise.all([
            runActor(PROFILE_SEARCH_ACTOR_ID, primaryPayload).catch(err => {
                console.warn('[Pipeline] Actor profile-search falhou:', err.message);
                return [];
            }),
            runActor(EMPLOYEES_ACTOR_ID, fallbackPayload).catch(err => {
                console.warn('[Pipeline] Actor company-employees falhou:', err.message);
                return [];
            })
        ]);

        console.log(`[Pipeline] Resultados — profile-search: ${primaryItems.length} | company-employees: ${fallbackItems.length}`);
        if (primaryItems.length === 0 && fallbackItems.length === 0) {
            console.warn('[Pipeline] Ambos actors retornaram 0. Verifique os payloads acima no console.');
        }

        // ── Cross-check: unir os dois resultados com deduplicação por publicIdentifier/linkedinUrl ──
        const profileMap = new Map();

        const addToMap = (items, source) => {
            for (const item of items) {
                const key = item.publicIdentifier
                    || (item.linkedinUrl || item.url || item.profileUrl || '').replace(/\/$/, '').split('/').pop()
                    || null;
                if (!key) continue;
                if (profileMap.has(key)) {
                    // Perfil apareceu nos dois: marcar como double-confirmed
                    profileMap.get(key)._sources.add(source);
                } else {
                    profileMap.set(key, { ...item, _sources: new Set([source]) });
                }
            }
        };

        addToMap(primaryItems, 'profile-search');
        addToMap(fallbackItems, 'company-employees');

        // Perfis confirmados pelas 2 fontes têm prioridade na ordenação
        let datasetItems = Array.from(profileMap.values()).map(item => ({
            ...item,
            _doubleConfirmed: item._sources.size === 2
        }));

        console.log(`[Pipeline] Total após merge: ${datasetItems.length} | Double-confirmed: ${datasetItems.filter(p => p._doubleConfirmed).length}`);
        updateStatus('active', 'Cruzando Dados', `${datasetItems.length} perfis encontrados (${datasetItems.filter(p => p._doubleConfirmed).length} confirmados em 2 fontes)...`);

        // ── Ordenar por cargo (Tier) ──
        updateStatus('active', 'Filtrando Cargos', 'Analisando relevância...');

        // Tier 1: tomadores de decisão sênior (C-level, diretores, fundadores, heads)
        const tier1Keywords = [
            'ceo', 'chief executive', 'coo', 'chief operating', 'cto', 'chief technology',
            'cmo', 'chief marketing', 'cfo', 'chief financial', 'cpo', 'chief product',
            'founder', 'co-founder', 'cofounder', 'owner', 'president', 'vice president', 'vp ',
            'director', 'head of', 'general manager', 'managing director', 'country manager',
            'commercial director', 'casino manager', 'business development director',
            'chief of staff', 'board member', 'chairman'
        ];

        // Tier 2: gerentes e decisores de médio nível
        const tier2Keywords = [
            'manager', 'partnerships', 'account executive', 'business development',
            'product owner', 'operations', 'crm', 'sales', 'commercial', 'growth',
            'analyst', 'consultant', 'coordinator', 'specialist', 'lead', 'senior'
        ];

        // Tier 3: cargos operacionais sem poder de decisão
        const tier3Keywords = [
            'social media', 'community manager', 'affiliate', 'influencer', 'content creator',
            'editor', 'copywriter', 'designer', 'support', 'customer service', 'assistant',
            'intern', 'estagiário', 'trainee', 'recruiter', 'hr ', 'human resources',
            'accountant', 'finance analyst', 'developer', 'engineer', 'qa ', 'tester',
            'data entry', 'administrative', 'receptionist'
        ];

        function getTier(title) {
            if (!title) return 3;
            const t = title.toLowerCase();
            for (let kw of tier1Keywords) if (t.includes(kw)) return 1;
            for (let kw of tier3Keywords) if (t.includes(kw)) return 3;
            for (let kw of tier2Keywords) if (t.includes(kw)) return 2;
            return 3;
        }

        if (datasetItems.length === 0) {
            console.error('[Pipeline] 0 resultados. Verifique no console os payloads enviados e confirme que a URL da empresa está correta.');
            updateStatus('error', 'Sem Resultados', 'Nenhum funcionário retornado. Verifique a URL da empresa ou tente com um filtro de cargo.');
            showToast('Nenhum resultado. Abra o console (F12) para ver os detalhes e confirme que a URL do LinkedIn está correta.', 'error');
            renderTable([]);
            setFormState(false);
            return;
        }

        const filteredEmployees = datasetItems
            .map(emp => {
                // ── Validar se ainda trabalha na empresa ──
                // A API retorna currentPositions (posições ativas) e positions (histórico completo).
                // Um perfil é "ex-funcionário" quando:
                //   a) currentPositions está vazio (nenhuma posição ativa), ou
                //   b) nenhuma das posições ativas bate com o slug da empresa pesquisada, ou
                //   c) todas as posições que batem com a empresa têm endDate/endYear definido.

                const allCurrentPositions = emp.currentPositions || [];
                const allPositions = emp.positions || emp.experience || [];

                const isPositionActive = (pos) => {
                    if (!pos) return false;
                    // Se há endDate ou endYear com valor, o cargo acabou
                    if (pos.endDate || pos.endYear || pos.end) return false;
                    // timePeriod é o campo usado pelo HarvestAPI: { endDate: { month, year } }
                    if (pos.timePeriod?.endDate?.year) return false;
                    return true;
                };

                const matchesCompany = (pos) => {
                    if (!pos) return false;
                    const posCompany = (pos.companyName || pos.company || pos.companyUsername || '').toLowerCase();
                    return posCompany.includes(companySlugShort.toLowerCase()) || companySlugShort.toLowerCase().includes(posCompany) || posCompany.length > 2 && displayCompanyName.toLowerCase().includes(posCompany);
                };

                // Se a API retornou currentPositions preenchido, usamos ele como fonte de verdade
                let activeAtCompany = false;
                if (allCurrentPositions.length > 0) {
                    // currentPositions já deveria ser só posições ativas, mas filtramos por segurança
                    activeAtCompany = allCurrentPositions.some(p => isPositionActive(p));
                } else if (allPositions.length > 0) {
                    // Sem currentPositions: analisar o histórico e verificar se há posição ativa na empresa
                    activeAtCompany = allPositions.some(p => matchesCompany(p) && isPositionActive(p));
                } else {
                    // Sem nenhum dado de posição: confiar no resultado da API (veio de employee search)
                    activeAtCompany = true;
                }

                if (!activeAtCompany) {
                    console.warn('[Pipeline] Ex-funcionário ignorado (cargo encerrado):', emp.firstName, emp.lastName, emp.headline);
                    return null;
                }

                const currentPos = allCurrentPositions[0] || allPositions.find(p => isPositionActive(p));
                const title = emp.headline || emp.position || emp.designation || emp.title || currentPos?.title || '';
                const tier = getTier(title);
                const verifiedUrl = emp.linkedinUrl || emp.url || emp.profileUrl || emp.link || (emp.publicIdentifier ? `https://www.linkedin.com/in/${emp.publicIdentifier}` : '');

                const hasIdentity = emp.firstName || emp.lastName || emp.publicIdentifier || emp.name;
                const hasLinkedinUrl = verifiedUrl && verifiedUrl.includes('linkedin.com/in/');

                if (!hasIdentity || !hasLinkedinUrl) {
                    console.warn('Perfil ignorado (sem identidade ou URL do LinkedIn):', emp);
                    return null;
                }

                let firstName = emp.firstName || '';
                let lastName = emp.lastName || '';
                if (emp.name && !firstName) {
                    const parts = emp.name.trim().split(' ');
                    firstName = parts[0] || '';
                    lastName = parts.slice(1).join(' ') || '';
                }

                return {
                    ...emp,
                    firstName,
                    lastName,
                    headline: title,
                    linkedinUrl: verifiedUrl,
                    tier,
                    doubleConfirmed: emp._doubleConfirmed || false
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                // Double-confirmed com Tier menor tem prioridade máxima
                const aScore = a.tier * 10 - (a.doubleConfirmed ? 5 : 0);
                const bScore = b.tier * 10 - (b.doubleConfirmed ? 5 : 0);
                return aScore - bScore;
            })
            .slice(0, 30);

        console.log(`[Pipeline] ${filteredEmployees.length} funcionários com identidade válida após ordenação`);

        if (filteredEmployees.length === 0) {
            const keysFound = Object.keys(datasetItems[0]).join(', ');
            console.warn('[Pipeline] Campos retornados pela API:', keysFound);
            console.warn('[Pipeline] Amostra completa:', JSON.stringify(datasetItems[0], null, 2));
            updateStatus('error', 'Sem Perfis Válidos', 'A API retornou dados sem URL do LinkedIn. Tente usar a URL exata da empresa no LinkedIn.');
            showToast(`Nenhum perfil com URL do LinkedIn válida encontrado. Cole a URL exata da empresa (ex: linkedin.com/company/brbet) no campo de busca.`, 'error');
            renderTable([]);
            setFormState(false);
            return;
        }

        // ── Finalizando Etapa 1 ──
        updateStatus('active', 'Finalizando', 'Estruturando resultados...');

        const finalLeads = filteredEmployees.map(emp => {
            const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            return {
                ...emp,
                fullName,
                companyName: displayCompanyName,
                companyDomain: companyDomain || '',
                email: emp.email || '',
                phone: emp.phone || '',
                emails: emp.email ? [emp.email] : [],
                tier: emp.tier
            };
        });

        globalLeads = finalLeads;
        renderTable(finalLeads);
        await saveLeadsToDb(finalLeads);

        totalLeadsEl.textContent = finalLeads.length;
        if (globalLeads.length > 0) {
            pullDataBtn.disabled = false;
        }

        const doubleCount = finalLeads.filter(l => l.doubleConfirmed).length;
        showToast(`${finalLeads.length} perfis encontrados (${doubleCount} confirmados em 2 fontes). Clique em "Puxar Dados" para buscar os e-mails.`);
        updateStatus('success', 'Aguardando', `Pronto. ${finalLeads.length} funcionários encontrados.`);

    } catch (error) {
        console.error(error);
        showToast('Ops! Ocorreu um erro durante a extração.', 'error');
        updateStatus('error', 'Erro Crítico', error.message);
    } finally {
        setFormState(false);
    }
}

function handleExtract() {
    const company = companyInput.value.trim();
    const linkedinUrl = linkedinUrlInput.value.trim();
    if (linkedinUrl) {
        runExtractionPipeline(company, null, linkedinUrl);
    } else {
        showToast('Insira a URL do LinkedIn da empresa.', 'error');
    }
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleExtract();
});

if (searchBtn) searchBtn.addEventListener('click', handleExtract);


// ── Icypeas enrichment: busca email por LinkedIn URL ou nome + empresa ──
async function enrichLeadWithIcypeas(lead) {
    if (!ICYPEAS_TOKEN) return null;
    try {
        // Monta o body: prioriza LinkedIn URL, cai para nome + empresa como fallback
        const body = lead.linkedinUrl
            ? { linkedin: lead.linkedinUrl }
            : {
                firstname: lead.firstName || '',
                lastname: lead.lastName || '',
                domainOrCompany: lead.companyName || ''
              };

        const res = await fetch('https://app.icypeas.com/api/email-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ICYPEAS_TOKEN}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            console.warn(`[Icypeas] HTTP ${res.status} para ${lead.linkedinUrl || lead.fullName}`);
            return null;
        }

        const data = await res.json();

        // Suporta os dois formatos de resposta da Icypeas
        const email = data?.item?.emails?.[0]
            || data?.data?.email
            || data?.email
            || '';

        if (!email) return null;
        return { email, emails: [email], phone: '' };
    } catch (err) {
        console.warn('[Icypeas] Erro ao enriquecer:', lead.linkedinUrl, err.message);
        return null;
    }
}

if (pullDataBtn) {
    pullDataBtn.addEventListener('click', async () => {
        if (!globalLeads || globalLeads.length === 0) return;

        if (!ICYPEAS_TOKEN) {
            showToast('Configure sua Icypeas API Key na aba Conexão antes de puxar dados.', 'error');
            return;
        }

        pullDataBtn.disabled = true;
        searchBtn.disabled = true;

        const originalPullBtnContent = pullDataBtn.innerHTML;
        pullDataBtn.innerHTML = '<span style="display: flex; align-items: center; gap: 0.5rem;"><div class="spinner" style="margin: 0; width: 16px; height: 16px; border-width: 2px;"></div> Puxando...</span>';

        updateStatus('active', 'Buscando Emails (Icypeas)', `Enriquecendo 0/${globalLeads.length} leads...`);

        const enrichedMap = new Map();

        for (let i = 0; i < globalLeads.length; i++) {
            const lead = globalLeads[i];

            updateStatus('active', 'Buscando Emails (Icypeas)', `Enriquecendo ${i + 1}/${globalLeads.length} leads...`);

            const result = await enrichLeadWithIcypeas(lead);
            const mapKey = lead.linkedinUrl || lead.fullName || i;
            if (result) enrichedMap.set(mapKey, result);

            // Respeita rate limit da Icypeas
            if (i < globalLeads.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        updateStatus('active', 'Finalizando', 'Atualizando resultados...');

        globalLeads = globalLeads.map((emp, i) => {
            const mapKey = emp.linkedinUrl || emp.fullName || i;
            const enriched = enrichedMap.get(mapKey);
            return {
                ...emp,
                email: enriched?.email || emp.email || '',
                emails: enriched?.emails?.length ? enriched.emails : (emp.email ? [emp.email] : []),
                phone: emp.phone || ''
            };
        });

        renderTable(globalLeads);
        await saveLeadsToDb(globalLeads);

        pullDataBtn.innerHTML = originalPullBtnContent;
        pullDataBtn.disabled = false;
        searchBtn.disabled = false;

        const withEmail = globalLeads.filter(l => l.email && l.email !== 'N/A' && l.email !== '').length;
        showToast(`Enriquecimento finalizado: ${withEmail}/${globalLeads.length} emails encontrados.`);
        updateStatus('success', 'Finalizado', 'Emails enriquecidos com sucesso!');
    });
}

// Company Search Logic
let globalCompanies = [];

function updateCompanyStatus(state, mainText, subText) {
    if (!companyStatusCard) return;

    // Hide if finished or idle
    if (mainText === 'Finalizado' || mainText === 'Aguardando') {
        companyStatusCard.style.display = 'none';
        return;
    }

    companyStatusCard.style.display = 'flex';
    companyStatusCard.className = 'stat-card panel status-card ' + state;
    if (companyMotorStatusText) companyMotorStatusText.textContent = mainText;
    if (companyMotorSubtext) companyMotorSubtext.textContent = subText;

    let dot = companyStatusCard.querySelector('.status-dot');
    if (!dot) {
        dot = document.createElement('div');
        const container = document.createElement('div');
        container.className = 'status-dot-container';
        container.appendChild(dot);
        companyStatusCard.insertBefore(container, companyStatusCard.firstChild);
    }
    dot.className = 'status-dot ' + (state === 'active' ? 'running' : state === 'error' ? 'error' : 'online');
}

function setCompanyFormState(loading) {
    if (companyCountryInput) companyCountryInput.disabled = loading;
    if (companyTypeInput) companyTypeInput.disabled = loading;
    if (companyKeywordsInput) companyKeywordsInput.disabled = loading;
    if (companyCountInput) companyCountInput.disabled = loading;
    if (companySearchBtn) companySearchBtn.disabled = loading;

    if (companySearchBtn) {
        if (loading) {
            companySearchBtn.innerHTML = '<span style="display: flex; align-items: center; gap: 0.5rem;"><div class="spinner" style="margin: 0; width: 16px; height: 16px; border-width: 2px;"></div> Buscando...</span>';
        } else {
            companySearchBtn.innerHTML = '<span><i class="las la-bolt"></i> Buscar Empresas</span>';
        }
    }
}

function getEmployeeRange(count) {
    if (!count) return 'N/A';
    if (typeof count === 'string') {
        const strCount = count.trim();
        if (strCount.includes('1-10') || strCount === '1 - 10') return '1-10';
        if (strCount.includes('11-50') || strCount === '11 - 50') return '11-50';
        if (strCount.includes('51-200') || strCount === '51 - 200') return '51-200';
        if (strCount.includes('201-500') || strCount === '201 - 500') return '201-500';
        if (strCount.includes('501-1000') || strCount === '501 - 1000') return '501-1000';
        if (strCount.includes('1001-5000') || strCount === '1001 - 5000') return '1001-5000';
        if (strCount.includes('5001-10000') || strCount === '5001 - 10000') return '5001-10000';
        if (strCount.includes('10000+') || strCount.includes('10001+')) return '10000+';
    }

    let num_str = count.toString().replace(/[^0-9]/g, '');
    if (num_str === '') return 'N/A';
    const num = parseInt(num_str, 10);

    if (isNaN(num) || num === 0) return 'N/A';
    if (num <= 10) return '1-10';
    if (num <= 50) return '11-50';
    if (num <= 200) return '51-200';
    if (num <= 500) return '201-500';
    if (num <= 1000) return '501-1000';
    if (num <= 5000) return '1001-5000';
    if (num <= 10000) return '5001-10000';
    return '10000+';
}

function getCountryISO(countryName) {
    if (!countryName || countryName === 'N/A') return null;
    const name = (typeof countryName === 'string' ? countryName : (countryName.country || countryName.name || '')).toLowerCase().trim();
    if (name.includes('brasil') || name.includes('brazil') || name === 'br') return 'br';
    if (name.includes('malta') || name === 'mt') return 'mt';
    if (name.includes('uk') || name.includes('united kingdom') || name.includes('reino unido') || name === 'gb') return 'gb';
    if (name.includes('us') || name.includes('united states') || name.includes('estados unidos') || name === 'usa') return 'us';
    if (name.includes('portugal') || name === 'pt') return 'pt';
    if (name.includes('spain') || name.includes('espanha') || name === 'es') return 'es';
    if (name.includes('cyprus') || name.includes('chipre') || name === 'cy') return 'cy';
    if (name.includes('curacao') || name.includes('curaçao') || name === 'cw') return 'cw';
    if (name.includes('canada') || name.includes('canadá') || name === 'ca') return 'ca';
    if (name.includes('australia') || name.includes('austrália') || name === 'au') return 'au';
    if (name.includes('germany') || name.includes('alemanha') || name === 'de') return 'de';
    if (name.includes('france') || name.includes('frança') || name === 'fr') return 'fr';
    if (name.includes('india') || name.includes('índia') || name === 'in') return 'in';
    if (name.includes('china') || name === 'cn') return 'cn';
    if (name.includes('argentina') || name === 'ar') return 'ar';
    if (name.includes('colombia') || name.includes('colômbia') || name === 'co') return 'co';
    if (name.includes('mexico') || name.includes('méxico') || name === 'mx') return 'mx';
    if (name.includes('chile') || name === 'cl') return 'cl';
    if (name.includes('peru') || name.includes('perú') || name === 'pe') return 'pe';
    return null;
}

function isLocalPreview() {
    return window.location.hostname === 'localhost'
        || window.location.hostname === '127.0.0.1'
        || window.location.protocol === 'file:';
}

function getCompanyLogoUrl(company) {
    const linkedinLogo = company.logoUrl || company.logo || '';
    if (!linkedinLogo) return '';

    // In production, keep LinkedIn media same-origin so browser privacy
    // protections do not hide company logos that still exist in Mongo.
    if (!isLocalPreview()) {
        const params = new URLSearchParams({
            logo: linkedinLogo,
            linkedin: company.linkedinUrl || '',
            id: company._id || ''
        });
        return `/api/company-logo?${params.toString()}`;
    }

    return linkedinLogo;
}

function escapeHtmlAttribute(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function handleCompanyLogoError(image) {
    image.remove();
}

function getCompanyAvatarHtml(company, name) {
    const initial = escapeHtmlAttribute(name.charAt(0).toUpperCase());
    const logoUrl = getCompanyLogoUrl(company);

    if (!logoUrl) {
        return `<div class="user-avatar company-avatar" style="border-radius: 8px;"><span>${initial}</span></div>`;
    }

    return `<div class="user-avatar company-avatar" style="border-radius: 8px;"><span>${initial}</span><img src="${escapeHtmlAttribute(logoUrl)}" alt="${escapeHtmlAttribute(name)}" onerror="handleCompanyLogoError(this)"></div>`;
}

function renderCompanyTable(data) {
    if (!companyResultsBody) return;
    if (data.length === 0) {
        companyResultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6">
                    <div class="empty-content">
                        <i class="las la-folder-open"></i>
                        <p>Nenhuma empresa encontrada com os critérios definidos.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    companyResultsBody.innerHTML = '';

    data.forEach((company, index) => {
        const name = company.name || company.title || 'N/A';
        const industry = company._maktubType || company.industry || company.type || companyTypeInput.value || 'N/A';
        const rawLocation = company.location?.linkedinText
            || company.headquarters
            || (typeof company.location === 'string' ? company.location : '')
            || company.country
            || '';
        let locationStr = typeof rawLocation === 'string' ? rawLocation : (rawLocation.country || rawLocation.name || '');
        if (!locationStr && companyCountryInput) locationStr = companyCountryInput.value || '';
        if (!locationStr) locationStr = 'N/A';
        const employeesRaw = company.employeeCount || company.staffCount || company.employees || '0';
        const employeesRange = getEmployeeRange(employeesRaw);
        const profileUrl = company.linkedinUrl || company.url || '#';
        const isoCode = getCountryISO(locationStr);

        const row = document.createElement('tr');

        const avatarHtml = getCompanyAvatarHtml(company, name);

        const isSaved = globalHistoryCompanies.some(c => 
            (c.linkedinUrl === profileUrl && profileUrl !== '#') || 
            (c.name === name)
        );

        const statusHtml = isSaved
            ? `<div class="status-indicator" title="Já salva no banco"><i class="ph-bold ph-checks" style="color: var(--brand-primary); font-size: 1.4rem;"></i></div>`
            : `<div class="status-indicator save-company-btn" data-index="${index}" title="Salvar empresa" style="opacity: 0.35; cursor: pointer; transition: opacity 0.2s;"><i class="ph-bold ph-plus" style="font-size: 1rem;"></i></div>`;

        row.innerHTML = `
            <td style="text-align: center;">
                ${statusHtml}
            </td>
            <td>
                <div class="user-profile">
                    ${avatarHtml}
                    <div class="user-details" style="max-width: 300px;">
                        <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</strong>
                    </div>
                </div>
            </td>
            <td><span class="industry-tag">${industry}</span></td>
            <td><i class="las la-users" style="color: var(--text-muted); margin-right: 4px;"></i> ${employeesRange}</td>
            <td>
                <a href="${profileUrl}" target="_blank" class="linkedin-link">
                    Ver Perfil
                </a>
            </td>
            <td style="text-align: center;">
                <button class="btn btn-extract-action extract-leads-btn" data-company="${encodeURIComponent(name)}" title="Buscar Leads desta Empresa">
                    EXTRAIR
                </button>
            </td>
        `;
        companyResultsBody.appendChild(row);
    });

    // Add event listeners tracking button clicks
    document.querySelectorAll('.extract-leads-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const companyName = decodeURIComponent(e.currentTarget.dataset.company);
            const companyObj = globalCompanies.find(c => c.name === companyName || c.title === companyName);
            let companyDomain = null;
            let companyLinkedinUrl = companyObj?.linkedinUrl || companyObj?.url || null;
            if (companyObj && (companyObj.url || companyObj.websiteUrl)) {
                try {
                    const u = new URL(companyObj.url || companyObj.websiteUrl);
                    let h = u.hostname;
                    if (h.startsWith('www.')) h = h.slice(4);
                    if (!h.includes('linkedin.com')) companyDomain = h;
                } catch (err) { }
            }
            showExtractConfirm(companyName, companyDomain, companyLinkedinUrl);
        });
    });

    document.querySelectorAll('.save-company-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const el = e.currentTarget;
            const idx = parseInt(el.dataset.index);
            const company = globalCompanies[idx];
            if (!company) return;

            el.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:var(--brand-primary);margin:0;"></div>`;
            el.style.opacity = '1';
            el.style.cursor = 'default';
            el.classList.remove('save-company-btn');

            const success = await saveCompaniesToDb([company]);
            if (success) {
                el.innerHTML = `<i class="ph-bold ph-checks" style="color: var(--brand-primary); font-size: 1.4rem;"></i>`;
                el.title = 'Já salva no banco';
                globalHistoryCompanies.push(company);
                showToast(`${company.name || company.title} salva!`);
            } else {
                el.innerHTML = `<i class="ph-bold ph-plus" style="font-size: 1rem;"></i>`;
                el.style.opacity = '0.35';
                el.style.cursor = 'pointer';
                el.classList.add('save-company-btn');
                showToast('Erro ao salvar empresa.', 'error');
            }
        });
    });
}

if (companyExtractForm) {
    companyExtractForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const country = (companyCountryInput.value || '').trim();
        const type = (companyTypeInput.value || '').trim();
        // size filter removed — contaminates igaming queries
        const keywords = (companyKeywordsInput.value || '').trim();
        const maxResults = parseInt(companyCountInput.value || '10');

        const typeList = type ? type.split(',').map(s => s.trim()).filter(s => s) : [];

        if (typeList.length === 0 && !keywords) {
            showToast('Selecione pelo menos um tipo de empresa ou informe palavras-chave.', 'error');
            return;
        }

        setCompanyFormState(true);
        updateCompanyStatus('active', 'Requisitando API', 'Iniciando busca de empresas...');
        
        // Fetch history to update status badges
        try {
            const historyApiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
                ? 'http://localhost:3000/api/empresas'
                : '/api/empresas';
            const res = await fetch(historyApiUrl);
            if (res.ok) {
                globalHistoryCompanies = await res.json();
            }
        } catch (e) {
            console.error('Failed to fetch history', e);
        }

        if (companyResultsBody) {
            companyResultsBody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="6">
                        <div class="empty-content">
                            <div class="spinner" style="width: 40px; height: 40px; border-width: 3px; border-top-color: var(--brand-primary);"></div>
                            <p style="color: var(--brand-primary); margin-top: 1rem;">Mapeando empresas no LinkedIn... Aguarde.</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const negativeKeywords = [
                'payment provider', 'psp', 'fintech', 'crypto exchange',
                'affiliate network', 'affiliate marketing', 'marketing agency', 'advertising agency',
                'seo agency', 'media company', 'news', 'blog', 'review site', 'odds comparison',
                'tipster', 'esports news', 'casino review', 'lead generation',
                'summit', 'event organizer', 'conference', 'wallet', 'pagamento', 'conta digital', 'vpag',
                // Excluir empresas puramente de apostas esportivas (sem cassino)
                'sports betting only', 'pure sportsbook', 'fantasy sports', 'daily fantasy',
                'sports analytics', 'sports data', 'trading sports', 'football betting'
            ];

            const countryTermsMap = {
                'Brazil': ['brasil', 'brazil', 'latam', 'latin america', 'américa latina'],
                'Portugal': ['portugal'],
                'España': ['españa', 'spain', 'espanha'],
                'Argentina': ['argentina'],
                'Colombia': ['colombia', 'colômbia'],
                'Mexico': ['mexico', 'méxico'],
            };

            // Restaurar seen companies do localStorage
            if (!window.globalSeenCompanies) {
                const stored = localStorage.getItem('maktub_seen_companies');
                window.globalSeenCompanies = new Set(stored ? JSON.parse(stored) : []);
            }
            try {
                const urlsApiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
                    ? 'http://localhost:3000/api/empresas/urls'
                    : '/api/empresas/urls';
                const urlsRes = await fetch(urlsApiUrl);
                if (urlsRes.ok) {
                    const savedUrls = await urlsRes.json();
                    savedUrls.forEach(u => window.globalSeenCompanies.add(u));
                }
            } catch (_) { /* servidor offline, usa só memória */ }

            // Montar pool completo de queries embaralhadas por tipo
            const queryPool = [];
            typeList.forEach(t => {
                const queries = [...(QUERY_SETS[t] || [COMPANY_TYPE_KEYWORDS[t] || t])];
                queries.sort(() => 0.5 - Math.random());
                queries.forEach(q => queryPool.push({ query: q, industries: INDUSTRY_IDS[t] || ["4"], type: t }));
            });
            if (keywords) {
                const allIndustries = [...new Set(typeList.flatMap(t => INDUSTRY_IDS[t] || ["4"]))];
                const industries = allIndustries.length > 0 ? allIndustries : ["4"];
                const kwType = typeList[0] || 'Operator';
                keywords.split(',').map(s => s.trim()).filter(s => s).forEach(kw => {
                    queryPool.push({ query: kw, industries, type: kwType });
                });
            }

            // Calcular skip para paginar além dos resultados já vistos
            const savedCount = globalHistoryCompanies ? globalHistoryCompanies.length : 0;
            const skipOffset = savedCount > 0 ? Math.floor(savedCount / Math.max(queryPool.length, 1)) : 0;

            // Funções auxiliares reutilizáveis
            const runQuery = async ({ query, industries, type }) => {
                const payload = {
                    searchQuery: query,
                    industries,
                    maxItems: Math.max(50, maxResults * 3),
                    ...(skipOffset > 0 ? { skip: skipOffset } : {})
                };
                const res = await fetch(`https://api.apify.com/v2/acts/${COMPANY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Falha ao iniciar busca de empresas');
                const data = await res.json();
                return { runId: data.data.id, datasetId: data.data.defaultDatasetId, type };
            };

            const pollRun = async (runId) => {
                while (true) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const statusData = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)).json();
                    const status = statusData.data.status;
                    if (status === 'SUCCEEDED') return;
                    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) throw new Error(`Busca falhou: ${status}`);
                }
            };

            const fetchDataset = async (datasetId) =>
                (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`)).json();

            const applyFilters = (items, datasetType) => {
                // Atribuir tipo
                items.forEach(item => { item._maktubType = item._maktubType || datasetType; });

                // Filtro por país
                if (country && country !== 'Worldwide') {
                    const terms = countryTermsMap[country] || [country.toLowerCase()];
                    const filtered = items.filter(company => {
                        const text = [company.description, company.summary, company.tagline, company.specialties, company.name, company.industry]
                            .filter(Boolean).join(' ').toLowerCase();
                        return terms.some(t => text.includes(t));
                    });
                    if (filtered.length > 0) items = filtered;
                }

                // Filtro negativo
                items = items.filter(company => {
                    const name = (company.name || company.title || '').toLowerCase();
                    const desc = (company.description || company.industry || '').toLowerCase();
                    return !negativeKeywords.some(neg => name.includes(neg) || desc.includes(neg));
                });

                return items;
            };

            // --- Loop principal: roda lotes de queries até ter maxResults NOVAS ---
            const newItemsMap = new Map();  // só empresas que NÃO estão no banco
            const seenMap = new Map();      // empresas que já estão no banco (fallback)
            const globalDedup = new Set(); // evita processar o mesmo item duas vezes entre rodadas
            const BATCH_SIZE = 3;
            let queryIndex = 0;
            let round = 0;

            while (newItemsMap.size < maxResults && queryIndex < queryPool.length) {
                const batch = queryPool.slice(queryIndex, queryIndex + BATCH_SIZE);
                queryIndex += BATCH_SIZE;
                round++;

                updateCompanyStatus('active', `Rodada ${round}`, `Buscando mais empresas... (${newItemsMap.size}/${maxResults} novas encontradas)`);

                const runs = await Promise.all(batch.map(runQuery));
                await Promise.all(runs.map(r => pollRun(r.runId)));

                for (const run of runs) {
                    const raw = await fetchDataset(run.datasetId);
                    const filtered = applyFilters(Array.isArray(raw) ? raw : [], run.type);
                    for (const item of filtered) {
                        const key = item.linkedinUrl || item.url || item.name;
                        if (!key || globalDedup.has(key)) continue;
                        globalDedup.add(key);

                        if (window.globalSeenCompanies.has(key)) {
                            seenMap.set(key, item); // já no banco → fallback
                        } else {
                            newItemsMap.set(key, item); // nova → conta para o critério
                        }

                        if (newItemsMap.size >= maxResults) break;
                    }
                    if (newItemsMap.size >= maxResults) break;
                }
            }

            updateCompanyStatus('active', 'Consolidando', 'Preparando resultados...');

            // Preferir novas; completar com fallback só se esgotou todas as queries
            let finalItems = [...newItemsMap.values()];
            if (finalItems.length < maxResults) {
                const fallback = [...seenMap.values()].sort(() => 0.5 - Math.random());
                finalItems = finalItems.concat(fallback.slice(0, maxResults - finalItems.length));
            }
            finalItems = finalItems.slice(0, maxResults);

            // Registrar em memória e persistir
            for (const item of finalItems) {
                const key = item.linkedinUrl || item.url || item.name;
                if (key) window.globalSeenCompanies.add(key);
            }
            try {
                localStorage.setItem('maktub_seen_companies', JSON.stringify([...window.globalSeenCompanies]));
            } catch (_) { /* localStorage cheio, ignora */ }

            datasetItems = finalItems;
            globalCompanies = datasetItems;
            renderCompanyTable(datasetItems);

            if (totalCompaniesEl) totalCompaniesEl.textContent = datasetItems.length;
            if (exportCompanyBtn && datasetItems.length > 0) exportCompanyBtn.disabled = false;

            const roundsMsg = round > 1 ? ` (${round} rodadas de busca)` : '';
            showToast(`${datasetItems.length} empresas encontradas com sucesso!${roundsMsg}`);
            updateCompanyStatus('success', 'Finalizado', 'Aguardando próxima tarefa...');

        } catch (error) {
            console.error(error);
            showToast('Ops! Ocorreu um erro durante a busca de empresas.', 'error');
            updateCompanyStatus('error', 'Erro Crítico', error.message);
        } finally {
            setCompanyFormState(false);
        }
    });
}

if (exportCompanyBtn) {
    exportCompanyBtn.addEventListener('click', () => {
        if (globalCompanies.length === 0) return;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Nome da Empresa,Setor,Localizacao,Funcionarios,LinkedIn\n";

        globalCompanies.forEach(company => {
            const name = (company.name || company.title || 'N/A').replace(/"/g, '""');
            const industry = (company.industry || company.type || companyTypeInput.value || 'N/A').replace(/"/g, '""');
            let locationStr = (company.headquarters || company.location || company.country || 'N/A').replace(/"/g, '""');
            if (locationStr === 'N/A' && companyCountryInput) {
                locationStr = (companyCountryInput.value || 'N/A').replace(/"/g, '""');
            }
            const employeesRaw = (company.employeeCount || company.staffCount || company.employees || '0');
            const employees = getEmployeeRange(employeesRaw);
            const link = company.linkedinUrl || company.url || 'N/A';

            csvContent += `"${name}","${industry}","${locationStr}","${employees}","${link}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `empresas_maktub_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Extrato exportado para CSV!');
    });
}

async function saveLeadsToDb(leads) {
    if (!leads || leads.length === 0) return;

    updateStatus('active', 'Salvando no Banco', 'Sincronizando com MongoDB...');

    try {
        // Se estiver rodando no localhost com o servidor na porta 3000, usa a URL completa.
        // Na Vercel, o caminho será apenas '/api/leads'
        const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
            ? 'http://localhost:3000/api/leads'
            : '/api/leads';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leads)
        });

        if (response.ok) {
            console.log('Leads salvos no MongoDB com sucesso');
            showToast(`${leads.length} Leads salvos no banco de dados!`);
        } else {
            console.error('Falha ao salvar leads no backend');
            showToast('Erro ao salvar no banco de dados', 'error');
        }
    } catch (error) {
        console.error('Erro de conexão com o backend:', error);
        showToast('Servidor offline - Leads não salvos no banco', 'error');
    } finally {
        updateStatus('success', 'Finalizado', 'Aguardando próxima tarefa...');
    }
}

async function saveCompaniesToDb(companies) {
    if (!companies || companies.length === 0) return false;

    try {
        const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
            ? 'http://localhost:3000/api/empresas'
            : '/api/empresas';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(companies)
        });

        if (!response.ok) {
            console.error('Falha ao salvar empresas no backend');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Erro de conexão com o backend ao salvar empresas:', error);
        return false;
    }
}

// History Logic
async function fetchHistoryLeads() {
    if (!historyResultsBody) return;

    historyResultsBody.innerHTML = `
        <tr class="empty-state">
            <td colspan="7">
                <div class="empty-content">
                    <div class="spinner" style="width: 30px; height: 30px; border-width: 3px; border-top-color: var(--brand-primary);"></div>
                    <p>Buscando leads salvos...</p>
                </div>
            </td>
        </tr>
    `;

    try {
        const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
            ? 'http://localhost:3000/api/leads'
            : '/api/leads';

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Falha ao carregar o histórico');

        const leads = await response.json();
        globalHistoryLeads = leads;

        if (historyNameFilter) historyNameFilter.value = '';
        if (historyCompanyFilter) historyCompanyFilter.value = '';

        renderHistoryTable(leads);
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        historyResultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="7">
                    <div class="empty-content">
                        <i class="las la-exclamation-triangle" style="color: var(--danger-dark);"></i>
                        <p style="color: var(--danger-dark);">Erro ao carregar o histórico. Tente novamente mais tarde.</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

function renderHistoryTable(data) {
    if (!historyTotalLeads || !historyResultsBody) return;

    historyTotalLeads.textContent = data.length;

    if (data.length === 0) {
        historyResultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="7">
                    <div class="empty-content">
                        <i class="las la-folder-open"></i>
                        <p>Nenhum lead salvo encontrado.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    historyResultsBody.innerHTML = '';

    data.forEach(profile => {
        const fullName = profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Perfil LinkedIn';
        const title = profile.headline || profile.position || 'Não informado';
        const locationStr = typeof profile.location === 'string' ? profile.location : (profile.location ? (profile.location.linkedinText || profile.location.country || 'N/A') : 'N/A');
        const companyLabel = profile.companyName || 'N/A';
        const dateStr = profile.extractedAt ? new Date(profile.extractedAt).toLocaleDateString('pt-BR') : 'N/A';
        const photoUrl = profile.photo || '';
        const profileUrl = profile.linkedinUrl || '#';

        const row = document.createElement('tr');

        let avatarHtml = `<div class="user-avatar" style="border-radius: 8px; width: 32px; height: 32px; font-size: 1rem;">${fullName.charAt(0).toUpperCase()}</div>`;
        if (photoUrl) {
            avatarHtml = `<div class="user-avatar" style="border-radius: 8px; overflow: hidden; width: 32px; height: 32px;"><img src="${photoUrl}" alt="${fullName}" onerror="this.style.display='none'" style="width: 100%; height: 100%; object-fit: cover;"></div>`;
        }

        const emailStr = (profile.emails && profile.emails.length > 0) ? profile.emails.join(', ') : (profile.email || 'N/A');
        const isoCode = getCountryISO(locationStr);
        const flagHtml = isoCode
            ? `<img src="https://flagcdn.com/w40/${isoCode}.png" srcset="https://flagcdn.com/w80/${isoCode}.png 2x" width="24" alt="${locationStr}" style="border-radius: 2px;">`
            : `<i class="las la-globe" style="font-size: 1.2rem; color: var(--text-muted);"></i>`;

        let hColor = '#ffeb3b', hBg = 'rgba(255, 235, 59, 0.1)', hBorder = 'rgba(255, 235, 59, 0.2)';
        if (profile.tier === 1) {
            hColor = '#10b981'; hBg = 'rgba(16, 185, 129, 0.15)'; hBorder = 'rgba(16, 185, 129, 0.3)';
        } else if (profile.tier === 2) {
            hColor = '#ff9800'; hBg = 'rgba(255, 152, 0, 0.15)'; hBorder = 'rgba(255, 152, 0, 0.3)';
        }
        const tierBadge = profile.tier ? `<span style="display:inline-block; margin-top: 4px; padding: 3px 6px; font-size: 0.65rem; border-radius: 2px; background: ${hBg}; color: ${hColor}; border: 1px solid ${hBorder};">Tier ${profile.tier}</span>` : '';

        row.innerHTML = `
            <td style="text-align: center;" title="${locationStr}">
                <div style="display: flex; justify-content: center; align-items: center;">
                    ${flagHtml}
                </div>
            </td>
            <td>
                <div class="user-profile">
                    ${avatarHtml}
                    <div class="user-details" style="max-width: 200px;">
                        <strong style="font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${fullName}</strong>
                        <span style="font-size: 0.75rem;">${profile.publicIdentifier || 'LinkedIn'}</span>
                    </div>
                </div>
            </td>
            <td style="font-size: 0.85rem; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${typeof title === 'string' ? title : ''}">${typeof title === 'string' ? title : ''}<br>${tierBadge}</td>
            <td><span style="color: var(--brand-primary); font-size: 0.85rem; font-weight: 500;">${companyLabel}</span></td>
            <td><span style="color: var(--text-muted); font-size: 0.85rem;">${emailStr !== 'N/A' ? `<a href="mailto:${emailStr}" style="color: inherit; text-decoration: none;">${emailStr}</a>` : 'N/A'}</span></td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</td>
            <td style="text-align: center;">
                <a href="${profileUrl}" target="_blank" class="btn btn-extract-action" style="font-size: 0.8rem; padding: 0.4rem 1rem; text-decoration: none; display: inline-block;">
                    Ver Perfil
                </a>
            </td>
        `;
        historyResultsBody.appendChild(row);
    });
}

function filterHistoryTable() {
    const nameTerm = (historyNameFilter.value || '').toLowerCase();
    const companyTerm = (historyCompanyFilter.value || '').toLowerCase();

    const filteredData = globalHistoryLeads.filter(lead => {
        const fullName = (lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`).toLowerCase();
        const title = (lead.headline || lead.position || '').toLowerCase();
        const company = (lead.companyName || '').toLowerCase();

        const matchName = fullName.includes(nameTerm) || title.includes(nameTerm);
        const matchCompany = company.includes(companyTerm);

        if (nameTerm && companyTerm) return matchName && matchCompany;
        if (nameTerm) return matchName;
        if (companyTerm) return matchCompany;
        return true;
    });

    renderHistoryTable(filteredData);
}

if (historySearchBtn) historySearchBtn.addEventListener('click', filterHistoryTable);

// Company History Logic
async function fetchHistoryCompanies() {
    if (!companyHistoryResultsBody) return;

    companyHistoryResultsBody.innerHTML = `
        <tr class="empty-state">
            <td colspan="5">
                <div class="empty-content">
                    <div class="spinner" style="width: 30px; height: 30px; border-width: 3px; border-top-color: var(--brand-primary);"></div>
                    <p>Buscando empresas salvas...</p>
                </div>
            </td>
        </tr>
    `;

    try {
        const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
            ? 'http://localhost:3000/api/empresas'
            : '/api/empresas';

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Falha ao carregar histórico de empresas');

        const companies = await response.json();
        globalHistoryCompanies = companies;
        
        // Push original search companies context
        globalCompanies = companies;

        if (companyHistoryNameFilter) companyHistoryNameFilter.value = '';
        if (companyHistoryIndustryFilter) companyHistoryIndustryFilter.value = '';

        renderHistoryCompanyTable(companies);
    } catch (error) {
        console.error('Erro ao buscar histórico de empresas:', error);
        companyHistoryResultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="5">
                    <div class="empty-content">
                        <i class="las la-exclamation-triangle" style="color: var(--danger-dark);"></i>
                        <p style="color: var(--danger-dark);">Erro ao carregar histórico de empresas. Tente novamente mais tarde.</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

function renderHistoryCompanyTable(data) {
    if (!companyHistoryTotalCompanies || !companyHistoryResultsBody) return;

    companyHistoryTotalCompanies.textContent = data.length;

    if (data.length === 0) {
        companyHistoryResultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="5">
                    <div class="empty-content">
                        <i class="las la-folder-open"></i>
                        <p>Nenhuma empresa salva encontrada.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    companyHistoryResultsBody.innerHTML = '';

    data.forEach(company => {
        const name = company.name || company.title || 'N/A';
        const industry = company._maktubType || company.industry || company.type || 'N/A';
        const rawLocation = company.location?.linkedinText
            || company.headquarters
            || (typeof company.location === 'string' ? company.location : '')
            || company.country
            || '';
        let locationStr = typeof rawLocation === 'string' ? rawLocation : (rawLocation.country || rawLocation.name || '');
        if (!locationStr) locationStr = 'N/A';
        const employeesRaw = company.employeeCount || company.staffCount || company.employees || '0';
        const employeesRange = getEmployeeRange(employeesRaw);
        const profileUrl = company.linkedinUrl || company.url || '#';
        const isoCode = getCountryISO(locationStr);
        const dateStr = company.extractedAt ? new Date(company.extractedAt).toLocaleDateString('pt-BR') : 'N/A';

        const row = document.createElement('tr');

        const avatarHtml = getCompanyAvatarHtml(company, name);

        row.innerHTML = `
            <td>
                <div class="user-profile">
                    ${avatarHtml}
                    <div class="user-details" style="max-width: 300px;">
                        <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</strong>
                    </div>
                </div>
            </td>
            <td><span class="industry-tag">${industry}</span></td>
            <td><i class="las la-users" style="color: var(--text-muted); margin-right: 4px;"></i> ${employeesRange}</td>
            <td>
                <a href="${profileUrl}" target="_blank" class="linkedin-link">
                    Ver Perfil
                </a>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                    <button class="btn btn-extract-action history-extract-leads-btn" data-company="${encodeURIComponent(name)}" title="Buscar Leads desta Empresa">
                        EXTRAIR
                    </button>
                    <button class="btn history-delete-company-btn" data-id="${company._id}" title="Deletar empresa do banco de dados" style="padding: 0.4rem 0.6rem; background: transparent; border: none; color: rgba(239,68,68,0.7); cursor: pointer; transition: all 0.2s;">
                        <i class="ph-bold ph-trash" style="font-size: 0.9rem;"></i>
                    </button>
                </div>
            </td>
        `;
        companyHistoryResultsBody.appendChild(row);
    });

    document.querySelectorAll('.history-extract-leads-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const companyName = decodeURIComponent(e.currentTarget.dataset.company);
            const companyObj = globalHistoryCompanies.find(c => c.name === companyName || c.title === companyName);
            let companyDomain = null;
            let companyLinkedinUrl = companyObj?.linkedinUrl || companyObj?.url || null;
            if (companyObj && (companyObj.url || companyObj.websiteUrl)) {
                try {
                    const u = new URL(companyObj.url || companyObj.websiteUrl);
                    let h = u.hostname;
                    if (h.startsWith('www.')) h = h.slice(4);
                    if (!h.includes('linkedin.com')) companyDomain = h;
                } catch (err) { }
            }
            showExtractConfirm(companyName, companyDomain, companyLinkedinUrl);
        });
    });

    document.querySelectorAll('.history-delete-company-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!id) return;

            const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
                ? `http://localhost:3000/api/empresas/${id}`
                : `/api/empresas/${id}`;

            try {
                const res = await fetch(apiUrl, { method: 'DELETE' });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error || `HTTP ${res.status}`);
                }
                globalHistoryCompanies = globalHistoryCompanies.filter(c => String(c._id) !== id);
                showToast('Empresa deletada com sucesso!');
                filterHistoryCompanyTable();
            } catch (err) {
                console.error('Erro ao deletar empresa:', err);
                showToast(`Erro ao deletar: ${err.message}`, 'error');
            }
        });
    });
}

function filterHistoryCompanyTable() {
    const nameTerm = (companyHistoryNameFilter.value || '').toLowerCase();
    
    // Split the comma-separated list into individual selected types
    const industryInputValue = companyHistoryIndustryFilter.value || '';
    const selectedIndustries = industryInputValue ? industryInputValue.split(',').map(s => s.trim().toLowerCase()) : [];

    const filteredData = globalHistoryCompanies.filter(company => {
        const name = (company.name || company.title || '').toLowerCase();
        const industry = (company._maktubType || company.industry || company.type || '').toLowerCase();

        const matchName = name.includes(nameTerm);
        // Match if no industry is selected, OR if the company's industry partially matches one of the selected ones
        const matchIndustry = selectedIndustries.length === 0 || selectedIndustries.some(si => industry.includes(si) || si.includes(industry));

        return matchName && matchIndustry;
    });

    renderHistoryCompanyTable(filteredData);
}

// Ensure the name filter also triggers when typing
if (companyHistoryNameFilter) {
    companyHistoryNameFilter.addEventListener('input', filterHistoryCompanyTable);
}

if (companyHistorySearchBtn) companyHistorySearchBtn.addEventListener('click', filterHistoryCompanyTable);

// Refresh button for company history
const refreshCompanyHistoryBtn = document.getElementById('refreshCompanyHistoryBtn');
if (refreshCompanyHistoryBtn) {
    refreshCompanyHistoryBtn.addEventListener('click', () => {
        const icon = refreshCompanyHistoryBtn.querySelector('i');
        if (icon) icon.classList.add('la-spin');
        fetchHistoryCompanies().finally(() => {
            if (icon) icon.classList.remove('la-spin');
        });
    });
}

// ── Confirmation Modal ──
let pendingExtraction = null;

function showExtractConfirm(companyName, companyDomain, companyLinkedinUrl) {
    pendingExtraction = { companyName, companyDomain, companyLinkedinUrl };
    document.getElementById('modalCompanyName').textContent = companyName;
    document.getElementById('extractConfirmModal').style.display = 'flex';
}

function hideExtractConfirm() {
    document.getElementById('extractConfirmModal').style.display = 'none';
    pendingExtraction = null;
}

document.getElementById('modalCancelBtn').addEventListener('click', hideExtractConfirm);

document.getElementById('modalConfirmBtn').addEventListener('click', () => {
    if (!pendingExtraction) return;
    const { companyName, companyDomain, companyLinkedinUrl } = pendingExtraction;
    hideExtractConfirm();
    runExtractionPipeline(companyName, companyDomain, companyLinkedinUrl);
});

document.getElementById('extractConfirmModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('extractConfirmModal')) hideExtractConfirm();
});

