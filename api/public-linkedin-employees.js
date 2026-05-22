const { fetchPublicLinkedInEmployees } = require('../lib/public-linkedin-employees');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).end();
    }

    try {
        const linkedinUrl = Array.isArray(req.query.linkedin) ? req.query.linkedin[0] : req.query.linkedin;
        return res.status(200).json(await fetchPublicLinkedInEmployees(linkedinUrl));
    } catch (error) {
        console.error('Erro ao buscar funcionarios publicos do LinkedIn:', error);
        return res.status(200).json([]);
    }
};
