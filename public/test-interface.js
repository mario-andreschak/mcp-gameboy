// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const gameboyScreen = document.getElementById('gameboyScreen');
const refreshScreen = document.getElementById('refreshScreen');
const romSelect = document.getElementById('romSelect');
const loadRom = document.getElementById('loadRom');
const responseLog = document.getElementById('responseLog');

// Button elements
const buttonUp = document.getElementById('buttonUp');
const buttonDown = document.getElementById('buttonDown');
const buttonLeft = document.getElementById('buttonLeft');
const buttonRight = document.getElementById('buttonRight');
const buttonA = document.getElementById('buttonA');
const buttonB = document.getElementById('buttonB');
const buttonStart = document.getElementById('buttonStart');
const buttonSelect = document.getElementById('buttonSelect');

// Function to log responses
function logResponse(message, data) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
  
  if (data) {
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    logEntry.innerHTML += `<pre>${jsonData}</pre>`;
  }
  
  responseLog.appendChild(logEntry);
  responseLog.scrollTop = responseLog.scrollHeight;
}

// Function to update the connection status
function updateConnectionStatus(connected) {
  if (connected) {
    connectionStatus.textContent = 'Connected to MCP server';
    connectionStatus.classList.remove('disconnected');
    connectionStatus.classList.add('connected');
  } else {
    connectionStatus.textContent = 'Not connected to MCP server';
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
  }
}

// Function to load available ROMs
async function loadAvailableRoms() {
  try {
    // Fetch the list of ROMs from the server
    const response = await fetch('/api/roms');
    const roms = await response.json();
    
    // Clear existing options except the first one
    while (romSelect.options.length > 1) {
      romSelect.remove(1);
    }
    
    // Add ROM options
    roms.forEach(rom => {
      const option = document.createElement('option');
      option.value = rom.path;
      option.textContent = rom.name;
      romSelect.appendChild(option);
    });
    
    logResponse('ROMs loaded successfully');
  } catch (error) {
    logResponse('Error loading ROMs', error.message);
  }
}

// Function to call MCP tool
async function callMcpTool(toolName, params = {}) {
  try {
    logResponse(`Calling MCP tool: ${toolName}`, params);
    
    const response = await fetch('/api/tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: toolName,
        params: params
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const result = await response.json();
    logResponse(`Tool response: ${toolName}`, result);
    
    // Update the screen if the response contains an image
    if (result.content && result.content.length > 0) {
      const imageContent = result.content.find(item => item.type === 'image');
      if (imageContent) {
        gameboyScreen.src = `data:${imageContent.mimeType};base64,${imageContent.data}`;
      }
    }
    
    return result;
  } catch (error) {
    logResponse(`Error calling tool ${toolName}`, error.message);
    throw error;
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load available ROMs
  loadAvailableRoms();
  
  // Button press events
  buttonUp.addEventListener('click', () => callMcpTool('press_up'));
  buttonDown.addEventListener('click', () => callMcpTool('press_down'));
  buttonLeft.addEventListener('click', () => callMcpTool('press_left'));
  buttonRight.addEventListener('click', () => callMcpTool('press_right'));
  buttonA.addEventListener('click', () => callMcpTool('press_a'));
  buttonB.addEventListener('click', () => callMcpTool('press_b'));
  buttonStart.addEventListener('click', () => callMcpTool('press_start'));
  buttonSelect.addEventListener('click', () => callMcpTool('press_select'));
  
  // Refresh screen event
  refreshScreen.addEventListener('click', () => callMcpTool('get_screen'));
  
  // Load ROM event
  loadRom.addEventListener('click', () => {
    const selectedRom = romSelect.value;
    if (selectedRom) {
      callMcpTool('load_rom', { romPath: selectedRom });
    } else {
      logResponse('Error', 'Please select a ROM first');
    }
  });
  
  // Initial connection status
  updateConnectionStatus(false);
  
  // Check connection status
  fetch('/api/status')
    .then(response => response.json())
    .then(data => {
      updateConnectionStatus(data.connected);
    })
    .catch(error => {
      logResponse('Error checking connection status', error.message);
    });
});
