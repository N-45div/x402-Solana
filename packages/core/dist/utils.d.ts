import { PublicKey } from '@solana/web3.js';
import { PaymentPayload, SolanaPaymentRequirement } from './types';
/**
 * Validates a Solana address string
 */
export declare function isValidSolanaAddress(address: string): boolean;
/**
 * Converts a base58 string to PublicKey
 */
export declare function toPublicKey(address: string): PublicKey;
/**
 * Encodes payment payload to base64 for X-PAYMENT header
 */
export declare function encodePaymentPayload(payload: PaymentPayload): string;
/**
 * Decodes payment payload from base64 X-PAYMENT header
 */
export declare function decodePaymentPayload(encoded: string): PaymentPayload;
/**
 * Validates payment requirement structure
 */
export declare function validatePaymentRequirement(requirement: SolanaPaymentRequirement): void;
/**
 * Converts human-readable amount to atomic units
 */
export declare function toAtomicUnits(amount: number, decimals: number): bigint;
/**
 * Converts atomic units to human-readable amount
 */
export declare function fromAtomicUnits(atomicAmount: bigint, decimals: number): number;
/**
 * Gets the appropriate RPC endpoint for a network
 */
export declare function getRpcEndpoint(network: string): string;
/**
 * Creates a payment requirement for SOL transfers
 */
export declare function createSolTransferRequirement(payTo: string, amount: string, resource: string, description: string, network?: 'solana-mainnet' | 'solana-devnet'): SolanaPaymentRequirement;
/**
 * Creates a payment requirement for SPL token transfers
 */
export declare function createSplTransferRequirement(payTo: string, amount: string, mint: string, resource: string, description: string, network?: 'solana-mainnet' | 'solana-devnet'): SolanaPaymentRequirement;
/**
 * Generates a unique nonce for replay protection
 */
export declare function generateNonce(): string;
/**
 * Validates transaction signature format
 */
export declare function isValidSignature(signature: string): boolean;
//# sourceMappingURL=utils.d.ts.map