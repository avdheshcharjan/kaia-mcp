# Model Context Protocol
## 🚀 Quickstart

This example shows you how to create a MCP Server to connect GOAT with Claude for Desktop.

It is implemented for both Kairos Testnet (DEFAULT) and Kaia Mainnet but can be updated to support any other chain, wallet and series of tools.

## Requirements
- Have Claude for Desktop installed. You can download it from [here](https://claude.ai/download)

## Setup
1. Clone the repository:
```bash
git clone https://github.com/avdheshcharjan/kaia-mcp && cd kaia-mcp
```

2. Run the following commands from the root folder:
```bash
pnpm install
pnpm build
```
### Configure the MCP server for Claude
1. Copy the `mcp-evm.example.json` file to `mcp-evm.json`:
```bash
# For EVM
cp mcp-evm.example.json mcp-evm.json 
```

2. Update the json file with your values for either EVM or Solana:
- Absolute path to the parent folder of the `kaia-mcp` folder, you can get it by running `pwd` in the `kaia-mcp` folder
- `WALLET_PRIVATE_KEY`
- `RPC_PROVIDER_URL`

3. Copy/update the json file and rename it to `claude_desktop_config.json` file to the `~/Library/Application Support/Claude/` directory:
```bash
# For EVM
cp mcp-evm.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

```

This tells Claude for Desktop:
- There’s are MCP servers named “goat-evm”
- Launch it by running the specified command

4. Restart Claude for Desktop.

**NOTE**: When making changes to the code you need to make sure to:
1. Run `pnpm build` in the `kaia-mcp` folder to generate the updated `evm.js` file.
2. If you update the json file: copy it again to the `~/Library/Application Support/Claude/` directory, or update the `claude_desktop_config.json` file with the new values. You will also need to restart Claude.

## Usage
1. Run Claude for Desktop

2. Chat with the agent:
- Check your balance for ERC-20 tokens
- Send ERC-20 tokens to another address
- Check your balance again to see the tokens you just sent

For more information on how to use the model context protocol, check out the [docs](https://modelcontextprotocol.io/quickstart/server).

