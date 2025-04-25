import { 
  Tool, 
  Resource, 
  ImageContent, 
  TextContent 
} from '@modelcontextprotocol/sdk/types.js';

// GameBoy button types
export enum GameBoyButton {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  A = 'A',
  B = 'B',
  START = 'START',
  SELECT = 'SELECT'
}

// Tool schemas
export interface PressButtonToolSchema {
  button: GameBoyButton;
  duration_frames?: number;
}

export interface WaitFramesToolSchema {
  duration_frames: number;
}

export interface LoadRomToolSchema {
  romPath: string;
}

export interface GetScreenToolSchema {
  // No parameters needed
}

// Tool response types
export interface GameBoyToolResponse {
  screen: ImageContent;
}

// Server configuration
export interface GameBoyServerConfig {
  romPath?: string;
  port?: number;
}

// Session state
export interface GameBoySession {
  romLoaded: boolean;
  romPath?: string;
}
