# MCP GameBoy Server

<a href="https://glama.ai/mcp/servers/@mario-andreschak/mcp-gameboy">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@mario-andreschak/mcp-gameboy/badge" alt="GameBoy Server MCP server" />
</a>


A Model Context Protocol (MCP) server for the GameBoy emulator, allowing LLMs to interact with a GameBoy emulator.
![Screenshot 2025-04-25 183528](https://github.com/user-attachments/assets/a248ef8a-73bb-4fc7-9c7f-7832cea34498)

![Screenshot 2025-04-25 081510](https://github.com/user-attachments/assets/dd47d7ea-fe93-4162-9da5-8da7d9aab469)

![image](https://github.com/user-attachments/assets/b9565920-b2ae-41d5-8609-59d832a90d44)


## Features

- Supports both stdio and SSE transports
- Provides tools for GameBoy controls (up, down, left, right, A, B, start, select)
- Provides tools to load different ROMs
- Provides tools to get the current screen
- All tools return an ImageContent with the latest screen frame

## Installation

### Installing in [FLUJO](https://github.com/mario-andreschak/FLUJO/)
1. Click Add Server
2. Copy & Paste Github URL into FLUJO
3. Click Parse, Clone, Install, Build and Save.

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-gameboy.git
cd mcp-gameboy

# Install dependencies
npm install

# Build the project
npm run build
```

### Installing via Configuration Files

!! **ATTENTION** : Many MCP Clients require to specify the ROM-Path in the .env vars as an **absolute path**

To integrate this MCP server with Cline or other MCP clients via configuration files:

1. Open your Cline settings:
   - In VS Code, go to File -> Preferences -> Settings
   - Search for "Cline MCP Settings"
   - Click "Edit in settings.json"

2. Add the server configuration to the `mcpServers` object:
   ```json
   {
     "mcpServers": {
       "mcp-gameboy": {
         "command": "node",
         "args": [
           "/path/to/mcp-gameboy/dist/index.js"
         ],
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

3. Replace `/path/to/mcp-gameboy/dist/index.js` with the actual path to the `index.js` file in your project directory. Use forward slashes (/) or double backslashes (\\\\) for the path on Windows.

4. Save the settings file. Cline should automatically connect to the server.


## Usage

### Environment Variables
!! **ATTENTION** : Many MCP Clients require to specify the ROM-Path in the .env vars as an **absolute path**

Create a `.env` file in the root directory with the following variables:

```
# Server configuration
PORT=3001

# ROM path for stdio mode
ROM_PATH=./roms/dangan.gb
```

### Running in stdio Mode

In stdio mode, the server uses the ROM path specified in the `ROM_PATH` environment variable. It will open a browser window to display the GameBoy screen.

```bash
npm run start
```

### Running in SSE Mode

In SSE mode, the server starts an Express server that serves a web page for ROM selection.

```bash
npm run start-sse
```

Then open your browser to `http://localhost:3001` to select a ROM.

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
