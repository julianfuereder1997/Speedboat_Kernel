// MCP-Server über stdio. Aufruf: pnpm --filter @speedboat/mcp start (die API muss laufen).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config_from_env, create_mcp_server } from "./server.js";

const server = create_mcp_server(config_from_env(process.env));
await server.connect(new StdioServerTransport());
