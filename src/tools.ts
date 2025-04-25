import { 
  CallToolResult,
  ImageContent
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { GameBoyButton } from './types';
import { GameBoyEmulator } from './gameboy';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Register GameBoy tools with the MCP server
 * @param server MCP server instance
 * @param emulator GameBoy emulator instance
 */
export function registerGameBoyTools(server: McpServer, emulator: GameBoyEmulator): void {
  // Register button press tools
  Object.values(GameBoyButton).forEach(button => {
    server.tool(
      `press_${button.toLowerCase()}`,
      `Press the ${button} button on the GameBoy`,
      {
        duration_frames: z.number().int().positive().optional().default(1).describe('Number of frames to hold the button').default(3)
      },
      async ({ duration_frames }): Promise<CallToolResult> => {
        if (!emulator.isRomLoaded()) {
          throw new Error('No ROM loaded');
        }

        // Press the button (this already advances one frame)
        emulator.pressButton(button);
        
        // If duration_frames > 1, advance additional frames
        for (let i = 1; i < duration_frames; i++) {
          emulator.doFrame();
        }
        
        // Return the current screen
        const screenBase64 = emulator.getScreenAsBase64();
        const screen: ImageContent = {
          type: 'image',
          data: screenBase64,
          mimeType: 'image/png'
        };

        return {
          content: [screen]
        };
      }
    );
  });

  // Register wait_frames tool
  server.tool(
    'wait_frames',
    'Wait for a specified number of frames',
    {
      duration_frames: z.number().int().positive().describe('Number of frames to wait').default(10)
    },
    async ({ duration_frames }): Promise<CallToolResult> => {
      if (!emulator.isRomLoaded()) {
        throw new Error('No ROM loaded');
      }
      
      // Advance the specified number of frames
      for (let i = 0; i < duration_frames; i++) {
        emulator.doFrame();
      }
      
      // Return the current screen
      const screenBase64 = emulator.getScreenAsBase64();
      const screen: ImageContent = {
        type: 'image',
        data: screenBase64,
        mimeType: 'image/png'
      };

      return {
        content: [screen]
      };
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
      emulator.loadRom(romPath);
      
      // Advance a few frames to initialize the screen
      for (let i = 0; i < 5; i++) {
        emulator.doFrame();
      }
      
      // Return the current screen
      const screenBase64 = emulator.getScreenAsBase64();
      const screen: ImageContent = {
        type: 'image',
        data: screenBase64,
        mimeType: 'image/png'
      };

      return {
        content: [screen]
      };
    }
  );

  // Register get screen tool
  server.tool(
    'get_screen',
    'Get the current GameBoy screen',
    {},
    async (): Promise<CallToolResult> => {
      if (!emulator.isRomLoaded()) {
        throw new Error('No ROM loaded');
      }
      
      // Advance one frame to update the screen
      emulator.doFrame();
      
      // Return the current screen
      const screenBase64 = emulator.getScreenAsBase64();
      const screen: ImageContent = {
        type: 'image',
        data: screenBase64,
        mimeType: 'image/png'
      };

      return {
        content: [screen]
      };
    }
  );
}
