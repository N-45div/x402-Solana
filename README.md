# x402 Protocol for Solana

A comprehensive implementation of the x402 HTTP payment protocol adapted for the Solana blockchain. This project extends the x402 standard to support Solana's unique transaction model and SPL tokens.

## Overview

The x402 protocol is an HTTP-based payment standard that enables services to charge for access to their APIs and content directly over HTTP using the 402 Payment Required status code. While the original x402 protocol was designed for EVM chains using ERC-3009, this implementation adapts it for Solana's architecture.

## Key Features

- **Solana Native**: Built specifically for Solana's transaction model
- **SPL Token Support**: Works with any SPL token (USDC, SOL, custom tokens)
- **Gasless Payments**: Uses Solana's fee delegation for seamless UX
- **HTTP Compatible**: Maintains x402 protocol standards
- **AI Agent Ready**: Perfect for autonomous payments by AI agents

## Architecture

flowchart LR
  C[Client\n(Web/Agent)] --> R[Resource Server\n(Your API)]
  R --> F[Facilitator Server\n(Solana)]
  F --> R
  R --> C

## Project Structure

```
x402-Solana/
├── packages/
│   ├── core/              # Core x402 types and utilities
│   ├── solana-scheme/     # Solana payment scheme implementation
│   ├── facilitator/       # Facilitator server for Solana
│   ├── client-sdk/        # Client SDK for payments
│   └── examples/          # Example implementations
├── programs/              # Solana programs (smart contracts)
├── docs/                  # Documentation
└── scripts/               # Deployment and utility scripts
```

## Quick Start

### Prerequisites

- Node.js 18+
- Rust and Solana CLI (CLI optional for basic testing)
- Solana wallet with SOL for testing (Devnet)

### Installation

```bash
git clone https://github.com/N-45div/x402-Solana
cd x402-Solana
npm install
# one-shot setup (installs + builds)
./scripts/setup.sh

# or manually
npm run build
```

### Run Example

```bash
# Start facilitator server
npm run start:facilitator

# Start example resource server
npm run start:example

# Set your payment address (receiver) for the resource server
# Edit: packages/examples/resource-server/.env
# Example:
# PAYMENT_ADDRESS=YourSolanaAddressHere

# (Optional) Test scripts & examples
npm run test:payment            # end-to-end payment flow with a wallet
npm run test:payment endpoints  # just lists 402 payment requirements
```

### Verify the 402 Flow (no wallet required)

You can hit a protected endpoint directly and see the x402-compliant 402 response:

```bash
curl -s http://localhost:4000/api/market-data | python3 -m json.tool
```

You should see a response with `accepts` that includes:
- `scheme`: `solana-transfer` (SOL) and/or `solana-spl` (USDC)
- `network`: `solana-devnet`
- `payTo`: your configured `PAYMENT_ADDRESS`
- `maxAmountRequired`: e.g., `0.01`

### Make a Real Payment (Devnet)

The `npm run test:payment` script uses a persistent test wallet at the repo root (`test-wallet.json`). Fund it and re-run:

```bash
# Show the test wallet pubkey (will also be printed by the script)
node -e "console.log(require('fs').existsSync('test-wallet.json') ? 'Wallet file exists' : 'Run npm run test:payment once to generate')"

# Fund wallet (replace <PUBKEY> with the address printed by the script)
solana airdrop 1 <PUBKEY> --url devnet

# Re-run payment test (will attempt to pay and access premium data)
npm run test:payment
```

## Payment Flow

1. **Client Request**: Client requests a protected resource
2. **Payment Required**: Server responds with 402 and payment requirements
3. **Payment Preparation**: Client prepares Solana transaction
4. **Payment Submission**: Client submits payment via X-PAYMENT header
5. **Verification**: Facilitator verifies the transaction
6. **Settlement**: Payment is settled on Solana
7. **Resource Delivery**: Server delivers the requested resource

## Solana-Specific Features

### Fee Delegation
- Facilitator can pay transaction fees for seamless UX
- Clients only need to sign, not pay gas

### SPL Token Support
- Native support for USDC, SOL, and custom SPL tokens
- Automatic token account creation when needed

### Transaction Optimization
- Batched operations for efficiency
- Priority fee handling for fast confirmation

## Troubleshooting

- Payment test says "insufficient funds"
  - Fund the test wallet shown by `npm run test:payment` using `solana airdrop 1 <PUBKEY> --url devnet`.

- `402 Payment Required` keeps appearing
  - This is expected until a valid payment is made and included. Use the SDK or the `npm run test:payment` script to perform the payment, then retry the request with the `X-Payment` header automatically handled by the client SDK.

- Facilitator fails to start `EADDRINUSE: 3000`
  - Another instance is running. Stop it or use a different port.

- Resource server shows `Payment address: YourSolanaAddressHere`
  - Set `PAYMENT_ADDRESS` in `packages/examples/resource-server/.env` to your Solana address and restart the server.

## License

MIT License - see [LICENSE](./LICENSE) for details.
