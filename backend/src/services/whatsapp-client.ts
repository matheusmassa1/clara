import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WAMessage,
  WASocket,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode-terminal';
import { EventEmitter } from 'events';
import { WhatsAppMessage, WhatsAppSession, WhatsAppConfig, MessageDeliveryStatus } from '../types/whatsapp';

export class WhatsAppClient extends EventEmitter {
  private socket: WASocket | null = null;
  private session: WhatsAppSession;
  private config: WhatsAppConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isInitializing = false;

  constructor(config: Partial<WhatsAppConfig> = {}) {
    super();
    
    this.config = {
      printQRInTerminal: true,
      defaultConnectionTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 1000,
      maxMsgRetryCount: 3,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      ...config
    };

    this.session = {
      id: 'clara-whatsapp-session',
      isConnected: false,
      connectionState: 'close',
      createdAt: new Date(),
      lastActivity: new Date()
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      console.log('WhatsApp client is already initializing...');
      return;
    }

    this.isInitializing = true;
    console.log('🚀 Initializing WhatsApp client...');

    try {
      // Setup authentication state
      const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

      // Create socket connection
      this.socket = makeWASocket({
        auth: state,
        // printQRInTerminal: this.config.printQRInTerminal, // Deprecated, we handle QR manually
        defaultQueryTimeoutMs: this.config.defaultConnectionTimeoutMs,
        keepAliveIntervalMs: this.config.keepAliveIntervalMs,
        retryRequestDelayMs: this.config.retryRequestDelayMs,
        maxMsgRetryCount: this.config.maxMsgRetryCount,
        syncFullHistory: this.config.syncFullHistory,
        markOnlineOnConnect: this.config.markOnlineOnConnect,
        generateHighQualityLinkPreview: true,
        shouldSyncHistoryMessage: () => false, // Don't sync old messages for performance
        browser: ['Clara Bot', 'Desktop', '1.0.0'], // Identify as Clara Bot
        connectTimeoutMs: 60000,
        qrTimeout: 30000,
      });

      // Setup event handlers
      this.setupEventHandlers(saveCreds);

    } catch (error) {
      console.error('❌ Failed to initialize WhatsApp client:', error);
      this.isInitializing = false;
      throw error;
    }
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Connection state updates
    this.socket.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update, saveCreds);
    });

    // New messages
    this.socket.ev.on('messages.upsert', async (messageUpdate) => {
      await this.handleNewMessages(messageUpdate);
    });

    // Message delivery receipts
    this.socket.ev.on('message-receipt.update', (receipts) => {
      this.handleMessageReceipts(receipts);
    });

    // Credentials update
    this.socket.ev.on('creds.update', saveCreds);

    // Handle errors
    this.socket.ev.on('connection.update', (update) => {
      if (update.lastDisconnect?.error) {
        console.error('❌ WhatsApp connection error:', update.lastDisconnect.error);
      }
    });
  }

  private async handleConnectionUpdate(
    update: Partial<ConnectionState>,
    saveCreds: () => Promise<void>
  ): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    // Handle QR code
    if (qr) {
      console.log('📱 QR Code received, scan it to connect WhatsApp:');
      console.log('🔗 You can also copy this QR data to view it: ' + qr);
      
      // Always print QR in terminal
      QRCode.generate(qr, { small: true });
      
      this.session.qrCode = qr;
      this.emit('qr', qr);
    }

    // Handle connection state changes
    if (connection) {
      this.session.connectionState = connection;
      this.session.lastActivity = new Date();

      switch (connection) {
        case 'open':
          console.log('✅ WhatsApp connected successfully!');
          this.session.isConnected = true;
          this.reconnectAttempts = 0;
          this.isInitializing = false;
          this.emit('connected');
          break;

        case 'connecting':
          console.log('🔄 Connecting to WhatsApp...');
          this.session.isConnected = false;
          this.emit('connecting');
          break;

        case 'close':
          this.session.isConnected = false;
          this.emit('disconnected');
          
          const shouldReconnect = await this.handleDisconnection(lastDisconnect);
          if (shouldReconnect) {
            await this.reconnect();
          }
          break;
      }
    }
  }

  private async handleDisconnection(lastDisconnect: any): Promise<boolean> {
    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

    switch (reason) {
      case DisconnectReason.badSession:
        console.log('❌ Bad session file, please delete and scan again');
        return false;

      case DisconnectReason.connectionClosed:
        console.log('🔌 Connection closed, reconnecting...');
        return true;

      case DisconnectReason.connectionLost:
        console.log('📶 Connection lost, reconnecting...');
        return true;

      case DisconnectReason.connectionReplaced:
        console.log('🔄 Connection replaced, probably opened another session');
        return false;

      case DisconnectReason.loggedOut:
        console.log('👋 Device logged out, please scan QR again');
        return false;

      case DisconnectReason.restartRequired:
        console.log('🔄 Restart required (usually happens during initial setup)');
        console.log('💡 Clearing auth session and restarting...');
        // Clear auth session for restart required errors
        return true;

      case DisconnectReason.timedOut:
        console.log('⏰ Connection timed out, reconnecting...');
        return true;

      default:
        console.log('❓ Unknown disconnect reason:', reason);
        return true;
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('max-reconnect-attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts), 45000); // Slower, longer delays
    
    console.log(`🔄 Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    console.log(`💡 Tip: If this keeps happening, wait 5 minutes before trying again`);
    
    setTimeout(async () => {
      this.isInitializing = false; // Reset initialization flag
      await this.initialize();
    }, delay);
  }

  private async handleNewMessages(messageUpdate: { messages: WAMessage[], type: string }): Promise<void> {
    const { messages, type } = messageUpdate;

    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        const whatsappMessage = this.parseMessage(message);
        if (whatsappMessage) {
          this.session.lastActivity = new Date();
          this.emit('message', whatsappMessage);
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
        this.emit('message-error', error, message);
      }
    }
  }

  private parseMessage(waMessage: WAMessage): WhatsAppMessage | null {
    const messageInfo = waMessage.key;
    const messageContent = waMessage.message;

    if (!messageInfo.remoteJid || !messageContent) return null;

    // Skip messages from status updates
    if (messageInfo.remoteJid === 'status@broadcast') return null;

    // Get message body
    const body = this.extractMessageBody(messageContent);
    if (!body) return null;

    // Skip messages sent by us
    if (messageInfo.fromMe) return null;

    const whatsappMessage: WhatsAppMessage = {
      id: messageInfo.id || '',
      from: messageInfo.remoteJid,
      to: this.socket?.user?.id || '',
      body: body.trim(),
      timestamp: (waMessage.messageTimestamp as number) || Date.now(),
      isGroup: messageInfo.remoteJid?.endsWith('@g.us') || false,
      ...(messageInfo.participant && { participant: messageInfo.participant })
    };

    // Handle quoted messages
    if ((messageContent as any).extendedTextMessage?.contextInfo?.quotedMessage) {
      // Parse quoted message if needed
    }

    return whatsappMessage;
  }

  private extractMessageBody(messageContent: any): string | null {
    // Text messages
    if (messageContent.conversation) {
      return messageContent.conversation;
    }

    // Extended text messages (with formatting, links, etc.)
    if (messageContent.extendedTextMessage?.text) {
      return messageContent.extendedTextMessage.text;
    }

    // Image with caption
    if (messageContent.imageMessage?.caption) {
      return messageContent.imageMessage.caption;
    }

    // Video with caption
    if (messageContent.videoMessage?.caption) {
      return messageContent.videoMessage.caption;
    }

    // Document with caption
    if (messageContent.documentMessage?.caption) {
      return messageContent.documentMessage.caption;
    }

    // Audio messages (return a placeholder)
    if (messageContent.audioMessage) {
      return '[Mensagem de áudio]';
    }

    // Stickers
    if (messageContent.stickerMessage) {
      return '[Figurinha]';
    }

    // Location
    if (messageContent.locationMessage) {
      return '[Localização]';
    }

    // Contact
    if (messageContent.contactMessage) {
      return '[Contato]';
    }

    return null;
  }

  private handleMessageReceipts(receipts: any[]): void {
    receipts.forEach(receipt => {
      const status: MessageDeliveryStatus = {
        messageId: receipt.key.id,
        status: receipt.receipt.readTimestamp ? 'read' : 'delivered',
        timestamp: new Date(receipt.receipt.receiptTimestamp * 1000)
      };

      this.emit('message-receipt', status);
    });
  }

  async sendMessage(to: string, message: string): Promise<string | null> {
    if (!this.socket || !this.session.isConnected) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      console.log(`📤 Sending message to ${to}: ${message.substring(0, 50)}...`);

      const result = await this.socket.sendMessage(to, { text: message });
      
      const messageId = result?.key?.id;
      if (messageId) {
        console.log(`✅ Message sent successfully with ID: ${messageId}`);
        return messageId;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  async sendTyping(to: string, duration: number = 3000): Promise<void> {
    if (!this.socket || !this.session.isConnected) return;

    try {
      await this.socket.sendPresenceUpdate('composing', to);
      
      setTimeout(async () => {
        if (this.socket && this.session.isConnected) {
          await this.socket.sendPresenceUpdate('paused', to);
        }
      }, duration);
    } catch (error) {
      console.error('❌ Failed to send typing indicator:', error);
    }
  }

  getSession(): WhatsAppSession {
    return { ...this.session };
  }

  isConnected(): boolean {
    return this.session.isConnected;
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      console.log('👋 Disconnecting WhatsApp client...');
      await this.socket?.logout();
      this.socket = null;
      this.session.isConnected = false;
      this.session.connectionState = 'close';
    }
  }

  async getContactInfo(jid: string): Promise<any | null> {
    if (!this.socket || !this.session.isConnected) {
      return null;
    }

    try {
      const contact = await this.socket.onWhatsApp(jid);
      return contact?.[0] || null;
    } catch (error) {
      console.error('❌ Failed to get contact info:', error);
      return null;
    }
  }
}