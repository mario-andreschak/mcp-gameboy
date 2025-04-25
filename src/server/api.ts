import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { GameBoyEmulator } from '../gameboy';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Create API routes for the test interface
 * @param app Express app
 * @param emulator GameBoy emulator instance
 * @param mcpServer MCP server instance
 */
export function createApiRoutes(
  app: express.Application, 
  emulator: GameBoyEmulator, 
  mcpServer: McpServer
): void {
  // Add middleware to parse JSON bodies
  app.use(express.json());
  
  // Get list of available ROMs
  app.get('/roms', (req: Request, res: Response) => {
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
  app.get('/mcp/status', (req: Request, res: Response) => {
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
  app.post('/mcp/tool', (req: Request, res: Response) => {
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
    } catch (error: unknown) {
      console.error(`Error calling tool:`, error);
      
      // Handle the error message
      let errorMessage = 'Failed to call tool';
      if (error instanceof Error) {
        errorMessage = `${errorMessage}: ${error.message}`;
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });
}
