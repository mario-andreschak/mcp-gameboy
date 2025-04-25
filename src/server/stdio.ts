import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GameBoyEmulator } from '../gameboy';
import { createGameBoyServer } from './server';
import * as path from 'path';
import * as fs from 'fs';
import open from 'open';
import express from 'express';
import http from 'http';

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
    
    // Create a route to serve the GameBoy screen
    app.get('/', (req, res) => {
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
    });
    
    // Create a route to serve the GameBoy screen as an image
    app.get('/screen', (req, res) => {
      if (!emulator.isRomLoaded()) {
        res.status(400).send('No ROM loaded');
        return;
      }
      
      // Advance one frame to update the screen
      emulator.doFrame();
      
      // Get the current screen
      const screenBase64 = emulator.getScreenAsBase64();
      const screenBuffer = Buffer.from(screenBase64, 'base64');
      
      // Set the content type and send the image
      res.setHeader('Content-Type', 'image/png');
      res.send(screenBuffer);
    });
    
    // Add a route for the test interface
    app.get('/test', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'public', 'test-interface.html'));
    });
    
    // API endpoints for the test interface
    
    // Get list of available ROMs
    app.get('/api/roms', (req, res) => {
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
    app.get('/api/status', (req, res) => {
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
    app.post('/api/tool', (req, res) => {
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
