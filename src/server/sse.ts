import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { GameBoyEmulator } from '../gameboy';
import { createGameBoyServer } from './server';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import multer from 'multer';
import bodyParser from 'body-parser';

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
  
  // Create the ROM selection page
  app.get('/', (req, res) => {
    // Check if the roms directory exists
    const romsDir = path.join(process.cwd(), 'roms');
    if (!fs.existsSync(romsDir)) {
      fs.mkdirSync(romsDir);
    }
    
    // Get a list of ROM files
    const romFiles = fs.readdirSync(romsDir)
      .filter(file => file.endsWith('.gb') || file.endsWith('.gbc'))
      .map(file => ({
        name: file,
        path: path.join(romsDir, file)
      }));
    
    // Render the ROM selection page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GameBoy ROM Selection</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f0f0f0;
              font-family: Arial, sans-serif;
            }
            
            h1 {
              margin-bottom: 20px;
            }
            
            .rom-list {
              width: 400px;
              max-height: 400px;
              overflow-y: auto;
              border: 1px solid #ccc;
              border-radius: 5px;
              padding: 10px;
              background-color: white;
            }
            
            .rom-item {
              padding: 10px;
              border-bottom: 1px solid #eee;
              cursor: pointer;
            }
            
            .rom-item:hover {
              background-color: #f5f5f5;
            }
            
            .rom-item:last-child {
              border-bottom: none;
            }
            
            .upload-form {
              margin-top: 20px;
              width: 400px;
              padding: 10px;
              border: 1px solid #ccc;
              border-radius: 5px;
              background-color: white;
            }
            
            .upload-form input[type="file"] {
              margin-bottom: 10px;
            }
            
            .upload-form button {
              padding: 5px 10px;
              background-color: #4CAF50;
              color: white;
              border: none;
              border-radius: 3px;
              cursor: pointer;
            }
            
            .upload-form button:hover {
              background-color: #45a049;
            }
          </style>
        </head>
        <body>
          <h1>Select a GameBoy ROM</h1>
          
          <div class="rom-list">
            ${romFiles.length > 0 
              ? romFiles.map(rom => `
                <div class="rom-item" onclick="selectRom('${rom.path}')">
                  ${rom.name}
                </div>
              `).join('')
              : '<p>No ROM files found. Upload one below.</p>'
            }
          </div>
          
          <div class="upload-form">
            <h2>Upload a ROM</h2>
            <form action="/upload" method="post" enctype="multipart/form-data">
              <input type="file" name="rom" accept=".gb,.gbc" required />
              <button type="submit">Upload</button>
            </form>
          </div>
          
          <script>
            function selectRom(romPath) {
              // Redirect to the GameBoy page with the selected ROM
              window.location.href = '/gameboy?rom=' + encodeURIComponent(romPath);
            }
          </script>
        </body>
      </html>
    `);
  });
  
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
      
      // Render the GameBoy page
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>GameBoy Emulator</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #f0f0f0;
                font-family: Arial, sans-serif;
              }
              
              h1 {
                margin-bottom: 20px;
              }
              
              #gameboy {
                border: 10px solid #333;
                border-radius: 10px;
                background-color: #9bbc0f;
                padding: 20px;
              }
              
              #screen {
                width: 320px;
                height: 288px;
                image-rendering: pixelated;
                background-color: #0f380f;
              }
              
              #info {
                margin-top: 20px;
                text-align: center;
              }
              
              #back-button {
                margin-top: 20px;
                padding: 5px 10px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                text-decoration: none;
              }
              
              #back-button:hover {
                background-color: #45a049;
              }
            </style>
          </head>
          <body>
            <h1>GameBoy Emulator</h1>
            <div id="gameboy">
              <img id="screen" src="/screen" alt="GameBoy Screen" />
            </div>
            <div id="info">
              <p>ROM: ${path.basename(romPath)}</p>
              <p>Use the MCP tools to control the GameBoy</p>
            </div>
            <a id="back-button" href="/">Back to ROM Selection</a>
            
            <script>
              // Function to update the screen
              function updateScreen() {
                const img = document.getElementById('screen');
                img.src = '/screen?' + new Date().getTime(); // Add timestamp to prevent caching
                
                // Update every 100ms
                setTimeout(updateScreen, 100);
              }
              
              // Start updating the screen
              updateScreen();
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error(`Error loading ROM: ${error}`);
      res.redirect('/');
    }
  });
  
  // Create the screen endpoint
  app.get('/screen', (req, res) => {
    if (!emulator.isRomLoaded()) {
      res.status(400).send('No ROM loaded');
      return;
    }
    
    // Get the current screen
    const screenBase64 = emulator.getScreenAsBase64();
    const screenBuffer = Buffer.from(screenBase64, 'base64');
    
    // Set the content type and send the image
    res.setHeader('Content-Type', 'image/png');
    res.send(screenBuffer);
  });
  
  // API endpoints for the test interface
  
  // Get list of available ROMs
  app.get('/roms', (req, res) => {
    try {
      const romsDir = path.join(process.cwd(), 'roms');
      
      // Create roms directory if it doesn't exist
      if (!fs.existsSync(romsDir)) {
        fs.mkdirSync(romsDir);
      }
      
      // Get list of ROM files
      const romFiles = fs.readdirSync(romsDir)
        .filter(file => file.endsWith('.gb') || file.endsWith('.gbc'))
        .map(file => ({
          name: file,
          path: path.join(romsDir, file)
        }));
      
      res.json(romFiles);
    } catch (error) {
      console.error('Error getting ROM list:', error);
      res.status(500).json({ error: 'Failed to get ROM list' });
    }
  });
  
  // Check MCP server status
  app.get('/mcp/status', (req, res) => {
    try {
      // Check if the emulator has a ROM loaded
      const romLoaded = emulator.isRomLoaded();
      
      res.json({
        connected: true,
        romLoaded,
        romPath: emulator.getRomPath()
      });
    } catch (error) {
      console.error('Error checking MCP server status:', error);
      res.status(500).json({ error: 'Failed to check MCP server status' });
    }
  });
  
  // Call MCP tool
  app.post('/mcp/tool', (req, res) => {
    try {
      const { tool, params } = req.body;
      
      if (!tool) {
        res.status(400).json({ error: 'Tool name is required' });
        return;
      }
      
      let result;
      
      // Handle different tools
      if (tool === 'get_screen') {
        // Get the current screen
        if (!emulator.isRomLoaded()) {
          res.status(400).json({ error: 'No ROM loaded' });
          return;
        }
        
        // Advance one frame to update the screen
        emulator.doFrame();
        
        // Get the current screen
        const screenBase64 = emulator.getScreenAsBase64();
        
        result = {
          content: [{
            type: 'image',
            data: screenBase64,
            mimeType: 'image/png'
          }]
        };
      } else if (tool === 'load_rom') {
        // Load a ROM
        if (!params || !params.romPath) {
          res.status(400).json({ error: 'ROM path is required' });
          return;
        }
        
        // Load the ROM
        emulator.loadRom(params.romPath);
        
        // Advance a few frames to initialize the screen
        for (let i = 0; i < 5; i++) {
          emulator.doFrame();
        }
        
        // Get the current screen
        const screenBase64 = emulator.getScreenAsBase64();
        
        result = {
          content: [{
            type: 'image',
            data: screenBase64,
            mimeType: 'image/png'
          }]
        };
      } else if (tool.startsWith('press_')) {
        // Press a button
        if (!emulator.isRomLoaded()) {
          res.status(400).json({ error: 'No ROM loaded' });
          return;
        }
        
        // Extract the button name from the tool name
        const buttonName = tool.replace('press_', '').toUpperCase();
        
        // Press the button
        emulator.pressButton(buttonName);
        
        // Get the current screen
        const screenBase64 = emulator.getScreenAsBase64();
        
        result = {
          content: [{
            type: 'image',
            data: screenBase64,
            mimeType: 'image/png'
          }]
        };
      } else {
        res.status(400).json({ error: `Unknown tool: ${tool}` });
        return;
      }
      
      res.json(result);
    } catch (error) {
      console.error(`Error calling tool:`, error);
      
      // Handle the error message
      let errorMessage = 'Failed to call tool';
      if (error instanceof Error) {
        errorMessage = `${errorMessage}: ${error.message}`;
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });
  
  // Add a route for the test interface
  app.get('/test', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'test-interface.html'));
  });
  
  // Start the Express server
  const httpServer = http.createServer(app);
  httpServer.listen(port, () => {
    console.log(`GameBoy MCP Server listening on http://localhost:${port}`);
  });
}
