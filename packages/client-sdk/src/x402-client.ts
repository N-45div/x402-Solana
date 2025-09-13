import axios, { AxiosInstance } from 'axios';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import {
  PaymentRequiredResponse,
  PaymentRequirement,
  SolanaPaymentRequirement,
  PaymentPayload,
  PaymentResult,
  PaymentOptions,
  X402Error,
  SolanaPaymentError,
  encodePaymentPayload,
  toPublicKey,
  toAtomicUnits,
  generateNonce,
  getRpcEndpoint,
  SOLANA_SCHEMES,
} from '@x402-solana/core';

export interface X402ClientOptions {
  facilitatorUrl?: string;
  network?: string;
  timeout?: number;
}

export class X402Client {
  private connection: Connection;
  private facilitatorUrl: string;
  private network: string;
  private httpClient: AxiosInstance;

  constructor(options: X402ClientOptions = {}) {
    this.network = options.network || 'solana-devnet';
    this.facilitatorUrl = options.facilitatorUrl || 'http://localhost:3000';
    
    const rpcEndpoint = getRpcEndpoint(this.network);
    this.connection = new Connection(rpcEndpoint, 'confirmed');

    this.httpClient = axios.create({
      baseURL: this.facilitatorUrl,
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Make a request to a protected resource
   */
  async request(
    url: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: any;
      wallet?: any;
      paymentOptions?: PaymentOptions;
    } = {}
  ): Promise<{
    data?: any;
    headers?: Record<string, string>;
    status: number;
    paymentRequired?: boolean;
    paymentRequirements?: PaymentRequiredResponse;
  }> {
    const { method = 'GET', headers = {}, body, wallet, paymentOptions } = options;

    try {
      // First attempt - make the request without payment
      const response = await axios({
        url,
        method,
        headers,
        data: body,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      if (response.status === 402) {
        // Payment required
        const paymentRequirements: PaymentRequiredResponse = response.data;
        
        if (!wallet) {
          return {
            status: 402,
            paymentRequired: true,
            paymentRequirements,
          };
        }

        // Attempt to make payment and retry
        const paymentResult = await this.makePayment(paymentRequirements, wallet, paymentOptions);
        
        if (!paymentResult.success) {
          throw new X402Error(`Payment failed: ${paymentResult.error}`, 'PAYMENT_FAILED');
        }

        // Retry request with payment header
        const retryResponse = await axios({
          url,
          method,
          headers: {
            ...headers,
            'X-PAYMENT': paymentResult.paymentHeader!,
          },
          data: body,
        });

        return {
          data: retryResponse.data,
          headers: retryResponse.headers as Record<string, string>,
          status: retryResponse.status,
        };
      }

      return {
        data: response.data,
        headers: response.headers as Record<string, string>,
        status: response.status,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new X402Error(`HTTP request failed: ${error.message}`, 'HTTP_ERROR');
      }
      throw error;
    }
  }

  /**
   * Make a payment for given requirements
   */
  async makePayment(
    paymentRequirements: PaymentRequiredResponse,
    wallet: any,
    options: PaymentOptions = { wallet: undefined }
  ): Promise<PaymentResult & { paymentHeader?: string }> {
    try {
      if (!paymentRequirements.accepts || paymentRequirements.accepts.length === 0) {
        throw new X402Error('No payment requirements available', 'NO_PAYMENT_OPTIONS');
      }

      // Find a supported payment requirement
      const requirement = this.selectPaymentRequirement(paymentRequirements.accepts);
      if (!requirement) {
        throw new X402Error('No supported payment schemes found', 'UNSUPPORTED_SCHEMES');
      }

      // Create payment payload based on scheme
      let paymentPayload: PaymentPayload;
      
      if (requirement.scheme === SOLANA_SCHEMES.TRANSFER) {
        paymentPayload = await this.createSOLPayment(requirement, wallet, options);
      } else if (requirement.scheme === SOLANA_SCHEMES.SPL) {
        paymentPayload = await this.createSPLPayment(requirement, wallet, options);
      } else {
        throw new X402Error(`Unsupported payment scheme: ${requirement.scheme}`, 'UNSUPPORTED_SCHEME');
      }

      // Encode payment payload for header
      const paymentHeader = encodePaymentPayload(paymentPayload);

      // Verify payment with facilitator
      const verification = await this.verifyPayment(paymentHeader, requirement);
      if (!verification.isValid) {
        throw new X402Error(`Payment verification failed: ${verification.invalidReason}`, 'VERIFICATION_FAILED');
      }

      return {
        success: true,
        signature: paymentPayload.payload.signature,
        paymentHeader,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create SOL payment payload
   */
  private async createSOLPayment(
    requirement: SolanaPaymentRequirement,
    wallet: any,
    options: PaymentOptions
  ): Promise<PaymentPayload> {
    const walletPublicKey = wallet.publicKey;
    if (!walletPublicKey) {
      throw new X402Error('Wallet not connected', 'WALLET_NOT_CONNECTED');
    }

    const fromPubkey = walletPublicKey;
    const toPubkey = toPublicKey(requirement.payTo);
    const amount = parseFloat(requirement.maxAmountRequired);
    const lamports = toAtomicUnits(amount, 9); // SOL has 9 decimals

    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: Number(lamports),
    });

    const transaction = new Transaction().add(transferInstruction);

    // Add priority fee if specified
    const priorityFee = options.priorityFee || requirement.extra?.priorityFee || 5000;
    if (priorityFee > 0) {
      const priorityFeeInstruction = SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey('11111111111111111111111111111112'), // System program
        lamports: priorityFee,
      });
      transaction.add(priorityFeeInstruction);
    }

    // Add memo if specified
    if (options.memo) {
      // Note: In a real implementation, you'd import and use the memo program
      // For now, we'll skip the memo instruction
    }

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Sign transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    const signature = signedTransaction.signatures[0].signature;
    
    if (!signature) {
      throw new SolanaPaymentError('Failed to sign transaction');
    }

    const signatureBase58 = Buffer.from(signature).toString('base64');

    return {
      x402Version: 1,
      scheme: SOLANA_SCHEMES.TRANSFER,
      network: requirement.network,
      payload: {
        from: fromPubkey.toString(),
        signature: signatureBase58,
        amount: lamports.toString(),
        timestamp: Date.now(),
        nonce: generateNonce(),
      },
    };
  }

  /**
   * Create SPL token payment payload
   */
  private async createSPLPayment(
    requirement: SolanaPaymentRequirement,
    wallet: any,
    options: PaymentOptions
  ): Promise<PaymentPayload> {
    const walletPublicKey = wallet.publicKey;
    if (!walletPublicKey) {
      throw new X402Error('Wallet not connected', 'WALLET_NOT_CONNECTED');
    }

    const fromPubkey = walletPublicKey;
    const toPubkey = toPublicKey(requirement.payTo);
    const mintPubkey = toPublicKey(requirement.asset);
    
    // Get token decimals
    const mintInfo = await this.connection.getParsedAccountInfo(mintPubkey);
    const decimals = mintInfo.value?.data && 'parsed' in mintInfo.value.data 
      ? mintInfo.value.data.parsed.info.decimals 
      : 9;

    const amount = parseFloat(requirement.maxAmountRequired);
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
    const signature = signedTransaction.signatures[0].signature;
    
    if (!signature) {
      throw new SolanaPaymentError('Failed to sign transaction');
    }

    const signatureBase58 = Buffer.from(signature).toString('base64');

    return {
      x402Version: 1,
      scheme: SOLANA_SCHEMES.SPL,
      network: requirement.network,
      payload: {
        from: fromPubkey.toString(),
        signature: signatureBase58,
        amount: atomicAmount.toString(),
        timestamp: Date.now(),
        nonce: generateNonce(),
        mint: requirement.asset,
        fromTokenAccount: fromTokenAccount.toString(),
        toTokenAccount: toTokenAccount.toString(),
      },
    };
  }

  /**
   * Select the best payment requirement from available options
   */
  private selectPaymentRequirement(requirements: PaymentRequirement[]): SolanaPaymentRequirement | null {
    // Filter for Solana requirements on our network
    const solanaRequirements = requirements.filter(
      (req): req is SolanaPaymentRequirement => 
        req.network === this.network && 
        (req.scheme === SOLANA_SCHEMES.TRANSFER || req.scheme === SOLANA_SCHEMES.SPL)
    );

    if (solanaRequirements.length === 0) {
      return null;
    }

    // Prefer SOL transfers over SPL tokens for simplicity
    const solTransfer = solanaRequirements.find(req => req.scheme === SOLANA_SCHEMES.TRANSFER);
    if (solTransfer) {
      return solTransfer;
    }

    // Otherwise, return the first SPL requirement
    return solanaRequirements[0];
  }

  /**
   * Verify payment with facilitator
   */
  private async verifyPayment(
    paymentHeader: string,
    requirement: PaymentRequirement
  ): Promise<{ isValid: boolean; invalidReason?: string }> {
    try {
      const response = await this.httpClient.post('/verify', {
        x402Version: 1,
        paymentHeader,
        paymentRequirements: requirement,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new X402Error(`Verification request failed: ${error.message}`, 'VERIFICATION_REQUEST_FAILED');
      }
      throw error;
    }
  }

  /**
   * Get wallet balance for SOL
   */
  async getSOLBalance(walletAddress: string): Promise<number> {
    try {
      const balance = await this.connection.getBalance(toPublicKey(walletAddress));
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      throw new SolanaPaymentError(`Failed to get SOL balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get wallet balance for SPL token
   */
  async getSPLBalance(walletAddress: string, mint: string): Promise<number> {
    try {
      const walletPubkey = toPublicKey(walletAddress);
      const mintPubkey = toPublicKey(mint);
      const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
      
      const account = await getAccount(this.connection, tokenAccount);
      
      // Get token decimals
      const mintInfo = await this.connection.getParsedAccountInfo(mintPubkey);
      const decimals = mintInfo.value?.data && 'parsed' in mintInfo.value.data 
        ? mintInfo.value.data.parsed.info.decimals 
        : 9;

      return Number(account.amount) / Math.pow(10, decimals);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return 0;
      }
      throw new SolanaPaymentError(`Failed to get SPL balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(requirement: SolanaPaymentRequirement, walletAddress: string): Promise<number> {
    try {
      const fromPubkey = toPublicKey(walletAddress);
      const toPubkey = toPublicKey(requirement.payTo);

      let transaction: Transaction;

      if (requirement.scheme === SOLANA_SCHEMES.TRANSFER) {
        // SOL transfer
        const transferInstruction = SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: 1, // Minimal amount for estimation
        });
        transaction = new Transaction().add(transferInstruction);
      } else {
        // SPL transfer
        const mintPubkey = toPublicKey(requirement.asset);
        const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
        const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

        transaction = new Transaction();

        // Check if recipient token account exists
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

        const transferInstruction = createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromPubkey,
          1, // Minimal amount
          [],
          TOKEN_PROGRAM_ID
        );
        transaction.add(transferInstruction);
      }

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      const fee = await this.connection.getFeeForMessage(transaction.compileMessage());
      return (fee.value || 5000) / LAMPORTS_PER_SOL; // Return in SOL
    } catch (error) {
      // Return default estimate
      return requirement.scheme === SOLANA_SCHEMES.TRANSFER ? 0.000005 : 0.00001; // SOL
    }
  }
}
