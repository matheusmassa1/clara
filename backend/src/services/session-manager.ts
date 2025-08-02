// src/services/session-manager.ts
import Redis from 'ioredis';
import { ConversationContext, ConversationStep } from '../types';

export class SessionManager {
  private redis: Redis;
  private defaultExpirySeconds = 300; // 5 minutes

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });
  }

  async getContext(whatsappNumber: string): Promise<ConversationContext | null> {
    try {
      const contextStr = await this.redis.get(`conversation:${whatsappNumber}`);
      
      if (!contextStr) {
        return null;
      }

      const context = JSON.parse(contextStr) as ConversationContext;
      
      // Check if context has expired
      if (new Date() > new Date(context.expiresAt)) {
        await this.clearContext(whatsappNumber);
        return null;
      }

      return context;
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return null;
    }
  }

  async setContext(whatsappNumber: string, context: ConversationContext): Promise<void> {
    try {
      const contextStr = JSON.stringify(context);
      
      await this.redis.setex(
        `conversation:${whatsappNumber}`,
        this.defaultExpirySeconds,
        contextStr
      );
    } catch (error) {
      console.error('Error setting conversation context:', error);
      throw error;
    }
  }

  async updateContext(
    whatsappNumber: string, 
    updates: Partial<ConversationContext>
  ): Promise<ConversationContext | null> {
    try {
      const currentContext = await this.getContext(whatsappNumber);
      
      if (!currentContext) {
        return null;
      }

      const updatedContext: ConversationContext = {
        ...currentContext,
        ...updates,
        data: {
          ...currentContext.data,
          ...updates.data
        }
      };

      await this.setContext(whatsappNumber, updatedContext);
      return updatedContext;
    } catch (error) {
      console.error('Error updating conversation context:', error);
      throw error;
    }
  }

  async clearContext(whatsappNumber: string): Promise<void> {
    try {
      await this.redis.del(`conversation:${whatsappNumber}`);
    } catch (error) {
      console.error('Error clearing conversation context:', error);
      throw error;
    }
  }

  async createContext(
    whatsappNumber: string,
    psychologistId: string,
    command?: string
  ): Promise<ConversationContext> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultExpirySeconds * 1000);

    const context: ConversationContext = {
      psychologistId,
      step: ConversationStep.COMMAND_PARSING,
      data: {},
      createdAt: now,
      expiresAt,
      ...(command && { currentCommand: command })
    };

    await this.setContext(whatsappNumber, context);
    return context;
  }

  async moveToStep(
    whatsappNumber: string, 
    step: ConversationStep,
    data?: any
  ): Promise<ConversationContext | null> {
    const updates: Partial<ConversationContext> = {
      step,
      ...(data && { data })
    };

    return await this.updateContext(whatsappNumber, updates);
  }

  async isWaitingForConfirmation(whatsappNumber: string): Promise<boolean> {
    const context = await this.getContext(whatsappNumber);
    return context?.step === ConversationStep.AWAITING_CONFIRMATION;
  }

  async isWaitingForPatientRegistration(whatsappNumber: string): Promise<boolean> {
    const context = await this.getContext(whatsappNumber);
    return context?.step === ConversationStep.AWAITING_PATIENT_REGISTRATION;
  }

  async getActiveContexts(): Promise<string[]> {
    try {
      const keys = await this.redis.keys('conversation:*');
      return keys.map(key => key.replace('conversation:', ''));
    } catch (error) {
      console.error('Error getting active contexts:', error);
      return [];
    }
  }

  async extendContextExpiry(whatsappNumber: string, additionalSeconds: number = 300): Promise<void> {
    try {
      await this.redis.expire(`conversation:${whatsappNumber}`, additionalSeconds);
    } catch (error) {
      console.error('Error extending context expiry:', error);
    }
  }

  async getContextStats(): Promise<{ activeContexts: number; expiredContexts: number }> {
    try {
      const keys = await this.redis.keys('conversation:*');
      let activeContexts = 0;
      let expiredContexts = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl > 0) {
          activeContexts++;
        } else {
          expiredContexts++;
        }
      }

      return { activeContexts, expiredContexts };
    } catch (error) {
      console.error('Error getting context stats:', error);
      return { activeContexts: 0, expiredContexts: 0 };
    }
  }

  async cleanup(): Promise<void> {
    try {
      const keys = await this.redis.keys('conversation:*');
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          await this.redis.del(key);
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired contexts:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}