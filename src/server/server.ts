import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GameBoyEmulator } from '../gameboy';
import { registerGameBoyTools } from '../tools';

/**
 * Create a GameBoy MCP server
 * @param emulator GameBoy emulator instance
 * @returns MCP server instance
 */
export function createGameBoyServer(emulator: GameBoyEmulator): McpServer {
  // Create the server
  const server = new McpServer(
    {
      name: 'serverboy',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register GameBoy tools
  registerGameBoyTools(server, emulator);

  return server;
}
