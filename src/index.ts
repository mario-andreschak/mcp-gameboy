import { startStdioServer } from './server/stdio';
import { startSseServer } from './server/sse';
import dotenv from 'dotenv';
import { log } from './utils/logger';

// Load environment variables from .env file
dotenv.config();

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const isStdio = args.includes('--stdio');
  const isSse = args.includes('--sse');
  
  // Get the SSE port from environment variable or use default
  const ssePort = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 3001;
  
  // Start the appropriate server
  if (isStdio) {
    log.info('Starting GameBoy MCP server in stdio mode');
    await startStdioServer();
  } else if (isSse) {
    log.info(`Starting GameBoy MCP server in SSE mode on port ${ssePort}`);
    await startSseServer(ssePort);
  } else {
    // Default to stdio mode
    log.info('No mode specified, defaulting to stdio mode');
    await startStdioServer();
  }
}

// Run the main function
main().catch(error => {
  log.error(`Error: ${error}`);
  process.exit(1);
});
