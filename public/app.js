let APIFY_TOKEN = '';
let ICYPEAS_TOKEN = '';
let LINKEDIN_COOKIE = '';
let currentUser = null;
const EMPLOYEES_ACTOR_ID = 'harvestapi~linkedin-company-employees';
const COMPANY_ACTOR_ID = 'harvestapi~linkedin-company-search';

function localApiCandidates(path) {
    const isLocalPage = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        || window.location.protocol === 'file:';

    if (!isLocalPage) {
        return [path];
    }

    if (window.location.port === '3000' || window.location.port === '3001') {
        return [
            path,
            `http://localhost:3000${path}`,
            `http://localhost:3001${path}`
        ];
    }

    return [
        `http://localhost:3000${path}`,
        `http://localhost:3001${path}`,
        path
    ];
}

async function fetchPublicLinkedInEmployees(companyUrl) {
    const path = `/api/public-linkedin-employees?linkedin=${encodeURIComponent(companyUrl)}`;
    let lastStatus = '';

    for (const endpoint of localApiCandidates(path)) {
        try {
            const response = await fetch(endpoint);
            if (!response.ok) {
                lastStatus = `${endpoint} -> HTTP ${response.status}`;
                continue;
            }

            const items = await response.json();
            return Array.isArray(items) ? items : [];
        } catch (error) {
            lastStatus = `${endpoint} -> ${error.message}`;
        }
    }

    console.warn('[Pipeline] Backend do fallback publico indisponivel:', lastStatus);
    return [];
}

async function postLocalApi(path, body) {
    let lastStatus = '';

    for (const endpoint of localApiCandidates(path)) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const errorBody = await response.text();
                lastStatus = `${endpoint} -> HTTP ${response.status} ${errorBody}`;
                continue;
            }

            return await response.json();
        } catch (error) {
            lastStatus = `${endpoint} -> ${error.message}`;
        }
    }

    throw new Error(lastStatus || `Backend indisponivel para ${path}`);
}

async function fetchLocalApi(path, options = {}) {
    let lastStatus = '';

    for (const endpoint of localApiCandidates(path)) {
        try {
            const response = await fetch(endpoint, {
                ...options,
                credentials: 'include',
                headers: {
                    ...(options.headers || {})
                }
            });
            return response;
        } catch (error) {
            lastStatus = `${endpoint} -> ${error.message}`;
        }
    }

    throw new Error(lastStatus || `Backend indisponivel para ${path}`);
}

async function apifyApi(path, options = {}) {
    const response = await fetchLocalApi(`/api/apify${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && !contentType.includes('application/json')) {
        const error = new Error('A rota Apify retornou uma pagina HTML. Reinicie o servidor local e tente novamente.');
        error.statusCode = 502;
        throw error;
    }

    if (!response.ok) {
        const errorBody = await response.text();
        let message = `Apify backend retornou HTTP ${response.status}`;
        try {
            const parsed = JSON.parse(errorBody);
            if (parsed.error) message = parsed.error;
        } catch (_) {}
        const error = new Error(message);
        error.statusCode = response.status;
        throw error;
    }

    return response.json();
}

async function apifyText(path) {
    const response = await fetchLocalApi(`/api/apify${path}`);
    if (!response.ok) return '';
    return response.text();
}

function getApifyRun(data) {
    return data?.data || data || {};
}

function getRequiredApifyRun(data) {
    const run = getApifyRun(data);
    const runId = run.id;
    const datasetId = run.defaultDatasetId;

    if (!runId) {
        throw new Error('A Apify iniciou a busca, mas nao retornou o runId. Confira o actor configurado e tente novamente.');
    }
    if (!datasetId) {
        throw new Error('A Apify iniciou a busca, mas nao retornou o datasetId. Confira o actor configurado e tente novamente.');
    }

    return { run, runId, datasetId };
}

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
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('appContainer');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authModeBtn = document.getElementById('authModeBtn');
const authError = document.getElementById('authError');
const sidebarToggle = document.getElementById('sidebarToggle');
const logoIcon = document.getElementById('collapsedLogo');
const form = document.getElementById('extractForm');
const companyInput = document.getElementById('companyInput');
const linkedinUrlInput = document.getElementById('linkedinUrlInput');
const roleInput = document.getElementById('roleInput');
const searchBtn = document.getElementById('searchBtn');
const resultsBody = document.getElementById('resultsBody');
const totalLeadsEl = document.getElementById('totalLeads');
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

// Dashboard
let dashDateFilter = 'all';
let dashDateFrom = '';
let dashDateTo = '';

function buildDashParams() {
    const now = new Date();
    let from = '';
    let to = '';
    if (dashDateFilter === 'today') {
        from = now.toISOString().slice(0, 10);
    } else if (dashDateFilter === 'yesterday') {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        from = y.toISOString().slice(0, 10);
        to = y.toISOString().slice(0, 10);
    } else if (dashDateFilter === '7days') {
        const d = new Date(now); d.setDate(d.getDate() - 6);
        from = d.toISOString().slice(0, 10);
    } else if (dashDateFilter === '30days') {
        const d = new Date(now); d.setDate(d.getDate() - 29);
        from = d.toISOString().slice(0, 10);
    } else if (dashDateFilter === 'custom') {
        from = dashDateFrom;
        to = dashDateTo;
    }
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
}

async function fetchDashboard() {
    const typesEl = document.getElementById('dashCompanyTypes');
    const crmStagesEl = document.getElementById('dashCrmStages');
    const totalCompEl = document.getElementById('dashTotalCompanies');
    const totalLeadsEl = document.getElementById('dashTotalLeads');
    const withEmailEl = document.getElementById('dashLeadsWithEmail');
    const totalCostEl = document.getElementById('dashTotalCost');

    if (typesEl) typesEl.innerHTML = '<div class="empty-content" style="padding:2rem;"><div class="spinner dash-spinner" style="width:28px;height:28px;border-width:3px;border-top-color:var(--brand-primary);"></div><p>Carregando...</p></div>';
    if (crmStagesEl) crmStagesEl.innerHTML = '<div class="empty-content" style="padding:2rem;"><div class="spinner dash-spinner" style="width:28px;height:28px;border-width:3px;border-top-color:var(--brand-primary);"></div><p>Carregando...</p></div>';
    if (totalCompEl) totalCompEl.textContent = '—';
    if (totalLeadsEl) totalLeadsEl.textContent = '—';
    if (withEmailEl) withEmailEl.textContent = '—';
    if (totalCostEl) totalCostEl.textContent = '—';

    try {
        const qs = buildDashParams();
        const res = await fetch(`/api/dashboard${qs ? '?' + qs : ''}`, { credentials: 'include' });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();

        if (totalCompEl) totalCompEl.textContent = data.totalCompanies ?? 0;
        if (totalLeadsEl) totalLeadsEl.textContent = data.totalLeads ?? 0;
        if (withEmailEl) withEmailEl.textContent = data.totalLeadsWithEmail ?? 0;
        if (totalCostEl) totalCostEl.textContent = `$${Number(data.totalCostUsd ?? 0).toFixed(4)}`;

        if (typesEl) {
            const types = data.companiesByType || [];
            if (types.length === 0) {
                typesEl.innerHTML = '<div class="empty-content" style="padding:2rem;"><p>Nenhuma empresa categorizada ainda.</p></div>';
            } else {
                const total = types.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
                const colors = ['#D7FE03', '#ffffff', '#8ea600', '#6f7f16', '#3d4612', '#a1a1a1'];
                let currentDeg = 0;
                const segments = types.map((item, index) => {
                    const count = Number(item.count || 0);
                    const nextDeg = currentDeg + (count / total) * 360;
                    const segment = `${colors[index % colors.length]} ${currentDeg.toFixed(2)}deg ${nextDeg.toFixed(2)}deg`;
                    currentDeg = nextDeg;
                    return segment;
                }).join(', ');

                typesEl.innerHTML = `
                    <div class="dash-donut-wrap">
                        <div class="dash-donut" style="background: conic-gradient(${segments});">
                            <div class="dash-donut-center">
                                <strong>${total}</strong>
                                <span>empresas</span>
                            </div>
                        </div>
                        <div class="dash-donut-legend">
                            ${types.map((t, index) => {
                                const count = Number(t.count || 0);
                                const percent = Math.round((count / total) * 100);
                                return `
                                    <div class="dash-donut-legend-item">
                                        <span class="dash-donut-color" style="background:${colors[index % colors.length]}"></span>
                                        <span class="dash-donut-label">${escapeHtml(t.type || 'Outros')}</span>
                                        <strong>${count}</strong>
                                        <span class="dash-list-percent">${percent}%</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        }

        if (crmStagesEl) {
            try {
                let leads = crmLoaded && Array.isArray(crmLeads) ? crmLeads : [];
                if (!leads.length) {
                    const leadsResponse = await fetchLocalApi('/api/leads');
                    if (!leadsResponse.ok) throw new Error('Falha ao carregar etapas do CRM');
                    leads = await leadsResponse.json();
                    crmLeads = Array.isArray(leads) ? leads : [];
                    globalHistoryLeads = crmLeads;
                    crmLoaded = true;
                }
                renderDashboardCrmStages(crmLeads);
            } catch (stageError) {
                console.error('[Dashboard CRM] Erro:', stageError.message);
                crmStagesEl.innerHTML = `<div class="empty-content" style="padding:2rem;"><p>Erro ao carregar etapas: ${escapeHtml(stageError.message)}</p></div>`;
            }
        }
    } catch (err) {
        console.error('[Dashboard] Erro:', err.message);
        if (typesEl) typesEl.innerHTML = `<div class="empty-content" style="padding:2rem;"><p>Erro: ${err.message}</p></div>`;
        if (crmStagesEl) crmStagesEl.innerHTML = `<div class="empty-content" style="padding:2rem;"><p>Erro: ${escapeHtml(err.message)}</p></div>`;
    }
}

function renderDashboardCrmStages(leads = []) {
    const crmStagesEl = document.getElementById('dashCrmStages');
    if (!crmStagesEl) return;

    loadCrmStages();
    if (!crmStages.length) {
        crmStages = [...DEFAULT_CRM_STAGES];
        saveCrmStages();
    }

    const stageCounts = crmStages.map(stage => ({
        ...stage,
        count: leads.filter(lead => getLeadCrmStage(lead) === stage.id).length
    }));
    const max = Math.max(...stageCounts.map(stage => stage.count), 1);
    const total = stageCounts.reduce((sum, stage) => sum + stage.count, 0);

    if (!stageCounts.length) {
        crmStagesEl.innerHTML = '<div class="empty-content" style="padding:2rem;"><p>Nenhuma etapa cadastrada.</p></div>';
        return;
    }

    crmStagesEl.innerHTML = `
        <div class="dash-crm-stage-total">
            <span>Total no CRM</span>
            <strong>${total}</strong>
        </div>
        <div class="dash-crm-funnel">
            ${stageCounts.map((stage, index) => {
                const taper = stageCounts.length > 1 ? index / (stageCounts.length - 1) : 0;
                const stageWidth = Math.max(34, Math.round(100 - (taper * 44)));
                const fill = Math.round((stage.count / max) * 100);
                const percent = total ? Math.round((stage.count / total) * 100) : 0;

                return `
                    <div class="dash-crm-funnel-row" style="--stage-width:${stageWidth}%; --stage-fill:${fill}%;">
                        <div class="dash-crm-stage-row">
                            <span class="dash-stage-index">${String(index + 1).padStart(2, '0')}</span>
                            <div class="dash-list-main">
                                <span class="dash-crm-stage-name">${escapeHtml(stage.name)}</span>
                                <span class="dash-list-percent">${percent}%</span>
                            </div>
                            <span class="dash-stage-count">${stage.count}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Views & Navigation
const dashboardView = document.getElementById('dashboard-view');
const crmView = document.getElementById('crm-view');
const emailBlastsView = document.getElementById('email-blasts-view');
const searchView = document.getElementById('search-view');
const companySearchView = document.getElementById('company-search-view');
const connectionView = document.getElementById('connection-view');
const usageView = document.getElementById('usage-view');
const historyView = document.getElementById('history-view');
const companyHistoryView = document.getElementById('company-history-view');
const accountView = document.getElementById('account-view');
const navDashboard = document.getElementById('nav-dashboard');
const navCrm = document.getElementById('nav-crm');
const navEmailBlasts = document.getElementById('nav-email-blasts');
const navSearch = document.getElementById('nav-search');
const navCompanySearch = document.getElementById('nav-company-search');
const navConnection = document.getElementById('nav-connection');
const navUsage = document.getElementById('nav-usage');
const navHistory = document.getElementById('nav-history');
const navCompanyHistory = document.getElementById('nav-company-history');
const navAccount = document.getElementById('nav-account');
const logoutBtn = document.getElementById('logoutBtn');
const accountEmail = document.getElementById('accountEmail');
const accountAvatar = document.getElementById('accountAvatar');
const accountApifyStatus = document.getElementById('accountApifyStatus');
const accountIcypeasStatus = document.getElementById('accountIcypeasStatus');
const accountLinkedinStatus = document.getElementById('accountLinkedinStatus');
const accountPasswordForm = document.getElementById('accountPasswordForm');
const currentPasswordInput = document.getElementById('currentPasswordInput');
const newPasswordInput = document.getElementById('newPasswordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const accountPasswordBtn = document.getElementById('accountPasswordBtn');
const accountPasswordMessage = document.getElementById('accountPasswordMessage');

// History UI Elements
const historyResultsBody = document.getElementById('historyResultsBody');
const historyTotalLeads = document.getElementById('historyTotalLeads');
const historyLeadsWithEmail = document.getElementById('historyLeadsWithEmail');
const historyNameFilter = document.getElementById('historyNameFilter');
const historyCompanyFilter = document.getElementById('historyCompanyFilter');
const historySearchBtn = document.getElementById('historySearchBtn');
const historySpinner = document.getElementById('historySpinner');
const historyEmptyText = document.getElementById('historyEmptyText');

let globalHistoryLeads = [];

const DEFAULT_CRM_STAGES = [
    { id: 'novo', name: 'Novo' },
    { id: 'contato', name: 'Contato feito' },
    { id: 'reuniao', name: 'Reuniao marcada' },
    { id: 'proposta', name: 'Proposta enviada' },
    { id: 'fechado', name: 'Fechado' }
];
const CRM_STAGES_STORAGE_KEY = 'maktubCrmStages';
let crmStages = [];
let crmLeads = [];
let crmSearchTerm = '';
let crmEmailFilter = 'all';
let crmLoaded = false;

const crmBoard = document.getElementById('crmBoard');
const crmAddStageBtn = document.getElementById('crmAddStageBtn');
const crmRefreshBtn = document.getElementById('crmRefreshBtn');
const crmSearchInput = document.getElementById('crmSearchInput');
const crmEmailFilterSelect = document.getElementById('crmEmailFilter');
const crmLeadCount = document.getElementById('crmLeadCount');
const crmStageCount = document.getElementById('crmStageCount');
const crmLeadModal = document.getElementById('crmLeadModal');
const crmLeadModalTitle = document.getElementById('crmLeadModalTitle');
const crmLeadModalCloseBtn = document.getElementById('crmLeadModalCloseBtn');
const crmLeadModalCancelBtn = document.getElementById('crmLeadModalCancelBtn');
const crmLeadModalSaveBtn = document.getElementById('crmLeadModalSaveBtn');
const crmLeadFullNameInput = document.getElementById('crmLeadFullNameInput');
const crmLeadTitleInput = document.getElementById('crmLeadTitleInput');
const crmLeadCompanyInput = document.getElementById('crmLeadCompanyInput');
const crmLeadEmailInput = document.getElementById('crmLeadEmailInput');
const crmLeadLinkedinInput = document.getElementById('crmLeadLinkedinInput');
const crmLeadStageSelect = document.getElementById('crmLeadStageSelect');
const crmLeadDetailsGrid = document.getElementById('crmLeadDetailsGrid');
const crmLeadRawData = document.getElementById('crmLeadRawData');
const crmLeadNotesInput = document.getElementById('crmLeadNotesInput');
let selectedCrmLeadId = null;

// Company History UI Elements
const companyHistoryResultsBody = document.getElementById('companyHistoryResultsBody');
const companyHistoryTotalCompanies = document.getElementById('companyHistoryTotalCompanies');
const companyHistoryClosedClients = document.getElementById('companyHistoryClosedClients');
const companyHistoryNameFilter = document.getElementById('companyHistoryNameFilter');
const companyHistoryIndustryFilter = document.getElementById('companyHistoryIndustryFilter');
const companyHistorySearchBtn = document.getElementById('companyHistorySearchBtn');
const companyDetailsModal = document.getElementById('companyDetailsModal');
const companyDetailsTitle = document.getElementById('companyDetailsTitle');
const companyDetailsGrid = document.getElementById('companyDetailsGrid');
const companyDetailsClientToggle = document.getElementById('companyDetailsClientToggle');
const companyDetailsCloseBtn = document.getElementById('companyDetailsCloseBtn');
const companyDetailsCancelBtn = document.getElementById('companyDetailsCancelBtn');
const companyDetailsSaveBtn = document.getElementById('companyDetailsSaveBtn');
let globalHistoryCompanies = [];
let selectedHistoryCompanyId = null;

// Connection UI Elements
const connectionForm = document.getElementById('connectionForm');
const apiKeyInput = document.getElementById('apiKeyInput');
const refreshConnectionBtn = document.getElementById('refreshConnectionBtn');
const connectionStatusTitle = document.getElementById('connectionStatusTitle');
const connectionStatusText = document.getElementById('connectionStatusText');
const connectionStatusDot = document.getElementById('connectionStatusDot');
const connectionStatusCard = document.getElementById('connectionStatusCard');

// Usage UI Elements
const refreshUsageBtn = document.getElementById('refreshUsageBtn');
const usageTodayCost = document.getElementById('usageTodayCost');
const usageMonthCost = document.getElementById('usageMonthCost');
const usageResultsBody = document.getElementById('usageResultsBody');
const usageSpinner = document.getElementById('usageSpinner');
const usageEmptyText = document.getElementById('usageEmptyText');
const usageTableSubtitle = document.getElementById('usageTableSubtitle');
const usagePageInfo = document.getElementById('usagePageInfo');
const usagePrevPage = document.getElementById('usagePrevPage');
const usageNextPage = document.getElementById('usageNextPage');

let globalLeads = [];
let authMode = 'login';
let usageCurrentPage = 1;
let usageTotalPages = 1;
let usageDateFilter = 'today';
let usageDateFrom = '';
let usageDateTo = '';

function updateAccountView() {
    const email = currentUser?.email || '-';
    if (accountEmail) accountEmail.textContent = email;
    if (accountAvatar) accountAvatar.textContent = email && email !== '-' ? email.charAt(0).toUpperCase() : '?';
    setAccountKeyStatus(accountApifyStatus, APIFY_TOKEN, 'Configurada', 'Nao configurada');
    setAccountKeyStatus(accountIcypeasStatus, ICYPEAS_TOKEN, 'Configurada', 'Nao configurada');
    setAccountKeyStatus(accountLinkedinStatus, LINKEDIN_COOKIE, 'Configurado', 'Nao configurado');
}

function setAccountKeyStatus(element, isConfigured, configuredText, emptyText) {
    if (!element) return;
    element.classList.toggle('configured', Boolean(isConfigured));
    element.innerHTML = isConfigured
        ? `<span class="status-dot online"></span>${configuredText}`
        : emptyText;
}

function formatUsageCurrency(value) {
    return `$${Number(value || 0).toFixed(4)}`;
}

function formatUsageDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatUsageProvider(value) {
    const labels = {
        apify: 'Apify',
        icypeas: 'Icypeas',
        'linkedin-public': 'LinkedIn publico'
    };
    return labels[value] || value || '-';
}

function formatUsageOperation(value) {
    const labels = {
        employees: 'Funcionarios',
        'company-search': 'Busca de empresas',
        'email-search': 'Busca de email',
        dataset: 'Leitura de dataset',
        run: 'Execucao'
    };
    return labels[value] || value || '-';
}

function getBillableSucceededUsage(logs = []) {
    return logs.filter((item) =>
        item.status === 'SUCCEEDED' && Number(item.estimatedCostUsd || 0) > 0
    );
}

function renderUsageTable(logs, pagination = {}) {
    if (!usageResultsBody) return;

    const billableLogs = getBillableSucceededUsage(logs);
    usageCurrentPage = pagination.page || usageCurrentPage || 1;
    usageTotalPages = pagination.totalPages || 1;

    if (usagePageInfo) usagePageInfo.textContent = `Pagina ${usageCurrentPage} de ${usageTotalPages}`;
    if (usagePrevPage) usagePrevPage.disabled = usageCurrentPage <= 1;
    if (usageNextPage) usageNextPage.disabled = usageCurrentPage >= usageTotalPages;
    if (usageTableSubtitle) {
        usageTableSubtitle.textContent = `${pagination.totalItems || billableLogs.length || 0} consultas cobradas registradas. Maximo de 20 itens por pagina.`;
    }

    if (!billableLogs.length) {
        usageResultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6">
                    <div class="empty-content">
                        <p>Nenhum consumo cobrado com status SUCCEEDED registrado ainda.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    usageResultsBody.innerHTML = billableLogs.map((item) => `
        <tr>
            <td>${formatUsageDate(item.createdAt)}</td>
            <td><span class="usage-provider">${formatUsageProvider(item.provider)}</span></td>
            <td>${formatUsageOperation(item.operation)}</td>
            <td><span class="usage-status usage-status-succeeded">${item.status || '-'}</span></td>
            <td style="text-align: center;">${Number(item.resultCount || 0)}</td>
            <td style="text-align: right; font-weight: 700;">${formatUsageCurrency(item.estimatedCostUsd)}</td>
        </tr>
    `).join('');
}

async function fetchUsage(page = 1) {
    if (!usageResultsBody) return;

    // Always read filter state directly from DOM so variable and UI never diverge
    const _sel = document.getElementById('usageDateFilter');
    const _fromEl = document.getElementById('usageDateFrom');
    const _toEl = document.getElementById('usageDateTo');
    const activeFilter = _sel ? (_sel.value || 'today') : usageDateFilter;
    usageDateFilter = activeFilter;

    usageResultsBody.innerHTML = `
        <tr class="empty-state">
            <td colspan="6">
                <div class="empty-content">
                    <div class="spinner" style="width: 30px; height: 30px; border-width: 3px; border-top-color: var(--brand-primary);"></div>
                    <p>Carregando consumo...</p>
                </div>
            </td>
        </tr>
    `;

    try {
        let url = `/api/usage?page=${page}&limit=20&dateFilter=${encodeURIComponent(activeFilter)}`;
        if (activeFilter === 'custom') {
            const fromVal = _fromEl ? _fromEl.value : usageDateFrom;
            const toVal = _toEl ? _toEl.value : usageDateTo;
            if (fromVal) url += `&dateFrom=${encodeURIComponent(fromVal)}`;
            if (toVal) url += `&dateTo=${encodeURIComponent(toVal)}`;
        }
        console.log('[Usage] Fetching:', url);
        const response = await fetchLocalApi(url);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (usageTodayCost) usageTodayCost.textContent = formatUsageCurrency(data.today?.total?.estimatedCostUsd);
        if (usageMonthCost) usageMonthCost.textContent = formatUsageCurrency(data.month?.total?.estimatedCostUsd);
        renderUsageTable(data.latest || [], data.pagination || {});
    } catch (error) {
        usageResultsBody.innerHTML = `
            <tr class="empty-state">
                <td colspan="6">
                    <div class="empty-content">
                        <p>Erro ao carregar consumo: ${error.message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

function setAuthenticated(user) {
    currentUser = user;
    if (authScreen) authScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'grid';
    updateAccountView();
}

function setUnauthenticated(message = '') {
    currentUser = null;
    APIFY_TOKEN = '';
    ICYPEAS_TOKEN = '';
    LINKEDIN_COOKIE = '';
    if (appContainer) appContainer.style.display = 'none';
    if (authScreen) authScreen.style.display = 'flex';
    if (authError) authError.textContent = message;
}

async function loadApiKeys() {
    const response = await fetchLocalApi('/api/account/api-keys');
    if (!response.ok) throw new Error('Falha ao carregar chaves da conta');
    const keys = await response.json();
    APIFY_TOKEN = keys.apifyToken || '';
    ICYPEAS_TOKEN = keys.icypeasToken || '';
    LINKEDIN_COOKIE = keys.linkedinCookie || '';
    updateAccountView();
}

async function loadSession() {
    try {
        const response = await fetchLocalApi('/api/auth/me');
        if (!response.ok) throw new Error('Sem sessao ativa');
        const data = await response.json();
        setAuthenticated(data.user);
        await loadApiKeys();
        switchView('dashboard');
    } catch (error) {
        setUnauthenticated('');
    }
}

function setAuthMode(mode) {
    authMode = mode;
    if (authSubmitBtn) {
        authSubmitBtn.innerHTML = mode === 'login'
            ? '<i class="ph-bold ph-sign-in"></i> Entrar'
            : '<i class="ph-bold ph-user-plus"></i> Criar conta';
    }
    if (authModeBtn) {
        authModeBtn.textContent = mode === 'login' ? 'Criar nova conta' : 'Ja tenho conta';
    }
    if (authError) authError.textContent = '';
}

if (authModeBtn) {
    authModeBtn.addEventListener('click', () => {
        setAuthMode(authMode === 'login' ? 'register' : 'login');
    });
}

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        const password = authPassword.value;
        const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

        authSubmitBtn.disabled = true;
        if (authError) authError.textContent = '';

        try {
            const response = await fetchLocalApi(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            setAuthenticated(data.user);
            await loadApiKeys();
            switchView('dashboard');
        } catch (error) {
            if (authError) authError.textContent = error.message;
        } finally {
            authSubmitBtn.disabled = false;
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await fetchLocalApi('/api/auth/logout', { method: 'POST' }).catch(() => null);
        setUnauthenticated('');
    });
}

if (accountPasswordForm) {
    accountPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        accountPasswordMessage.textContent = '';
        accountPasswordMessage.className = 'account-password-message';

        if (newPassword !== confirmPassword) {
            accountPasswordMessage.textContent = 'A confirmacao nao confere com a nova senha.';
            accountPasswordMessage.classList.add('error');
            return;
        }

        accountPasswordBtn.disabled = true;

        try {
            const response = await fetchLocalApi('/api/account/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            accountPasswordForm.reset();
            accountPasswordMessage.textContent = 'Senha alterada com sucesso.';
            accountPasswordMessage.classList.add('success');
            showToast('Senha alterada com sucesso!');
        } catch (error) {
            accountPasswordMessage.textContent = error.message;
            accountPasswordMessage.classList.add('error');
        } finally {
            accountPasswordBtn.disabled = false;
        }
    });
}

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
    if (dashboardView) dashboardView.style.display = 'none';
    if (crmView) crmView.style.display = 'none';
    if (emailBlastsView) emailBlastsView.style.display = 'none';
    if (searchView) searchView.style.display = 'none';
    if (companySearchView) companySearchView.style.display = 'none';
    if (connectionView) connectionView.style.display = 'none';
    if (usageView) usageView.style.display = 'none';
    if (historyView) historyView.style.display = 'none';
    if (companyHistoryView) companyHistoryView.style.display = 'none';
    if (accountView) accountView.style.display = 'none';

    if (navDashboard) navDashboard.classList.remove('active');
    if (navCrm) navCrm.classList.remove('active');
    if (navEmailBlasts) navEmailBlasts.classList.remove('active');
    if (navSearch) navSearch.classList.remove('active');
    if (navCompanySearch) navCompanySearch.classList.remove('active');
    if (navConnection) navConnection.classList.remove('active');
    if (navUsage) navUsage.classList.remove('active');
    if (navHistory) navHistory.classList.remove('active');
    if (navCompanyHistory) navCompanyHistory.classList.remove('active');
    if (navAccount) navAccount.classList.remove('active');

    if (viewName === 'dashboard') {
        if (dashboardView) dashboardView.style.display = 'block';
        if (navDashboard) navDashboard.classList.add('active');
        fetchDashboard();
    } else if (viewName === 'crm') {
        if (crmView) crmView.style.display = 'block';
        if (navCrm) navCrm.classList.add('active');
        fetchCrmLeads();
    } else if (viewName === 'email-blasts') {
        if (emailBlastsView) emailBlastsView.style.display = 'block';
        if (navEmailBlasts) navEmailBlasts.classList.add('active');
    } else if (viewName === 'company-search') {
        if (companySearchView) companySearchView.style.display = 'block';
        if (navCompanySearch) navCompanySearch.classList.add('active');
    } else if (viewName === 'search') {
        if (searchView) searchView.style.display = 'block';
        if (navSearch) navSearch.classList.add('active');
    } else if (viewName === 'connection') {
        if (connectionView) connectionView.style.display = 'block';
        if (navConnection) navConnection.classList.add('active');

        apiKeyInput.value = APIFY_TOKEN;
        const icypeasKeyInput = document.getElementById('icypeasKeyInput');
        const linkedinCookieInput = document.getElementById('linkedinCookieInput');
        if (icypeasKeyInput) icypeasKeyInput.value = ICYPEAS_TOKEN;
        if (linkedinCookieInput) linkedinCookieInput.value = LINKEDIN_COOKIE;
        checkApiConnection();
    } else if (viewName === 'usage') {
        if (usageView) usageView.style.display = 'block';
        if (navUsage) navUsage.classList.add('active');
        const _filterEl = document.getElementById('usageDateFilter');
        if (_filterEl) {
            usageDateFilter = _filterEl.value || 'today';
            const _customRange = document.getElementById('usageCustomDateRange');
            if (_customRange) _customRange.style.display = usageDateFilter === 'custom' ? 'flex' : 'none';
        }
        usageCurrentPage = 1;
        fetchUsage(1);
    } else if (viewName === 'account') {
        if (accountView) accountView.style.display = 'block';
        if (navAccount) navAccount.classList.add('active');
        updateAccountView();
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
if (navDashboard) navDashboard.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
if (navCrm) navCrm.addEventListener('click', (e) => { e.preventDefault(); switchView('crm'); });
if (navEmailBlasts) navEmailBlasts.addEventListener('click', (e) => { e.preventDefault(); switchView('email-blasts'); });
const refreshDashBtn = document.getElementById('refreshDashBtn');
if (refreshDashBtn) refreshDashBtn.addEventListener('click', fetchDashboard);

const dashDateFilterEl = document.getElementById('dashDateFilter');
const dashCustomDateRange = document.getElementById('dashCustomDateRange');
if (dashDateFilterEl) {
    dashDateFilterEl.addEventListener('change', () => {
        dashDateFilter = dashDateFilterEl.value;
        if (dashCustomDateRange) dashCustomDateRange.style.display = dashDateFilter === 'custom' ? 'flex' : 'none';
        if (dashDateFilter !== 'custom') fetchDashboard();
    });
}
const dashApplyCustomDate = document.getElementById('dashApplyCustomDate');
if (dashApplyCustomDate) {
    dashApplyCustomDate.addEventListener('click', () => {
        dashDateFrom = document.getElementById('dashDateFrom')?.value || '';
        dashDateTo = document.getElementById('dashDateTo')?.value || '';
        fetchDashboard();
    });
}
if (navCompanySearch) navCompanySearch.addEventListener('click', (e) => { e.preventDefault(); switchView('company-search'); });
if (navSearch) navSearch.addEventListener('click', (e) => { e.preventDefault(); switchView('search'); });
if (navConnection) navConnection.addEventListener('click', (e) => { e.preventDefault(); switchView('connection'); });
if (navUsage) navUsage.addEventListener('click', (e) => { e.preventDefault(); switchView('usage'); });
if (navHistory) navHistory.addEventListener('click', (e) => { e.preventDefault(); switchView('history'); });
if (navCompanyHistory) navCompanyHistory.addEventListener('click', (e) => { e.preventDefault(); switchView('company-history'); });
if (navAccount) navAccount.addEventListener('click', (e) => { e.preventDefault(); switchView('account'); });

if (refreshUsageBtn) refreshUsageBtn.addEventListener('click', () => fetchUsage(1));
if (usagePrevPage) usagePrevPage.addEventListener('click', () => {
    if (usageCurrentPage > 1) fetchUsage(usageCurrentPage - 1);
});
if (usageNextPage) usageNextPage.addEventListener('click', () => {
    if (usageCurrentPage < usageTotalPages) fetchUsage(usageCurrentPage + 1);
});

const usageDateFilterEl = document.getElementById('usageDateFilter');
const usageCustomDateRange = document.getElementById('usageCustomDateRange');
const usageDateFromEl = document.getElementById('usageDateFrom');
const usageDateToEl = document.getElementById('usageDateTo');
const usageApplyCustomDate = document.getElementById('usageApplyCustomDate');

if (usageDateFilterEl) {
    usageDateFilterEl.addEventListener('change', () => {
        usageDateFilter = usageDateFilterEl.value;
        if (usageCustomDateRange) {
            usageCustomDateRange.style.display = usageDateFilter === 'custom' ? 'flex' : 'none';
        }
        if (usageDateFilter !== 'custom') {
            usageDateFrom = '';
            usageDateTo = '';
            fetchUsage(1);
        }
    });
}

if (usageApplyCustomDate) {
    usageApplyCustomDate.addEventListener('click', () => {
        usageDateFrom = usageDateFromEl ? usageDateFromEl.value : '';
        usageDateTo = usageDateToEl ? usageDateToEl.value : '';
        fetchUsage(1);
    });
}

// Email blast workflow copied from the standalone n8n sender and adapted to this UI.
function initEmailBlasts() {
    const WEBHOOK_URL = 'https://vmi3101877.contaboserver.net/webhook/maktub-csv';
    const STATUS_URL = 'https://vmi3101877.contaboserver.net/webhook/maktub-status';
    const LOGO_CENTER_X = 419;
    const LOGO_CENTER_Y = 503;
    const LOGO_MAX_W = 120;
    const LOGO_MAX_H = 28;
    const MAX_ATTACHMENT_MB = 10;

    const refs = {
        langPt: document.getElementById('emailLangPt'),
        langEn: document.getElementById('emailLangEn'),
        csvDropZone: document.getElementById('emailCsvDropZone'),
        csvInput: document.getElementById('emailCsvInput'),
        csvFileName: document.getElementById('emailCsvFileName'),
        logoDropZone: document.getElementById('emailLogoDropZone'),
        logoInput: document.getElementById('emailLogoInput'),
        logoFileName: document.getElementById('emailLogoFileName'),
        attachmentDropZone: document.getElementById('emailAttachmentDropZone'),
        attachmentInput: document.getElementById('emailAttachmentInput'),
        attachmentFileName: document.getElementById('emailAttachmentFileName'),
        compositePreview: document.getElementById('emailCompositePreview'),
        compositeCanvas: document.getElementById('emailCompositeCanvas'),
        baseImg: document.getElementById('emailBaseGameImg'),
        delayInput: document.getElementById('emailDelayInput'),
        sendBtn: document.getElementById('emailSendBtn'),
        status: document.getElementById('emailStatus'),
        previewHead: document.getElementById('emailPreviewHead'),
        previewBody: document.getElementById('emailPreviewBody'),
        totalBadge: document.getElementById('emailTotalBadge'),
        moreRows: document.getElementById('emailMoreRows'),
        sentLog: document.getElementById('emailSentLog'),
        sentList: document.getElementById('emailSentList'),
        sentBadge: document.getElementById('emailSentBadge'),
        modal: document.getElementById('emailConfirmModal'),
        modalClose: document.getElementById('emailModalCloseBtn'),
        modalCancel: document.getElementById('emailModalCancelBtn'),
        modalConfirm: document.getElementById('emailModalConfirmBtn'),
        modalImage: document.getElementById('emailModalImage'),
        modalLeadCount: document.getElementById('emailModalLeadCount'),
        modalDelay: document.getElementById('emailModalDelay'),
        modalTableHead: document.getElementById('emailModalTableHead'),
        modalTableBody: document.getElementById('emailModalTableBody')
    };

    if (!refs.csvInput || !refs.sendBtn) return;

    let selectedLang = 'pt';
    let contacts = [];
    let logoFile = null;
    let compositeB64 = null;
    let attachmentBase64 = null;
    let attachmentName = null;
    let pollInterval = null;
    const knownEmails = new Set();

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    function setLang(lang) {
        selectedLang = lang;
        refs.langPt?.classList.toggle('active', lang === 'pt');
        refs.langEn?.classList.toggle('active', lang === 'en');
    }

    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        }).filter(row => Object.values(row).some(Boolean));
    }

    function showEmailStatus(type, message) {
        refs.status.className = `email-status ${type}`;
        refs.status.style.display = 'flex';
        refs.status.innerHTML = type === 'loading'
            ? `<div class="spinner"></div><span>${escapeHtml(message)}</span>`
            : `<i class="ph-bold ${type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}"></i><span>${escapeHtml(message)}</span>`;
    }

    function renderPreview(data) {
        if (!data.length) return;
        const headers = Object.keys(data[0]);
        const shown = data.slice(0, 7);
        refs.previewHead.innerHTML = headers.map(header => `<th>${escapeHtml(header)}</th>`).join('');
        refs.previewBody.innerHTML = shown.map(row =>
            `<tr>${headers.map(header => `<td title="${escapeHtml(row[header])}">${escapeHtml(row[header])}</td>`).join('')}</tr>`
        ).join('');
        refs.totalBadge.textContent = `${data.length} contato${data.length !== 1 ? 's' : ''}`;
        refs.moreRows.style.display = data.length > shown.length ? 'block' : 'none';
        refs.moreRows.textContent = data.length > shown.length ? `+ ${data.length - shown.length} contatos adicionais` : '';
    }

    function checkReady() {
        refs.sendBtn.disabled = !(contacts.length && compositeB64);
    }

    function handleCSV(file) {
        if (!file || !file.name.toLowerCase().endsWith('.csv')) {
            showEmailStatus('error', 'Selecione um arquivo .csv valido.');
            return;
        }

        refs.csvFileName.textContent = file.name;
        refs.csvFileName.style.display = 'block';

        const reader = new FileReader();
        reader.onload = event => {
            contacts = parseCSV(event.target.result);
            if (!contacts.length) {
                showEmailStatus('error', 'CSV vazio ou formato invalido.');
                refs.sendBtn.disabled = true;
                return;
            }
            renderPreview(contacts);
            checkReady();
            refs.status.style.display = 'none';
        };
        reader.readAsText(file);
    }

    async function buildComposite() {
        if (!logoFile || !refs.baseImg || !refs.compositeCanvas) return;
        if (!refs.baseImg.complete && refs.baseImg.decode) {
            await refs.baseImg.decode().catch(() => {});
        }

        const logoUrl = URL.createObjectURL(logoFile);
        const logoImg = new Image();
        logoImg.onload = () => {
            const width = refs.baseImg.naturalWidth || 838;
            const height = refs.baseImg.naturalHeight || 583;
            refs.compositeCanvas.width = width;
            refs.compositeCanvas.height = height;

            const ctx = refs.compositeCanvas.getContext('2d');
            ctx.drawImage(refs.baseImg, 0, 0, width, height);

            const scale = Math.min(LOGO_MAX_W / logoImg.width, LOGO_MAX_H / logoImg.height);
            const logoWidth = logoImg.width * scale;
            const logoHeight = logoImg.height * scale;
            const logoX = LOGO_CENTER_X - logoWidth / 2;
            const logoY = LOGO_CENTER_Y - logoHeight / 2;
            ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);

            URL.revokeObjectURL(logoUrl);
            compositeB64 = refs.compositeCanvas.toDataURL('image/png');
            refs.compositePreview.style.display = 'block';
            checkReady();
        };
        logoImg.onerror = () => showEmailStatus('error', 'Nao foi possivel carregar a logo.');
        logoImg.src = logoUrl;
    }

    function handleLogo(file) {
        if (!file || !file.type.startsWith('image/')) {
            showEmailStatus('error', 'Selecione uma imagem valida para a logo.');
            return;
        }
        logoFile = file;
        refs.logoFileName.textContent = file.name;
        refs.logoFileName.style.display = 'block';
        buildComposite();
    }

    function handleAttachment(file) {
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
            attachmentBase64 = null;
            attachmentName = null;
            refs.attachmentInput.value = '';
            refs.attachmentFileName.style.display = 'none';
            showEmailStatus('error', `Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(1)} MB. O limite e ${MAX_ATTACHMENT_MB} MB.`);
            return;
        }

        attachmentName = file.name;
        refs.attachmentFileName.textContent = file.name;
        refs.attachmentFileName.style.display = 'block';
        const reader = new FileReader();
        reader.onload = event => {
            attachmentBase64 = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function bindDropZone(zone, input, handler) {
        if (!zone || !input) return;
        input.addEventListener('change', () => handler(input.files[0]));
        zone.addEventListener('dragover', event => {
            event.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', event => {
            event.preventDefault();
            zone.classList.remove('drag-over');
            handler(event.dataTransfer.files[0]);
        });
    }

    function openModal() {
        const delay = parseInt(refs.delayInput.value, 10) || 10;
        const headers = Object.keys(contacts[0] || {});
        refs.modalLeadCount.textContent = contacts.length;
        refs.modalDelay.textContent = delay;
        refs.modalImage.src = compositeB64;
        refs.modalTableHead.innerHTML = headers.map(header => `<th>${escapeHtml(header)}</th>`).join('');
        refs.modalTableBody.innerHTML = contacts.map(row =>
            `<tr>${headers.map(header => `<td title="${escapeHtml(row[header])}">${escapeHtml(row[header])}</td>`).join('')}</tr>`
        ).join('');
        refs.modal.style.display = 'flex';
    }

    function closeModal() {
        refs.modal.style.display = 'none';
    }

    function startPolling(total) {
        if (refs.sentLog) refs.sentLog.style.display = 'block';
        if (refs.sentList) refs.sentList.innerHTML = '';
        if (refs.sentBadge) refs.sentBadge.textContent = '0';
        knownEmails.clear();
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async () => {
            try {
                const response = await fetch(STATUS_URL);
                if (!response.ok) return;
                const data = await response.json();
                (data.sentEmails || []).forEach(item => {
                    const key = `${item.email || ''}${item.sentAt || ''}`;
                    if (knownEmails.has(key)) return;
                    knownEmails.add(key);

                    const time = item.sentAt
                        ? new Date(item.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '--:--';
                    const el = document.createElement('div');
                    el.className = 'email-sent-item';
                    el.innerHTML = `<span class="email-sent-dot"></span><strong>${escapeHtml(item.name || '-')}</strong><span>${escapeHtml(item.email || '-')} - ${escapeHtml(time)}</span>`;
                    refs.sentList?.prepend(el);
                });
                if (refs.sentBadge) refs.sentBadge.textContent = knownEmails.size;
                if (knownEmails.size >= total) {
                    clearInterval(pollInterval);
                    showEmailStatus('success', `Todos os ${total} emails foram enviados!`);
                }
            } catch (_) {}
        }, 5000);
    }

    refs.langPt?.addEventListener('click', () => setLang('pt'));
    refs.langEn?.addEventListener('click', () => setLang('en'));
    bindDropZone(refs.csvDropZone, refs.csvInput, handleCSV);
    bindDropZone(refs.logoDropZone, refs.logoInput, handleLogo);
    bindDropZone(refs.attachmentDropZone, refs.attachmentInput, handleAttachment);

    refs.sendBtn.addEventListener('click', () => {
        if (!contacts.length || !compositeB64) return;
        openModal();
    });
    refs.modalClose?.addEventListener('click', closeModal);
    refs.modalCancel?.addEventListener('click', closeModal);
    refs.modal?.addEventListener('click', event => {
        if (event.target === refs.modal) closeModal();
    });

    refs.modalConfirm?.addEventListener('click', async () => {
        closeModal();
        const delayMinutes = parseInt(refs.delayInput.value, 10) || 10;
        refs.sendBtn.disabled = true;
        showEmailStatus('loading', `Enviando ${contacts.length} contatos para o n8n...`);

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contacts,
                    language: selectedLang,
                    delayMinutes,
                    imagemBase64: compositeB64,
                    anexoBase64: attachmentBase64 || null,
                    anexoNome: attachmentName || null
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            showEmailStatus('success', `OK - ${contacts.length} contatos enviados com a imagem personalizada.`);
            startPolling(contacts.length);
        } catch (error) {
            showEmailStatus('error', `Erro ao enviar: ${error.message}`);
        } finally {
            checkReady();
        }
    });
}

initEmailBlasts();

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
function updateApifyConnectionStatus(state, title, text) {
    connectionStatusTitle.textContent = title;
    connectionStatusText.textContent = text;

    const stateClass = {
        online: 'online',
        error: 'error',
        checking: 'running'
    }[state] || '';

    connectionStatusDot.className = stateClass ? `status-dot ${stateClass}` : 'status-dot';
}

function apifyConnectionErrorMessage(error) {
    const message = String(error?.message || '');

    if (/login|sessao|sessão/i.test(message)) {
        return {
            title: 'Sessao expirada',
            text: 'Entre novamente para verificar a conexao com a Apify.'
        };
    }

    if (error?.statusCode === 401 || /token|invalid|unauthorized|not authorized/i.test(message)) {
        return {
            title: 'Apify: Token rejeitado',
            text: 'A Apify recusou a API Token salva. Confira se ela foi copiada completa.'
        };
    }

    if (error?.statusCode === 400 || /ausente|nao configurada|não configurada/i.test(message)) {
        return {
            title: 'Apify: Nao configurada',
            text: 'Cole sua API Token da Apify e salve para ativar a conexao.'
        };
    }

    return {
        title: 'Apify: Nao verificada',
        text: `Nao foi possivel confirmar agora: ${message || 'erro de comunicacao com o backend'}`
    };
}

async function checkApiConnection() {
    updateApifyConnectionStatus('checking', 'Verificando...', 'Testando a API Token salva na sua conta...');

    apiKeyInput.disabled = true;
    refreshConnectionBtn.disabled = true;

    try {
        if (!APIFY_TOKEN) {
            throw new Error('Chave nao configurada');
        }

        const data = await apifyApi('/profile');
        if (!data?.data) {
            throw new Error('Resposta inesperada da Apify');
        }

        updateApifyConnectionStatus(
            'online',
            'Apify: Conectado',
            'Autenticado como ' + (data.data.username || 'Usuario Apify')
        );
    } catch (error) {
        const status = apifyConnectionErrorMessage(error);
        updateApifyConnectionStatus('error', status.title, status.text);
    } finally {
        apiKeyInput.disabled = false;
        refreshConnectionBtn.disabled = false;
    }

    const icypeasStatusEl = document.getElementById('icypeasStatusText');
    const icypeasKeyInput = document.getElementById('icypeasKeyInput');
    if (icypeasStatusEl && icypeasKeyInput) {
        icypeasKeyInput.value = ICYPEAS_TOKEN;
        if (ICYPEAS_TOKEN) {
            icypeasStatusEl.textContent = 'Icypeas Key configurada';
            icypeasStatusEl.style.color = 'var(--success, #10b981)';
        } else {
            icypeasStatusEl.textContent = 'Icypeas Key nao configurada';
            icypeasStatusEl.style.color = 'var(--danger, #ef4444)';
        }
    }

    const linkedinCookieInput = document.getElementById('linkedinCookieInput');
    const linkedinCookieStatus = document.getElementById('linkedinCookieStatus');
    if (linkedinCookieInput) linkedinCookieInput.value = LINKEDIN_COOKIE;
    if (linkedinCookieStatus) {
        if (LINKEDIN_COOKIE) {
            linkedinCookieStatus.textContent = 'Cookie configurado';
            linkedinCookieStatus.style.color = 'var(--success, #10b981)';
        } else {
            linkedinCookieStatus.textContent = 'Cookie nao configurado - extracao pode falhar';
            linkedinCookieStatus.style.color = 'var(--danger, #ef4444)';
        }
    }
}

if (connectionForm) {
    connectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newApifyKey = apiKeyInput.value.trim();
        const icypeasKeyInput = document.getElementById('icypeasKeyInput');
        const newIcypeasKey = icypeasKeyInput ? icypeasKeyInput.value.trim() : '';
        const linkedinCookieInput = document.getElementById('linkedinCookieInput');
        const newLinkedinCookie = linkedinCookieInput ? linkedinCookieInput.value.trim() : '';

        APIFY_TOKEN = newApifyKey;
        ICYPEAS_TOKEN = newIcypeasKey;
        LINKEDIN_COOKIE = newLinkedinCookie;

        try {
            const response = await fetchLocalApi('/api/account/api-keys', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apifyToken: APIFY_TOKEN,
                    icypeasToken: ICYPEAS_TOKEN,
                    linkedinCookie: LINKEDIN_COOKIE
                })
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${response.status}`);
            }

            updateAccountView();
            showToast('Chaves salvas na sua conta!');
            await checkApiConnection();
        } catch (error) {
            showToast(`Erro ao salvar na conta: ${error.message}`, 'error');
            await checkApiConnection();
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

function loadCrmStages() {
    try {
        const savedStages = JSON.parse(localStorage.getItem(CRM_STAGES_STORAGE_KEY) || '[]');
        crmStages = Array.isArray(savedStages) && savedStages.length ? savedStages : [...DEFAULT_CRM_STAGES];
    } catch (_) {
        crmStages = [...DEFAULT_CRM_STAGES];
    }
}

function saveCrmStages() {
    localStorage.setItem(CRM_STAGES_STORAGE_KEY, JSON.stringify(crmStages));
}

function createCrmStageId(name) {
    const base = String(name || 'etapa')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'etapa';
    let id = base;
    let index = 2;
    while (crmStages.some(stage => stage.id === id)) {
        id = `${base}-${index}`;
        index += 1;
    }
    return id;
}

function normalizeCrmMatchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeLinkedInCompanyUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || !raw.includes('linkedin.com/company/')) return '';

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const url = new URL(withProtocol);
        url.hash = '';
        url.search = '';
        url.pathname = url.pathname
            .replace(/\/(about|admin|jobs|life|people|posts)\/?$/i, '')
            .replace(/\/+$/g, '');
        return `${url.hostname.toLowerCase()}${url.pathname.toLowerCase()}`;
    } catch (_) {
        return raw
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/[?#].*$/, '')
            .replace(/\/(about|admin|jobs|life|people|posts)\/?$/i, '')
            .replace(/\/+$/g, '');
    }
}

function getLeadCrmStage(lead) {
    const stageExists = crmStages.some(stage => stage.id === lead.crmStage);
    return stageExists ? lead.crmStage : (crmStages[0]?.id || 'novo');
}

function getLeadRecordId(lead) {
    return lead?._id || lead?.id || lead?.leadId || '';
}

function isClosedCrmStage(stageId) {
    const stage = crmStages.find(item => item.id === stageId);
    return stageId === 'fechado' || normalizeCrmMatchText(stage?.name) === 'fechado';
}

function getLeadCompanyPositions(lead) {
    return [
        ...(Array.isArray(lead.currentPosition) ? lead.currentPosition : []),
        ...(Array.isArray(lead.currentPositions) ? lead.currentPositions : []),
        ...(Array.isArray(lead.positions) ? lead.positions : [])
    ].filter(Boolean);
}

function findCompanyForLead(lead) {
    const positions = getLeadCompanyPositions(lead);
    const leadCompanyUrls = [
        lead.companyLinkedinUrl,
        lead.companyLinkedInUrl,
        lead.companyUrl,
        lead.companyProfileUrl,
        lead.companyLinkedin,
        ...positions.flatMap(position => [
            position.companyLinkedinUrl,
            position.companyLinkedInUrl,
            position.companyUrl,
            position.companyProfileUrl,
            position.companyLinkedin,
            position.linkedinUrl,
            position.url
        ])
    ].map(normalizeLinkedInCompanyUrl).filter(Boolean);

    if (leadCompanyUrls.length) {
        const urlSet = new Set(leadCompanyUrls);
        const companyByUrl = globalHistoryCompanies.find(company => {
            const companyUrls = [
                company.linkedinUrl,
                company.url,
                company.companyLinkedinUrl,
                company.companyUrl
            ].map(normalizeLinkedInCompanyUrl).filter(Boolean);
            return companyUrls.some(url => urlSet.has(url));
        });
        if (companyByUrl) return companyByUrl;
    }

    const leadCompanyNames = [
        lead.companyName,
        lead.company,
        lead.organizationName,
        ...positions.flatMap(position => [
            position.companyName,
            position.company,
            position.organizationName
        ])
    ].map(normalizeCrmMatchText).filter(Boolean);

    if (!leadCompanyNames.length) return null;
    const nameSet = new Set(leadCompanyNames);
    return globalHistoryCompanies.find(company => {
        const companyNames = [
            company.name,
            company.title,
            company.companyName
        ].map(normalizeCrmMatchText).filter(Boolean);
        return companyNames.some(name => nameSet.has(name));
    }) || null;
}

async function markLeadCompanyAsClient(lead) {
    if (!globalHistoryCompanies.length) {
        const companiesResponse = await fetchLocalApi('/api/empresas').catch(() => null);
        if (companiesResponse?.ok) {
            globalHistoryCompanies = await companiesResponse.json();
        }
    }

    let company = findCompanyForLead(lead);
    if (!company) {
        const companiesResponse = await fetchLocalApi('/api/empresas').catch(() => null);
        if (companiesResponse?.ok) {
            globalHistoryCompanies = await companiesResponse.json();
            company = findCompanyForLead(lead);
        }
    }

    if (!company || !company._id || company.isClient) return false;

    const response = await fetchLocalApi(`/api/empresas/${company._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isClient: true })
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
    }

    const updatedCompany = await response.json();
    globalHistoryCompanies = globalHistoryCompanies.map(item =>
        String(item._id) === String(company._id) ? { ...item, ...updatedCompany } : item
    );

    if (typeof filterHistoryCompanyTable === 'function') {
        filterHistoryCompanyTable();
    }

    return true;
}

function getLeadPrimaryEmail(lead) {
    if (Array.isArray(lead.emails)) {
        const email = lead.emails.find(item => String(item || '').trim());
        if (email) return String(email).trim();
    }
    return String(lead.email || '').trim();
}

function leadHasEmail(lead) {
    return Boolean(getLeadPrimaryEmail(lead));
}

async function fetchCrmLeads(force = false) {
    if (!crmBoard) return;
    loadCrmStages();
    if (crmLoaded && !force) {
        renderCrmBoard();
        return;
    }

    crmBoard.innerHTML = `
        <div class="empty-content" style="padding: 3rem;">
            <div class="spinner" style="width: 30px; height: 30px; border-width: 3px;"></div>
            <p>Carregando CRM...</p>
        </div>
    `;

    try {
        const [leadsResponse, companiesResponse] = await Promise.all([
            fetchLocalApi('/api/leads'),
            fetchLocalApi('/api/empresas').catch(() => null)
        ]);
        if (!leadsResponse.ok) throw new Error('Falha ao carregar leads do CRM');

        crmLeads = await leadsResponse.json();
        globalHistoryLeads = crmLeads;
        if (companiesResponse?.ok) {
            globalHistoryCompanies = await companiesResponse.json();
        }
        crmLoaded = true;
        renderCrmBoard();
    } catch (error) {
        console.error('Erro ao carregar CRM:', error);
        crmBoard.innerHTML = `
            <div class="empty-content" style="padding: 3rem;">
                <i class="ph-bold ph-warning-circle" style="color: var(--danger);"></i>
                <p style="color: var(--danger);">Erro ao carregar CRM: ${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

function leadMatchesCrmSearch(lead) {
    if (!crmSearchTerm) return true;
    const haystack = [
        lead.fullName,
        lead.firstName,
        lead.lastName,
        lead.headline,
        lead.position,
        lead.title,
        lead.companyName,
        lead.email,
        ...(Array.isArray(lead.emails) ? lead.emails : [])
    ].join(' ').toLowerCase();
    return haystack.includes(crmSearchTerm);
}

function leadMatchesCrmEmailFilter(lead) {
    if (crmEmailFilter === 'with') return leadHasEmail(lead);
    if (crmEmailFilter === 'without') return !leadHasEmail(lead);
    return true;
}

function renderCrmBoard() {
    if (!crmBoard) return;
    loadCrmStages();

    const filteredLeads = crmLeads
        .filter(leadMatchesCrmSearch)
        .filter(leadMatchesCrmEmailFilter);
    if (crmLeadCount) crmLeadCount.textContent = `${filteredLeads.length} lead${filteredLeads.length === 1 ? '' : 's'}`;
    if (crmStageCount) crmStageCount.textContent = `${crmStages.length} etapa${crmStages.length === 1 ? '' : 's'}`;

    if (!crmStages.length) {
        crmStages = [...DEFAULT_CRM_STAGES];
        saveCrmStages();
    }

    crmBoard.innerHTML = crmStages.map((stage, index) => {
        const stageLeads = filteredLeads.filter(lead => getLeadCrmStage(lead) === stage.id);
        return `
            <article class="crm-column" data-stage-id="${escapeHtmlAttribute(stage.id)}">
                <div class="crm-column-header">
                    <input class="crm-stage-name-input" value="${escapeHtmlAttribute(stage.name)}" data-stage-id="${escapeHtmlAttribute(stage.id)}" aria-label="Nome da etapa">
                    <span class="crm-column-count">${stageLeads.length}</span>
                    <button type="button" class="crm-stage-delete-btn" data-stage-id="${escapeHtmlAttribute(stage.id)}" title="Apagar etapa" ${crmStages.length <= 1 ? 'disabled' : ''}>
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>
                <div class="crm-card-list" data-stage-id="${escapeHtmlAttribute(stage.id)}">
                    ${stageLeads.length
                        ? stageLeads.map(lead => renderCrmLeadCard(lead)).join('')
                        : `<div class="crm-empty-stage">${index === 0 ? 'Leads sem etapa aparecem aqui.' : 'Arraste cards para esta etapa.'}</div>`
                    }
                </div>
            </article>
        `;
    }).join('');

    bindCrmEvents();
}

function renderCrmLeadCard(lead) {
    const fullName = lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Lead sem nome';
    const title = lead.headline || lead.position || lead.title || 'Cargo nao informado';
    const company = lead.companyName || 'Empresa nao informada';
    const avatarHtml = getLeadAvatarHtml(lead, fullName);
    const leadId = getLeadRecordId(lead);

    return `
        <article class="crm-lead-card" draggable="true" data-lead-id="${escapeHtmlAttribute(leadId)}">
            <div class="crm-lead-top">
                ${avatarHtml}
                <div class="crm-lead-main">
                    <strong>${escapeHtml(fullName)}</strong>
                    <span title="${escapeHtmlAttribute(title)}">${escapeHtml(title)}</span>
                </div>
                <button type="button" class="crm-lead-edit-btn" data-lead-id="${escapeHtmlAttribute(leadId)}" title="Editar lead" aria-label="Editar lead">
                    <i class="ph-bold ph-pencil-simple"></i>
                </button>
            </div>
            <div class="crm-lead-company">${escapeHtml(company)}</div>
        </article>
    `;
}

function getCrmLeadNotes(lead) {
    return String(lead.notes || lead.observations || lead.comments || lead.crmNotes || '').trim();
}

function getLeadDisplayDetails(lead) {
    const email = getLeadPrimaryEmail(lead);
    const profileUrl = lead.linkedinUrl || lead.profileUrl || '';
    const createdAt = lead.extractedAt || lead.createdAt;
    const updatedAt = lead.updatedAt;
    const location = formatCompanyDetailValue(lead.location || lead.geoLocation || lead.locationName || '');
    const publicIdentifier = lead.publicIdentifier || '';
    const tier = lead.tier !== undefined && lead.tier !== null ? lead.tier : '';

    return [
        { label: 'ID', value: getLeadRecordId(lead) },
        { label: 'Primeiro nome', value: lead.firstName || '' },
        { label: 'Sobrenome', value: lead.lastName || '' },
        { label: 'Localizacao', value: location },
        { label: 'E-mail salvo', value: email },
        { label: 'LinkedIn', value: profileUrl, link: true },
        { label: 'Identificador publico', value: publicIdentifier },
        { label: 'Tier', value: tier },
        { label: 'Salvo em', value: createdAt ? new Date(createdAt).toLocaleString('pt-BR') : '' },
        { label: 'Atualizado em', value: updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : '' }
    ];
}

function renderCrmLeadStageOptions(selectedStageId) {
    if (!crmLeadStageSelect) return;
    loadCrmStages();
    crmLeadStageSelect.innerHTML = crmStages.map(stage =>
        `<option value="${escapeHtmlAttribute(stage.id)}" ${stage.id === selectedStageId ? 'selected' : ''}>${escapeHtml(stage.name)}</option>`
    ).join('');
}

function openCrmLeadModal(leadId) {
    const lead = crmLeads.find(item => String(getLeadRecordId(item)) === String(leadId));
    if (!lead || !crmLeadModal) return;

    selectedCrmLeadId = String(getLeadRecordId(lead));
    const fullName = lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Lead sem nome';
    const title = lead.headline || lead.position || lead.title || '';
    const email = getLeadPrimaryEmail(lead);
    const profileUrl = lead.linkedinUrl || lead.profileUrl || '';

    if (crmLeadModalTitle) crmLeadModalTitle.textContent = fullName;
    if (crmLeadFullNameInput) crmLeadFullNameInput.value = fullName === 'Lead sem nome' ? '' : fullName;
    if (crmLeadTitleInput) crmLeadTitleInput.value = title;
    if (crmLeadCompanyInput) crmLeadCompanyInput.value = lead.companyName || '';
    if (crmLeadEmailInput) crmLeadEmailInput.value = email;
    if (crmLeadLinkedinInput) crmLeadLinkedinInput.value = profileUrl;
    if (crmLeadNotesInput) crmLeadNotesInput.value = getCrmLeadNotes(lead);
    renderCrmLeadStageOptions(getLeadCrmStage(lead));

    if (crmLeadDetailsGrid) {
        crmLeadDetailsGrid.innerHTML = getLeadDisplayDetails(lead).map(item => {
            const value = formatCompanyDetailValue(item.value);
            const valueHtml = item.link && value !== 'N/A'
                ? `<a href="${escapeHtmlAttribute(value)}" target="_blank" class="linkedin-link">${escapeHtml(value)}</a>`
                : escapeHtml(value);
            return `
                <div class="company-detail-item">
                    <div class="company-detail-label">${escapeHtml(item.label)}</div>
                    <div class="company-detail-value">${valueHtml}</div>
                </div>
            `;
        }).join('');
    }
    if (crmLeadRawData) crmLeadRawData.textContent = JSON.stringify(lead, null, 2);

    crmLeadModal.style.display = 'flex';
}

function closeCrmLeadModal() {
    if (crmLeadModal) crmLeadModal.style.display = 'none';
    selectedCrmLeadId = null;
}

async function saveCrmLeadDetails() {
    if (!selectedCrmLeadId || !crmLeadModalSaveBtn) return;

    const lead = crmLeads.find(item => String(getLeadRecordId(item)) === String(selectedCrmLeadId));
    if (!lead) return;

    const id = selectedCrmLeadId;
    const email = String(crmLeadEmailInput?.value || '').trim();
    const fullName = String(crmLeadFullNameInput?.value || '').trim();
    const title = String(crmLeadTitleInput?.value || '').trim();
    const companyName = String(crmLeadCompanyInput?.value || '').trim();
    const linkedinUrl = String(crmLeadLinkedinInput?.value || '').trim();
    const crmStage = String(crmLeadStageSelect?.value || getLeadCrmStage(lead)).trim();
    const notes = String(crmLeadNotesInput?.value || '').trim();
    const previousStage = lead.crmStage;
    const originalHtml = crmLeadModalSaveBtn.innerHTML;

    crmLeadModalSaveBtn.disabled = true;
    crmLeadModalSaveBtn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:0.5rem;"><div class="spinner" style="margin:0;width:16px;height:16px;border-width:2px;"></div> Salvando...</span>';

    try {
        const response = await fetchLocalApi(`/api/leads/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName,
                headline: title,
                title,
                position: title,
                companyName,
                email,
                emails: email ? [email] : [],
                linkedinUrl,
                profileUrl: linkedinUrl,
                crmStage,
                notes,
                crmNotes: notes
            })
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${response.status}`);
        }

        const updatedLead = await response.json();
        crmLeads = crmLeads.map(item => String(getLeadRecordId(item)) === id ? { ...item, ...updatedLead } : item);
        globalHistoryLeads = crmLeads;
        closeCrmLeadModal();
        renderCrmBoard();

        if (previousStage !== crmStage && isClosedCrmStage(crmStage)) {
            try {
                const companyMarked = await markLeadCompanyAsClient({ ...lead, ...updatedLead });
                if (companyMarked) showToast('Lead salvo e empresa marcada como CLIENTE.');
                else showToast('Lead salvo.');
            } catch (companyError) {
                console.error('Erro ao marcar empresa como cliente:', companyError);
                showToast(`Lead salvo, mas nao consegui marcar a empresa como CLIENTE: ${companyError.message}`, 'error');
            }
        } else {
            showToast('Lead salvo com sucesso.');
        }
    } catch (error) {
        console.error('Erro ao salvar lead no CRM:', error);
        showToast(`Erro ao salvar lead: ${error.message}`, 'error');
    } finally {
        crmLeadModalSaveBtn.disabled = false;
        crmLeadModalSaveBtn.innerHTML = originalHtml;
    }
}

function bindCrmEvents() {
    document.querySelectorAll('.crm-stage-name-input').forEach(input => {
        input.addEventListener('change', (event) => {
            const id = event.currentTarget.dataset.stageId;
            const stage = crmStages.find(item => item.id === id);
            if (!stage) return;
            const nextName = event.currentTarget.value.trim();
            if (!nextName) {
                event.currentTarget.value = stage.name;
                showToast('A etapa precisa ter um nome.', 'error');
                return;
            }
            stage.name = nextName;
            saveCrmStages();
            renderCrmBoard();
        });
    });

    document.querySelectorAll('.crm-stage-delete-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const stageId = event.currentTarget.dataset.stageId;
            await deleteCrmStage(stageId);
        });
    });

    document.querySelectorAll('.crm-lead-edit-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openCrmLeadModal(event.currentTarget.dataset.leadId);
        });
    });

    document.querySelectorAll('.crm-lead-card').forEach(card => {
        card.addEventListener('dragstart', (event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', event.currentTarget.dataset.leadId);
            event.dataTransfer.setData('application/x-maktub-lead-id', event.currentTarget.dataset.leadId);
            event.currentTarget.classList.add('dragging');
        });
        card.addEventListener('dragend', (event) => {
            event.currentTarget.classList.remove('dragging');
        });
    });

    document.querySelectorAll('.crm-card-list').forEach(list => {
        list.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            event.currentTarget.classList.add('drag-over');
        });
        list.addEventListener('dragleave', (event) => {
            event.currentTarget.classList.remove('drag-over');
        });
        list.addEventListener('drop', async (event) => {
            event.preventDefault();
            event.currentTarget.classList.remove('drag-over');
            const leadId = event.dataTransfer.getData('application/x-maktub-lead-id') || event.dataTransfer.getData('text/plain');
            const stageId = event.currentTarget.dataset.stageId;
            await moveLeadToStage(leadId, stageId);
        });
    });
}

async function moveLeadToStage(leadId, stageId) {
    if (!leadId || !stageId) return;
    const lead = crmLeads.find(item => String(getLeadRecordId(item)) === String(leadId));
    if (!lead || lead.crmStage === stageId) return;

    const previousStage = lead.crmStage;
    lead.crmStage = stageId;
    renderCrmBoard();

    try {
        const response = await fetchLocalApi(`/api/leads/${encodeURIComponent(leadId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                crmStage: stageId,
                linkedinUrl: lead.linkedinUrl || lead.profileUrl || '',
                fullName: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
                companyName: lead.companyName || ''
            })
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${response.status}`);
        }
        const updatedLead = await response.json();
        crmLeads = crmLeads.map(item => String(getLeadRecordId(item)) === String(leadId) ? { ...item, ...updatedLead } : item);
        globalHistoryLeads = crmLeads;

        if (isClosedCrmStage(stageId)) {
            try {
                const companyMarked = await markLeadCompanyAsClient({ ...lead, ...updatedLead });
                if (companyMarked) {
                    showToast('Empresa marcada como CLIENTE.');
                }
            } catch (companyError) {
                console.error('Erro ao marcar empresa como cliente:', companyError);
                showToast(`Lead movido, mas nao consegui marcar a empresa como CLIENTE: ${companyError.message}`, 'error');
            }
        }
    } catch (error) {
        lead.crmStage = previousStage;
        renderCrmBoard();
        showToast(`Erro ao mover lead: ${error.message}`, 'error');
    }
}

async function deleteCrmStage(stageId) {
    if (crmStages.length <= 1) {
        showToast('Mantenha pelo menos uma etapa no CRM.', 'error');
        return;
    }

    const stage = crmStages.find(item => item.id === stageId);
    if (!stage) return;
    if (!confirm(`Apagar a etapa "${stage.name}"? Os leads dela vao para a primeira etapa.`)) return;

    const fallbackStage = crmStages.find(item => item.id !== stageId);
    crmStages = crmStages.filter(item => item.id !== stageId);
    saveCrmStages();

    const leadsToMove = crmLeads.filter(lead => getLeadCrmStage(lead) === stageId || lead.crmStage === stageId);
    leadsToMove.forEach(lead => {
        lead.crmStage = fallbackStage.id;
    });
    renderCrmBoard();

    const results = await Promise.allSettled(leadsToMove.map(lead =>
        fetchLocalApi(`/api/leads/${lead._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crmStage: fallbackStage.id })
        })
    ));
    if (results.some(result => result.status === 'rejected' || !result.value.ok)) {
        showToast('Etapa apagada, mas alguns leads podem nao ter sincronizado.', 'error');
    } else {
        showToast('Etapa apagada com sucesso.');
    }
}

if (crmAddStageBtn) {
    crmAddStageBtn.addEventListener('click', () => {
        loadCrmStages();
        const name = prompt('Nome da nova etapa:');
        const trimmedName = String(name || '').trim();
        if (!trimmedName) return;
        crmStages.push({ id: createCrmStageId(trimmedName), name: trimmedName });
        saveCrmStages();
        renderCrmBoard();
        showToast('Etapa criada.');
    });
}

if (crmRefreshBtn) {
    crmRefreshBtn.addEventListener('click', () => fetchCrmLeads(true));
}

if (crmSearchInput) {
    crmSearchInput.addEventListener('input', () => {
        crmSearchTerm = crmSearchInput.value.trim().toLowerCase();
        renderCrmBoard();
    });
}

if (crmEmailFilterSelect) {
    crmEmailFilterSelect.addEventListener('change', () => {
        crmEmailFilter = crmEmailFilterSelect.value;
        renderCrmBoard();
    });
}

if (crmLeadModalCloseBtn) crmLeadModalCloseBtn.addEventListener('click', closeCrmLeadModal);
if (crmLeadModalCancelBtn) crmLeadModalCancelBtn.addEventListener('click', closeCrmLeadModal);
if (crmLeadModalSaveBtn) crmLeadModalSaveBtn.addEventListener('click', saveCrmLeadDetails);
if (crmLeadModal) {
    crmLeadModal.addEventListener('click', (event) => {
        if (event.target === crmLeadModal) closeCrmLeadModal();
    });
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

    data.forEach((profile, index) => {
        const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Perfil LinkedIn';
        const title = profile.headline || profile.position || 'Não informado';
        const companyLabel = (profile.currentPosition && profile.currentPosition[0] ? profile.currentPosition[0].companyName : null)
            || profile.companyName
            || '';
        const profileUrl = profile.linkedinUrl || '#';

        const row = document.createElement('tr');
        const avatarHtml = getLeadAvatarHtml(profile, fullName);

        const emailStr = (profile.emails && profile.emails.length > 0) ? profile.emails.join(', ') : (profile.email || 'N/A');

        let tColor = '#ffeb3b', tBg = 'rgba(255, 235, 59, 0.1)', tBorder = 'rgba(255, 235, 59, 0.2)';
        if (profile.tier === 1) {
            tColor = '#10b981'; tBg = 'rgba(16, 185, 129, 0.15)'; tBorder = 'rgba(16, 185, 129, 0.3)';
        } else if (profile.tier === 2) {
            tColor = '#ff9800'; tBg = 'rgba(255, 152, 0, 0.15)'; tBorder = 'rgba(255, 152, 0, 0.3)';
        }
        const tierBadge = profile.tier ? `<span style="display:inline-block; margin-top: 4px; padding: 3px 6px; font-size: 0.65rem; border-radius: 2px; background: ${tBg}; color: ${tColor}; border: 1px solid ${tBorder};">Tier ${profile.tier}</span>` : '';
        const phoneStr = profile.phone || profile.phones?.[0] || 'N/A';

        const isSaved = globalHistoryLeads.some(l =>
            (l.linkedinUrl && l.linkedinUrl === profileUrl && profileUrl !== '#') ||
            (l.fullName && l.fullName === fullName && fullName !== 'Perfil LinkedIn')
        );

        const statusHtml = isSaved
            ? `<div class="status-indicator" title="Já salvo no banco"><i class="ph-bold ph-checks" style="color: var(--brand-primary); font-size: 1.4rem;"></i></div>`
            : `<div class="status-indicator save-lead-btn" data-index="${index}" title="Salvar lead" style="opacity: 0.35; cursor: pointer; transition: opacity 0.2s;"><i class="ph-bold ph-plus" style="font-size: 1rem;"></i></div>`;

        row.innerHTML = `
            <td style="text-align: center;">
                ${statusHtml}
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
                ${title}<br>${tierBadge}
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

    document.querySelectorAll('.save-lead-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const el = e.currentTarget;
            const idx = parseInt(el.dataset.index);
            const lead = globalLeads[idx];
            if (!lead) return;

            el.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:var(--brand-primary);margin:0;"></div>`;
            el.style.opacity = '1';
            el.style.cursor = 'default';
            el.classList.remove('save-lead-btn');

            const success = await saveLeadToDb(lead);
            if (success) {
                el.innerHTML = `<i class="ph-bold ph-checks" style="color: var(--brand-primary); font-size: 1.4rem;"></i>`;
                el.title = 'Já salvo no banco';
                globalHistoryLeads.push(lead);
                showToast(`${lead.fullName || lead.firstName || 'Lead'} salvo!`);
            } else {
                el.innerHTML = `<i class="ph-bold ph-plus" style="font-size: 1rem;"></i>`;
                el.style.opacity = '0.35';
                el.style.cursor = 'pointer';
                el.classList.add('save-lead-btn');
                showToast('Erro ao salvar lead.', 'error');
            }
        });
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
            const runData = await apifyApi('/runs', {
                method: 'POST',
                body: JSON.stringify({
                    actorId,
                    payload,
                    operation: actorId === EMPLOYEES_ACTOR_ID ? 'employees' : 'actor-run'
                })
            });
            const { run: startedRun, runId, datasetId } = getRequiredApifyRun(runData);
            let finalRunData = startedRun;
            while (true) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                const statusData = await apifyApi(`/runs?runId=${encodeURIComponent(runId)}&operation=${encodeURIComponent(actorId === EMPLOYEES_ACTOR_ID ? 'employees' : 'actor-run')}`);
                finalRunData = getApifyRun(statusData);
                const status = finalRunData.status;
                if (status === 'SUCCEEDED') break;
                if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) throw new Error(`Actor falhou: ${status}`);
            }

            const items = await apifyApi(`/datasets?datasetId=${encodeURIComponent(datasetId)}&runId=${encodeURIComponent(runId)}&operation=${encodeURIComponent(actorId === EMPLOYEES_ACTOR_ID ? 'employees' : 'actor-run')}`);
            let logTail = '';
            if (!Array.isArray(items) || items.length === 0) {
                try {
                    const logText = await apifyText(`/logs?runId=${encodeURIComponent(runId)}`);
                    logTail = logText.split('\n').slice(-30).join('\n');
                } catch (_) {}
            }

            return {
                actorId,
                runId,
                datasetId,
                run: finalRunData,
                items: Array.isArray(items) ? items : [],
                logTail
            };
        };

        updateStatus('active', 'Buscando Funcionários', 'Consultando funcionários da empresa...');

        const employeesPayload = {
            companies: [companySlug],
            profileScraperMode: 'Short ($4 per 1k)',
            maxItems: 60
        };
        if (role) employeesPayload.jobTitles = [role];

        console.log('[Pipeline] Payload enviado para company-employees:', JSON.stringify(employeesPayload));

        const employeesResult = await runActor(EMPLOYEES_ACTOR_ID, employeesPayload).catch(err => {
            console.warn('[Pipeline] Actor company-employees falhou:', err.message);
            return { actorId: EMPLOYEES_ACTOR_ID, items: [], error: err.message };
        });

        const employeesItems = employeesResult.items;
        let publicLinkedinItems = [];
        if (employeesItems.length === 0) {
            try {
                publicLinkedinItems = await fetchPublicLinkedInEmployees(companySlug);
            } catch (err) {
                console.warn('[Pipeline] Fallback publico do LinkedIn falhou:', err.message);
            }
        }

        console.log('[Pipeline] Runs Apify:', {
            companyEmployees: {
                runId: employeesResult.runId,
                datasetId: employeesResult.datasetId,
                status: employeesResult.run?.status,
                error: employeesResult.error,
                stats: employeesResult.run?.stats,
                logTail: employeesResult.logTail
            }
        });

        console.log(`[Pipeline] Resultados — company-employees: ${employeesItems.length} | linkedin-publico: ${publicLinkedinItems.length}`);
        if (employeesItems.length === 0 && publicLinkedinItems.length === 0) {
            console.warn('[Pipeline] Actor e fallback publico retornaram 0. Veja Runs Apify acima no console.');
        }

        // Une o actor principal ao fallback público sem duplicar perfis.
        const profileMap = new Map();

        const addToMap = (items, source) => {
            for (const item of items) {
                const key = item.publicIdentifier
                    || (item.linkedinUrl || item.url || item.profileUrl || '').replace(/\/$/, '').split('/').pop()
                    || null;
                if (!key) continue;
                if (profileMap.has(key)) {
                    profileMap.get(key)._sources.add(source);
                } else {
                    profileMap.set(key, { ...item, _sources: new Set([source]) });
                }
            }
        };

        addToMap(employeesItems, 'company-employees');
        addToMap(publicLinkedinItems, 'linkedin-public');

        let datasetItems = Array.from(profileMap.values());

        console.log(`[Pipeline] Total após consolidar fontes: ${datasetItems.length}`);
        updateStatus('active', 'Consolidando Dados', `${datasetItems.length} perfis encontrados...`);

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
                    tier
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                return a.tier - b.tier;
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
                companyLinkedinUrl: linkedinCompanyUrl,
                companyDomain: companyDomain || '',
                email: emp.email || '',
                phone: emp.phone || '',
                emails: emp.email ? [emp.email] : [],
                tier: emp.tier
            };
        });

        globalLeads = finalLeads;

        // Carregar histórico para exibir status de "salvo" correto
        try {
            const histRes = await fetchLocalApi('/api/leads');
            if (histRes.ok) globalHistoryLeads = await histRes.json();
        } catch (_) {}

        renderTable(finalLeads);

        totalLeadsEl.textContent = finalLeads.length;
        showToast(`${finalLeads.length} perfis encontrados. Salve apenas os leads que deseja enriquecer depois.`);
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
    if (!APIFY_TOKEN) {
        showToast('Configure sua Apify API Key na aba Conexao antes de extrair.', 'error');
        switchView('connection');
        return;
    }
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


// ── Icypeas enrichment: busca email por nome + empresa e aguarda o resultado ──
async function enrichLeadWithIcypeas(lead) {
    if (!ICYPEAS_TOKEN) return null;
    try {
        const data = await postLocalApi('/api/icypeas-email', {
            token: ICYPEAS_TOKEN,
            lead
        });

        console.log('[Icypeas] Resultado:', {
            lead: lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
            company: lead.companyDomain || lead.companyName,
            status: data.status,
            email: data.email || ''
        });

        if (!data.email) return null;
        return {
            email: data.email,
            emails: data.emails || [data.email],
            phone: data.phone || '',
            phones: data.phones || []
        };
    } catch (err) {
        console.warn('[Icypeas] Erro ao enriquecer:', lead.fullName || lead.linkedinUrl, err.message);
        return null;
    }
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

function isLinkedInAssetUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && /^(media|static)\.licdn\.com$/i.test(url.hostname);
    } catch (_) {
        return false;
    }
}

function getFirstUrl(...values) {
    for (const value of values) {
        if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
            return value.trim();
        }
    }
    return '';
}

function getLeadPhotoUrl(profile) {
    const photoUrl = getFirstUrl(
        profile.photo,
        profile.profilePicture,
        profile.profilePictureUrl,
        profile.picture,
        profile.pictureUrl,
        profile.image,
        profile.imageUrl,
        profile.avatar,
        profile.avatarUrl
    );

    if (isLinkedInAssetUrl(photoUrl)) {
        const params = new URLSearchParams({ url: photoUrl });
        return `/api/profile-image?${params.toString()}`;
    }

    return photoUrl;
}

function getLeadAvatarHtml(profile, fullName) {
    const initial = escapeHtmlAttribute((fullName || 'L').charAt(0).toUpperCase());
    const photoUrl = getLeadPhotoUrl(profile);

    if (!photoUrl) {
        return `<div class="user-avatar" style="border-radius: 8px; width: 32px; height: 32px; font-size: 1rem;">${initial}</div>`;
    }

    return `<div class="user-avatar" style="position: relative; border-radius: 8px; overflow: hidden; width: 32px; height: 32px; font-size: 1rem;"><span>${initial}</span><img src="${escapeHtmlAttribute(photoUrl)}" alt="${escapeHtmlAttribute(fullName)}" onerror="handleAvatarImageError(this)" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;"></div>`;
}

function getCompanyLogoUrl(company) {
    const linkedinLogo = getFirstUrl(
        company.logoUrl,
        company.logo,
        company.companyLogo,
        company.companyLogoUrl,
        company.image,
        company.imageUrl,
        company.picture,
        company.pictureUrl
    );
    const linkedinUrl = company.linkedinUrl || company.url || '';

    if (!linkedinLogo && !linkedinUrl && !company._id) return '';

    // In production, keep LinkedIn media same-origin so browser privacy
    // protections do not hide company logos that still exist in Mongo.
    if (isLinkedInAssetUrl(linkedinLogo) || linkedinUrl || company._id) {
        const params = new URLSearchParams({
            logo: linkedinLogo,
            linkedin: linkedinUrl,
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

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function handleCompanyLogoError(image) {
    image.remove();
}

function handleAvatarImageError(image) {
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

function formatCompanyDetailValue(value) {
    if (value === undefined || value === null || value === '') return 'N/A';
    if (Array.isArray(value)) return value.length ? value.join(', ') : 'N/A';
    if (typeof value === 'object') {
        if (value.linkedinText) return value.linkedinText;
        if (value.name) return value.name;
        if (value.country) return value.country;
        return JSON.stringify(value);
    }
    return String(value);
}

function getCompanyDisplayDetails(company) {
    const name = company.name || company.title || 'N/A';
    const industry = company._maktubType || company.industry || company.type || 'N/A';
    const rawLocation = company.location?.linkedinText
        || company.headquarters
        || (typeof company.location === 'string' ? company.location : '')
        || company.country
        || '';
    const locationStr = formatCompanyDetailValue(rawLocation);
    const employeesRaw = company.employeeCount || company.staffCount || company.employees || '';
    const employeesRange = getEmployeeRange(employeesRaw);
    const linkedinUrl = company.linkedinUrl || company.url || '';
    const website = company.website || company.websiteUrl || '';
    const description = company.description || company.summary || company.tagline || '';
    const createdAt = company.extractedAt || company.createdAt;
    const updatedAt = company.updatedAt;

    return [
        { label: 'Nome', value: name },
        { label: 'Tipo / Setor', value: industry },
        { label: 'Localizacao', value: locationStr },
        { label: 'Funcionarios', value: employeesRange },
        { label: 'LinkedIn', value: linkedinUrl, link: true },
        { label: 'Site', value: website, link: true },
        { label: 'Salva em', value: createdAt ? new Date(createdAt).toLocaleString('pt-BR') : 'N/A' },
        { label: 'Atualizada em', value: updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : 'N/A' },
        { label: 'Descricao', value: description, full: true }
    ];
}

function openCompanyDetailsModal(companyId) {
    const company = globalHistoryCompanies.find(c => String(c._id) === String(companyId));
    if (!company || !companyDetailsModal) return;

    selectedHistoryCompanyId = String(company._id);
    const name = company.name || company.title || 'Empresa';
    if (companyDetailsTitle) companyDetailsTitle.textContent = name;
    if (companyDetailsClientToggle) companyDetailsClientToggle.checked = Boolean(company.isClient);

    if (companyDetailsGrid) {
        const details = getCompanyDisplayDetails(company);
        companyDetailsGrid.innerHTML = details.map(item => {
            const value = formatCompanyDetailValue(item.value);
            const valueHtml = item.link && value !== 'N/A'
                ? `<a href="${escapeHtmlAttribute(value)}" target="_blank" class="linkedin-link">${escapeHtml(value)}</a>`
                : escapeHtml(value);
            return `
                <div class="company-detail-item ${item.full ? 'full' : ''}">
                    <div class="company-detail-label">${escapeHtml(item.label)}</div>
                    <div class="company-detail-value">${valueHtml}</div>
                </div>
            `;
        }).join('');
    }

    companyDetailsModal.style.display = 'flex';
}

function closeCompanyDetailsModal() {
    if (companyDetailsModal) companyDetailsModal.style.display = 'none';
    selectedHistoryCompanyId = null;
}

async function saveCompanyDetails() {
    if (!selectedHistoryCompanyId || !companyDetailsClientToggle || !companyDetailsSaveBtn) return;

    const id = selectedHistoryCompanyId;
    const isClient = companyDetailsClientToggle.checked;
    const originalHtml = companyDetailsSaveBtn.innerHTML;
    companyDetailsSaveBtn.disabled = true;
    companyDetailsSaveBtn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:0.5rem;"><div class="spinner" style="margin:0;width:16px;height:16px;border-width:2px;"></div> Salvando...</span>';

    try {
        const res = await fetchLocalApi(`/api/empresas/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isClient })
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${res.status}`);
        }

        const updatedCompany = await res.json();
        globalHistoryCompanies = globalHistoryCompanies.map(company =>
            String(company._id) === id ? { ...company, ...updatedCompany } : company
        );
        showToast(isClient ? 'Empresa marcada como CLIENTE.' : 'Marcacao de CLIENTE removida.');
        closeCompanyDetailsModal();
        filterHistoryCompanyTable();
    } catch (err) {
        console.error('Erro ao atualizar empresa:', err);
        showToast(`Erro ao salvar: ${err.message}`, 'error');
    } finally {
        companyDetailsSaveBtn.disabled = false;
        companyDetailsSaveBtn.innerHTML = originalHtml;
    }
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

        if (!APIFY_TOKEN) {
            showToast('Configure sua Apify API Key na aba Conexao antes de buscar empresas.', 'error');
            switchView('connection');
            return;
        }

        if (typeList.length === 0 && !keywords) {
            showToast('Selecione pelo menos um tipo de empresa ou informe palavras-chave.', 'error');
            return;
        }

        setCompanyFormState(true);
        updateCompanyStatus('active', 'Requisitando API', 'Iniciando busca de empresas...');
        
        // Fetch history to update status badges
        try {
            const res = await fetchLocalApi('/api/empresas');
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
                const urlsRes = await fetchLocalApi('/api/empresas/urls');
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
                const data = await apifyApi('/runs', {
                    method: 'POST',
                    body: JSON.stringify({
                        actorId: COMPANY_ACTOR_ID,
                        payload,
                        operation: 'company-search'
                    })
                });
                const { runId, datasetId } = getRequiredApifyRun(data);
                return { runId, datasetId, type };
            };

            const pollRun = async (runId) => {
                while (true) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const statusData = await apifyApi(`/runs?runId=${encodeURIComponent(runId)}&operation=company-search`);
                    const status = getApifyRun(statusData).status;
                    if (status === 'SUCCEEDED') return;
                    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) throw new Error(`Busca falhou: ${status}`);
                }
            };

            const fetchDataset = async (datasetId, runId) =>
                apifyApi(`/datasets?datasetId=${encodeURIComponent(datasetId)}&runId=${encodeURIComponent(runId)}&operation=company-search`);

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
                    const raw = await fetchDataset(run.datasetId, run.runId);
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

async function saveLeadToDb(lead) {
    if (!lead) return false;

    try {
        const response = await fetchLocalApi('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([lead])
        });

        return response.ok;
    } catch (error) {
        console.error('Erro ao salvar lead:', error);
        return false;
    }
}

async function saveCompaniesToDb(companies) {
    if (!companies || companies.length === 0) return false;

    try {
        const response = await fetchLocalApi('/api/empresas', {
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
        const [response, companiesResponse] = await Promise.all([
            fetchLocalApi('/api/leads'),
            fetchLocalApi('/api/empresas').catch(() => null)
        ]);
        if (!response.ok) throw new Error('Falha ao carregar o histórico');

        const leads = await response.json();
        if (companiesResponse?.ok) {
            globalHistoryCompanies = await companiesResponse.json();
        }
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
    if (historyLeadsWithEmail) {
        const withEmail = data.filter(l => l.email && l.email.trim() !== '').length;
        historyLeadsWithEmail.textContent = withEmail;
    }

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

    const companyMap = new Map();
    globalHistoryCompanies.forEach(c => {
        const key = (c.name || c.title || '').toLowerCase();
        if (key) companyMap.set(key, c);
    });

    const fragment = document.createDocumentFragment();

    data.forEach(profile => {
        const fullName = profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Perfil LinkedIn';
        const title = profile.headline || profile.position || 'Não informado';
        const companyLabel = profile.companyName || 'N/A';
        const profileUrl = profile.linkedinUrl || '#';

        const row = document.createElement('tr');
        const avatarHtml = getLeadAvatarHtml(profile, fullName);

        const emailStr = (profile.emails && profile.emails.length > 0) ? profile.emails.join(', ') : (profile.email || 'N/A');
        const matchedCompany = companyMap.get(companyLabel.toLowerCase());
        const companyLogoHtml = matchedCompany
            ? getCompanyAvatarHtml(matchedCompany, companyLabel)
            : `<div class="user-avatar company-avatar" style="border-radius: 8px;"><span>${companyLabel.charAt(0).toUpperCase()}</span></div>`;

        let hColor = '#ffeb3b', hBg = 'rgba(255, 235, 59, 0.1)', hBorder = 'rgba(255, 235, 59, 0.2)';
        if (profile.tier === 1) {
            hColor = '#10b981'; hBg = 'rgba(16, 185, 129, 0.15)'; hBorder = 'rgba(16, 185, 129, 0.3)';
        } else if (profile.tier === 2) {
            hColor = '#ff9800'; hBg = 'rgba(255, 152, 0, 0.15)'; hBorder = 'rgba(255, 152, 0, 0.3)';
        }
        const tierBadge = profile.tier ? `<span style="display:inline-block; margin-top: 4px; padding: 3px 6px; font-size: 0.65rem; border-radius: 2px; background: ${hBg}; color: ${hColor}; border: 1px solid ${hBorder};">Tier ${profile.tier}</span>` : '';

        row.innerHTML = `
            <td style="text-align: center;">
                <div style="display: flex; justify-content: center; align-items: center;">
                    ${companyLogoHtml}
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
            <td>
                ${profileUrl && profileUrl !== '#'
                    ? `<a href="${profileUrl}" target="_blank" class="linkedin-link">Ver Perfil</a>`
                    : `<span style="color: var(--text-muted); font-size: 0.85rem;">Sem link</span>`
                }
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                    <button class="btn btn-extract-action history-enrich-lead-btn" data-id="${profile._id}" style="font-size: 0.8rem; padding: 0.4rem 1rem; display: inline-block;">
                        Puxar Dados
                    </button>
                    <button class="btn history-delete-lead-btn" data-id="${profile._id}" title="Deletar lead do banco de dados" style="padding: 0.4rem 0.6rem; background: transparent; border: none; color: rgba(239,68,68,0.7); cursor: pointer; transition: all 0.2s;">
                        <i class="ph-bold ph-trash" style="font-size: 0.9rem;"></i>
                    </button>
                </div>
            </td>
        `;
        fragment.appendChild(row);
    });
    historyResultsBody.appendChild(fragment);

    document.querySelectorAll('.history-delete-lead-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!id) return;

            try {
                const res = await fetchLocalApi(`/api/leads/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error || `HTTP ${res.status}`);
                }
                globalHistoryLeads = globalHistoryLeads.filter(l => String(l._id) !== id);
                showToast('Lead deletado com sucesso!');
                filterHistoryTable();
            } catch (err) {
                console.error('Erro ao deletar lead:', err);
                showToast(`Erro ao deletar: ${err.message}`, 'error');
            }
        });
    });

    document.querySelectorAll('.history-enrich-lead-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            const id = button.dataset.id;
            const lead = globalHistoryLeads.find(item => String(item._id) === id);
            if (!lead) return;

            if (!ICYPEAS_TOKEN) {
                showToast('Configure sua Icypeas API Key na aba Conexao antes de puxar dados.', 'error');
                return;
            }

            const originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<span style="display: flex; align-items: center; gap: 0.4rem;"><div class="spinner" style="margin: 0; width: 14px; height: 14px; border-width: 2px;"></div> Puxando...</span>';
            updateStatus('active', 'Buscando Dados', `Consultando Icypeas para ${lead.fullName || lead.firstName || 'lead'}...`);

            const enriched = await enrichLeadWithIcypeas(lead);
            if (!enriched) {
                button.disabled = false;
                button.innerHTML = originalContent;
                showToast('Icypeas nao encontrou dados para este lead.', 'error');
                updateStatus('error', 'Sem Dados', 'Nenhum email encontrado para o lead selecionado.');
                return;
            }

            const updatedLead = {
                ...lead,
                email: enriched.email || lead.email || '',
                emails: enriched.emails?.length ? enriched.emails : (lead.emails || []),
                phone: enriched.phone || lead.phone || '',
                phones: enriched.phones?.length ? enriched.phones : (lead.phones || [])
            };

            const saved = await saveLeadToDb(updatedLead);
            button.disabled = false;
            button.innerHTML = originalContent;

            if (!saved) {
                showToast('Dados encontrados, mas nao foi possivel atualizar o banco.', 'error');
                updateStatus('error', 'Falha ao Salvar', 'Revise a conexao com o banco.');
                return;
            }

            globalHistoryLeads = globalHistoryLeads.map(item =>
                String(item._id) === id ? { ...item, ...updatedLead } : item
            );
            showToast(`Dados atualizados para ${updatedLead.fullName || updatedLead.firstName || 'lead'}.`);
            updateStatus('success', 'Finalizado', 'Lead enriquecido e salvo no historico.');
            filterHistoryTable();
        });
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
        const response = await fetchLocalApi('/api/empresas');
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
    if (companyHistoryClosedClients) {
        companyHistoryClosedClients.textContent = data.filter(company => Boolean(company.isClient)).length;
    }

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

    const companyFragment = document.createDocumentFragment();

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
        const clientTagHtml = company.isClient
            ? `<span class="client-tag"><i class="ph-bold ph-check-circle"></i> CLIENTE</span>`
            : '';

        row.innerHTML = `
            <td>
                <div class="user-profile">
                    ${avatarHtml}
                    <div class="user-details" style="max-width: 300px;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0; flex-wrap: wrap;">
                            <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(name)}</strong>
                            ${clientTagHtml}
                        </div>
                    </div>
                </div>
            </td>
            <td><span class="industry-tag">${escapeHtml(industry)}</span></td>
            <td><i class="las la-users" style="color: var(--text-muted); margin-right: 4px;"></i> ${escapeHtml(employeesRange)}</td>
            <td>
                <a href="${escapeHtmlAttribute(profileUrl)}" target="_blank" class="linkedin-link">
                    Ver Perfil
                </a>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                    <button class="btn btn-extract-action history-extract-leads-btn" data-company="${encodeURIComponent(name)}" title="Buscar Leads desta Empresa">
                        EXTRAIR
                    </button>
                    <button class="btn company-action-icon history-edit-company-btn" data-id="${escapeHtmlAttribute(company._id)}" title="Editar cadastro da empresa" style="color: rgba(255,255,255,0.7);">
                        <i class="ph-bold ph-pencil-simple" style="font-size: 0.9rem;"></i>
                    </button>
                    <button class="btn company-action-icon history-delete-company-btn" data-id="${escapeHtmlAttribute(company._id)}" title="Deletar empresa do banco de dados" style="color: rgba(239,68,68,0.7);">
                        <i class="ph-bold ph-trash" style="font-size: 0.9rem;"></i>
                    </button>
                </div>
            </td>
        `;
        companyFragment.appendChild(row);
    });
    companyHistoryResultsBody.appendChild(companyFragment);

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

    document.querySelectorAll('.history-edit-company-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            openCompanyDetailsModal(id);
        });
    });

    document.querySelectorAll('.history-delete-company-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!id) return;

            try {
                const res = await fetchLocalApi(`/api/empresas/${id}`, { method: 'DELETE' });
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
if (companyDetailsCloseBtn) companyDetailsCloseBtn.addEventListener('click', closeCompanyDetailsModal);
if (companyDetailsCancelBtn) companyDetailsCancelBtn.addEventListener('click', closeCompanyDetailsModal);
if (companyDetailsSaveBtn) companyDetailsSaveBtn.addEventListener('click', saveCompanyDetails);
if (companyDetailsModal) {
    companyDetailsModal.addEventListener('click', (e) => {
        if (e.target === companyDetailsModal) closeCompanyDetailsModal();
    });
}

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

setAuthMode('login');
loadSession();
