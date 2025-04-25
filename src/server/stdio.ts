import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GameBoyEmulator } from '../gameboy';
import { EmulatorService } from '../emulatorService'; // Import EmulatorService
import { createGameBoyServer } from './server';
import * as path from 'path';
import * as fs from 'fs';
import open from 'open';
import express, { Request, Response } from 'express'; // Import Request, Response
import http from 'http';
import multer from 'multer'; // Import multer
import { setupWebUI, setupRomSelectionUI } from '../ui'; // Import setupRomSelectionUI
import { log } from '../utils/logger';

/**
 * Start the GameBoy MCP server in stdio mode
 */
export async function startStdioServer(): Promise<void> {
  // Create the emulator
  const emulator = new GameBoyEmulator();
  // Create the emulator service
  const emulatorService = new EmulatorService(emulator);
  
  // Create the server using the service
  const server = createGameBoyServer(emulatorService);
  
  // Check for ROM path in environment variable
  const romPath = process.env.ROM_PATH;
  if (!romPath) {
    log.error('ROM_PATH environment variable not set');
    process.exit(1);
  }
  
  // Check if the ROM file exists
  if (!fs.existsSync(romPath)) {
    log.error(`ROM file not found: ${romPath}`);
    process.exit(1);
  }
  
  // Load the ROM using the service
  try {
    emulatorService.loadRom(romPath); // Use service to load ROM
    log.info(`ROM loaded: ${path.basename(romPath)}`);
    
    // Create an Express app to serve the GameBoy screen
    const app = express();
    const port = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 3000;
    
    // Add middleware to parse JSON bodies
    app.use(express.json());
    app.use(express.static(path.join(process.cwd(), 'public'))); // Serve static files if needed by UI

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

    // Set up the main web UI (emulator screen)
    setupWebUI(app, emulatorService);

    // Set up the ROM selection UI
    setupRomSelectionUI(app, emulatorService);

    // Handle ROM upload
    app.post('/upload', upload.single('rom'), (req: Request, res: Response) => {
      // Redirect back to the ROM selection page after upload
      res.redirect('/');
    });

    // Add the /gameboy route to handle loading a ROM selected from the UI
    app.get('/gameboy', (req: Request, res: Response) => {
      const relativeRomPath = req.query.rom as string;

      if (!relativeRomPath) {
        log.error('[stdio /gameboy] No ROM path provided in query.');
        res.redirect('/'); // Redirect to selection if no path
        return;
      }

      const absoluteRomPath = path.resolve(process.cwd(), relativeRomPath);
      log.info(`[stdio /gameboy] Received relative path: ${relativeRomPath}`);
      log.info(`[stdio /gameboy] Resolved to absolute path: ${absoluteRomPath}`);

      if (!fs.existsSync(absoluteRomPath)) {
        log.error(`[stdio /gameboy] ROM file not found at absolute path: ${absoluteRomPath}`);
        res.status(404).send(`ROM not found: ${relativeRomPath}`); // Send error or redirect
        return;
      }

      try {
        log.info(`[stdio /gameboy] Attempting to load ROM from absolute path: ${absoluteRomPath}`);
        emulatorService.loadRom(absoluteRomPath); // Load the newly selected ROM
        log.info(`[stdio /gameboy] ROM loaded successfully: ${absoluteRomPath}`);
        res.redirect('/emulator'); // Redirect to the emulator page
      } catch (error) {
        log.error(`[stdio /gameboy] Error loading ROM from ${absoluteRomPath}:`, error);
        res.status(500).send('Error loading ROM'); // Send error or redirect
      }
    });

    // // Add a redirect from root to emulator (Keep commented out, root is now ROM selection)
    // app.get('/', (req, res) => {
    //   res.redirect('/emulator');
    // });
    
    // Start the Express server
    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
      // Log both the emulator page and the selection page
      log.info(`Initial ROM loaded. Emulator available at http://localhost:${port}/emulator`);
      log.info(`ROM Selection available at http://localhost:${port}/`);

      // Open the web interface directly to the emulator for the initial ROM
      open(`http://localhost:${port}/emulator`);
    });

    // Create the stdio transport
    const transport = new StdioServerTransport();
    
    // Connect the transport to the server
    await server.connect(transport);
    
    log.info('MCP server running on stdio');
    
  } catch (error) {
    log.error(`Error starting server: ${error}`);
    process.exit(1);
  }
}
