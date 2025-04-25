import { 
  CallToolResult,
  ImageContent,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GameBoyButton } from './types';
import { EmulatorService } from './emulatorService'; // Import EmulatorService
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fs from 'fs';
import * as path from 'path';
import { log } from './utils/logger';

/**
 * Register GameBoy tools with the MCP server
 * @param server MCP server instance
 * @param emulatorService Emulator service instance
 */
export function registerGameBoyTools(server: McpServer, emulatorService: EmulatorService): void {
  // Register button press tools
  Object.values(GameBoyButton).forEach(button => {
    server.tool(
      `press_${button.toLowerCase()}`,
      `Press the ${button} button on the GameBoy`,
      {
        duration_frames: z.number().int().positive().optional().default(1).describe('Number of frames to hold the button').default(5)
      },
      async ({ duration_frames }): Promise<CallToolResult> => {
        // Press the button using the service (advances one frame)
        emulatorService.pressButton(button);

        // If duration_frames > 1, wait additional frames using the service
        if (duration_frames > 1) {
          emulatorService.waitFrames(duration_frames - 1);
        }

        // Return the current screen using the service
        const screen = emulatorService.getScreen();
        return { content: [screen] };
      }
    );
  });

  // Register wait_frames tool
  server.tool(
    'wait_frames',
    'Wait for a specified number of frames',
    {
      duration_frames: z.number().int().positive().describe('Number of frames to wait').default(100)
    },
    async ({ duration_frames }): Promise<CallToolResult> => {
      // Wait for frames using the service
      const screen = emulatorService.waitFrames(duration_frames);
      return { content: [screen] };
    }
  );

  // Register load ROM tool
  server.tool(
    'load_rom',
    'Load a GameBoy ROM file',
    {
      romPath: z.string().describe('Path to the ROM file')
    },
    async ({ romPath }): Promise<CallToolResult> => {
      // Load ROM using the service (already advances initial frames)
      const screen = emulatorService.loadRom(romPath);
      return { content: [screen] };
    }
  );

  // Register get screen tool
  server.tool(
    'get_screen',
    'Get the current GameBoy screen (advances one frame)', // Updated description
    {},
    async (): Promise<CallToolResult> => {
      // Advance one frame and get the screen using the service
      const screen = emulatorService.advanceFrameAndGetScreen();
      return { content: [screen] };
    }
  );

  // Register is_rom_loaded tool
  server.tool(
    'is_rom_loaded',
    'Check if a ROM is currently loaded in the emulator',
    {},
    async (): Promise<CallToolResult> => {
      const isLoaded = emulatorService.isRomLoaded();
      const romPath = emulatorService.getRomPath();
      
      const responseText: TextContent = {
        type: 'text',
        text: JSON.stringify({
          romLoaded: isLoaded,
          romPath: romPath || null
        })
      };
      
      log.verbose('Checked ROM loaded status', JSON.stringify({ 
        romLoaded: isLoaded, 
        romPath: romPath || null 
      }));
      
      return { content: [responseText] };
    }
  );

  // Register list_roms tool
  server.tool(
    'list_roms',
    'List all available GameBoy ROM files',
    {},
    async (): Promise<CallToolResult> => {
      try {
        const romsDir = path.join(process.cwd(), 'roms');
        
        // Create roms directory if it doesn't exist
        if (!fs.existsSync(romsDir)) {
          fs.mkdirSync(romsDir);
          log.info('Created roms directory');
        }
        
        // Get list of ROM files
        const romFiles = fs.readdirSync(romsDir)
          .filter(file => file.endsWith('.gb') || file.endsWith('.gbc'))
          .map(file => ({
            name: file,
            path: path.join(romsDir, file)
          }));
        
        const responseText: TextContent = {
          type: 'text',
          text: JSON.stringify(romFiles)
        };
        
        log.verbose('Listed available ROMs', JSON.stringify({ 
          count: romFiles.length, 
          roms: romFiles 
        }));
        
        return { content: [responseText] };
      } catch (error) {
        log.error('Error listing ROMs:', error instanceof Error ? error.message : String(error));
        
        const errorText: TextContent = {
          type: 'text',
          text: JSON.stringify({
            error: 'Failed to list ROMs',
            message: error instanceof Error ? error.message : String(error)
          })
        };
        
        return { content: [errorText] };
      }
    }
  );
}
