export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  participant?: string | undefined;
  quotedMessage?: WhatsAppMessage;
}

export interface WhatsAppContact {
  id: string;
  name?: string;
  notify?: string;
  verifiedName?: string;
  imgUrl?: string;
  status?: string;
}

export interface WhatsAppSession {
  id: string;
  psychologistId?: string;
  isConnected: boolean;
  connectionState: 'open' | 'connecting' | 'close';
  qrCode?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface MessageDeliveryStatus {
  messageId: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  error?: string;
}

export interface WhatsAppConfig {
  printQRInTerminal: boolean;
  defaultConnectionTimeoutMs: number;
  keepAliveIntervalMs: number;
  retryRequestDelayMs: number;
  maxMsgRetryCount: number;
  syncFullHistory: boolean;
  markOnlineOnConnect: boolean;
}

export interface PsychologistWhatsAppMapping {
  psychologistId: string;
  whatsappNumber: string;
  fullName: string;
  isActive: boolean;
}