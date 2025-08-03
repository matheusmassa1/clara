# Clara - WhatsApp Integration Layer

## 🚀 Overview

The WhatsApp integration layer uses **Baileys** library to provide seamless WhatsApp Business automation for Clara's psychologist scheduling system. This implementation allows psychologists to receive and respond to scheduling requests directly through WhatsApp.

## 📁 File Structure

```
backend/src/
├── types/whatsapp.ts              # TypeScript interfaces for WhatsApp
├── services/
│   ├── whatsapp-client.ts         # Core WhatsApp client using Baileys
│   ├── whatsapp-message-router.ts # Message routing and processing
│   └── whatsapp-service.ts        # Main service orchestrator
├── routes/whatsapp.ts             # REST API endpoints
├── scripts/init-whatsapp.ts       # Initialization script
└── views/whatsapp-dashboard.html  # Management dashboard
```

## 🔧 Core Components

### 1. WhatsAppClient (`whatsapp-client.ts`)
- **Purpose**: Direct interface with WhatsApp using Baileys
- **Features**:
  - QR code authentication
  - Message sending/receiving
  - Connection management
  - Automatic reconnection
  - Typing indicators
  - Message delivery receipts

### 2. WhatsAppMessageRouter (`whatsapp-message-router.ts`)
- **Purpose**: Routes incoming messages to appropriate psychologists
- **Features**:
  - Phone number mapping
  - Message queuing and retries
  - Unknown sender handling
  - Broadcast messaging
  - Processing queue management

### 3. WhatsAppService (`whatsapp-service.ts`)
- **Purpose**: Main orchestrator for WhatsApp functionality
- **Features**:
  - Service lifecycle management
  - Psychologist registration
  - Status monitoring
  - Health checks

## 🛠️ Setup and Installation

### 1. Install Dependencies
```bash
cd backend
npm install @whiskeysockets/baileys qrcode-terminal
```

### 2. Start WhatsApp Service
```bash
# Option 1: Use the initialization script
npm run whatsapp:init

# Option 2: Start with the main app
npm run dev
```

### 3. Scan QR Code
When you start the service, a QR code will appear in the terminal. Scan it with your WhatsApp mobile app to connect.

## 📱 Usage

### API Endpoints

All WhatsApp endpoints are available under `/api/whatsapp`:

#### Service Management
- `GET /api/whatsapp/status` - Get service status
- `POST /api/whatsapp/start` - Start WhatsApp service
- `POST /api/whatsapp/stop` - Stop WhatsApp service
- `POST /api/whatsapp/restart` - Restart WhatsApp service
- `GET /api/whatsapp/health` - Health check

#### Psychologist Management
- `GET /api/whatsapp/psychologists` - List registered psychologists
- `POST /api/whatsapp/psychologists` - Register new psychologist
- `PATCH /api/whatsapp/psychologists/:number/status` - Update psychologist status
- `DELETE /api/whatsapp/psychologists/:number` - Unregister psychologist

#### Messaging
- `POST /api/whatsapp/send-message` - Send test message
- `POST /api/whatsapp/broadcast` - Broadcast to all psychologists

### Dashboard
Access the WhatsApp management dashboard at:
```
http://localhost:3000/simulator/whatsapp-dashboard
```

## 👩‍⚕️ Registering Psychologists

### Via API
```bash
curl -X POST http://localhost:3000/api/whatsapp/psychologists \
  -H "Content-Type: application/json" \
  -d '{
    "psychologistId": "psych-001",
    "whatsappNumber": "5511999999999",
    "fullName": "Dra. Ana Silva",
    "isActive": true
  }'
```

### Via Dashboard
1. Go to the WhatsApp dashboard
2. Fill in the "Cadastrar Psicólogo" form
3. Click "Cadastrar"

### Via Initialization Script
The `init-whatsapp.ts` script includes mock psychologists for testing.

## 💬 Testing Message Processing

### Mock Responses (Current Implementation)
The system currently uses mock responses for testing:

- **"agendar"** or **"marcar"** → Scheduling confirmation
- **"cancelar"** or **"desmarcar"** → Cancellation confirmation  
- **"agenda"** or **"ver"** → Agenda viewing message
- **"ajuda"** or **"help"** → Help message with commands
- **Other messages** → Generic help response

### Sample Commands to Test
Send these messages via WhatsApp to test the system:

```
agendar Ana quinta 14h
cancelar João segunda
ver agenda
ajuda
```

## 🔄 Message Flow

```
WhatsApp Message → WhatsAppClient → WhatsAppMessageRouter → MessageProcessor → Response → WhatsApp
```

1. **WhatsApp receives message** from psychologist's contact
2. **WhatsAppClient** parses and validates the message
3. **WhatsAppMessageRouter** identifies the psychologist by phone number
4. **MessageProcessor** analyzes the message content (currently mocked)
5. **Response** is generated and sent back via WhatsApp

## 🏗️ Architecture Features

### Connection Management
- **Automatic QR Code Generation**: New QR codes when session expires
- **Reconnection Logic**: Automatic reconnection with exponential backoff
- **Session Persistence**: Auth state saved to `./auth_info_baileys/`
- **Connection Monitoring**: Real-time status updates

### Message Handling
- **Queue System**: Message processing queue with retry logic
- **Error Handling**: Graceful error handling with user notifications
- **Typing Indicators**: Shows "typing..." while processing
- **Delivery Receipts**: Tracks message delivery status

### Security & Reliability
- **Phone Number Validation**: Supports Brazilian phone number formats
- **Rate Limiting**: Built into Express app
- **Content Filtering**: Skips status updates and own messages
- **Unknown Sender Handling**: Welcomes unknown users appropriately

## 🚧 Current Limitations (Mock Mode)

The current implementation runs in **mock mode** without database integration:

- ✅ **WhatsApp connectivity** - Fully functional
- ✅ **Message routing** - Working correctly  
- ✅ **Command recognition** - Basic pattern matching
- ⚠️ **Database operations** - Mocked responses only
- ⚠️ **Real scheduling** - Not connected to calendar/database

## 🔮 Next Steps

### 1. Database Integration
Replace the mock message processor with real database connectivity:

```typescript
// In whatsapp-service.ts, replace the mock with:
const sessionManager = new SessionManager();
const commandParser = new CommandParser();
const validationLayer = new ValidationLayer();
const responseGenerator = new ResponseGenerator();

this.messageProcessor = new MessageProcessor(
  commandParser,
  sessionManager,
  validationLayer,
  responseGenerator
);
```

### 2. Calendar Integration
Connect to Google Calendar API for real scheduling operations.

### 3. Enhanced Monitoring
Add comprehensive logging, metrics, and alerting.

### 4. Production Deployment
- Move from Baileys to WhatsApp Business Cloud API
- Add proper authentication and authorization
- Implement horizontal scaling

## 🐛 Troubleshooting

### QR Code Issues
- **QR Code not appearing**: Check terminal size and colors
- **QR Code expired**: Restart the service to generate a new one
- **Connection failed**: Ensure stable internet and try again

### Message Processing Issues
- **Messages not received**: Check if psychologist is registered and active
- **No responses**: Check console for processing errors
- **Wrong psychologist**: Verify phone number mapping

### Common Commands
```bash
# Check service status
curl http://localhost:3000/api/whatsapp/status

# View registered psychologists
curl http://localhost:3000/api/whatsapp/psychologists

# Health check
curl http://localhost:3000/api/whatsapp/health
```

## 📊 Monitoring

### Service Status
The service provides comprehensive status information:
- Connection state (connected/disconnected/connecting)
- Uptime
- Registered psychologists count
- Message queue statistics
- Error rates

### Logs
All WhatsApp operations are logged with timestamps and appropriate log levels:
- 🟢 Connection events
- 📨 Message processing
- ❌ Errors and retries
- 📊 Queue statistics

---

## 🎯 Summary

The WhatsApp integration layer provides a robust foundation for Clara's messaging functionality. While currently in mock mode for testing, it's designed to seamlessly integrate with the existing command parser, session manager, and validation systems once database connectivity is established.

The system handles all the complexities of WhatsApp integration (authentication, connection management, message parsing) while providing a clean interface for the business logic layer.