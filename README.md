# MCP GameBoy Server

A Model Context Protocol (MCP) server for the GameBoy emulator, allowing LLMs to interact with a GameBoy emulator.

## Features

- Supports both stdio and SSE transports
- Provides tools for GameBoy controls (up, down, left, right, A, B, start, select)
- Provides tools to load different ROMs
- Provides tools to get the current screen
- All tools return an ImageContent with the latest screen frame

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-gameboy.git
cd mcp-gameboy

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server configuration
PORT=3000

# ROM path for stdio mode
ROM_PATH=./roms/example.gb
```

### Running in stdio Mode

In stdio mode, the server uses the ROM path specified in the `ROM_PATH` environment variable. It will open a browser window to display the GameBoy screen.

```bash
npm run start:stdio
```

### Running in SSE Mode

In SSE mode, the server starts an Express server that serves a web page for ROM selection.

```bash
npm run start:sse
```

Then open your browser to `http://localhost:3000` to select a ROM.

## Tools

The server provides the following tools:

- `press_up`: Press the UP button on the GameBoy
- `press_down`: Press the DOWN button on the GameBoy
- `press_left`: Press the LEFT button on the GameBoy
- `press_right`: Press the RIGHT button on the GameBoy
- `press_a`: Press the A button on the GameBoy
- `press_b`: Press the B button on the GameBoy
- `press_start`: Press the START button on the GameBoy
- `press_select`: Press the SELECT button on the GameBoy
- `load_rom`: Load a GameBoy ROM file
- `get_screen`: Get the current GameBoy screen

All tools return an ImageContent with the latest screen frame.

## Implementation Details

This server is built using the Model Context Protocol (MCP) TypeScript SDK. It uses:

- `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` for the server implementation
- `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js` for stdio transport
- `SSEServerTransport` from `@modelcontextprotocol/sdk/server/sse.js` for SSE transport
- `serverboy` for the GameBoy emulation
- `express` for the web server in SSE mode
- `canvas` for rendering the GameBoy screen

## License

MIT
