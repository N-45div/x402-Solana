import { PublicKey } from '@solana/web3.js';

// Core x402 protocol types
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
  payload: any; // Scheme-dependent payload
}

// Solana-specific types
export interface SolanaPaymentRequirement extends PaymentRequirement {
  scheme: 'solana-transfer' | 'solana-spl';
  network: 'solana-mainnet' | 'solana-devnet' | 'solana-testnet';
  payTo: string; // Base58 encoded Solana address
  asset: string; // Mint address for SPL tokens, 'SOL' for native SOL
  extra: {
    feePayer?: string; // Optional fee payer for gasless transactions
    priorityFee?: number; // Priority fee in lamports
    memo?: string; // Optional memo
  };
}

export interface SolanaTransferPayload {
  from: string; // Base58 encoded sender address
  signature: string; // Base58 encoded transaction signature
  amount: string; // Amount in atomic units
  timestamp: number; // Unix timestamp
  nonce?: string; // Optional nonce for replay protection
}

export interface SolanaSPLPayload extends SolanaTransferPayload {
  mint: string; // SPL token mint address
  fromTokenAccount: string; // Sender's token account
  toTokenAccount: string; // Recipient's token account
}

// Facilitator types
export interface VerificationRequest {
  x402Version: number;
  paymentHeader: string; // Base64 encoded PaymentPayload
  paymentRequirements: PaymentRequirement;
}

export interface VerificationResponse {
  isValid: boolean;
  invalidReason: string | null;
}

export interface SettlementRequest {
  x402Version: number;
  paymentHeader: string; // Base64 encoded PaymentPayload
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

// Client SDK types
export interface PaymentOptions {
  wallet?: any; // Wallet adapter
  priorityFee?: number;
  memo?: string;
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// Error types
export class X402Error extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'X402Error';
  }
}

export class SolanaPaymentError extends X402Error {
  constructor(message: string, public solanaError?: any) {
    super(message, 'SOLANA_PAYMENT_ERROR');
  }
}

// Constants
export const X402_VERSION = 1;
export const SOLANA_NETWORKS = {
  MAINNET: 'solana-mainnet',
  DEVNET: 'solana-devnet',
} as const;

export const SOLANA_SCHEMES = {
  TRANSFER: 'solana-transfer',
  SPL: 'solana-spl',
} as const;

export const NATIVE_SOL_MINT = 'SOL';
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
