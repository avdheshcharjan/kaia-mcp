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
import { Packages } from "@kaiachain/kaia-agent-kit";
// Create wallet using ethers
import { JsonRpcProvider, Wallet, Contract, Network } from "ethers";

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

// Create Kaia wallet for web3 services
const kairosRpcUrl = "https://public-en-kairos.node.kaia.io";
// Create wallet using ethers with proper network configuration
const kairosNetwork = new Network("kairos", 1001);
const provider = new JsonRpcProvider(kairosRpcUrl, kairosNetwork);
const kaiaWallet = new Wallet(process.env.WALLET_PRIVATE_KEY as string, provider);

// 2. Get the onchain tools for the wallet
const toolsPromise = getOnChainTools({
    wallet: viem(walletClient),
    plugins: [sendETH(), erc20({ tokens: [USDC] })],
});

// Standard ERC20 ABI for token transfers
const erc20Abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

// Standard ERC721 ABI for NFT transfers
const erc721Abi = [
    "function safeTransferFrom(address from, address to, uint256 tokenId) external",
    "function transferFrom(address from, address to, uint256 tokenId) external",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function approve(address to, uint256 tokenId) external"
];

// Standard ERC1155 ABI for token transfers
const erc1155Abi = [
    "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external",
    "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data) external",
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function isApprovedForAll(address account, address operator) view returns (bool)",
    "function setApprovalForAll(address operator, bool approved) external"
];

// Define tool type
interface Tool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
    };
}

// Define Kaia web3 tools
const kaiaTools: Record<string, Tool> = {
    transfer_erc20: {
        name: "transfer_erc20",
        description: "Transfer ERC20 tokens to an address",
        inputSchema: {
            type: "object",
            properties: {
                to: { type: "string", description: "Recipient address" },
                token: { type: "string", description: "Token contract address" },
                amount: { type: "string", description: "Amount to transfer" },
            },
            required: ["to", "token", "amount"],
        }
    },
    transfer_erc721: {
        name: "transfer_erc721",
        description: "Transfer ERC721 token (NFT) to an address",
        inputSchema: {
            type: "object",
            properties: {
                to: { type: "string", description: "Recipient address" },
                token: { type: "string", description: "NFT contract address" },
                tokenId: { type: "string", description: "Token ID to transfer" },
            },
            required: ["to", "token", "tokenId"],
        }
    },
    transfer_erc1155: {
        name: "transfer_erc1155",
        description: "Transfer ERC1155 token to an address",
        inputSchema: {
            type: "object",
            properties: {
                to: { type: "string", description: "Recipient address" },
                token: { type: "string", description: "Token contract address" },
                tokenId: { type: "string", description: "Token ID to transfer" },
                amount: { type: "string", description: "Amount to transfer" },
            },
            required: ["to", "token", "tokenId", "amount"],
        }
    },
    transfer_native_token: {
        name: "transfer_native_token",
        description: "Transfer native KAIA tokens to an address",
        inputSchema: {
            type: "object",
            properties: {
                to: { type: "string", description: "Recipient address" },
                amount: { type: "string", description: "Amount to transfer in KAIA" },
            },
            required: ["to", "amount"],
        }
    },
    transfer_faucet: {
        name: "transfer_faucet",
        description: "Request test KAIA tokens from faucet",
        inputSchema: {
            type: "object",
            properties: {
                receiver: { type: "string", description: "Address to receive test tokens" },
                amount: { type: "string", description: "Amount of KAIA tokens to receive (default: 1)" },
            },
            required: ["receiver"],
        }
    }
};

// 3. Create and configure the server
const server = new Server(
    {
        name: "kaia-mcp",
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
    const tools = listOfTools();
    
    // Add kaia web3 tools to the list
    Object.keys(kaiaTools).forEach(tool => {
        tools.push(kaiaTools[tool] as any);
    });
    
    return { tools };
});

// Helper function to format tool responses
function formatToolResponse(message: string, details?: Record<string, any>) {
    return {
        content: [
            {
                type: "text",
                text: message
            }
        ],
        ...details
    };
}

// Helper function to ensure address is a valid hex address (no ENS)
function ensureHexAddress(address: string): string {
    // If it looks like a hex address (0x followed by hex chars), return as is
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
        return address;
    }
    throw new Error(`Invalid address format: ${address}. Must be a valid hex address.`);
}

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { toolHandler } = await toolsPromise;
    
    try {
        // Handle kaia-agent-kit web3 functions
        if (request.params.name === "transfer_erc20") {
            const args = request.params.arguments as Record<string, string>;
            
            // Ensure addresses are valid hex format (not ENS)
            const tokenAddress = ensureHexAddress(args.token);
            const recipientAddress = ensureHexAddress(args.to);
            
            // Use direct ethers.js contract interaction for ERC20 transfers
            try {
                const tokenContract = new Contract(tokenAddress, erc20Abi, kaiaWallet);
                const tx = await tokenContract.transfer(recipientAddress, args.amount);
                await tx.wait();
                return formatToolResponse(`ERC20 token transfer successful. Transaction hash: ${tx.hash}`, { transactionHash: tx.hash });
            } catch (error) {
                // Fall back to the SDK method if direct transfer fails
                const result = await Packages.web3.Services.transferErc20({
                    contractAddress: args.token as `0x${string}`,
                    receiver: args.to as `0x${string}`,
                    sender: account.address,
                    amount: args.amount
                }, {}, kaiaWallet);
                return formatToolResponse(`ERC20 token transfer successful. Transaction hash: ${result.transactionHash}`, { transactionHash: result.transactionHash });
            }
        }
        
        if (request.params.name === "transfer_erc721") {
            const args = request.params.arguments as Record<string, string>;
            
            // Ensure addresses are valid hex format (not ENS)
            const tokenAddress = ensureHexAddress(args.token);
            const recipientAddress = ensureHexAddress(args.to);
            
            // Use direct ethers.js contract interaction for ERC721 transfers
            try {
                // Create the contract instance
                const nftContract = new Contract(tokenAddress, erc721Abi, kaiaWallet);
                
                // Get the current owner to make sure it's owned by the sender
                const currentOwner = await nftContract.ownerOf(args.tokenId);
                
                // Check that the sender is the owner
                if (currentOwner.toLowerCase() === kaiaWallet.address.toLowerCase()) {
                    // Try using the safe transfer method first
                    try {
                        const tx = await nftContract.safeTransferFrom(
                            kaiaWallet.address,
                            recipientAddress,
                            args.tokenId
                        );
                        await tx.wait();
                        return formatToolResponse(`NFT transfer successful. Transaction hash: ${tx.hash}`, { transactionHash: tx.hash });
                    } catch (safeTransferError) {
                        // If safe transfer fails, try regular transfer
                        const tx = await nftContract.transferFrom(
                            kaiaWallet.address,
                            recipientAddress,
                            args.tokenId
                        );
                        await tx.wait();
                        return formatToolResponse(`NFT transfer successful. Transaction hash: ${tx.hash}`, { transactionHash: tx.hash });
                    }
                } else {
                    throw new Error("You don't own this NFT");
                }
            } catch (error) {
                // Fall back to the SDK method if direct transfer fails
                const result = await Packages.web3.Services.transferErc721({
                    contractAddress: args.token as `0x${string}`,
                    receiver: args.to as `0x${string}`,
                    sender: account.address,
                    tokenId: args.tokenId
                }, {}, kaiaWallet);
                return formatToolResponse(`NFT transfer successful. Transaction hash: ${result.transactionHash}`, { transactionHash: result.transactionHash });
            }
        }
        
        if (request.params.name === "transfer_erc1155") {
            const args = request.params.arguments as Record<string, string>;
            
            // Ensure addresses are valid hex format (not ENS)
            const tokenAddress = ensureHexAddress(args.token);
            const recipientAddress = ensureHexAddress(args.to);
            
            // Use direct ethers.js contract interaction for ERC1155 transfers
            try {
                // Create the contract instance
                const tokenContract = new Contract(tokenAddress, erc1155Abi, kaiaWallet);
                
                // Check token balance to make sure sender owns enough tokens
                const balance = await tokenContract.balanceOf(kaiaWallet.address, args.tokenId);
                if (BigInt(balance) >= BigInt(args.amount)) {
                    // Perform the transfer - empty bytes for data parameter
                    const tx = await tokenContract.safeTransferFrom(
                        kaiaWallet.address,
                        recipientAddress,
                        args.tokenId,
                        args.amount,
                        "0x"
                    );
                    await tx.wait();
                    return formatToolResponse(`ERC1155 token transfer successful. Transaction hash: ${tx.hash}`, { transactionHash: tx.hash });
                } else {
                    throw new Error("Insufficient token balance for transfer");
                }
            } catch (error) {
                // Fall back to the SDK method if direct transfer fails
                const result = await Packages.web3.Services.transferErc1155({
                    contractAddress: args.token as `0x${string}`,
                    receiver: args.to as `0x${string}`,
                    sender: account.address,
                    tokenId: args.tokenId,
                    amount: args.amount
                }, {}, kaiaWallet);
                return formatToolResponse(`ERC1155 token transfer successful. Transaction hash: ${result.transactionHash}`, { transactionHash: result.transactionHash });
            }
        }
        
        if (request.params.name === "transfer_native_token") {
            const args = request.params.arguments as Record<string, string>;
            
            // Ensure recipient address is valid hex format (not ENS)
            const recipientAddress = ensureHexAddress(args.to);
            
            // Use direct ethers.js for native token transfers
            try {
                const tx = await kaiaWallet.sendTransaction({
                    to: recipientAddress,
                    value: args.amount
                });
                await tx.wait();
                return formatToolResponse(`Native token transfer successful. Transaction hash: ${tx.hash}`, { transactionHash: tx.hash });
            } catch (error) {
                // Fall back to the SDK method if direct transfer fails
                const result = await Packages.web3.Services.transferNativeToken({
                    receiver: args.to as `0x${string}`,
                    sender: account.address,
                    amount: args.amount
                }, {}, kaiaWallet);
                return formatToolResponse(`Native token transfer successful. Transaction hash: ${result.transactionHash}`, { transactionHash: result.transactionHash });
            }
        }
        
        if (request.params.name === "transfer_faucet") {
            const args = request.params.arguments as Record<string, string>;
            
            // Ensure recipient address is valid hex format (not ENS)
            const recipientAddress = ensureHexAddress(args.receiver);
            
            const result = await Packages.web3.Services.transferFaucet({
                receiver: recipientAddress as `0x${string}`
            }, {
                KAIROS_FAUCET_AMOUNT: args.amount || "1"
            }, kaiaWallet);
            return formatToolResponse(`Faucet tokens successfully requested. Transaction hash: ${result.transactionHash}`, { transactionHash: result.transactionHash });
        }
        
        // Handle other tools - wrap response in proper format
        const rawResponse = await toolHandler(request.params.name, request.params.arguments);
        
        // Check if the response is already in the expected format
        if (rawResponse && 'content' in rawResponse && Array.isArray(rawResponse.content)) {
            return rawResponse;
        }
        
        // Otherwise format the response
        return formatToolResponse(`Tool ${request.params.name} executed successfully.`, rawResponse);
    } catch (error) {
        throw new Error(`Tool ${request.params.name} failed: ${error}`);
    }
});

// 4. Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("KAIA MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
