"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSolanaAddress = isValidSolanaAddress;
exports.toPublicKey = toPublicKey;
exports.encodePaymentPayload = encodePaymentPayload;
exports.decodePaymentPayload = decodePaymentPayload;
exports.validatePaymentRequirement = validatePaymentRequirement;
exports.toAtomicUnits = toAtomicUnits;
exports.fromAtomicUnits = fromAtomicUnits;
exports.getRpcEndpoint = getRpcEndpoint;
exports.createSolTransferRequirement = createSolTransferRequirement;
exports.createSplTransferRequirement = createSplTransferRequirement;
exports.generateNonce = generateNonce;
exports.isValidSignature = isValidSignature;
const web3_js_1 = require("@solana/web3.js");
const types_1 = require("./types");
/**
 * Validates a Solana address string
 */
function isValidSolanaAddress(address) {
    try {
        new web3_js_1.PublicKey(address);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Converts a base58 string to PublicKey
 */
function toPublicKey(address) {
    try {
        return new web3_js_1.PublicKey(address);
    }
    catch (error) {
        throw new types_1.X402Error(`Invalid Solana address: ${address}`, 'INVALID_ADDRESS');
    }
}
/**
 * Encodes payment payload to base64 for X-PAYMENT header
 */
function encodePaymentPayload(payload) {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}
/**
 * Decodes payment payload from base64 X-PAYMENT header
 */
function decodePaymentPayload(encoded) {
    try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        return JSON.parse(decoded);
    }
    catch (error) {
        throw new types_1.X402Error('Invalid payment payload encoding', 'INVALID_PAYLOAD');
    }
}
/**
 * Validates payment requirement structure
 */
function validatePaymentRequirement(requirement) {
    if (!requirement.scheme || !['solana-transfer', 'solana-spl'].includes(requirement.scheme)) {
        throw new types_1.X402Error('Invalid or missing scheme', 'INVALID_SCHEME');
    }
    if (!requirement.network || !requirement.network.startsWith('solana-')) {
        throw new types_1.X402Error('Invalid or missing network', 'INVALID_NETWORK');
    }
    if (!requirement.payTo || !isValidSolanaAddress(requirement.payTo)) {
        throw new types_1.X402Error('Invalid payTo address', 'INVALID_PAY_TO');
    }
    if (!requirement.asset) {
        throw new types_1.X402Error('Missing asset specification', 'MISSING_ASSET');
    }
    if (requirement.scheme === 'solana-spl' && requirement.asset === 'SOL') {
        throw new types_1.X402Error('SPL scheme cannot use native SOL', 'INVALID_ASSET_SCHEME');
    }
    if (requirement.scheme === 'solana-transfer' && requirement.asset !== 'SOL') {
        throw new types_1.X402Error('Transfer scheme must use native SOL', 'INVALID_ASSET_SCHEME');
    }
    const amount = parseFloat(requirement.maxAmountRequired);
    if (isNaN(amount) || amount <= 0) {
        throw new types_1.X402Error('Invalid maxAmountRequired', 'INVALID_AMOUNT');
    }
}
/**
 * Converts human-readable amount to atomic units
 */
function toAtomicUnits(amount, decimals) {
    return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}
/**
 * Converts atomic units to human-readable amount
 */
function fromAtomicUnits(atomicAmount, decimals) {
    return Number(atomicAmount) / Math.pow(10, decimals);
}
/**
 * Gets the appropriate RPC endpoint for a network
 */
function getRpcEndpoint(network) {
    switch (network) {
        case 'solana-mainnet':
            return process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
        case 'solana-devnet':
            return process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';
        default:
            throw new types_1.X402Error(`Unsupported network: ${network}`, 'UNSUPPORTED_NETWORK');
    }
}
/**
 * Creates a payment requirement for SOL transfers
 */
function createSolTransferRequirement(payTo, amount, resource, description, network = 'solana-devnet') {
    return {
        scheme: 'solana-transfer',
        network,
        maxAmountRequired: amount,
        resource,
        description,
        mimeType: 'application/json',
        payTo,
        maxTimeoutSeconds: 60,
        asset: 'SOL',
        extra: {
            priorityFee: 5000, // 5000 lamports default priority fee
        },
    };
}
/**
 * Creates a payment requirement for SPL token transfers
 */
function createSplTransferRequirement(payTo, amount, mint, resource, description, network = 'solana-devnet') {
    return {
        scheme: 'solana-spl',
        network,
        maxAmountRequired: amount,
        resource,
        description,
        mimeType: 'application/json',
        payTo,
        maxTimeoutSeconds: 60,
        asset: mint,
        extra: {
            priorityFee: 5000,
        },
    };
}
/**
 * Generates a unique nonce for replay protection
 */
function generateNonce() {
    return Date.now().toString() + Math.random().toString(36).substring(2);
}
/**
 * Validates transaction signature format
 */
function isValidSignature(signature) {
    try {
        // Solana signatures are base58 encoded and typically 87-88 characters
        return signature.length >= 87 && signature.length <= 88;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=utils.js.map