# Clara MVP - Manual Scheduling Mode

## 🎯 MVP Feature Scope

### ✅ Core Features (Must Have)
1. **Basic Scheduling Commands**
   - Schedule new sessions
   - Cancel existing sessions
   - View daily/weekly agenda
   - Implicit patient registration

2. **Working Hours Management**
   - Configure working hours per day
   - Prevent scheduling outside working hours
   - Basic conflict detection

3. **Google Calendar Integration**
   - One-way sync (Clara → Google Calendar)
   - Create/update/delete calendar events

4. **Multi-tenant Support**
   - Multiple psychologists on shared WhatsApp number
   - Data isolation per psychologist

### 🔄 Deferred Features (Phase 2+)
- Recurring sessions
- Advanced availability blocks
- Two-way calendar sync
- Session reminders
- Patient phone numbers
- Rescheduling commands
- Session notes

## 📱 WhatsApp Message Flow Examples

### 1. Psychologist Registration (First Time)
```
👋 Hi! I'm Clara, your scheduling assistant.

I need to set up your profile first:
• What's your full name?
• What are your working hours? (e.g., "Mon-Fri 9am-6pm")

Type your info and I'll get you started!
```

**Response handling:**
```
Perfect! Dr. Maria Silva registered ✅

Working Hours:
📅 Mon-Fri: 9:00 - 18:00
📅 Sat-Sun: Closed

You can now start scheduling! Try:
"Schedule Ana Thursday 2pm"
"Show my week"
"Cancel João tomorrow"
```

### 2. Basic Scheduling Flow
```
Psychologist: "Schedule Ana Thursday 2pm"

Clara: "📅 Scheduling Ana Silva
• Date: Thursday, Jan 18
• Time: 14:00 - 14:50
• Duration: 50 minutes

Confirm? (Yes/No)"

Psychologist: "Yes"

Clara: "✅ Session scheduled!
📲 Added to your Google Calendar
🔗 Event: bit.ly/cal-link"
```

### 3. New Patient Registration
```
Psychologist: "Schedule João Friday 10am"

Clara: "👤 I haven't seen João before. 
Should I add him as a new patient? (Yes/No)"

Psychologist: "Yes"

Clara: "✅ João added as new patient!

📅 Scheduling João
• Date: Friday, Jan 19
• Time: 10:00 - 10:50

Confirm? (Yes/No)"
```

### 4. Conflict Detection
```
Psychologist: "Schedule Carlos Thursday 2pm"

Clara: "⚠️ Conflict detected!
You already have Ana scheduled at 14:00-14:50

Available times on Thursday:
• 09:00 - 09:50 ✅
• 15:00 - 15:50 ✅
• 16:00 - 16:50 ✅

Try: "Schedule Carlos Thursday 3pm""
```

### 5. View Agenda
```
Psychologist: "Show my week"

Clara: "📅 Your week (Jan 15-21)

**Tuesday, Jan 16**
• 10:00 - Ana Silva
• 15:00 - João Santos

**Thursday, Jan 18**
• 14:00 - Ana Silva

**Friday, Jan 19**
• 09:00 - Carlos Lima
• 11:00 - Maria Costa

Total: 5 sessions this week"
```

### 6. Cancellation
```
Psychologist: "Cancel Ana Thursday"

Clara: "❌ Cancel session?
• Patient: Ana Silva  
• Date: Thursday, Jan 18
• Time: 14:00 - 14:50

Confirm cancellation? (Yes/No)"

Psychologist: "Yes" 

Clara: "✅ Session cancelled
🗓️ Removed from Google Calendar
Ana Silva is now available for Thursday 14:00"
```

## 🔧 Backend API Endpoints

### Authentication & Setup
```typescript
POST /api/psychologists/register
// Register new psychologist via WhatsApp number

GET /api/psychologists/me
// Get current psychologist profile

PUT /api/psychologists/working-hours
// Update working hours configuration
```

### Patient Management
```typescript
GET /api/patients
// List all patients for current psychologist

POST /api/patients
// Create new patient (implicit from scheduling)

GET /api/patients/:id/sessions
// Get session history for patient
```

### Session Management
```typescript
POST /api/sessions
// Create new session

GET /api/sessions
// List sessions (with date filters)

PUT /api/sessions/:id
// Update session details

DELETE /api/sessions/:id
// Cancel session

GET /api/sessions/conflicts
// Check for scheduling conflicts
```

### Calendar Integration
```typescript
POST /api/calendar/sync
// Trigger Google Calendar sync

GET /api/calendar/availability
// Get available time slots for date range
```

### WhatsApp Integration
```typescript
POST /api/whatsapp/webhook
// Handle incoming WhatsApp messages

POST /api/whatsapp/send
// Send outgoing messages

GET /api/whatsapp/status
// Check WhatsApp connection health
```

## 🧠 Natural Language Command Parser

### Command Recognition Patterns
```typescript
interface CommandPattern {
  intent: string;
  patterns: RegExp[];
  extract: (match: RegExpMatchArray) => ParsedCommand;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    intent: 'schedule',
    patterns: [
      /schedule\s+(\w+)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\w+day)\s+(\d{1,2}(?::\d{2})?(?:am|pm)?)/i,
      /marcar\s+(\w+)\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo|\w+)\s+(\d{1,2}(?::\d{2})?(?:h)?)/i
    ],
    extract: (match) => ({
      action: 'schedule',
      patient: match[1],
      datetime: parseDateTime(match[2], match[3]),
      confidence: 0.9
    })
  },
  
  {
    intent: 'cancel',
    patterns: [
      /cancel\s+(\w+)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /cancelar\s+(\w+)\s+(hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo)/i
    ],
    extract: (match) => ({
      action: 'cancel',
      patient: match[1],
      datetime: parseDateTime(match[2]),
      confidence: 0.85
    })
  },
  
  {
    intent: 'view_agenda',
    patterns: [
      /show\s+(my\s+)?(week|today|tomorrow|agenda)/i,
      /mostrar\s+(minha\s+)?(semana|hoje|amanhã|agenda)/i
    ],
    extract: (match) => ({
      action: 'view',
      timeframe: match[2] === 'week' ? 'week' : 'day',
      confidence: 0.95
    })
  }
];
```

### Fuzzy Patient Name Matching
```typescript
import { distance } from 'fastest-levenshtein';

function findBestPatientMatch(inputName: string, patients: Patient[]): Patient | null {
  const threshold = 0.7;
  let bestMatch: Patient | null = null;
  let bestScore = 0;

  for (const patient of patients) {
    const similarity = 1 - (distance(inputName.toLowerCase(), patient.full_name.toLowerCase()) / Math.max(inputName.length, patient.full_name.length));
    
    if (similarity > threshold && similarity > bestScore) {
      bestMatch = patient;
      bestScore = similarity;
    }
  }

  return bestMatch;
}
```

## 🔄 Session State Management

### Conversation Context (Redis)
```typescript
interface ConversationContext {
  psychologist_id: string;
  current_command?: string;
  step: 'parsing' | 'confirmation' | 'execution' | 'completed';
  data: {
    patient_name?: string;
    proposed_datetime?: string;
    session_id?: string;
    conflicts?: string[];
  };
  created_at: Date;
  expires_at: Date;
}

// Store conversation state
await redis.setex(
  `conversation:${whatsappNumber}`, 
  300, // 5 minutes expiry
  JSON.stringify(context)
);
```

### Confirmation Flow State Machine
```typescript
enum ConversationStep {
  COMMAND_PARSING = 'parsing',
  AWAITING_CONFIRMATION = 'confirmation', 
  AWAITING_PATIENT_REGISTRATION = 'patient_registration',
  EXECUTION = 'execution',
  COMPLETED = 'completed'
}

class ConversationManager {
  async processMessage(whatsappNumber: string, message: string): Promise<string> {
    const context = await this.getContext(whatsappNumber);
    
    switch (context.step) {
      case ConversationStep.COMMAND_PARSING:
        return this.parseCommand(message, context);
      
      case ConversationStep.AWAITING_CONFIRMATION:
        return this.handleConfirmation(message, context);
      
      case ConversationStep.AWAITING_PATIENT_REGISTRATION:
        return this.handlePatientRegistration(message, context);
      
      default:
        return this.parseCommand(message, context);
    }
  }
}
```

## 🏗️ Implementation Priority

### Week 1-2: Foundation
1. Database schema setup
2. Basic WhatsApp integration (Baileys)
3. Psychologist registration flow
4. Simple command parser

### Week 3-4: Core Features  
1. Schedule/cancel session commands
2. Patient implicit registration
3. Basic conflict detection
4. View agenda functionality

### Week 5-6: Calendar & Polish
1. Google Calendar integration
2. Working hours validation
3. Error handling & edge cases
4. Message delivery reliability

### Week 7-8: Testing & Deployment
1. End-to-end testing
2. Load testing WhatsApp integration
3. Railway/Fly.io deployment
4. Monitoring & logging setup