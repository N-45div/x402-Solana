"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const client_sdk_1 = require("@x402-solana/client-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Mock wallet adapter for testing
class MockWallet {
    constructor(keypair) {
        this.keypair = keypair;
        this.publicKey = keypair.publicKey;
    }
    async signTransaction(transaction) {
        transaction.partialSign(this.keypair);
        return transaction;
    }
}
async function testPayment() {
    console.log('🧪 Testing x402 Solana Payment Flow\n');
    // Use a fixed test wallet so we can fund it consistently
    const fs = require('fs');
    let testKeypair;
    try {
        // Try to load existing test wallet
        const walletData = JSON.parse(fs.readFileSync('test-wallet.json', 'utf8'));
        testKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(walletData));
    }
    catch {
        // Generate new wallet if file doesn't exist
        testKeypair = web3_js_1.Keypair.generate();
        fs.writeFileSync('test-wallet.json', JSON.stringify(Array.from(testKeypair.secretKey)));
    }
    const wallet = new MockWallet(testKeypair);
    console.log(`📝 Test wallet address: ${wallet.publicKey.toString()}`);
    // Initialize x402 client
    const client = new client_sdk_1.X402Client({
        facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3000',
        network: 'solana-devnet',
        timeout: 30000
    });
    const resourceServerUrl = process.env.RESOURCE_SERVER_URL || 'http://localhost:4000';
    try {
        // Test 1: Free endpoint (should work without payment)
        console.log('\n🆓 Testing free endpoint...');
        const freeResponse = await client.request(`${resourceServerUrl}/free-data`);
        console.log('✅ Free endpoint response:', freeResponse.status);
        console.log('📄 Data:', JSON.stringify(freeResponse.data, null, 2));
        // Test 2: Paid endpoint without wallet (should return 402)
        console.log('\n💰 Testing paid endpoint without payment...');
        const paidResponse = await client.request(`${resourceServerUrl}/api/market-data`);
        if (paidResponse.status === 402) {
            console.log('✅ Correctly received 402 Payment Required');
            console.log('💳 Payment requirements:', JSON.stringify(paidResponse.paymentRequirements, null, 2));
        }
        else {
            console.log('❌ Expected 402 but got:', paidResponse.status);
        }
        // Test 3: Check wallet balance (will be 0 for new wallet)
        console.log('\n💰 Checking wallet balance...');
        const solBalance = await client.getSOLBalance(wallet.publicKey.toString());
        console.log(`💎 SOL Balance: ${solBalance} SOL`);
        if (solBalance === 0) {
            console.log('\n⚠️  Wallet has no SOL for testing payments');
            console.log('💡 To test actual payments:');
            console.log('   1. Fund this wallet with devnet SOL');
            console.log('   2. Use: solana airdrop 1 ' + wallet.publicKey.toString() + ' --url devnet');
            console.log('   3. Run this test again');
            return;
        }
        // Test 4: Attempt payment (will fail without funds but shows the flow)
        console.log('\n💳 Testing payment flow...');
        const paymentResponse = await client.request(`${resourceServerUrl}/api/market-data`, {
            wallet,
            paymentOptions: {
                wallet,
                priorityFee: 5000,
                memo: 'x402 test payment'
            }
        });
        if (paymentResponse.status === 200) {
            console.log('✅ Payment successful!');
            console.log('📄 Premium data:', JSON.stringify(paymentResponse.data, null, 2));
            console.log('🧾 Payment response headers:', paymentResponse.headers?.['x-payment-response']);
        }
        else {
            console.log('❌ Payment failed with status:', paymentResponse.status);
        }
    }
    catch (error) {
        console.error('❌ Test error:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.message.includes('insufficient funds')) {
            console.log('\n💡 This is expected for a new wallet. Fund the wallet to test payments.');
        }
    }
    console.log('\n🏁 Test completed');
}
// Test different endpoints
async function testAllEndpoints() {
    console.log('🧪 Testing All x402 Endpoints\n');
    const client = new client_sdk_1.X402Client({
        facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:3000',
        network: 'solana-devnet'
    });
    const resourceServerUrl = process.env.RESOURCE_SERVER_URL || 'http://localhost:4000';
    const endpoints = [
        { path: '/free-data', name: 'Free Data', requiresPayment: false },
        { path: '/api/market-data', name: 'Market Data', requiresPayment: true, cost: '0.01 SOL/USDC' },
        { path: '/api/premium-feed', name: 'Premium Feed', requiresPayment: true, cost: '0.1 SOL/USDC' },
        { path: '/api/sol-only', name: 'SOL Only', requiresPayment: true, cost: '0.02 SOL' },
        { path: '/api/usdc-only', name: 'USDC Only', requiresPayment: true, cost: '0.03 USDC' }
    ];
    for (const endpoint of endpoints) {
        console.log(`\n📡 Testing ${endpoint.name} (${endpoint.path})`);
        console.log(`💰 Cost: ${endpoint.requiresPayment ? endpoint.cost : 'Free'}`);
        try {
            const response = await client.request(`${resourceServerUrl}${endpoint.path}`);
            if (response.status === 200) {
                console.log('✅ Success - Got data');
            }
            else if (response.status === 402) {
                console.log('💳 Payment Required');
                console.log(`📋 Accepts: ${response.paymentRequirements?.accepts?.length || 0} payment methods`);
                // Show payment options
                response.paymentRequirements?.accepts?.forEach((req, i) => {
                    console.log(`   ${i + 1}. ${req.scheme} on ${req.network} - ${req.maxAmountRequired} ${req.asset}`);
                });
            }
            else {
                console.log(`❌ Unexpected status: ${response.status}`);
            }
        }
        catch (error) {
            console.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
// Run tests
if (require.main === module) {
    const testType = process.argv[2] || 'payment';
    if (testType === 'endpoints') {
        testAllEndpoints();
    }
    else {
        testPayment();
    }
}
//# sourceMappingURL=test-payment.js.map