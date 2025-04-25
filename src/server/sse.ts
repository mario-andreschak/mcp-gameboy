import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { GameBoyEmulator } from '../gameboy';
import { EmulatorService } from '../emulatorService'; // Import EmulatorService
import { createGameBoyServer } from './server';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import multer from 'multer';
import { setupWebUI, setupRomSelectionUI } from '../ui';
import { log } from '../utils/logger';

/**
 * Start the GameBoy MCP server in SSE mode
 * @param port Port to listen on (defaults to SERVER_PORT from .env or 3001)
 */
export async function startSseServer(port?: number): Promise<void> {
  // Use SERVER_PORT from environment variables if port is not provided
  const ssePort = port || (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 3001);
  const webUiPort = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 3002;
  
  // Create the emulator
  const emulator = new GameBoyEmulator();
  // Create the emulator service
  const emulatorService = new EmulatorService(emulator);
  
  // Create the server using the service
  const server = createGameBoyServer(emulatorService);
  
  // Create the Express app
  const app = express();
  
  // Middleware
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use(express.json());
  
  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const romsDir = path.join(process.cwd(), 'roms');
      if (!fs.existsSync(romsDir)) {
        fs.mkdirSync(romsDir);
      }
      cb(null, romsDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });
  
  const upload = multer({ storage });
  
  // Store transports by session ID
  const transports: Record<string, SSEServerTransport> = {};
  
  // SSE endpoint for establishing the stream
  app.get('/mcp', async (req: Request, res: Response) => {
    log.info('Received GET request to /mcp (establishing SSE stream)');
    
    try {
      // Create a new SSE transport for the client
      const transport = new SSEServerTransport('/messages', res);
      
      // Store the transport by session ID
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;
      
      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        log.info(`SSE transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };
      
      // Connect the transport to the MCP server
      await server.connect(transport);
      
      log.info(`Established SSE stream with session ID: ${sessionId}`);
    } catch (error) {
      log.error('Error establishing SSE stream:', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });
  
  // Messages endpoint for receiving client JSON-RPC requests
  app.post('/messages', async (req: Request, res: Response) => {
    log.info('Received POST request to /messages');
    
    // Extract session ID from URL query parameter
    const sessionId = req.query.sessionId as string | undefined;
    
    if (!sessionId) {
      log.error('No session ID provided in request URL');
      res.status(400).send('Missing sessionId parameter');
      return;
    }
    
    const transport = transports[sessionId];
    if (!transport) {
      log.error(`No active transport found for session ID: ${sessionId}`);
      res.status(404).send('Session not found');
      return;
    }
    
    try {
      // Handle the POST message with the transport
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      log.error('Error handling request:', error);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  });
  
  // Set up the ROM selection UI using the service
  setupRomSelectionUI(app, emulatorService); // Pass service, remove emulator
  
  // Handle ROM upload
  app.post('/upload', upload.single('rom'), (req, res) => {
    // Redirect to the ROM selection page
    res.redirect('/');
  });
  
  // Create the GameBoy page
  app.get('/gameboy', (req, res) => {
    const romPath = req.query.rom as string;
    
    // Check if the ROM file exists
    if (!romPath || !fs.existsSync(romPath)) {
      res.redirect('/');
      return;
    }
    
    // Load the ROM using the service
    try {
      emulatorService.loadRom(romPath); // Use service
      
      // NOTE: setupWebUI should ideally be called only ONCE during setup,
      // not within a route handler. Let's move it outside.
      // We'll set it up after the ROM selection UI.
      
      // Redirect to the emulator page - the UI will fetch the screen
      res.redirect('/emulator'); 
    } catch (error) {
      log.error(`Error loading ROM: ${error}`, error);
      res.redirect('/'); // Redirect back to selection on error
    }
  });

  // Set up the main Web UI (needs to be done once)
  // Pass the service instance. The optional romPath isn't strictly needed here
  // as the UI gets the current ROM from the service via API.
  setupWebUI(app, emulatorService); 
  
  // Start the Express server
  const httpServer = http.createServer(app);
  httpServer.listen(ssePort, () => {
    log.info(`GameBoy MCP Server listening on http://localhost:${ssePort}`);
    log.info(`GameBoy Web UI available at http://localhost:${webUiPort}`);
  });
}
