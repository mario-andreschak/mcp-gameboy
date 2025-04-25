import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { GameBoyEmulator } from '../gameboy';
import { createGameBoyServer } from './server';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import multer from 'multer';
import bodyParser from 'body-parser';
import { setupWebUI, setupRomSelectionUI } from '../web/ui';

/**
 * Start the GameBoy MCP server in SSE mode
 * @param port Port to listen on
 */
export async function startSseServer(port: number = 3000): Promise<void> {
  // Create the emulator
  const emulator = new GameBoyEmulator();
  
  // Create the server
  const server = createGameBoyServer(emulator);
  
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
    console.log('Received GET request to /mcp (establishing SSE stream)');
    
    try {
      // Create a new SSE transport for the client
      const transport = new SSEServerTransport('/messages', res);
      
      // Store the transport by session ID
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;
      
      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        console.log(`SSE transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };
      
      // Connect the transport to the MCP server
      await server.connect(transport);
      
      console.log(`Established SSE stream with session ID: ${sessionId}`);
    } catch (error) {
      console.error('Error establishing SSE stream:', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });
  
  // Messages endpoint for receiving client JSON-RPC requests
  app.post('/messages', async (req: Request, res: Response) => {
    console.log('Received POST request to /messages');
    
    // Extract session ID from URL query parameter
    const sessionId = req.query.sessionId as string | undefined;
    
    if (!sessionId) {
      console.error('No session ID provided in request URL');
      res.status(400).send('Missing sessionId parameter');
      return;
    }
    
    const transport = transports[sessionId];
    if (!transport) {
      console.error(`No active transport found for session ID: ${sessionId}`);
      res.status(404).send('Session not found');
      return;
    }
    
    try {
      // Handle the POST message with the transport
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error handling request:', error);
      if (!res.headersSent) {
        res.status(500).send('Error handling request');
      }
    }
  });
  
  // Set up the ROM selection UI
  setupRomSelectionUI(app, emulator);
  
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
    
    // Load the ROM
    try {
      emulator.loadRom(romPath);
      
      // Advance a few frames to initialize the screen
      for (let i = 0; i < 5; i++) {
        emulator.doFrame();
      }
      
      // Set up the web UI for this route
      setupWebUI(app, emulator, romPath);
      
      // Redirect to the root path which will now show the GameBoy UI
      res.redirect('/');
    } catch (error) {
      console.error(`Error loading ROM: ${error}`);
      res.redirect('/');
    }
  });
  
  // Start the Express server
  const httpServer = http.createServer(app);
  httpServer.listen(port, () => {
    console.log(`GameBoy MCP Server listening on http://localhost:${port}`);
  });
}
