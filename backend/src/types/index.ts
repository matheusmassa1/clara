// src/types/index.ts

export interface ParsedCommand {
  action: 'schedule' | 'reschedule' | 'cancel' | 'view' | 'block' | 'help' | 'unknown';
  patient?: string | undefined;
  datetime?: Date | undefined;
  duration?: number;
  timeframe?: 'day' | 'week' | 'month';
  confidence: number;
  originalText: string;
}

export interface ConversationContext {
  psychologistId: string;
  currentCommand?: string;
  step: ConversationStep;
  data: {
    patientName?: string;
    proposedDatetime?: string;
    sessionId?: string;
    conflicts?: string[];
    pendingConfirmation?: boolean;
    lastMessage?: string;
  };
  createdAt: Date;
  expiresAt: Date;
}

export enum ConversationStep {
  COMMAND_PARSING = 'parsing',
  AWAITING_CONFIRMATION = 'confirmation',
  AWAITING_PATIENT_REGISTRATION = 'patient_registration',
  EXECUTION = 'execution',
  COMPLETED = 'completed'
}

export interface CommandPattern {
  intent: string;
  patterns: RegExp[];
  extract: (match: RegExpMatchArray, originalText: string) => ParsedCommand;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  formatted: string;
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictingSession?: {
    patientName: string;
    startTime: string;
    endTime: string;
  };
  availableSlots?: AvailableSlot[];
}

export interface ProcessingResult {
  success: boolean;
  response: string;
  context?: ConversationContext | null;
  error?: string;
}

export interface SimulationMessage {
  id: string;
  timestamp: Date;
  sender: 'psychologist' | 'clara';
  content: string;
  context?: ConversationContext;
}