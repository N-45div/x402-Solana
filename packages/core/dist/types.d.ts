export interface X402Version {
    version: number;
}
export interface PaymentRequiredResponse {
    x402Version: number;
    accepts: PaymentRequirement[];
    error?: string;
}
export interface PaymentRequirement {
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    outputSchema?: object | null;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra?: object | null;
}
export interface PaymentPayload {
    x402Version: number;
    scheme: string;
    network: string;
    payload: any;
}
export interface SolanaPaymentRequirement extends PaymentRequirement {
    scheme: 'solana-transfer' | 'solana-spl';
    network: 'solana-mainnet' | 'solana-devnet' | 'solana-testnet';
    payTo: string;
    asset: string;
    extra: {
        feePayer?: string;
        priorityFee?: number;
        memo?: string;
    };
}
export interface SolanaTransferPayload {
    from: string;
    signature: string;
    amount: string;
    timestamp: number;
    nonce?: string;
}
export interface SolanaSPLPayload extends SolanaTransferPayload {
    mint: string;
    fromTokenAccount: string;
    toTokenAccount: string;
}
export interface VerificationRequest {
    x402Version: number;
    paymentHeader: string;
    paymentRequirements: PaymentRequirement;
}
export interface VerificationResponse {
    isValid: boolean;
    invalidReason: string | null;
}
export interface SettlementRequest {
    x402Version: number;
    paymentHeader: string;
    paymentRequirements: PaymentRequirement;
}
export interface SettlementResponse {
    success: boolean;
    error: string | null;
    txHash: string | null;
    networkId: string | null;
    confirmations?: number;
}
export interface SupportedScheme {
    scheme: string;
    network: string;
}
export interface SupportedSchemesResponse {
    kinds: SupportedScheme[];
}
export interface PaymentOptions {
    wallet?: any;
    priorityFee?: number;
    memo?: string;
}
export interface PaymentResult {
    success: boolean;
    signature?: string;
    error?: string;
}
export declare class X402Error extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class SolanaPaymentError extends X402Error {
    solanaError?: any | undefined;
    constructor(message: string, solanaError?: any | undefined);
}
export declare const X402_VERSION = 1;
export declare const SOLANA_NETWORKS: {
    readonly MAINNET: "solana-mainnet";
    readonly DEVNET: "solana-devnet";
};
export declare const SOLANA_SCHEMES: {
    readonly TRANSFER: "solana-transfer";
    readonly SPL: "solana-spl";
};
export declare const NATIVE_SOL_MINT = "SOL";
export declare const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export declare const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
//# sourceMappingURL=types.d.ts.map