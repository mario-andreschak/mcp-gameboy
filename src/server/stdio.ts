import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GameBoyEmulator } from '../gameboy';
import { createGameBoyServer } from './server';
import * as path from 'path';
import * as fs from 'fs';
import open from 'open';
import express from 'express';
import http from 'http';
import { setupWebUI } from '../web/ui';

/**
 * Start the GameBoy MCP server in stdio mode
 */
export async function startStdioServer(): Promise<void> {
  // Create the emulator
  const emulator = new GameBoyEmulator();
  
  // Create the server
  const server = createGameBoyServer(emulator);
  
  // Check for ROM path in environment variable
  const romPath = process.env.ROM_PATH;
  if (!romPath) {
    console.error('ROM_PATH environment variable not set');
    process.exit(1);
  }
  
  // Check if the ROM file exists
  if (!fs.existsSync(romPath)) {
    console.error(`ROM file not found: ${romPath}`);
    process.exit(1);
  }
  
  // Load the ROM
  try {
    emulator.loadRom(romPath);
    console.log(`ROM loaded: ${path.basename(romPath)}`);
    
    // Advance a few frames to initialize the screen
    for (let i = 0; i < 5; i++) {
      emulator.doFrame();
    }
    
    // Create an Express app to serve the GameBoy screen
    const app = express();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    
    // Add middleware to parse JSON bodies
    app.use(express.json());
    
    // Set up the web UI
    setupWebUI(app, emulator, romPath);
    
    // Start the Express server
    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
      console.log(`GameBoy web interface available at http://localhost:${port}`);
      
      // Open the web interface in the browser
      open(`http://localhost:${port}`);
    });
    
    // Create the stdio transport
    const transport = new StdioServerTransport();
    
    // Connect the transport to the server
    await server.connect(transport);
    
    console.log('MCP server running on stdio');
    
  } catch (error) {
    console.error(`Error starting server: ${error}`);
    process.exit(1);
  }
}
