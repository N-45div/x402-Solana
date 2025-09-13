"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.X402Client = void 0;
const axios_1 = __importDefault(require("axios"));
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const core_1 = require("@x402-solana/core");
class X402Client {
    constructor(options = {}) {
        this.network = options.network || 'solana-devnet';
        this.facilitatorUrl = options.facilitatorUrl || 'http://localhost:3000';
        const rpcEndpoint = (0, core_1.getRpcEndpoint)(this.network);
        this.connection = new web3_js_1.Connection(rpcEndpoint, 'confirmed');
        this.httpClient = axios_1.default.create({
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
    async request(url, options = {}) {
        const { method = 'GET', headers = {}, body, wallet, paymentOptions } = options;
        try {
            // First attempt - make the request without payment
            const response = await (0, axios_1.default)({
                url,
                method,
                headers,
                data: body,
                validateStatus: (status) => status < 500, // Don't throw on 4xx errors
            });
            if (response.status === 402) {
                // Payment required
                const paymentRequirements = response.data;
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
                    throw new core_1.X402Error(`Payment failed: ${paymentResult.error}`, 'PAYMENT_FAILED');
                }
                // Retry request with payment header
                const retryResponse = await (0, axios_1.default)({
                    url,
                    method,
                    headers: {
                        ...headers,
                        'X-PAYMENT': paymentResult.paymentHeader,
                    },
                    data: body,
                });
                return {
                    data: retryResponse.data,
                    headers: retryResponse.headers,
                    status: retryResponse.status,
                };
            }
            return {
                data: response.data,
                headers: response.headers,
                status: response.status,
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new core_1.X402Error(`HTTP request failed: ${error.message}`, 'HTTP_ERROR');
            }
            throw error;
        }
    }
    /**
     * Make a payment for given requirements
     */
    async makePayment(paymentRequirements, wallet, options = { wallet: undefined }) {
        try {
            if (!paymentRequirements.accepts || paymentRequirements.accepts.length === 0) {
                throw new core_1.X402Error('No payment requirements available', 'NO_PAYMENT_OPTIONS');
            }
            // Find a supported payment requirement
            const requirement = this.selectPaymentRequirement(paymentRequirements.accepts);
            if (!requirement) {
                throw new core_1.X402Error('No supported payment schemes found', 'UNSUPPORTED_SCHEMES');
            }
            // Create payment payload based on scheme
            let paymentPayload;
            if (requirement.scheme === core_1.SOLANA_SCHEMES.TRANSFER) {
                paymentPayload = await this.createSOLPayment(requirement, wallet, options);
            }
            else if (requirement.scheme === core_1.SOLANA_SCHEMES.SPL) {
                paymentPayload = await this.createSPLPayment(requirement, wallet, options);
            }
            else {
                throw new core_1.X402Error(`Unsupported payment scheme: ${requirement.scheme}`, 'UNSUPPORTED_SCHEME');
            }
            // Encode payment payload for header
            const paymentHeader = (0, core_1.encodePaymentPayload)(paymentPayload);
            // Verify payment with facilitator
            const verification = await this.verifyPayment(paymentHeader, requirement);
            if (!verification.isValid) {
                throw new core_1.X402Error(`Payment verification failed: ${verification.invalidReason}`, 'VERIFICATION_FAILED');
            }
            return {
                success: true,
                signature: paymentPayload.payload.signature,
                paymentHeader,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Create SOL payment payload
     */
    async createSOLPayment(requirement, wallet, options) {
        const walletPublicKey = wallet.publicKey;
        if (!walletPublicKey) {
            throw new core_1.X402Error('Wallet not connected', 'WALLET_NOT_CONNECTED');
        }
        const fromPubkey = walletPublicKey;
        const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
        const amount = parseFloat(requirement.maxAmountRequired);
        const lamports = (0, core_1.toAtomicUnits)(amount, 9); // SOL has 9 decimals
        // Create transfer instruction
        const transferInstruction = web3_js_1.SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Number(lamports),
        });
        const transaction = new web3_js_1.Transaction().add(transferInstruction);
        // Add priority fee if specified
        const priorityFee = options.priorityFee || requirement.extra?.priorityFee || 5000;
        if (priorityFee > 0) {
            const priorityFeeInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey,
                toPubkey: new web3_js_1.PublicKey('11111111111111111111111111111112'), // System program
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
            throw new core_1.SolanaPaymentError('Failed to sign transaction');
        }
        const signatureBase58 = Buffer.from(signature).toString('base64');
        return {
            x402Version: 1,
            scheme: core_1.SOLANA_SCHEMES.TRANSFER,
            network: requirement.network,
            payload: {
                from: fromPubkey.toString(),
                signature: signatureBase58,
                amount: lamports.toString(),
                timestamp: Date.now(),
                nonce: (0, core_1.generateNonce)(),
            },
        };
    }
    /**
     * Create SPL token payment payload
     */
    async createSPLPayment(requirement, wallet, options) {
        const walletPublicKey = wallet.publicKey;
        if (!walletPublicKey) {
            throw new core_1.X402Error('Wallet not connected', 'WALLET_NOT_CONNECTED');
        }
        const fromPubkey = walletPublicKey;
        const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
        const mintPubkey = (0, core_1.toPublicKey)(requirement.asset);
        // Get token decimals
        const mintInfo = await this.connection.getParsedAccountInfo(mintPubkey);
        const decimals = mintInfo.value?.data && 'parsed' in mintInfo.value.data
            ? mintInfo.value.data.parsed.info.decimals
            : 9;
        const amount = parseFloat(requirement.maxAmountRequired);
        const atomicAmount = (0, core_1.toAtomicUnits)(amount, decimals);
        // Get associated token accounts
        const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, fromPubkey);
        const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, toPubkey);
        const transaction = new web3_js_1.Transaction();
        // Check if recipient token account exists, create if not
        try {
            await (0, spl_token_1.getAccount)(this.connection, toTokenAccount);
        }
        catch (error) {
            if (error instanceof spl_token_1.TokenAccountNotFoundError) {
                const createAccountInstruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(fromPubkey, // payer
                toTokenAccount, toPubkey, // owner
                mintPubkey);
                transaction.add(createAccountInstruction);
            }
        }
        // Create transfer instruction
        const transferInstruction = (0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromPubkey, Number(atomicAmount), [], spl_token_1.TOKEN_PROGRAM_ID);
        transaction.add(transferInstruction);
        // Get recent blockhash
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromPubkey;
        // Sign transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = signedTransaction.signatures[0].signature;
        if (!signature) {
            throw new core_1.SolanaPaymentError('Failed to sign transaction');
        }
        const signatureBase58 = Buffer.from(signature).toString('base64');
        return {
            x402Version: 1,
            scheme: core_1.SOLANA_SCHEMES.SPL,
            network: requirement.network,
            payload: {
                from: fromPubkey.toString(),
                signature: signatureBase58,
                amount: atomicAmount.toString(),
                timestamp: Date.now(),
                nonce: (0, core_1.generateNonce)(),
                mint: requirement.asset,
                fromTokenAccount: fromTokenAccount.toString(),
                toTokenAccount: toTokenAccount.toString(),
            },
        };
    }
    /**
     * Select the best payment requirement from available options
     */
    selectPaymentRequirement(requirements) {
        // Filter for Solana requirements on our network
        const solanaRequirements = requirements.filter((req) => req.network === this.network &&
            (req.scheme === core_1.SOLANA_SCHEMES.TRANSFER || req.scheme === core_1.SOLANA_SCHEMES.SPL));
        if (solanaRequirements.length === 0) {
            return null;
        }
        // Prefer SOL transfers over SPL tokens for simplicity
        const solTransfer = solanaRequirements.find(req => req.scheme === core_1.SOLANA_SCHEMES.TRANSFER);
        if (solTransfer) {
            return solTransfer;
        }
        // Otherwise, return the first SPL requirement
        return solanaRequirements[0];
    }
    /**
     * Verify payment with facilitator
     */
    async verifyPayment(paymentHeader, requirement) {
        try {
            const response = await this.httpClient.post('/verify', {
                x402Version: 1,
                paymentHeader,
                paymentRequirements: requirement,
            });
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                throw new core_1.X402Error(`Verification request failed: ${error.message}`, 'VERIFICATION_REQUEST_FAILED');
            }
            throw error;
        }
    }
    /**
     * Get wallet balance for SOL
     */
    async getSOLBalance(walletAddress) {
        try {
            const balance = await this.connection.getBalance((0, core_1.toPublicKey)(walletAddress));
            return balance / web3_js_1.LAMPORTS_PER_SOL;
        }
        catch (error) {
            throw new core_1.SolanaPaymentError(`Failed to get SOL balance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get wallet balance for SPL token
     */
    async getSPLBalance(walletAddress, mint) {
        try {
            const walletPubkey = (0, core_1.toPublicKey)(walletAddress);
            const mintPubkey = (0, core_1.toPublicKey)(mint);
            const tokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, walletPubkey);
            const account = await (0, spl_token_1.getAccount)(this.connection, tokenAccount);
            // Get token decimals
            const mintInfo = await this.connection.getParsedAccountInfo(mintPubkey);
            const decimals = mintInfo.value?.data && 'parsed' in mintInfo.value.data
                ? mintInfo.value.data.parsed.info.decimals
                : 9;
            return Number(account.amount) / Math.pow(10, decimals);
        }
        catch (error) {
            if (error instanceof spl_token_1.TokenAccountNotFoundError) {
                return 0;
            }
            throw new core_1.SolanaPaymentError(`Failed to get SPL balance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Estimate transaction fee
     */
    async estimateFee(requirement, walletAddress) {
        try {
            const fromPubkey = (0, core_1.toPublicKey)(walletAddress);
            const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
            let transaction;
            if (requirement.scheme === core_1.SOLANA_SCHEMES.TRANSFER) {
                // SOL transfer
                const transferInstruction = web3_js_1.SystemProgram.transfer({
                    fromPubkey,
                    toPubkey,
                    lamports: 1, // Minimal amount for estimation
                });
                transaction = new web3_js_1.Transaction().add(transferInstruction);
            }
            else {
                // SPL transfer
                const mintPubkey = (0, core_1.toPublicKey)(requirement.asset);
                const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, fromPubkey);
                const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, toPubkey);
                transaction = new web3_js_1.Transaction();
                // Check if recipient token account exists
                try {
                    await (0, spl_token_1.getAccount)(this.connection, toTokenAccount);
                }
                catch (error) {
                    if (error instanceof spl_token_1.TokenAccountNotFoundError) {
                        const createAccountInstruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(fromPubkey, toTokenAccount, toPubkey, mintPubkey);
                        transaction.add(createAccountInstruction);
                    }
                }
                const transferInstruction = (0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromPubkey, 1, // Minimal amount
                [], spl_token_1.TOKEN_PROGRAM_ID);
                transaction.add(transferInstruction);
            }
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;
            const fee = await this.connection.getFeeForMessage(transaction.compileMessage());
            return (fee.value || 5000) / web3_js_1.LAMPORTS_PER_SOL; // Return in SOL
        }
        catch (error) {
            // Return default estimate
            return requirement.scheme === core_1.SOLANA_SCHEMES.TRANSFER ? 0.000005 : 0.00001; // SOL
        }
    }
}
exports.X402Client = X402Client;
//# sourceMappingURL=x402-client.js.map