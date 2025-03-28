import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { http, createWalletClient, Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, kaia, kairos } from "viem/chains";

import { USDC, erc20 } from "@goat-sdk/plugin-erc20";

import { getOnChainTools } from "@goat-sdk/adapter-model-context-protocol";
import { sendETH } from "@goat-sdk/wallet-evm";
import { viem } from "@goat-sdk/wallet-viem";

// 1. Create the wallet client
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

// Define Kaia chain configuration
const kaiaChain = {
    id: 8217, // Kaia chain ID
    name: 'Kaia',
    nativeCurrency: {
        decimals: 18,
        name: 'KAIA',
        symbol: 'KAIA',
    },
    rpcUrls: {
        default: {
            http: [process.env.RPC_PROVIDER_URL || 'https://rpc.kaiachain.dev'],
        },
        public: {
            http: [process.env.RPC_PROVIDER_URL || 'https://rpc.kaiachain.dev'],
        },
    },
} as const satisfies Chain;

// Update wallet client to use Kaia chain
const walletClient = createWalletClient({
    account: account,
    //FOR MAINNET: CHANGE THIS TO THE RPC PROVIDER URL FOR MAINNET AND chain: kairos to chain: kaia
    transport: http("https://public-en-kairos.node.kaia.io" ),
    chain: kairos
});

// 2. Get the onchain tools for the wallet
const toolsPromise = getOnChainTools({
    wallet: viem(walletClient),
    plugins: [sendETH(), erc20({ tokens: [USDC] })],
});

// 3. Create and configure the server
const server = new Server(
    {
        name: "goat-evm",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const { listOfTools } = await toolsPromise;
    return {
        tools: listOfTools(),
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { toolHandler } = await toolsPromise;
    try {
        return toolHandler(request.params.name, request.params.arguments);
    } catch (error) {
        throw new Error(`Tool ${request.params.name} failed: ${error}`);
    }
});

// 4. Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GOAT MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
