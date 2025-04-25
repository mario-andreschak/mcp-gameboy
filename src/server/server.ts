import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EmulatorService } from '../emulatorService'; // Import EmulatorService
import { registerGameBoyTools } from '../tools';

/**
 * Create a GameBoy MCP server
 * @param emulatorService Emulator service instance
 * @returns MCP server instance
 */
export function createGameBoyServer(emulatorService: EmulatorService): McpServer {
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
  registerGameBoyTools(server, emulatorService); // Pass emulatorService

  return server;
}
