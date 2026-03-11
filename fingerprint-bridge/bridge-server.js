const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173/", // Your React app URL
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Store connected device
let fingerprintDevice = null;
let serialPort = null;

// Configuration for Digital Persona 4500
const DEVICE_CONFIG = {
  vendorId: 0x05ba,  // Digital Persona vendor ID
  productId: 0x000a,  // U.are.U 4500 product ID
  baudRate: 9600      // Standard baud rate for fingerprint scanners
};

// Find and connect to USB device
async function connectToDevice() {
  try {
    // List all serial ports
    const ports = await SerialPort.list();
    console.log('Available ports:', ports);

    // Find Digital Persona device
    const devicePort = ports.find(port => 
      port.vendorId === DEVICE_CONFIG.vendorId.toString(16) ||
      port.productId === DEVICE_CONFIG.productId.toString(16)
    );

    if (!devicePort) {
      console.log('Device not found. Please check connection.');
      return false;
    }

    console.log('Found device at:', devicePort.path);

    // Connect to the device
    serialPort = new SerialPort({
      path: devicePort.path,
      baudRate: DEVICE_CONFIG.baudRate,
      autoOpen: false
    });

    // Set up data parser
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    // Handle incoming data
    parser.on('data', (data) => {
      console.log('Fingerprint data received:', data);
      io.emit('fingerprint-data', { 
        data: data,
        timestamp: new Date().toISOString()
      });
    });

    // Open the port
    serialPort.open((err) => {
      if (err) {
        console.error('Error opening port:', err);
        return false;
      }
      console.log('Connected to fingerprint scanner');
      
      // Send initialization command
      serialPort.write('INIT\r\n');
    });

    return true;

  } catch (error) {
    console.error('Connection error:', error);
    return false;
  }
}

// WebSocket connection for real-time events
io.on('connection', (socket) => {
  console.log('Client connected to WebSocket');

  // Send current connection status
  socket.emit('connection-status', { 
    connected: serialPort ? serialPort.isOpen : false 
  });

  // Handle scan request from frontend
  socket.on('scan-fingerprint', async () => {
    console.log('Scan request received');
    
    if (!serialPort || !serialPort.isOpen) {
      socket.emit('error', { message: 'Scanner not connected' });
      return;
    }

    // Send scan command to device
    serialPort.write('SCAN\r\n');
    
    // Emit scanning status
    socket.emit('scanning', { status: 'in-progress' });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// REST API endpoints
app.post('/api/clock-in', async (req, res) => {
  try {
    const { employeeId } = req.body;
    
    if (!serialPort || !serialPort.isOpen) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fingerprint scanner not connected' 
      });
    }

    // Send clock-in command with employee ID
    serialPort.write(`CLOCK_IN:${employeeId}\r\n`);

    // Wait for response (simplified - you'd want proper async handling)
    setTimeout(() => {
      res.json({ 
        success: true, 
        message: 'Clock-in request sent to scanner' 
      });
    }, 1000);

  } catch (error) {
    console.error('Clock-in error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    connected: serialPort ? serialPort.isOpen : false,
    device: fingerprintDevice ? 'connected' : 'disconnected'
  });
});

// Auto-connect on startup
connectToDevice().then(success => {
  if (success) {
    console.log('✅ Fingerprint scanner ready');
  } else {
    console.log('❌ Please connect fingerprint scanner');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Bridge server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
});