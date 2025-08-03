import { WhatsAppMessage, PsychologistWhatsAppMapping } from '../types/whatsapp';
import { MessageProcessor } from './message-processor';
import { WhatsAppClient } from './whatsapp-client';
import { logger } from '../utils/logger';

export class WhatsAppMessageRouter {
  private messageProcessor: MessageProcessor;
  private whatsappClient: WhatsAppClient;
  private psychologistMappings: Map<string, PsychologistWhatsAppMapping> = new Map();
  private messageQueue: Array<{ message: WhatsAppMessage; retryCount: number }> = [];
  private isProcessingQueue = false;

  constructor(messageProcessor: MessageProcessor, whatsappClient: WhatsAppClient) {
    this.messageProcessor = messageProcessor;
    this.whatsappClient = whatsappClient;
    this.setupEventHandlers();
    this.startQueueProcessor();
  }

  private setupEventHandlers(): void {
    // Handle incoming messages
    this.whatsappClient.on('message', async (message: WhatsAppMessage) => {
      await this.routeMessage(message);
    });

    // Handle connection events
    this.whatsappClient.on('connected', () => {
      logger.info('WhatsApp Message Router connected');
    });

    this.whatsappClient.on('disconnected', () => {
      logger.warn('WhatsApp Message Router disconnected');
    });

    // Handle message delivery receipts
    this.whatsappClient.on('message-receipt', (receipt) => {
      logger.debug('Message delivery receipt', {
        messageId: receipt.messageId,
        status: receipt.status
      });
    });
  }

  /**
   * Routes incoming WhatsApp messages to the appropriate psychologist
   */
  private async routeMessage(message: WhatsAppMessage): Promise<void> {
    try {
      logger.info('Processing incoming WhatsApp message', {
        from: message.from,
        messagePreview: message.body.substring(0, 50),
        isGroup: message.isGroup
      });

      // Skip group messages
      if (message.isGroup) {
        logger.debug('Skipping group message', { from: message.from });
        return;
      }

      // Extract phone number and find psychologist
      const phoneNumber = this.extractPhoneNumber(message.from);
      const psychologist = this.findPsychologistByPhone(phoneNumber);
      
      if (!psychologist) {
        logger.warn('Message from unregistered number', { phoneNumber });
        await this.handleUnknownSender(message);
        return;
      }

      logger.info('Message routed to psychologist', {
        psychologistId: psychologist.psychologistId,
        psychologistName: psychologist.fullName,
        phoneNumber
      });

      // Add to processing queue and process
      this.messageQueue.push({ message, retryCount: 0 });
      await this.processMessageForPsychologist(message, psychologist.psychologistId);

    } catch (error) {
      logger.error('Error routing WhatsApp message', { 
        error: error instanceof Error ? error.message : error,
        from: message.from 
      });
      await this.sendErrorMessage(message.from, 'Ocorreu um erro interno. Tente novamente em alguns instantes.');
    }
  }

  /**
   * Process message for a specific psychologist
   */
  private async processMessageForPsychologist(message: WhatsAppMessage, psychologistId: string): Promise<void> {
    try {
      // Send typing indicator
      await this.whatsappClient.sendTyping(message.from);

      // Process message through the message processor
      const result = await this.messageProcessor.processMessage(
        message.from,
        message.body
      );

      // Send response back
      if (result.response) {
        await this.whatsappClient.sendMessage(message.from, result.response);
        logger.info('Response sent successfully', { 
          to: message.from, 
          psychologistId 
        });
      }

    } catch (error) {
      logger.error('Error processing message for psychologist', { 
        error: error instanceof Error ? error.message : error,
        psychologistId,
        messageFrom: message.from 
      });
      
      // Add to retry queue if retries available
      const queueItem = this.messageQueue.find(item => item.message.id === message.id);
      if (queueItem && queueItem.retryCount < 3) {
        queueItem.retryCount++;
        logger.info('Retrying message processing', { 
          attempt: queueItem.retryCount,
          maxAttempts: 3,
          messageId: message.id 
        });
        
        // Retry after delay
        setTimeout(async () => {
          await this.processMessageForPsychologist(message, psychologistId);
        }, queueItem.retryCount * 2000);
      } else {
        logger.warn('Max retry attempts reached for message', { messageId: message.id });
        await this.sendErrorMessage(message.from, 'Não foi possível processar sua mensagem. Tente novamente mais tarde.');
      }
    }
  }

  /**
   * Handle messages from unknown senders
   */
  private async handleUnknownSender(message: WhatsAppMessage): Promise<void> {
    const welcomeMessage = `
Olá! 👋

Você não está cadastrado no sistema Clara ainda.

Clara é um assistente de agendamento para psicólogos. Se você é um psicólogo interessado em usar nossos serviços, entre em contato conosco.

Se você é paciente de um dos nossos psicólogos, verifique se está usando o número correto ou entre em contato com seu psicólogo.

Para mais informações: https://clara.help
    `.trim();

    await this.whatsappClient.sendMessage(message.from, welcomeMessage);
  }

  /**
   * Send error message to user
   */
  private async sendErrorMessage(to: string, errorMessage: string): Promise<void> {
    try {
      await this.whatsappClient.sendMessage(to, `❌ ${errorMessage}`);
    } catch (error) {
      console.error('❌ Failed to send error message:', error);
    }
  }

  /**
   * Extract phone number from WhatsApp JID
   */
  private extractPhoneNumber(jid: string): string {
    // WhatsApp JID format: phone@s.whatsapp.net
    return jid.split('@')[0] || '';
  }

  /**
   * Find psychologist by phone number with Brazilian mobile number support
   */
  private findPsychologistByPhone(phoneNumber: string): PsychologistWhatsAppMapping | null {
    const cleanPhone = this.cleanPhoneNumber(phoneNumber);
    
    // Try exact match first
    let psychologist = this.psychologistMappings.get(cleanPhone);
    
    if (!psychologist) {
      // Try Brazilian mobile number variations (add/remove 9 after DDD)
      const variations = [
        this.addBrazilianMobileNine(cleanPhone),
        this.removeBrazilianMobileNine(cleanPhone),
      ].filter((v): v is string => Boolean(v));

      for (const variation of variations) {
        psychologist = this.psychologistMappings.get(this.cleanPhoneNumber(variation));
        if (psychologist) break;
      }
    }

    return psychologist?.isActive ? psychologist : null;
  }

  /**
   * Clean phone number for consistent comparison
   */
  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '');
  }

  /**
   * Add Brazilian mobile number 9 after DDD (if not present)
   * Example: 556282337961 -> 5562982337961
   */
  private addBrazilianMobileNine(phone: string): string | undefined {
    // Brazilian mobile numbers: 55 + DDD(2) + 9 + number(8)
    if (phone.length === 13 && phone.startsWith('55')) {
      // Already has 9 after DDD (13 digits)
      return undefined;
    } else if (phone.length === 12 && phone.startsWith('55')) {
      // Add 9 after DDD: 556282337961 -> 5562982337961
      return phone.substring(0, 4) + '9' + phone.substring(4);
    }
    return undefined;
  }

  /**
   * Remove Brazilian mobile number 9 after DDD (if present)
   * Example: 5562982337961 -> 556282337961
   */
  private removeBrazilianMobileNine(phone: string): string | undefined {
    // Brazilian mobile numbers: 55 + DDD(2) + 9 + number(8)
    if (phone.length === 13 && phone.startsWith('55')) {
      // Check if 5th character is 9 (after DDD)
      if (phone.charAt(4) === '9') {
        // Remove 9: 5562982337961 -> 556282337961
        return phone.substring(0, 4) + phone.substring(5);
      }
    }
    return undefined;
  }

  /**
   * Register a psychologist phone mapping
   */
  public registerPsychologist(mapping: PsychologistWhatsAppMapping): void {
    const cleanPhone = this.cleanPhoneNumber(mapping.whatsappNumber);
    this.psychologistMappings.set(cleanPhone, mapping);
    logger.info('Psychologist registered for WhatsApp', {
      psychologistId: mapping.psychologistId,
      fullName: mapping.fullName,
      whatsappNumber: cleanPhone
    });
  }

  /**
   * Unregister a psychologist
   */
  public unregisterPsychologist(whatsappNumber: string): void {
    const cleanPhone = this.cleanPhoneNumber(whatsappNumber);
    const mapping = this.psychologistMappings.get(cleanPhone);
    
    if (mapping) {
      this.psychologistMappings.delete(cleanPhone);
      logger.info('Psychologist unregistered from WhatsApp', {
        psychologistId: mapping.psychologistId,
        fullName: mapping.fullName
      });
    }
  }

  /**
   * Update psychologist status
   */
  public updatePsychologistStatus(whatsappNumber: string, isActive: boolean): void {
    const cleanPhone = this.cleanPhoneNumber(whatsappNumber);
    const mapping = this.psychologistMappings.get(cleanPhone);
    
    if (mapping) {
      mapping.isActive = isActive;
      logger.info('Psychologist WhatsApp status updated', {
        psychologistId: mapping.psychologistId,
        fullName: mapping.fullName,
        isActive
      });
    }
  }

  /**
   * Get all registered psychologists
   */
  public getRegisteredPsychologists(): PsychologistWhatsAppMapping[] {
    return Array.from(this.psychologistMappings.values());
  }

  /**
   * Start queue processor for handling message retries
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingQueue && this.messageQueue.length > 0) {
        this.processQueue();
      }
    }, 5000);
  }

  /**
   * Process message queue for retries and cleanup
   */
  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    try {
      // Remove processed messages older than 5 minutes
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const initialCount = this.messageQueue.length;
      this.messageQueue = this.messageQueue.filter(item => 
        item.message.timestamp > fiveMinutesAgo
      );

      if (initialCount !== this.messageQueue.length) {
        logger.debug('Cleaned up old messages from queue', {
          removed: initialCount - this.messageQueue.length,
          remaining: this.messageQueue.length
        });
      }

    } catch (error) {
      logger.error('Error processing message queue', {
        error: error instanceof Error ? error.message : error
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): { total: number; retrying: number; failed: number } {
    const total = this.messageQueue.length;
    const retrying = this.messageQueue.filter(item => item.retryCount > 0 && item.retryCount < 3).length;
    const failed = this.messageQueue.filter(item => item.retryCount >= 3).length;

    return { total, retrying, failed };
  }

  /**
   * Broadcast message to all registered psychologists
   */
  public async broadcastMessage(message: string): Promise<void> {
    const activePsychologists = Array.from(this.psychologistMappings.values())
      .filter(p => p.isActive);

    logger.info('Broadcasting message to psychologists', {
      recipientCount: activePsychologists.length,
      messagePreview: message.substring(0, 50)
    });

    for (const psychologist of activePsychologists) {
      try {
        const jid = `${psychologist.whatsappNumber}@s.whatsapp.net`;
        await this.whatsappClient.sendMessage(jid, message);
        logger.debug('Broadcast message sent', {
          psychologistId: psychologist.psychologistId,
          fullName: psychologist.fullName
        });
      } catch (error) {
        logger.error('Failed to send broadcast message', {
          error: error instanceof Error ? error.message : error,
          psychologistId: psychologist.psychologistId,
          fullName: psychologist.fullName
        });
      }
    }
  }
}