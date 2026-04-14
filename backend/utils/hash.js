const crypto = require('crypto');

/**
 * Compute SHA-256 hash of a buffer or string
 * @param {Buffer|string} data 
 * @returns {string} hex hash
 */
function computeHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validate that a string is a valid SHA-256 hex hash
 * @param {string} hash 
 * @returns {boolean}
 */
function isValidHash(hash) {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Generate a unique dataset ID
 * @param {string} name 
 * @param {string} authorWallet 
 * @returns {string}
 */
function generateDatasetId(name, authorWallet) {
  const input = `${name}-${authorWallet}-${Date.now()}`;
  return computeHash(input).substring(0, 32);
}

module.exports = { computeHash, isValidHash, generateDatasetId };
