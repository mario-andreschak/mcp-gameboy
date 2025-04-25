import { GameBoyButton } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, Canvas } from 'canvas';

// Import the serverboy library
const Gameboy = require('serverboy');

export class GameBoyEmulator {
  private gameboy: any;
  private canvas: Canvas;
  private romLoaded: boolean = false;
  private romPath?: string;

  constructor() {
    this.gameboy = new Gameboy();
    // Create a canvas for rendering the screen
    this.canvas = createCanvas(160, 144);
  }

  /**
   * Load a ROM file
   * @param romPath Path to the ROM file
   */
  public loadRom(romPath: string): void {
    try {
      const rom = fs.readFileSync(romPath);
      this.gameboy.loadRom(rom);
      this.romLoaded = true;
      this.romPath = romPath;
      console.log(`ROM loaded: ${path.basename(romPath)}`);
    } catch (error) {
      console.error(`Error loading ROM: ${error}`);
      throw new Error(`Failed to load ROM: ${error}`);
    }
  }

  /**
   * Press a button on the GameBoy
   * @param button Button to press
   */
  public pressButton(button: GameBoyButton): void {
    if (!this.romLoaded) {
      throw new Error('No ROM loaded');
    }

    // Map our button enum to serverboy's keymap
    const buttonMap: Record<GameBoyButton, number> = {
      [GameBoyButton.UP]: Gameboy.KEYMAP.UP,
      [GameBoyButton.DOWN]: Gameboy.KEYMAP.DOWN,
      [GameBoyButton.LEFT]: Gameboy.KEYMAP.LEFT,
      [GameBoyButton.RIGHT]: Gameboy.KEYMAP.RIGHT,
      [GameBoyButton.A]: Gameboy.KEYMAP.A,
      [GameBoyButton.B]: Gameboy.KEYMAP.B,
      [GameBoyButton.START]: Gameboy.KEYMAP.START,
      [GameBoyButton.SELECT]: Gameboy.KEYMAP.SELECT
    };

    this.gameboy.pressKeys([buttonMap[button]]);
    this.gameboy.doFrame();
  }

  /**
   * Advance the emulation by one frame
   */
  public doFrame(): void {
    if (!this.romLoaded) {
      throw new Error('No ROM loaded');
    }
    this.gameboy.doFrame();
  }

  /**
   * Get the current screen as a base64 encoded PNG
   * @returns Base64 encoded PNG image
   */
  public getScreenAsBase64(): string {
    if (!this.romLoaded) {
      throw new Error('No ROM loaded');
    }

    // Get the raw screen data
    const screenData = this.gameboy.getScreen();
    
    // Draw to canvas
    const ctx = this.canvas.getContext('2d');
    const imageData = ctx.createImageData(160, 144);
    
    for (let i = 0; i < screenData.length; i++) {
      imageData.data[i] = screenData[i];
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Convert to base64 PNG
    return this.canvas.toDataURL('image/png').split(',')[1];
  }

  /**
   * Get the current ROM path
   * @returns Current ROM path or undefined if no ROM is loaded
   */
  public getRomPath(): string | undefined {
    return this.romPath;
  }

  /**
   * Check if a ROM is loaded
   * @returns True if a ROM is loaded, false otherwise
   */
  public isRomLoaded(): boolean {
    return this.romLoaded;
  }
}
