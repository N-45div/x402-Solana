"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacilitatorService = void 0;
const core_1 = require("@x402-solana/core");
const solana_scheme_1 = require("@x402-solana/solana-scheme");
class FacilitatorService {
    constructor(logger) {
        this.transferSchemes = new Map();
        this.splSchemes = new Map();
        this.logger = logger;
        this.initializeSchemes();
    }
    initializeSchemes() {
        // Initialize transfer schemes for each network
        Object.values(core_1.SOLANA_NETWORKS).forEach(network => {
            this.transferSchemes.set(network, new solana_scheme_1.SolanaTransferScheme(network));
            this.splSchemes.set(network, new solana_scheme_1.SolanaSPLScheme(network));
        });
        this.logger.info('Initialized Solana payment schemes for all networks');
    }
    /**
     * Get supported payment schemes and networks
     */
    async getSupportedSchemes() {
        const kinds = [];
        // Add all combinations of schemes and networks
        Object.values(core_1.SOLANA_NETWORKS).forEach(network => {
            Object.values(core_1.SOLANA_SCHEMES).forEach(scheme => {
                kinds.push({ scheme, network });
            });
        });
        return { kinds };
    }
    /**
     * Verify a payment payload
     */
    async verifyPayment(x402Version, paymentHeader, paymentRequirements) {
        try {
            // Validate x402 version
            if (x402Version !== 1) {
                return {
                    isValid: false,
                    invalidReason: `Unsupported x402 version: ${x402Version}`
                };
            }
            // Decode payment payload
            const paymentPayload = (0, core_1.decodePaymentPayload)(paymentHeader);
            const solanaRequirement = paymentRequirements;
            // Validate scheme and network match
            if (paymentPayload.scheme !== solanaRequirement.scheme) {
                return {
                    isValid: false,
                    invalidReason: 'Payment scheme mismatch'
                };
            }
            if (paymentPayload.network !== solanaRequirement.network) {
                return {
                    isValid: false,
                    invalidReason: 'Payment network mismatch'
                };
            }
            // Route to appropriate scheme handler
            if (paymentPayload.scheme === core_1.SOLANA_SCHEMES.TRANSFER) {
                return await this.verifyTransferPayment(paymentPayload, solanaRequirement);
            }
            else if (paymentPayload.scheme === core_1.SOLANA_SCHEMES.SPL) {
                return await this.verifySPLPayment(paymentPayload, solanaRequirement);
            }
            else {
                return {
                    isValid: false,
                    invalidReason: `Unsupported payment scheme: ${paymentPayload.scheme}`
                };
            }
        }
        catch (error) {
            this.logger.error('Payment verification error:', error);
            return {
                isValid: false,
                invalidReason: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Settle a payment on the blockchain
     */
    async settlePayment(x402Version, paymentHeader, paymentRequirements) {
        try {
            // First verify the payment
            const verification = await this.verifyPayment(x402Version, paymentHeader, paymentRequirements);
            if (!verification.isValid) {
                return {
                    success: false,
                    error: verification.invalidReason,
                    txHash: null,
                    networkId: null
                };
            }
            // Decode payment payload
            const paymentPayload = (0, core_1.decodePaymentPayload)(paymentHeader);
            const solanaRequirement = paymentRequirements;
            // Route to appropriate scheme handler
            if (paymentPayload.scheme === core_1.SOLANA_SCHEMES.TRANSFER) {
                return await this.settleTransferPayment(paymentPayload, solanaRequirement);
            }
            else if (paymentPayload.scheme === core_1.SOLANA_SCHEMES.SPL) {
                return await this.settleSPLPayment(paymentPayload, solanaRequirement);
            }
            else {
                return {
                    success: false,
                    error: `Unsupported payment scheme: ${paymentPayload.scheme}`,
                    txHash: null,
                    networkId: null
                };
            }
        }
        catch (error) {
            this.logger.error('Payment settlement error:', error);
            return {
                success: false,
                error: `Settlement failed: ${error instanceof Error ? error.message : String(error)}`,
                txHash: null,
                networkId: null
            };
        }
    }
    /**
     * Get transaction status
     */
    async getTransactionStatus(signature, network) {
        try {
            const transferScheme = this.transferSchemes.get(network);
            if (!transferScheme) {
                throw new Error(`Unsupported network: ${network}`);
            }
            return await transferScheme.getTransactionStatus(signature);
        }
        catch (error) {
            this.logger.error('Transaction status error:', error);
            return {
                confirmed: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async verifyTransferPayment(paymentPayload, requirement) {
        const scheme = this.transferSchemes.get(requirement.network);
        if (!scheme) {
            return {
                isValid: false,
                invalidReason: `Unsupported network: ${requirement.network}`
            };
        }
        const result = await scheme.verifyPayment(paymentPayload, requirement);
        return {
            isValid: result.isValid,
            invalidReason: result.invalidReason || null
        };
    }
    async verifySPLPayment(paymentPayload, requirement) {
        const scheme = this.splSchemes.get(requirement.network);
        if (!scheme) {
            return {
                isValid: false,
                invalidReason: `Unsupported network: ${requirement.network}`
            };
        }
        // Get token decimals
        const tokenDecimals = await this.getTokenDecimals(requirement.asset, requirement.network);
        const result = await scheme.verifyPayment(paymentPayload, requirement, tokenDecimals);
        return {
            isValid: result.isValid,
            invalidReason: result.invalidReason || null
        };
    }
    async settleTransferPayment(paymentPayload, requirement) {
        const scheme = this.transferSchemes.get(requirement.network);
        if (!scheme) {
            return {
                success: false,
                error: `Unsupported network: ${requirement.network}`,
                txHash: null,
                networkId: null
            };
        }
        const result = await scheme.settlePayment(paymentPayload, requirement);
        return {
            success: result.success,
            error: result.error || null,
            txHash: result.txHash || null,
            networkId: requirement.network
        };
    }
    async settleSPLPayment(paymentPayload, requirement) {
        const scheme = this.splSchemes.get(requirement.network);
        if (!scheme) {
            return {
                success: false,
                error: `Unsupported network: ${requirement.network}`,
                txHash: null,
                networkId: null
            };
        }
        // Get token decimals
        const tokenDecimals = await this.getTokenDecimals(requirement.asset, requirement.network);
        const result = await scheme.settlePayment(paymentPayload, requirement, tokenDecimals);
        return {
            success: result.success,
            error: result.error || null,
            txHash: result.txHash || null,
            networkId: requirement.network
        };
    }
    async getTokenDecimals(mint, network) {
        // Handle common tokens
        if (mint === core_1.USDC_MINT_MAINNET || mint === core_1.USDC_MINT_DEVNET) {
            return 6; // USDC has 6 decimals
        }
        // For other tokens, query the blockchain
        try {
            const scheme = this.splSchemes.get(network);
            if (!scheme) {
                throw new Error(`Unsupported network: ${network}`);
            }
            const mintInfo = await scheme.getTokenMintInfo(mint);
            return mintInfo.decimals;
        }
        catch (error) {
            this.logger.warn(`Failed to get token decimals for ${mint}, defaulting to 9:`, error);
            return 9; // Default to 9 decimals
        }
    }
}
exports.FacilitatorService = FacilitatorService;
//# sourceMappingURL=facilitator-service.js.map