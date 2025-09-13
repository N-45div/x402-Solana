import { SolanaPaymentRequirement, PaymentPayload } from '@x402-solana/core';
export declare class SolanaSPLScheme {
    private connection;
    constructor(network: string);
    /**
     * Creates a payment payload for SPL token transfer
     */
    createPaymentPayload(requirement: SolanaPaymentRequirement, fromAddress: string, amount: number, decimals: number, wallet: any): Promise<PaymentPayload>;
    /**
     * Verifies an SPL token transfer payment payload
     */
    verifyPayment(paymentPayload: PaymentPayload, requirement: SolanaPaymentRequirement, tokenDecimals: number): Promise<{
        isValid: boolean;
        invalidReason?: string;
    }>;
    /**
     * Settles an SPL token transfer payment by submitting to blockchain
     */
    settlePayment(paymentPayload: PaymentPayload, requirement: SolanaPaymentRequirement, tokenDecimals: number): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    /**
     * Gets token account balance
     */
    getTokenBalance(tokenAccount: string): Promise<bigint>;
    /**
     * Gets token mint information
     */
    getTokenMintInfo(mint: string): Promise<{
        decimals: number;
        supply: bigint;
    }>;
    /**
     * Estimates transaction fee for SPL transfer
     */
    estimateFee(fromAddress: string, requirement: SolanaPaymentRequirement): Promise<number>;
}
//# sourceMappingURL=solana-spl.d.ts.map