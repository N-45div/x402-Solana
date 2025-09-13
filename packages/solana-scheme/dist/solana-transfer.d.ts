import { SolanaPaymentRequirement, PaymentPayload } from '@x402-solana/core';
export declare class SolanaTransferScheme {
    private connection;
    constructor(network: string);
    /**
     * Creates a payment payload for SOL transfer
     */
    createPaymentPayload(requirement: SolanaPaymentRequirement, fromAddress: string, amount: number, wallet: any): Promise<PaymentPayload>;
    /**
     * Verifies a SOL transfer payment payload
     */
    verifyPayment(paymentPayload: PaymentPayload, requirement: SolanaPaymentRequirement): Promise<{
        isValid: boolean;
        invalidReason?: string;
    }>;
    /**
     * Settles a SOL transfer payment by submitting to blockchain
     */
    settlePayment(paymentPayload: PaymentPayload, requirement: SolanaPaymentRequirement): Promise<{
        success: boolean;
        txHash?: string;
        error?: string;
    }>;
    /**
     * Gets transaction status
     */
    getTransactionStatus(signature: string): Promise<{
        confirmed: boolean;
        confirmations?: number;
        error?: string;
    }>;
    /**
     * Estimates transaction fee
     */
    estimateFee(fromAddress: string, requirement: SolanaPaymentRequirement): Promise<number>;
}
//# sourceMappingURL=solana-transfer.d.ts.map