import { Logger } from 'winston';
import { PaymentRequirement, VerificationResponse, SettlementResponse, SupportedSchemesResponse } from '@x402-solana/core';
export declare class FacilitatorService {
    private transferSchemes;
    private splSchemes;
    private logger;
    constructor(logger: Logger);
    private initializeSchemes;
    /**
     * Get supported payment schemes and networks
     */
    getSupportedSchemes(): Promise<SupportedSchemesResponse>;
    /**
     * Verify a payment payload
     */
    verifyPayment(x402Version: number, paymentHeader: string, paymentRequirements: PaymentRequirement): Promise<VerificationResponse>;
    /**
     * Settle a payment on the blockchain
     */
    settlePayment(x402Version: number, paymentHeader: string, paymentRequirements: PaymentRequirement): Promise<SettlementResponse>;
    /**
     * Get transaction status
     */
    getTransactionStatus(signature: string, network: string): Promise<{
        confirmed: boolean;
        confirmations?: number;
        error?: string;
    }>;
    private verifyTransferPayment;
    private verifySPLPayment;
    private settleTransferPayment;
    private settleSPLPayment;
    private getTokenDecimals;
}
//# sourceMappingURL=facilitator-service.d.ts.map