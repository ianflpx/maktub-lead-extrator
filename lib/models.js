const { mongoose } = require('./mongodb');

const leadSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    fullName: String,
    headline: String,
    title: String,
    location: mongoose.Schema.Types.Mixed,
    companyName: String,
    linkedinUrl: String,
    profileUrl: String,
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
    linkedinUrl: { type: String, unique: true },
    url: String,
    logoUrl: String,
    logo: String,
    description: String,
    summary: String,
    extractedAt: { type: Date, default: Date.now }
}, {
    collection: 'empresas',
    timestamps: true,
    strict: false
});

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
const Empresa = mongoose.models.Empresa || mongoose.model('Empresa', empresaSchema);

module.exports = {
    Empresa,
    Lead
};
