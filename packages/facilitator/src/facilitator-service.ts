import { Logger } from 'winston';
import {
  PaymentRequirement,
  SolanaPaymentRequirement,
  VerificationResponse,
  SettlementResponse,
  SupportedSchemesResponse,
  SupportedScheme,
  PaymentPayload,
  decodePaymentPayload,
  X402Error,
  SOLANA_NETWORKS,
  SOLANA_SCHEMES,
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
} from '@x402-solana/core';
import { SolanaTransferScheme, SolanaSPLScheme } from '@x402-solana/solana-scheme';

export class FacilitatorService {
  private transferSchemes: Map<string, SolanaTransferScheme> = new Map();
  private splSchemes: Map<string, SolanaSPLScheme> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeSchemes();
  }

  private initializeSchemes() {
    // Initialize transfer schemes for each network
    Object.values(SOLANA_NETWORKS).forEach(network => {
      this.transferSchemes.set(network, new SolanaTransferScheme(network));
      this.splSchemes.set(network, new SolanaSPLScheme(network));
    });

    this.logger.info('Initialized Solana payment schemes for all networks');
  }

  /**
   * Get supported payment schemes and networks
   */
  async getSupportedSchemes(): Promise<SupportedSchemesResponse> {
    const kinds: SupportedScheme[] = [];

    // Add all combinations of schemes and networks
    Object.values(SOLANA_NETWORKS).forEach(network => {
      Object.values(SOLANA_SCHEMES).forEach(scheme => {
        kinds.push({ scheme, network });
      });
    });

    return { kinds };
  }

  /**
   * Verify a payment payload
   */
  async verifyPayment(
    x402Version: number,
    paymentHeader: string,
    paymentRequirements: PaymentRequirement
  ): Promise<VerificationResponse> {
    try {
      // Validate x402 version
      if (x402Version !== 1) {
        return {
          isValid: false,
          invalidReason: `Unsupported x402 version: ${x402Version}`
        };
      }

      // Decode payment payload
      const paymentPayload = decodePaymentPayload(paymentHeader);
      const solanaRequirement = paymentRequirements as SolanaPaymentRequirement;

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
      if (paymentPayload.scheme === SOLANA_SCHEMES.TRANSFER) {
        return await this.verifyTransferPayment(paymentPayload, solanaRequirement);
      } else if (paymentPayload.scheme === SOLANA_SCHEMES.SPL) {
        return await this.verifySPLPayment(paymentPayload, solanaRequirement);
      } else {
        return {
          isValid: false,
          invalidReason: `Unsupported payment scheme: ${paymentPayload.scheme}`
        };
      }
    } catch (error) {
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
  async settlePayment(
    x402Version: number,
    paymentHeader: string,
    paymentRequirements: PaymentRequirement
  ): Promise<SettlementResponse> {
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
      const paymentPayload = decodePaymentPayload(paymentHeader);
      const solanaRequirement = paymentRequirements as SolanaPaymentRequirement;

      // Route to appropriate scheme handler
      if (paymentPayload.scheme === SOLANA_SCHEMES.TRANSFER) {
        return await this.settleTransferPayment(paymentPayload, solanaRequirement);
      } else if (paymentPayload.scheme === SOLANA_SCHEMES.SPL) {
        return await this.settleSPLPayment(paymentPayload, solanaRequirement);
      } else {
        return {
          success: false,
          error: `Unsupported payment scheme: ${paymentPayload.scheme}`,
          txHash: null,
          networkId: null
        };
      }
    } catch (error) {
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
  async getTransactionStatus(signature: string, network: string): Promise<{
    confirmed: boolean;
    confirmations?: number;
    error?: string;
  }> {
    try {
      const transferScheme = this.transferSchemes.get(network);
      if (!transferScheme) {
        throw new Error(`Unsupported network: ${network}`);
      }

      return await transferScheme.getTransactionStatus(signature);
    } catch (error) {
      this.logger.error('Transaction status error:', error);
      return {
        confirmed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async verifyTransferPayment(
    paymentPayload: PaymentPayload,
    requirement: SolanaPaymentRequirement
  ): Promise<VerificationResponse> {
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

  private async verifySPLPayment(
    paymentPayload: PaymentPayload,
    requirement: SolanaPaymentRequirement
  ): Promise<VerificationResponse> {
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

  private async settleTransferPayment(
    paymentPayload: PaymentPayload,
    requirement: SolanaPaymentRequirement
  ): Promise<SettlementResponse> {
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

  private async settleSPLPayment(
    paymentPayload: PaymentPayload,
    requirement: SolanaPaymentRequirement
  ): Promise<SettlementResponse> {
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

  private async getTokenDecimals(mint: string, network: string): Promise<number> {
    // Handle common tokens
    if (mint === USDC_MINT_MAINNET || mint === USDC_MINT_DEVNET) {
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
    } catch (error) {
      this.logger.warn(`Failed to get token decimals for ${mint}, defaulting to 9:`, error);
      return 9; // Default to 9 decimals
    }
  }
}
