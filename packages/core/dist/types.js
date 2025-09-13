"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDC_MINT_DEVNET = exports.USDC_MINT_MAINNET = exports.NATIVE_SOL_MINT = exports.SOLANA_SCHEMES = exports.SOLANA_NETWORKS = exports.X402_VERSION = exports.SolanaPaymentError = exports.X402Error = void 0;
// Error types
class X402Error extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'X402Error';
    }
}
exports.X402Error = X402Error;
class SolanaPaymentError extends X402Error {
    constructor(message, solanaError) {
        super(message, 'SOLANA_PAYMENT_ERROR');
        this.solanaError = solanaError;
    }
}
exports.SolanaPaymentError = SolanaPaymentError;
// Constants
exports.X402_VERSION = 1;
exports.SOLANA_NETWORKS = {
    MAINNET: 'solana-mainnet',
    DEVNET: 'solana-devnet',
};
exports.SOLANA_SCHEMES = {
    TRANSFER: 'solana-transfer',
    SPL: 'solana-spl',
};
exports.NATIVE_SOL_MINT = 'SOL';
exports.USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
exports.USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
//# sourceMappingURL=types.js.map