"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaTransferScheme = void 0;
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const core_1 = require("@x402-solana/core");
class SolanaTransferScheme {
    constructor(network) {
        const rpcEndpoint = (0, core_1.getRpcEndpoint)(network);
        this.connection = new web3_js_1.Connection(rpcEndpoint, 'confirmed');
    }
    /**
     * Creates a payment payload for SOL transfer
     */
    async createPaymentPayload(requirement, fromAddress, amount, wallet) {
        if (requirement.scheme !== 'solana-transfer') {
            throw new core_1.SolanaPaymentError('Invalid scheme for SOL transfer');
        }
        if (requirement.asset !== 'SOL') {
            throw new core_1.SolanaPaymentError('SOL transfer scheme requires SOL asset');
        }
        const fromPubkey = (0, core_1.toPublicKey)(fromAddress);
        const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
        const lamports = (0, core_1.toAtomicUnits)(amount, 9); // SOL has 9 decimals
        // Create transfer instruction
        const transferInstruction = web3_js_1.SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Number(lamports),
        });
        // Create transaction
        const transaction = new web3_js_1.Transaction().add(transferInstruction);
        // Add priority fee if specified
        if (requirement.extra?.priorityFee) {
            const priorityFeeInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey,
                toPubkey: new web3_js_1.PublicKey('11111111111111111111111111111112'), // System program
                lamports: requirement.extra.priorityFee,
            });
            transaction.add(priorityFeeInstruction);
        }
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
            amount: lamports.toString(),
            timestamp: Date.now(),
            nonce: (0, core_1.generateNonce)(),
        };
        return {
            x402Version: 1,
            scheme: 'solana-transfer',
            network: requirement.network,
            payload,
        };
    }
    /**
     * Verifies a SOL transfer payment payload
     */
    async verifyPayment(paymentPayload, requirement) {
        try {
            if (paymentPayload.scheme !== 'solana-transfer') {
                return { isValid: false, invalidReason: 'Invalid scheme' };
            }
            const payload = paymentPayload.payload;
            // Verify signature format
            if (!payload.signature || payload.signature.length < 87) {
                return { isValid: false, invalidReason: 'Invalid signature format' };
            }
            // Verify addresses
            const fromPubkey = (0, core_1.toPublicKey)(payload.from);
            const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
            // Verify amount
            const requiredAmount = (0, core_1.toAtomicUnits)(parseFloat(requirement.maxAmountRequired), 9);
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
     * Settles a SOL transfer payment by submitting to blockchain
     */
    async settlePayment(paymentPayload, requirement) {
        try {
            const payload = paymentPayload.payload;
            // First verify the payment
            const verification = await this.verifyPayment(paymentPayload, requirement);
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
            const lamports = BigInt(payload.amount);
            const transferInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: Number(lamports),
            });
            const transaction = new web3_js_1.Transaction().add(transferInstruction);
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
     * Gets transaction status
     */
    async getTransactionStatus(signature) {
        try {
            const status = await this.connection.getSignatureStatus(signature);
            if (status.value?.err) {
                return { confirmed: false, error: 'Transaction failed' };
            }
            return {
                confirmed: status.value?.confirmationStatus === 'confirmed' ||
                    status.value?.confirmationStatus === 'finalized',
                confirmations: status.value?.confirmations || 0,
            };
        }
        catch (error) {
            return { confirmed: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    /**
     * Estimates transaction fee
     */
    async estimateFee(fromAddress, requirement) {
        try {
            const fromPubkey = (0, core_1.toPublicKey)(fromAddress);
            const toPubkey = (0, core_1.toPublicKey)(requirement.payTo);
            const transferInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: 1, // Minimal amount for fee estimation
            });
            const transaction = new web3_js_1.Transaction().add(transferInstruction);
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;
            const fee = await this.connection.getFeeForMessage(transaction.compileMessage());
            return fee.value || 5000; // Default to 5000 lamports if estimation fails
        }
        catch (error) {
            return 5000; // Default fee
        }
    }
}
exports.SolanaTransferScheme = SolanaTransferScheme;
//# sourceMappingURL=solana-transfer.js.map