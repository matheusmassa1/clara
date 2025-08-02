# Clara Phase 1 - System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Psychologist  │◄──►│  WhatsApp Web    │◄──►│  Clara Backend  │
│   (WhatsApp)    │    │   Automation     │    │   (Node.js)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              │                          ▼
                              │                ┌─────────────────┐
                              │                │   PostgreSQL    │
                              │                │   + Redis       │
                              │                └─────────────────┘
                              │                          │
                              │                          ▼
                              │                ┌─────────────────┐
                              └───────────────►│ Google Calendar │
                                               │   Integration   │
                                               └─────────────────┘
```

## 🔧 Core Components

### 1. WhatsApp Integration Layer
- **Library**: Baileys or Z-API for MVP
- **Responsibilities**:
  - Receive/send messages from shared Clara number
  - Route messages to correct psychologist based on sender phone
  - Handle message delivery status and retries
  - Session management for WhatsApp Web connection

### 2. Message Processing Engine (Node.js)
- **Command Parser**: Natural language to structured commands
- **Session Manager**: Handle conversational state
- **Validation Layer**: Check conflicts, availability, patient existence
- **Response Generator**: Create contextual WhatsApp responses

### 3. Calendar Integration
- **Google Calendar API**: Two-way sync
- **Conflict Detection**: Prevent double-booking
- **Time Zone Handling**: Brazil timezone support
- **Recurring Events**: Handle weekly/monthly sessions

### 4. Database Layer (PostgreSQL + Redis)
- **PostgreSQL**: Core data (users, patients, sessions, availability)
- **Redis**: Session state, rate limiting, message queues

## 📊 Database Schema

### Core Tables

```sql
-- Psychologists (multi-tenant support)
CREATE TABLE psychologists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    google_calendar_id VARCHAR(255),
    working_hours JSONB NOT NULL, -- {"mon": "09:00-17:00", "tue": "10:00-18:00"}
    session_duration_minutes INTEGER DEFAULT 50,
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Patients (scoped per psychologist)
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psychologist_id UUID REFERENCES psychologists(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(20), -- Optional, for Smart Copilot Mode
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(psychologist_id, full_name)
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psychologist_id UUID REFERENCES psychologists(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
    google_calendar_event_id VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_pattern JSONB, -- {"frequency": "weekly", "until": "2024-12-31"}
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Availability blocks (for time-off, breaks)
CREATE TABLE availability_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psychologist_id UUID REFERENCES psychologists(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    block_type VARCHAR(20) NOT NULL, -- 'unavailable', 'break', 'vacation'
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Message logs (for debugging and analytics)
CREATE TABLE message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psychologist_id UUID REFERENCES psychologists(id),
    message_type VARCHAR(50), -- 'command', 'response', 'error'
    content TEXT NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB -- Store command parsing results, errors, etc.
);
```

### Indexes
```sql
CREATE INDEX idx_sessions_psychologist_date ON sessions(psychologist_id, scheduled_at);
CREATE INDEX idx_patients_psychologist ON patients(psychologist_id);
CREATE INDEX idx_availability_psychologist_time ON availability_blocks(psychologist_id, start_time, end_time);
CREATE INDEX idx_psychologists_whatsapp ON psychologists(whatsapp_number);
```

## 🔄 Message Flow Architecture

### 1. Incoming Message Processing
```
WhatsApp Message → Message Router → Psychologist Identification → Command Parser → Business Logic → Response Generator → WhatsApp Response
```

### 2. Session State Management (Redis)
```json
{
  "session:+5511999999999": {
    "psychologist_id": "uuid",
    "current_command": "schedule",
    "context": {
      "patient_name": "João",
      "proposed_time": "Thursday 14:00"
    },
    "step": "confirmation",
    "expires_at": "2024-01-20T15:00:00Z"
  }
}
```

## 🎯 Command Processing Pipeline

### Natural Language Command Parser
```typescript
interface ParsedCommand {
  action: 'schedule' | 'reschedule' | 'cancel' | 'view' | 'block';
  patient?: string;
  datetime?: Date;
  duration?: number;
  recurring?: RecurringPattern;
  confidence: number;
}
```

### Command Examples
- "Schedule Ana Thursday 10am" → `{action: 'schedule', patient: 'Ana', datetime: '2024-01-18T10:00:00'}`
- "Cancel João tomorrow" → `{action: 'cancel', patient: 'João', datetime: '2024-01-17'}`
- "Show my week" → `{action: 'view', timeframe: 'week'}`
- "Block Friday afternoon" → `{action: 'block', datetime: '2024-01-19T13:00:00'}`

## 🔗 Google Calendar Integration

### Two-way Sync Strategy
1. **Clara → Google**: Create/update/delete events when sessions change
2. **Google → Clara**: Webhook to detect external changes and update local DB
3. **Conflict Resolution**: Google Calendar as source of truth for scheduling conflicts

### Event Format
```json
{
  "summary": "Session: João Silva",
  "description": "Therapy session scheduled via Clara",
  "start": {"dateTime": "2024-01-18T10:00:00-03:00"},
  "end": {"dateTime": "2024-01-18T10:50:00-03:00"},
  "extendedProperties": {
    "private": {
      "clara_session_id": "uuid",
      "clara_patient_id": "uuid"
    }
  }
}
```

## 🚀 Deployment Architecture (MVP)

### Development Stack
- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (Supabase) + Redis (Railway/Upstash)
- **WhatsApp**: Baileys library
- **Calendar**: Google Calendar API
- **Hosting**: Railway or Fly.io

### Production Migration Path
- **WhatsApp**: Migrate to WhatsApp Business Cloud API
- **Infrastructure**: AWS (Lambda + RDS + ElastiCache)
- **Monitoring**: Sentry + DataDog
- **CI/CD**: GitHub Actions