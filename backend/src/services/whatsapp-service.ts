import { WhatsAppClient } from './whatsapp-client';
import { WhatsAppMessageRouter } from './whatsapp-message-router';
import { MessageProcessor } from './message-processor';
import { PsychologistWhatsAppMapping, WhatsAppSession } from '../types/whatsapp';
import { logger } from '../utils/logger';

export class WhatsAppService {
  public whatsappClient: WhatsAppClient; // Make public so scripts can access events
  private messageRouter: WhatsAppMessageRouter;
  private messageProcessor: MessageProcessor;
  private isInitialized = false;
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    
    // Initialize real message processor with database connection
    this.messageProcessor = new MessageProcessor();

    // Initialize WhatsApp client
    this.whatsappClient = new WhatsAppClient({
      printQRInTerminal: true,
      defaultConnectionTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    // Initialize message router with real message processor
    this.messageRouter = new WhatsAppMessageRouter(
      this.messageProcessor,
      this.whatsappClient
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // WhatsApp Client Events
    this.whatsappClient.on('connected', () => {
      logger.info('WhatsApp Service connected and ready');
      this.logStats();
    });

    this.whatsappClient.on('disconnected', () => {
      logger.warn('WhatsApp Service disconnected');
    });

    this.whatsappClient.on('connecting', () => {
      logger.info('WhatsApp Service connecting');
    });

    this.whatsappClient.on('qr', (qrCode) => {
      logger.info('WhatsApp QR Code received');
      console.log('📱 WhatsApp Service: QR Code received, please scan with your phone');
    });

    this.whatsappClient.on('message', (message) => {
      logger.debug('New WhatsApp message received', { from: message.from });
    });

    this.whatsappClient.on('message-error', (error, message) => {
      logger.error('WhatsApp message processing error', { 
        error: error instanceof Error ? error.message : error,
        from: message?.from 
      });
    });

    this.whatsappClient.on('max-reconnect-attempts', () => {
      logger.error('WhatsApp Service max reconnection attempts reached');
    });
  }

  /**
   * Initialize the WhatsApp service
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('WhatsApp Service is already initialized');
      return;
    }

    try {
      logger.info('Starting WhatsApp Service');
      
      await this.whatsappClient.initialize();
      this.isInitialized = true;

      logger.info('WhatsApp Service started successfully');
      
    } catch (error) {
      logger.error('Failed to start WhatsApp Service', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Stop the WhatsApp service
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping WhatsApp Service');
      
      await this.whatsappClient.disconnect();
      this.isInitialized = false;

      logger.info('WhatsApp Service stopped successfully');
      
    } catch (error) {
      logger.error('Error stopping WhatsApp Service', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * Register a psychologist for WhatsApp integration
   */
  registerPsychologist(psychologist: PsychologistWhatsAppMapping): void {
    this.messageRouter.registerPsychologist(psychologist);
  }

  /**
   * Unregister a psychologist
   */
  unregisterPsychologist(whatsappNumber: string): void {
    this.messageRouter.unregisterPsychologist(whatsappNumber);
  }

  /**
   * Update psychologist status
   */
  updatePsychologistStatus(whatsappNumber: string, isActive: boolean): void {
    this.messageRouter.updatePsychologistStatus(whatsappNumber, isActive);
  }

  /**
   * Get service status
   */
  getStatus(): {
    isInitialized: boolean;
    isConnected: boolean;
    session: WhatsAppSession;
    queueStats: { total: number; retrying: number; failed: number };
    uptime: number;
    registeredPsychologists: number;
  } {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.whatsappClient.isConnected(),
      session: this.whatsappClient.getSession(),
      queueStats: this.messageRouter.getQueueStats(),
      uptime: Date.now() - this.startTime.getTime(),
      registeredPsychologists: this.messageRouter.getRegisteredPsychologists().length
    };
  }

  /**
   * Send message to a specific number
   */
  async sendMessage(to: string, message: string): Promise<string | null> {
    if (!this.isInitialized || !this.whatsappClient.isConnected()) {
      throw new Error('WhatsApp Service is not connected');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    return await this.whatsappClient.sendMessage(jid, message);
  }

  /**
   * Broadcast message to all registered psychologists
   */
  async broadcastMessage(message: string): Promise<void> {
    if (!this.isInitialized || !this.whatsappClient.isConnected()) {
      throw new Error('WhatsApp Service is not connected');
    }

    await this.messageRouter.broadcastMessage(message);
  }

  /**
   * Get registered psychologists
   */
  getRegisteredPsychologists(): PsychologistWhatsAppMapping[] {
    return this.messageRouter.getRegisteredPsychologists();
  }

  /**
   * Log service statistics
   */
  private logStats(): void {
    const status = this.getStatus();
    
    logger.info('WhatsApp Service Statistics', {
      status: status.isConnected ? 'Connected' : 'Disconnected',
      uptime: Math.floor(status.uptime / 1000),
      registeredPsychologists: status.registeredPsychologists,
      messageQueue: {
        total: status.queueStats.total,
        retrying: status.queueStats.retrying,
        failed: status.queueStats.failed
      }
    });

    // Keep console output for development
    console.log('\n📊 WhatsApp Service Statistics:');
    console.log(`   🟢 Status: ${status.isConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`   ⏱️ Uptime: ${Math.floor(status.uptime / 1000)}s`);
    console.log(`   👩‍⚕️ Registered Psychologists: ${status.registeredPsychologists}`);
    console.log(`   📥 Message Queue: ${status.queueStats.total} (${status.queueStats.retrying} retrying, ${status.queueStats.failed} failed)`);
    console.log('');
  }

  /**
   * Health check endpoint
   */
  isHealthy(): boolean {
    return this.isInitialized && this.whatsappClient.isConnected();
  }

  /**
   * Force restart connection
   */
  async restart(): Promise<void> {
    logger.info('Restarting WhatsApp Service');
    
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.start();
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();