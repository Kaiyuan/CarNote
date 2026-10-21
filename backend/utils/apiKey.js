const crypto = require('crypto');

function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

function hashApiKey(key) {
    return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function getApiKeyPrefix(key) {
    return String(key).slice(0, 8);
}

module.exports = {
    generateApiKey,
    hashApiKey,
    getApiKeyPrefix
};
