"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaSPLScheme = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
const core_1 = require("@x402-solana/core");
class SolanaSPLScheme {
    constructor(network) {
        const rpcEndpoint = (0, core_1.getRpcEndpoint)(network);
        this.connection = new web3_js_1.Connection(rpcEndpoint, 'confirmed');
    }
    /**
     * Creates a payment payload for SPL token transfer
     */
    async createPaymentPayload(requirement, fromAddress, amount, decimals, wallet) {
        if (requirement.scheme !== 'solana-spl') {
            throw new core_1.SolanaPaymentError('Invalid scheme for SPL transfer');
        }
        if (requirement.asset === 'SOL') {
            throw new core_1.SolanaPaymentError('SPL scheme cannot use native SOL');
        }
        const fromPubkey = (0, core_1.toPublicKey)(fromAddress);
        const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
        const mintPubkey = (0, core_1.toPublicKey)(requirement.asset);
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
        const signature = bs58_1.default.encode(signedTransaction.signature);
        const payload = {
            from: fromAddress,
            signature,
            amount: atomicAmount.toString(),
            timestamp: Date.now(),
            nonce: (0, core_1.generateNonce)(),
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
    async verifyPayment(paymentPayload, requirement, tokenDecimals) {
        try {
            if (paymentPayload.scheme !== 'solana-spl') {
                return { isValid: false, invalidReason: 'Invalid scheme' };
            }
            const payload = paymentPayload.payload;
            // Verify signature format
            if (!payload.signature || payload.signature.length < 87) {
                return { isValid: false, invalidReason: 'Invalid signature format' };
            }
            // Verify mint matches requirement
            if (payload.mint !== requirement.asset) {
                return { isValid: false, invalidReason: 'Mint mismatch' };
            }
            // Verify addresses
            const fromPubkey = (0, core_1.toPublicKey)(payload.from);
            const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
            const mintPubkey = (0, core_1.toPublicKey)(payload.mint);
            // Verify token accounts
            const expectedFromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, fromPubkey);
            const expectedToTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, toPubkey);
            if (payload.fromTokenAccount !== expectedFromTokenAccount.toString()) {
                return { isValid: false, invalidReason: 'Invalid from token account' };
            }
            if (payload.toTokenAccount !== expectedToTokenAccount.toString()) {
                return { isValid: false, invalidReason: 'Invalid to token account' };
            }
            // Verify amount
            const requiredAmount = (0, core_1.toAtomicUnits)(parseFloat(requirement.maxAmountRequired), tokenDecimals);
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
        }
        catch (error) {
            return { isValid: false, invalidReason: `Verification error: ${error instanceof Error ? error.message : String(error)}` };
        }
    }
    /**
     * Settles an SPL token transfer payment by submitting to blockchain
     */
    async settlePayment(paymentPayload, requirement, tokenDecimals) {
        try {
            const payload = paymentPayload.payload;
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
            }
            catch (error) {
                // Transaction not found, need to submit
            }
            // Reconstruct and submit transaction
            const fromPubkey = (0, core_1.toPublicKey)(payload.from);
            const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
            const mintPubkey = (0, core_1.toPublicKey)(payload.mint);
            const fromTokenAccount = (0, core_1.toPublicKey)(payload.fromTokenAccount);
            const toTokenAccount = (0, core_1.toPublicKey)(payload.toTokenAccount);
            const atomicAmount = BigInt(payload.amount);
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
            // Submit transaction
            const signature = await this.connection.sendRawTransaction(transaction.serialize({ requireAllSignatures: false }));
            // Wait for confirmation
            await this.connection.confirmTransaction(signature, 'confirmed');
            return { success: true, txHash: signature };
        }
        catch (error) {
            return { success: false, error: `Settlement error: ${error instanceof Error ? error.message : String(error)}` };
        }
    }
    /**
     * Gets token account balance
     */
    async getTokenBalance(tokenAccount) {
        try {
            const account = await (0, spl_token_1.getAccount)(this.connection, (0, core_1.toPublicKey)(tokenAccount));
            return account.amount;
        }
        catch (error) {
            throw new core_1.SolanaPaymentError(`Failed to get token balance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Gets token mint information
     */
    async getTokenMintInfo(mint) {
        try {
            const mintInfo = await this.connection.getParsedAccountInfo((0, core_1.toPublicKey)(mint));
            const data = mintInfo.value?.data;
            if (!data || !('parsed' in data)) {
                throw new Error('Invalid mint account');
            }
            const parsed = data.parsed;
            return {
                decimals: parsed.info.decimals,
                supply: BigInt(parsed.info.supply),
            };
        }
        catch (error) {
            throw new core_1.SolanaPaymentError(`Failed to get mint info: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Estimates transaction fee for SPL transfer
     */
    async estimateFee(fromAddress, requirement) {
        try {
            const fromPubkey = (0, core_1.toPublicKey)(fromAddress);
            const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
            const mintPubkey = (0, core_1.toPublicKey)(requirement.asset);
            const fromTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, fromPubkey);
            const toTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mintPubkey, toPubkey);
            const transaction = new web3_js_1.Transaction();
            // Check if we need to create recipient token account
            try {
                await (0, spl_token_1.getAccount)(this.connection, toTokenAccount);
            }
            catch (error) {
                if (error instanceof spl_token_1.TokenAccountNotFoundError) {
                    const createAccountInstruction = (0, spl_token_1.createAssociatedTokenAccountInstruction)(fromPubkey, toTokenAccount, toPubkey, mintPubkey);
                    transaction.add(createAccountInstruction);
                }
            }
            // Add transfer instruction
            const transferInstruction = (0, spl_token_1.createTransferInstruction)(fromTokenAccount, toTokenAccount, fromPubkey, 1, // Minimal amount for fee estimation
            [], spl_token_1.TOKEN_PROGRAM_ID);
            transaction.add(transferInstruction);
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;
            const fee = await this.connection.getFeeForMessage(transaction.compileMessage());
            return fee.value || 10000; // Default to 10000 lamports if estimation fails
        }
        catch (error) {
            return 10000; // Default fee for SPL transfers
        }
    }
}
exports.SolanaSPLScheme = SolanaSPLScheme;
//# sourceMappingURL=solana-spl.js.map