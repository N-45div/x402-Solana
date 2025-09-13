import { PaymentRequiredResponse, SolanaPaymentRequirement, PaymentResult, PaymentOptions } from '@x402-solana/core';
export interface X402ClientOptions {
    facilitatorUrl?: string;
    network?: string;
    timeout?: number;
}
export declare class X402Client {
    private connection;
    private facilitatorUrl;
    private network;
    private httpClient;
    constructor(options?: X402ClientOptions);
    /**
     * Make a request to a protected resource
     */
    request(url: string, options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        headers?: Record<string, string>;
        body?: any;
        wallet?: any;
        paymentOptions?: PaymentOptions;
    }): Promise<{
        data?: any;
        headers?: Record<string, string>;
        status: number;
        paymentRequired?: boolean;
        paymentRequirements?: PaymentRequiredResponse;
    }>;
    /**
     * Make a payment for given requirements
     */
    makePayment(paymentRequirements: PaymentRequiredResponse, wallet: any, options?: PaymentOptions): Promise<PaymentResult & {
        paymentHeader?: string;
    }>;
    /**
     * Create SOL payment payload
     */
    private createSOLPayment;
    /**
     * Create SPL token payment payload
     */
    private createSPLPayment;
    /**
     * Select the best payment requirement from available options
     */
    private selectPaymentRequirement;
    /**
     * Verify payment with facilitator
     */
    private verifyPayment;
    /**
     * Get wallet balance for SOL
     */
    getSOLBalance(walletAddress: string): Promise<number>;
    /**
     * Get wallet balance for SPL token
     */
    getSPLBalance(walletAddress: string, mint: string): Promise<number>;
    /**
     * Estimate transaction fee
     */
    estimateFee(requirement: SolanaPaymentRequirement, walletAddress: string): Promise<number>;
}
//# sourceMappingURL=x402-client.d.ts.map