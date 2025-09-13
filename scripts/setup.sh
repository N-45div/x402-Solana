#!/bin/bash

# x402 Solana Setup Script
echo "🚀 Setting up x402 Solana Protocol..."

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required (found v$NODE_VERSION)"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed"
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check Solana CLI (optional)
if command -v solana &> /dev/null; then
    echo "✅ Solana CLI $(solana --version)"
else
    echo "⚠️  Solana CLI not found (optional for development)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build packages
echo "🔨 Building packages..."
npm run build

# Setup environment files
echo "⚙️  Setting up environment files..."

# Facilitator environment
if [ ! -f "packages/facilitator/.env" ]; then
    cp packages/facilitator/.env.example packages/facilitator/.env
    echo "✅ Created facilitator .env file"
else
    echo "✅ Facilitator .env file already exists"
fi

# Create example environment for resource server
cat > packages/examples/resource-server/.env << EOF
PORT=4000
PAYMENT_ADDRESS=YourSolanaAddressHere
FACILITATOR_URL=http://localhost:3000
EOF
echo "✅ Created resource server .env file"

# Create example environment for client demo
cat > packages/examples/client-demo/.env << EOF
FACILITATOR_URL=http://localhost:3000
RESOURCE_SERVER_URL=http://localhost:4000
EOF
echo "✅ Created client demo .env file"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update PAYMENT_ADDRESS in packages/examples/resource-server/.env"
echo "2. Start the facilitator: npm run start:facilitator"
echo "3. Start the example server: npm run start:example"
echo "4. Test the payment flow: npm run test:payment"
echo ""
echo "📚 Documentation:"
echo "- Quick Start: docs/quickstart.md"
echo "- Examples: packages/examples/"
echo ""
echo "💡 For testing with real payments:"
echo "- Get devnet SOL: solana airdrop 1 <address> --url devnet"
echo "- Update your payment address in the .env files"
