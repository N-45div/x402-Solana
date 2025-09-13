import {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import bs58 from 'bs58';
import {
  SolanaPaymentRequirement,
  SolanaSPLPayload,
  PaymentPayload,
  SolanaPaymentError,
  getRpcEndpoint,
  toPublicKey,
  toAtomicUnits,
  generateNonce,
} from '@x402-solana/core';

export class SolanaSPLScheme {
  private connection: Connection;

  constructor(network: string) {
    const rpcEndpoint = getRpcEndpoint(network);
    this.connection = new Connection(rpcEndpoint, 'confirmed');
  }

  /**
   * Creates a payment payload for SPL token transfer
   */
  async createPaymentPayload(
    requirement: SolanaPaymentRequirement,
    fromAddress: string,
    amount: number,
    decimals: number,
    wallet: any
  ): Promise<PaymentPayload> {
    if (requirement.scheme !== 'solana-spl') {
      throw new SolanaPaymentError('Invalid scheme for SPL transfer');
    }

    if (requirement.asset === 'SOL') {
      throw new SolanaPaymentError('SPL scheme cannot use native SOL');
    }

    const fromPubkey = toPublicKey(fromAddress);
    const toPubkey = toPublicKey(requirement.payTo);
    const mintPubkey = toPublicKey(requirement.asset);
    const atomicAmount = toAtomicUnits(amount, decimals);

    // Get associated token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
    const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

    const transaction = new Transaction();

    // Check if recipient token account exists, create if not
    try {
      await getAccount(this.connection, toTokenAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        const createAccountInstruction = createAssociatedTokenAccountInstruction(
          fromPubkey, // payer
          toTokenAccount,
          toPubkey, // owner
          mintPubkey
        );
        transaction.add(createAccountInstruction);
      }
    }

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromPubkey,
      Number(atomicAmount),
      [],
      TOKEN_PROGRAM_ID
    );
    transaction.add(transferInstruction);

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Sign transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = bs58.encode(signedTransaction.signature!);

    const payload: SolanaSPLPayload = {
      from: fromAddress,
      signature,
      amount: atomicAmount.toString(),
      timestamp: Date.now(),
      nonce: generateNonce(),
      mint: requirement.asset,
      fromTokenAccount: fromTokenAccount.toString(),
      toTokenAccount: toTokenAccount.toString(),
    };

    return {
      x402Version: 1,
      scheme: 'solana-spl',
      network: requirement.network,
      payload,
    };
  }

  /**
   * Verifies an SPL token transfer payment payload
   */
  async verifyPayment(
    paymentPayload: PaymentPayload,
    requirement: SolanaPaymentRequirement,
    tokenDecimals: number
  ): Promise<{ isValid: boolean; invalidReason?: string }> {
    try {
      if (paymentPayload.scheme !== 'solana-spl') {
        return { isValid: false, invalidReason: 'Invalid scheme' };
      }

      const payload = paymentPayload.payload as SolanaSPLPayload;

      // Verify signature format
      if (!payload.signature || payload.signature.length < 87) {
        return { isValid: false, invalidReason: 'Invalid signature format' };
      }

      // Verify mint matches requirement
      if (payload.mint !== requirement.asset) {
        return { isValid: false, invalidReason: 'Mint mismatch' };
      }

      // Verify addresses
      const fromPubkey = toPublicKey(payload.from);
      const toPubkey = toPublicKey(requirement.payTo);
      const mintPubkey = toPublicKey(payload.mint);

      // Verify token accounts
      const expectedFromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
      const expectedToTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

      if (payload.fromTokenAccount !== expectedFromTokenAccount.toString()) {
        return { isValid: false, invalidReason: 'Invalid from token account' };
      }

      if (payload.toTokenAccount !== expectedToTokenAccount.toString()) {
        return { isValid: false, invalidReason: 'Invalid to token account' };
      }

      // Verify amount
      const requiredAmount = toAtomicUnits(parseFloat(requirement.maxAmountRequired), tokenDecimals);
      const payloadAmount = BigInt(payload.amount);

      if (payloadAmount < requiredAmount) {
        return { isValid: false, invalidReason: 'Insufficient payment amount' };
      }

      // Verify timestamp (not too old)
      const maxAge = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - payload.timestamp > maxAge) {
        return { isValid: false, invalidReason: 'Payment payload expired' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, invalidReason: `Verification error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Settles an SPL token transfer payment by submitting to blockchain
   */
  async settlePayment(
    paymentPayload: PaymentPayload,
    requirement: SolanaPaymentRequirement,
    tokenDecimals: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const payload = paymentPayload.payload as SolanaSPLPayload;

      // First verify the payment
      const verification = await this.verifyPayment(paymentPayload, requirement, tokenDecimals);
      if (!verification.isValid) {
        return { success: false, error: verification.invalidReason };
      }

      // Check if transaction already exists on chain
      try {
        const txInfo = await this.connection.getTransaction(payload.signature);
        if (txInfo) {
          // Transaction already confirmed
          return { success: true, txHash: payload.signature };
        }
      } catch (error) {
        // Transaction not found, need to submit
      }

      // Reconstruct and submit transaction
      const fromPubkey = toPublicKey(payload.from);
      const toPubkey = toPublicKey(requirement.payTo);
      const mintPubkey = toPublicKey(payload.mint);
      const fromTokenAccount = toPublicKey(payload.fromTokenAccount);
      const toTokenAccount = toPublicKey(payload.toTokenAccount);
      const atomicAmount = BigInt(payload.amount);

      const transaction = new Transaction();

      // Check if recipient token account exists, create if not
      try {
        await getAccount(this.connection, toTokenAccount);
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          const createAccountInstruction = createAssociatedTokenAccountInstruction(
            fromPubkey, // payer
            toTokenAccount,
            toPubkey, // owner
            mintPubkey
          );
          transaction.add(createAccountInstruction);
        }
      }

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        Number(atomicAmount),
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(transferInstruction);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // Submit transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize({ requireAllSignatures: false })
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      return { success: true, txHash: signature };
    } catch (error) {
      return { success: false, error: `Settlement error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Gets token account balance
   */
  async getTokenBalance(tokenAccount: string): Promise<bigint> {
    try {
      const account = await getAccount(this.connection, toPublicKey(tokenAccount));
      return account.amount;
    } catch (error) {
      throw new SolanaPaymentError(`Failed to get token balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets token mint information
   */
  async getTokenMintInfo(mint: string): Promise<{ decimals: number; supply: bigint }> {
    try {
      const mintInfo = await this.connection.getParsedAccountInfo(toPublicKey(mint));
      const data = mintInfo.value?.data;
      
      if (!data || !('parsed' in data)) {
        throw new Error('Invalid mint account');
      }

      const parsed = data.parsed;
      return {
        decimals: parsed.info.decimals,
        supply: BigInt(parsed.info.supply),
      };
    } catch (error) {
      throw new SolanaPaymentError(`Failed to get mint info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimates transaction fee for SPL transfer
   */
  async estimateFee(
    fromAddress: string,
    requirement: SolanaPaymentRequirement
  ): Promise<number> {
    try {
      const fromPubkey = toPublicKey(fromAddress);
      const toPubkey = toPublicKey(requirement.payTo);
      const mintPubkey = toPublicKey(requirement.asset);

      const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
      const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

      const transaction = new Transaction();

      // Check if we need to create recipient token account
      try {
        await getAccount(this.connection, toTokenAccount);
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          const createAccountInstruction = createAssociatedTokenAccountInstruction(
            fromPubkey,
            toTokenAccount,
            toPubkey,
            mintPubkey
          );
          transaction.add(createAccountInstruction);
        }
      }

      // Add transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        1, // Minimal amount for fee estimation
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(transferInstruction);

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const fee = await this.connection.getFeeForMessage(transaction.compileMessage());
      return fee.value || 10000; // Default to 10000 lamports if estimation fails
    } catch (error) {
      return 10000; // Default fee for SPL transfers
    }
  }
}
