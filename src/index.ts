import { startStdioServer } from './server/stdio';
import { startSseServer } from './server/sse';
import dotenv from 'dotenv';

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
  
  // Get the port from environment variable or use default
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  
  // Start the appropriate server
  if (isStdio) {
    console.log('Starting GameBoy MCP server in stdio mode');
    await startStdioServer();
  } else if (isSse) {
    console.log(`Starting GameBoy MCP server in SSE mode on port ${port}`);
    await startSseServer(port);
  } else {
    // Default to stdio mode
    console.log('No mode specified, defaulting to stdio mode');
    await startStdioServer();
  }
}

// Run the main function
main().catch(error => {
  console.error(`Error: ${error}`);
  process.exit(1);
});
