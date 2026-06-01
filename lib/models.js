const { mongoose } = require('./mongodb');

const leadSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    firstName: String,
    lastName: String,
    fullName: String,
    headline: String,
    title: String,
    location: mongoose.Schema.Types.Mixed,
    companyName: String,
    linkedinUrl: String,
    profileUrl: String,
    email: String,
    emails: [String],
    phone: String,
    phones: [String],
    notes: String,
    crmNotes: String,
    observations: String,
    comments: String,
    photo: String,
    profilePicture: String,
    publicIdentifier: String,
    currentPosition: mongoose.Schema.Types.Mixed,
    tier: Number,
    extractedAt: { type: Date, default: Date.now }
}, {
    collection: 'leads',
    timestamps: true,
    strict: false
});

const empresaSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: String,
    title: String,
    industry: String,
    type: String,
    _maktubType: String,
    employeeCount: mongoose.Schema.Types.Mixed,
    staffCount: mongoose.Schema.Types.Mixed,
    employees: mongoose.Schema.Types.Mixed,
    location: mongoose.Schema.Types.Mixed,
    headquarters: String,
    country: String,
    linkedinUrl: String,
    url: String,
    website: String,
    websiteUrl: String,
    logoUrl: String,
    logo: String,
    description: String,
    summary: String,
    isClient: { type: Boolean, default: false },
    extractedAt: { type: Date, default: Date.now }
}, {
    collection: 'empresas',
    timestamps: true,
    strict: false
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    sessionTokenHash: { type: String, default: '' },
    apiKeys: {
        apifyToken: { type: String, default: '' },
        icypeasToken: { type: String, default: '' },
        linkedinCookie: { type: String, default: '' }
    }
}, {
    collection: 'users',
    timestamps: true
});

const apiUsageLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    provider: { type: String, required: true, index: true },
    operation: { type: String, default: '', index: true },
    status: { type: String, default: '' },
    requestCount: { type: Number, default: 1 },
    resultCount: { type: Number, default: 0 },
    runId: { type: String, default: '', index: true },
    datasetId: { type: String, default: '', index: true },
    estimatedCostUsd: { type: Number, default: 0 },
    rawUsage: mongoose.Schema.Types.Mixed,
    error: { type: String, default: '' }
}, {
    collection: 'api_usage_logs',
    timestamps: true,
    strict: false
});

leadSchema.index({ userId: 1, linkedinUrl: 1 });
empresaSchema.index({ userId: 1, linkedinUrl: 1 });

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
const Empresa = mongoose.models.Empresa || mongoose.model('Empresa', empresaSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const ApiUsageLog = mongoose.models.ApiUsageLog || mongoose.model('ApiUsageLog', apiUsageLogSchema);

module.exports = {
    ApiUsageLog,
    Empresa,
    Lead,
    User
};
