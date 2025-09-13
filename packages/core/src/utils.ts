import { PublicKey } from '@solana/web3.js';
import { PaymentPayload, SolanaPaymentRequirement, X402Error } from './types';

/**
 * Validates a Solana address string
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a base58 string to PublicKey
 */
export function toPublicKey(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch (error) {
    throw new X402Error(`Invalid Solana address: ${address}`, 'INVALID_ADDRESS');
  }
}

/**
 * Encodes payment payload to base64 for X-PAYMENT header
 */
export function encodePaymentPayload(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decodes payment payload from base64 X-PAYMENT header
 */
export function decodePaymentPayload(encoded: string): PaymentPayload {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new X402Error('Invalid payment payload encoding', 'INVALID_PAYLOAD');
  }
}

/**
 * Validates payment requirement structure
 */
export function validatePaymentRequirement(requirement: SolanaPaymentRequirement): void {
  if (!requirement.scheme || !['solana-transfer', 'solana-spl'].includes(requirement.scheme)) {
    throw new X402Error('Invalid or missing scheme', 'INVALID_SCHEME');
  }

  if (!requirement.network || !requirement.network.startsWith('solana-')) {
    throw new X402Error('Invalid or missing network', 'INVALID_NETWORK');
  }

  if (!requirement.payTo || !isValidSolanaAddress(requirement.payTo)) {
    throw new X402Error('Invalid payTo address', 'INVALID_PAY_TO');
  }

  if (!requirement.asset) {
    throw new X402Error('Missing asset specification', 'MISSING_ASSET');
  }

  if (requirement.scheme === 'solana-spl' && requirement.asset === 'SOL') {
    throw new X402Error('SPL scheme cannot use native SOL', 'INVALID_ASSET_SCHEME');
  }

  if (requirement.scheme === 'solana-transfer' && requirement.asset !== 'SOL') {
    throw new X402Error('Transfer scheme must use native SOL', 'INVALID_ASSET_SCHEME');
  }

  const amount = parseFloat(requirement.maxAmountRequired);
  if (isNaN(amount) || amount <= 0) {
    throw new X402Error('Invalid maxAmountRequired', 'INVALID_AMOUNT');
  }
}

/**
 * Converts human-readable amount to atomic units
 */
export function toAtomicUnits(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

/**
 * Converts atomic units to human-readable amount
 */
export function fromAtomicUnits(atomicAmount: bigint, decimals: number): number {
  return Number(atomicAmount) / Math.pow(10, decimals);
}

/**
 * Gets the appropriate RPC endpoint for a network
 */
export function getRpcEndpoint(network: string): string {
  switch (network) {
    case 'solana-mainnet':
      return process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
    case 'solana-devnet':
      return process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';
    default:
      throw new X402Error(`Unsupported network: ${network}`, 'UNSUPPORTED_NETWORK');
  }
}

/**
 * Creates a payment requirement for SOL transfers
 */
export function createSolTransferRequirement(
  payTo: string,
  amount: string,
  resource: string,
  description: string,
  network: 'solana-mainnet' | 'solana-devnet' = 'solana-devnet'
): SolanaPaymentRequirement {
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
export function createSplTransferRequirement(
  payTo: string,
  amount: string,
  mint: string,
  resource: string,
  description: string,
  network: 'solana-mainnet' | 'solana-devnet' = 'solana-devnet'
): SolanaPaymentRequirement {
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
export function generateNonce(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2);
}

/**
 * Validates transaction signature format
 */
export function isValidSignature(signature: string): boolean {
  try {
    // Solana signatures are base58 encoded and typically 87-88 characters
    return signature.length >= 87 && signature.length <= 88;
  } catch {
    return false;
  }
}
