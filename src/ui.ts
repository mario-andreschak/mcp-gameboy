import express, { Request, Response, RequestHandler } from 'express'; // Import RequestHandler
import * as path from 'path';
import * as fs from 'fs';
import { EmulatorService } from './emulatorService'; // Import EmulatorService
import { GameBoyButton } from './types'; // Import GameBoyButton
import { log } from './utils/logger';

/**
 * Sets up the web UI routes for the GameBoy emulator
 * @param app Express application
 * @param emulatorService Emulator service instance
 */
export function setupWebUI(app: express.Application, emulatorService: EmulatorService): void {

  // Route for the main emulator page
  app.get('/emulator', (req: Request, res: Response) => {
    const currentRomPath = emulatorService.getRomPath();
    const displayRomPath = currentRomPath || 'No ROM loaded';
    const romName = currentRomPath ? path.basename(currentRomPath) : 'No ROM loaded';

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GameBoy Emulator</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f0f0f0; font-family: Arial, sans-serif; }
            h1 { margin-bottom: 20px; }
            #gameboy { border: 10px solid #333; border-radius: 10px; background-color: #9bbc0f; padding: 20px; }
            #screen { width: 320px; height: 288px; image-rendering: pixelated; background-color: #0f380f; display: block; }
            #info { margin-top: 10px; text-align: center; }
            #controls { margin-top: 15px; display: flex; flex-direction: column; align-items: center; }
            .control-row { display: flex; margin-bottom: 10px; align-items: center; }
            .dpad { display: grid; grid-template-columns: repeat(3, 40px); grid-template-rows: repeat(3, 40px); gap: 5px; margin-right: 20px; }
            .action-buttons { display: grid; grid-template-columns: repeat(2, 40px); grid-template-rows: repeat(2, 40px); gap: 5px; margin-left: 20px; }
            .menu-buttons { display: flex; gap: 10px; margin-top: 10px; }
            .control-button, .menu-button { background-color: #333; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; }
            .control-button { width: 40px; height: 40px; }
            .menu-button { padding: 5px 10px; }
            .control-button:hover, .menu-button:hover { background-color: #555; }
            .control-button:active { background-color: #777; }
            .skip-button { margin-top: 10px; padding: 5px 10px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
            .skip-button:hover { background-color: #45a049; }
            #auto-play-container { margin-top: 10px; display: flex; align-items: center; }
            #auto-play-checkbox { margin-right: 5px; }
            #back-button { margin-top: 15px; padding: 5px 10px; background-color: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; text-decoration: none; }
            #back-button:hover { background-color: #45a049; }
          </style>
        </head>
        <body>
          <h1>GameBoy Emulator</h1>
          <div id="gameboy">
            <img id="screen" src="/screen" alt="GameBoy Screen" />
          </div>
          <div id="info">
            <p>ROM: ${romName}</p>
          </div>
          <div id="controls">
            <div class="control-row">
              <div class="dpad">
                <div></div><button class="control-button" id="btn-up">↑</button><div></div>
                <button class="control-button" id="btn-left">←</button><div></div><button class="control-button" id="btn-right">→</button>
                <div></div><button class="control-button" id="btn-down">↓</button><div></div>
              </div>
              <div class="action-buttons">
                <div></div><div></div>
                <button class="control-button" id="btn-b">B</button>
                <button class="control-button" id="btn-a">A</button>
              </div>
            </div>
            <div class="menu-buttons">
              <button class="menu-button" id="btn-select">SELECT</button>
              <button class="menu-button" id="btn-start">START</button>
            </div>
            <button class="skip-button" id="btn-skip">Skip 100 Frames</button>
            <div id="auto-play-container">
              <input type="checkbox" id="auto-play-checkbox">
              <label for="auto-play-checkbox">Auto-Play</label>
            </div>
          </div>
          <a id="back-button" href="/">Back to ROM Selection</a>

          <script>
            let autoPlayEnabled = false;
            let updateTimeoutId = null;
            const autoPlayCheckbox = document.getElementById('auto-play-checkbox');
            const screenImg = document.getElementById('screen');

            autoPlayCheckbox.addEventListener('change', (event) => {
              autoPlayEnabled = event.target.checked;
              console.log('Auto-play toggled:', autoPlayEnabled);
              // Clear existing timeout and immediately trigger an update
              if (updateTimeoutId) clearTimeout(updateTimeoutId);
              updateScreen();
            });

            async function updateScreen() {
              if (!screenImg) return; // Exit if image element not found

              const endpoint = autoPlayEnabled ? '/api/advance_and_get_screen' : '/screen';
              const timestamp = new Date().getTime(); // Prevent caching

              try {
                const response = await fetch(endpoint + '?' + timestamp);
                if (!response.ok) {
                  console.error('Error fetching screen:', response.status, response.statusText);
                  // Schedule next attempt after a delay, even on error
                  scheduleNextUpdate();
                  return;
                }
                const blob = await response.blob();
                // Revoke previous object URL to free memory
                if (screenImg.src.startsWith('blob:')) {
                  URL.revokeObjectURL(screenImg.src);
                }
                screenImg.src = URL.createObjectURL(blob);
              } catch (error) {
                console.error('Error fetching screen:', error);
              } finally {
                scheduleNextUpdate();
              }
            }

            function scheduleNextUpdate() {
               // Schedule next update
               // ~60fps if auto-playing (1000ms / 60fps ≈ 16.67ms)
               // Slower update rate if not auto-playing to reduce load
               const delay = autoPlayEnabled ? 17 : 100;
               updateTimeoutId = setTimeout(updateScreen, delay);
            }

            async function callApiTool(toolName, params = {}) {
               console.log(\`Calling tool: \${toolName} with params:\`, params);
               try {
                 const response = await fetch('/api/tool', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ tool: toolName, params: params })
                 });
                 if (!response.ok) {
                   const errorText = await response.text();
                   console.error(\`Error calling tool \${toolName}: \${response.status} \${errorText}\`);
                 } else {
                   console.log(\`Tool \${toolName} called successfully.\`);
                   // Optionally force a screen update if not auto-playing
                   // if (!autoPlayEnabled) {
                   //   if (updateTimeoutId) clearTimeout(updateTimeoutId);
                   //   updateScreen();
                   // }
                 }
               } catch (error) {
                 console.error(\`Network error calling tool \${toolName}:\`, error);
               }
            }

            // Add event listeners for buttons
            document.getElementById('btn-up')?.addEventListener('click', () => callApiTool('press_up'));
            document.getElementById('btn-down')?.addEventListener('click', () => callApiTool('press_down'));
            document.getElementById('btn-left')?.addEventListener('click', () => callApiTool('press_left'));
            document.getElementById('btn-right')?.addEventListener('click', () => callApiTool('press_right'));
            document.getElementById('btn-a')?.addEventListener('click', () => callApiTool('press_a'));
            document.getElementById('btn-b')?.addEventListener('click', () => callApiTool('press_b'));
            document.getElementById('btn-start')?.addEventListener('click', () => callApiTool('press_start'));
            document.getElementById('btn-select')?.addEventListener('click', () => callApiTool('press_select'));
            document.getElementById('btn-skip')?.addEventListener('click', () => callApiTool('wait_frames', { duration_frames: 100 }));

            // Start the screen update loop
            updateScreen();
          </script>
        </body>
      </html>
    `);
  });

  // Route to get the current screen image (no frame advance)
  const screenHandler: RequestHandler = (req, res) => {
    if (!emulatorService.isRomLoaded()) {
      res.status(400).send('No ROM loaded');
    } else {
      try {
        const screen = emulatorService.getScreen(); // Does not advance frame
        const screenBuffer = Buffer.from(screen.data, 'base64');
        res.setHeader('Content-Type', 'image/png');
        res.send(screenBuffer); // Ends the response
      } catch (error) {
         log.error('Error getting screen:', error);
         res.status(500).send('Error getting screen'); // Ends the response
      }
    }
  };
  app.get('/screen', screenHandler);

  // API endpoint for advancing one frame and getting the screen (for Auto-Play)
  const advanceAndGetScreenHandler: RequestHandler = (req, res) => {
    if (!emulatorService.isRomLoaded()) {
      res.status(400).send('No ROM loaded');
    } else {
      try {
        const screen = emulatorService.advanceFrameAndGetScreen(); // Advances frame
        const screenBuffer = Buffer.from(screen.data, 'base64');
        res.setHeader('Content-Type', 'image/png');
        res.send(screenBuffer); // Ends the response
      } catch (error) {
        log.error('Error advancing frame and getting screen:', error);
         res.status(500).send('Error advancing frame and getting screen'); // Ends the response
      }
    }
  };
  app.get('/api/advance_and_get_screen', advanceAndGetScreenHandler);

  // API endpoint to call emulator tools (used by UI buttons)
  const apiToolHandler: RequestHandler = async (req, res) => {
    const { tool, params } = req.body;
    log.info(`API /api/tool called: ${tool}`, params);

    if (!tool) {
      res.status(400).json({ error: 'Tool name is required' });
      return; // Exit early if no tool provided
    }

    if (!emulatorService.isRomLoaded() && tool !== 'load_rom') {
        res.status(400).json({ error: 'No ROM loaded' });
        return; // Exit early if ROM not loaded (except for load_rom tool)
    }

    try {
      let result: any; // Should be ImageContent

      switch (tool) {
        case 'get_screen':
          result = emulatorService.getScreen();
          break;
        case 'load_rom':
          if (!params || !params.romPath) {
            res.status(400).json({ error: 'ROM path is required' });
            return; // Exit early
          }
          result = emulatorService.loadRom(params.romPath);
          break;
        case 'wait_frames':
          const duration_frames_wait = params?.duration_frames ?? 100;
          if (typeof duration_frames_wait !== 'number' || duration_frames_wait <= 0) {
            res.status(400).json({ error: 'Invalid duration_frames' });
            return; // Exit early
          }
          result = emulatorService.waitFrames(duration_frames_wait);
          break;
        default:
          if (tool.startsWith('press_')) {
            const buttonName = tool.replace('press_', '').toUpperCase();
            if (!(Object.values(GameBoyButton) as string[]).includes(buttonName)) {
              res.status(400).json({ error: `Invalid button: ${buttonName}` });
              return; // Exit early
            }
             const duration_frames_press = params?.duration_frames ?? 1;
             if (typeof duration_frames_press !== 'number' || duration_frames_press <= 0) {
               res.status(400).json({ error: 'Invalid duration_frames for press' });
               return; // Exit early
             }
             emulatorService.pressButton(buttonName as GameBoyButton);
             if (duration_frames_press > 1) {
               emulatorService.waitFrames(duration_frames_press - 1);
             }
             result = emulatorService.getScreen();
          } else {
            res.status(400).json({ error: `Unknown tool: ${tool}` });
            return; // Exit early
          }
      }

      // Send response if result was obtained
      res.json({ content: [result] }); // Ends the response

    } catch (error) {
      log.error(`Error calling tool ${tool} via API:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to call tool: ${errorMessage}` }); // Ends the response
    }
  };
  app.post('/api/tool', apiToolHandler);

  // --- Test Interface Endpoints (Keep as is for now, assuming they are correct or will be fixed separately if needed) ---

   // Add a route for the test interface
   app.get('/test', (req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), 'public', 'test-interface.html'));
  });

  // Get list of available ROMs
  app.get('/api/roms', (req: Request, res: Response) => {
    try {
      const romsDir = path.join(process.cwd(), 'roms');
      if (!fs.existsSync(romsDir)) {
        fs.mkdirSync(romsDir);
      }
      const romFiles = fs.readdirSync(romsDir)
        .filter(file => file.endsWith('.gb') || file.endsWith('.gbc'))
        .map(file => ({
          name: file,
          path: path.join(romsDir, file)
        }));
      res.json(romFiles);
    } catch (error) {
      log.error('Error getting ROM list:', error);
      res.status(500).json({ error: 'Failed to get ROM list' });
    }
  });

  // Check MCP server status
  app.get('/api/status', (req: Request, res: Response) => {
    try {
      const romLoaded = emulatorService.isRomLoaded();
      res.json({
        connected: true, // Assume connected if UI is reachable
        romLoaded,
        romPath: emulatorService.getRomPath()
      });
    } catch (error) {
      log.error('Error checking MCP server status:', error);
      res.status(500).json({ error: 'Failed to check MCP server status' });
    }
  });
}

/**
 * Sets up the ROM selection page
 * @param app Express application
 * @param emulatorService Emulator service instance (No longer needs emulator directly)
 */
export function setupRomSelectionUI(app: express.Application, emulatorService: EmulatorService): void {
  // Create the ROM selection page
  app.get('/', (req: Request, res: Response) => {
    // No need to check emulatorService.isRomLoaded() here,
    // let the user always see the selection page.

    const romsDir = path.join(process.cwd(), 'roms');
    let romFiles: { name: string; path: string }[] = [];
    try {
      if (!fs.existsSync(romsDir)) {
        fs.mkdirSync(romsDir);
      }
      romFiles = fs.readdirSync(romsDir)
        .filter(file => file.endsWith('.gb') || file.endsWith('.gbc'))
        .map(file => ({
          name: file,
          // IMPORTANT: Use relative path for security and consistency
          path: path.join('roms', file) // Use relative path from project root
        }));
    } catch (error) {
      log.error("Error reading ROM directory:", error);
      // Proceed with empty list if directory reading fails
    }

    // Render the ROM selection page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GameBoy ROM Selection</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f0f0f0; font-family: Arial, sans-serif; padding: 20px; box-sizing: border-box; }
            h1 { margin-bottom: 20px; text-align: center; }
            .container { max-width: 500px; width: 100%; }
            .rom-list, .upload-form { width: 100%; border: 1px solid #ccc; border-radius: 5px; padding: 15px; background-color: white; margin-bottom: 20px; box-sizing: border-box; }
            .rom-list { max-height: 400px; overflow-y: auto; }
            .rom-item { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; word-break: break-all; }
            .rom-item:hover { background-color: #f5f5f5; }
            .rom-item:last-child { border-bottom: none; }
            .upload-form h2 { margin-top: 0; margin-bottom: 15px; }
            .upload-form input[type="file"] { margin-bottom: 10px; display: block; width: 100%; }
            .upload-form button { padding: 8px 15px; background-color: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 1em; }
            .upload-form button:hover { background-color: #45a049; }
            .no-roms { text-align: center; color: #555; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Select a GameBoy ROM</h1>
            <div class="rom-list">
              ${romFiles.length > 0
                ? romFiles.map(rom => `
                  <div class="rom-item" onclick="selectRom('${rom.path.replace(/\\/g, '\\\\')}')">
                    ${rom.name}
                  </div>`).join('') // Escape backslashes for JS string literal
                : '<p class="no-roms">No ROM files found in ./roms directory. Upload one below.</p>'
              }
            </div>
            <div class="upload-form">
              <h2>Upload a ROM</h2>
              <form action="/upload" method="post" enctype="multipart/form-data">
                <input type="file" name="rom" accept=".gb,.gbc" required />
                <button type="submit">Upload</button>
              </form>
            </div>
          </div>
          <script>
            function selectRom(romPath) {
              // Use the /gameboy endpoint which now handles loading via the service
              window.location.href = '/gameboy?rom=' + encodeURIComponent(romPath);
            }
          </script>
        </body>
      </html>
    `);
  });
}
