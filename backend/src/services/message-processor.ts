// src/services/message-processor.ts
import { PrismaClient } from '@prisma/client';
import { CommandParser } from './command-parser';
import { SessionManager } from './session-manager';
import { ValidationLayer } from './validation-layer';
import { ResponseGenerator } from './response-generator';
import { ParsedCommand, ConversationStep, ProcessingResult } from '../types';

export class MessageProcessor {
  private prisma: PrismaClient;
  private commandParser: CommandParser;
  private sessionManager: SessionManager;
  private validationLayer: ValidationLayer;
  private responseGenerator: ResponseGenerator;

  constructor() {
    this.prisma = new PrismaClient();
    this.commandParser = new CommandParser();
    this.sessionManager = new SessionManager();
    this.validationLayer = new ValidationLayer(this.prisma);
    this.responseGenerator = new ResponseGenerator();
  }

  async processMessage(
    whatsappNumber: string,
    message: string
  ): Promise<ProcessingResult> {
    try {
      // Log da mensagem recebida
      await this.logMessage(whatsappNumber, 'incoming', message);

      // Buscar ou criar contexto da conversa
      let context = await this.sessionManager.getContext(whatsappNumber);
      
      // Se não há contexto, verificar se o psicólogo existe
      if (!context) {
        const psychologist = await this.findPsychologistByWhatsApp(whatsappNumber);
        
        if (!psychologist) {
          const response = this.responseGenerator.generateWelcomeMessage();
          await this.logMessage(whatsappNumber, 'response', response);
          return { success: true, response };
        }

        context = await this.sessionManager.createContext(whatsappNumber, psychologist.id);
      }

      // Processar mensagem baseado no estado da conversa
      const result = await this.processMessageByStep(context, message, whatsappNumber);
      
      // Log da resposta
      await this.logMessage(context.psychologistId, 'response', result.response);

      return result;

    } catch (error) {
      console.error('Error processing message:', error);
      const errorResponse = this.responseGenerator.generateErrorMessage(
        'Ocorreu um erro interno. Tente novamente em alguns instantes.'
      );
      
      return {
        success: false,
        response: errorResponse,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async processMessageByStep(
    context: any,
    message: string,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    switch (context.step) {
      case ConversationStep.COMMAND_PARSING:
        return await this.handleCommandParsing(context, message, whatsappNumber);
        
      case ConversationStep.AWAITING_CONFIRMATION:
        return await this.handleConfirmation(context, message, whatsappNumber);
        
      case ConversationStep.AWAITING_PATIENT_REGISTRATION:
        return await this.handlePatientRegistration(context, message, whatsappNumber);
        
      default:
        return await this.handleCommandParsing(context, message, whatsappNumber);
    }
  }

  private async handleCommandParsing(
    context: any,
    message: string,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    const command = this.commandParser.parse(message);
    
    switch (command.action) {
      case 'schedule':
        return await this.handleScheduleCommand(command, context, whatsappNumber);
        
      case 'cancel':
        return await this.handleCancelCommand(command, context, whatsappNumber);
        
      case 'view':
        return await this.handleViewCommand(command, context);
        
      case 'help':
        return {
          success: true,
          response: this.responseGenerator.generateHelpMessage(),
          context
        };
        
      case 'unknown':
        return {
          success: true,
          response: this.responseGenerator.generateUnknownCommandMessage(),
          context
        };
        
      default:
        return {
          success: true,
          response: this.responseGenerator.generateUnknownCommandMessage(),
          context
        };
    }
  }

  private async handleScheduleCommand(
    command: ParsedCommand,
    context: any,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    // Validar comando
    const validation = await this.validationLayer.validateScheduleCommand(
      command,
      context.psychologistId
    );

    if (!validation.isValid) {
      if (validation.conflicts.hasConflict) {
        const response = this.responseGenerator.generateConflictMessage(
          validation.conflicts,
          command.patient!,
          command.datetime!
        );
        return { success: true, response, context };
      }

      const response = this.responseGenerator.generateValidationErrors(validation.errors);
      return { success: true, response, context };
    }

    // Se paciente não existe, pedir confirmação para criar
    if (!validation.patient) {
      const updatedContext = await this.sessionManager.updateContext(whatsappNumber, {
        step: ConversationStep.AWAITING_PATIENT_REGISTRATION,
        data: {
          ...context.data,
          patientName: command.patient,
          proposedDatetime: command.datetime!.toISOString(),
          pendingConfirmation: true
        }
      });

      const response = this.responseGenerator.generateNewPatientConfirmation(command.patient!);
      
      return {
        success: true,
        response,
        context: updatedContext
      };
    }

    // Pedir confirmação do agendamento
    const updatedContext = await this.sessionManager.updateContext(whatsappNumber, {
      step: ConversationStep.AWAITING_CONFIRMATION,
      currentCommand: 'schedule',
      data: {
        ...context.data,
        patientName: command.patient,
        proposedDatetime: command.datetime!.toISOString()
      }
    });

    const response = this.responseGenerator.generateScheduleConfirmation(
      command.patient!,
      command.datetime!
    );

    return {
      success: true,
      response: response + this.responseGenerator.generateConfirmationPrompt(),
      context: updatedContext
    };
  }

  private async handleCancelCommand(
    command: ParsedCommand,
    context: any,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    const validation = await this.validationLayer.validateCancelCommand(
      command,
      context.psychologistId
    );

    if (!validation.isValid) {
      const response = this.responseGenerator.generateValidationErrors(validation.errors);
      return { success: true, response, context };
    }

    // Pedir confirmação do cancelamento
    const session = validation.session!;
    const sessionTime = this.formatTime(session.scheduledAt);
    const sessionEndTime = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60000);
    const formattedTime = `${sessionTime} - ${this.formatTime(sessionEndTime)}`;

    const updatedContext = await this.sessionManager.updateContext(whatsappNumber, {
      step: ConversationStep.AWAITING_CONFIRMATION,
      currentCommand: 'cancel',
      data: {
        ...context.data,
        sessionId: session.id,
        patientName: session.patient.fullName,
        proposedDatetime: session.scheduledAt.toISOString()
      }
    });

    const response = this.responseGenerator.generateCancelConfirmation(
      session.patient.fullName,
      session.scheduledAt,
      formattedTime
    );

    return {
      success: true,
      response: response + this.responseGenerator.generateConfirmationPrompt(),
      context: updatedContext
    };
  }

  private async handleViewCommand(
    command: ParsedCommand,
    context: any
  ): Promise<ProcessingResult> {
    
    const timeframe = command.timeframe || 'week';
    const { startDate, endDate } = this.getDateRange(timeframe);

    const sessions = await this.prisma.session.findMany({
      where: {
        psychologistId: context.psychologistId,
        scheduledAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'scheduled'
      },
      include: {
        patient: true
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });

    const response = this.responseGenerator.generateAgendaView(sessions, timeframe);

    return {
      success: true,
      response,
      context
    };
  }

  private async handleConfirmation(
    context: any,
    message: string,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    const isPositive = this.isPositiveResponse(message);
    
    if (!isPositive) {
      // Cancelar operação
      await this.sessionManager.clearContext(whatsappNumber);
      return {
        success: true,
        response: '❌ Operação cancelada.',
        context: null
      };
    }

    // Executar comando confirmado
    if (context.currentCommand === 'schedule') {
      return await this.executeScheduleCommand(context, whatsappNumber);
    } else if (context.currentCommand === 'cancel') {
      return await this.executeCancelCommand(context, whatsappNumber);
    }

    return {
      success: false,
      response: this.responseGenerator.generateErrorMessage('Comando não reconhecido.'),
      context
    };
  }

  private async handlePatientRegistration(
    context: any,
    message: string,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    const isPositive = this.isPositiveResponse(message);
    
    if (!isPositive) {
      await this.sessionManager.clearContext(whatsappNumber);
      return {
        success: true,
        response: '❌ Paciente não foi criado. Operação cancelada.',
        context: null
      };
    }

    // Criar paciente
    try {
      const patient = await this.prisma.patient.create({
        data: {
          psychologistId: context.psychologistId,
          fullName: context.data.patientName
        }
      });

      // Continuar com agendamento
      const updatedContext = await this.sessionManager.updateContext(whatsappNumber, {
        step: ConversationStep.AWAITING_CONFIRMATION,
        currentCommand: 'schedule'
      });

      const datetime = new Date(context.data.proposedDatetime);
      const response = this.responseGenerator.generateScheduleConfirmation(
        patient.fullName,
        datetime
      );

      return {
        success: true,
        response: `✅ Paciente ${patient.fullName} criado!\n\n${response}${this.responseGenerator.generateConfirmationPrompt()}`,
        context: updatedContext
      };

    } catch (error) {
      console.error('Error creating patient:', error);
      return {
        success: false,
        response: this.responseGenerator.generateErrorMessage('Erro ao criar paciente.'),
        context
      };
    }
  }

  private async executeScheduleCommand(
    context: any,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    try {
      const datetime = new Date(context.data.proposedDatetime);
      
      // Buscar paciente
      const patient = await this.validationLayer.findPatientByName(
        context.data.patientName,
        context.psychologistId
      );

      if (!patient) {
        return {
          success: false,
          response: this.responseGenerator.generateErrorMessage('Paciente não encontrado.'),
          context
        };
      }

      // Buscar psicólogo para duração da sessão
      const psychologist = await this.prisma.psychologist.findUnique({
        where: { id: context.psychologistId }
      });

      // Criar sessão
      const session = await this.prisma.session.create({
        data: {
          psychologistId: context.psychologistId,
          patientId: patient.id,
          scheduledAt: datetime,
          durationMinutes: psychologist?.sessionDurationMinutes || 50
        }
      });

      // Limpar contexto
      await this.sessionManager.clearContext(whatsappNumber);

      const response = this.responseGenerator.generateScheduleSuccess(
        patient.fullName,
        datetime
      );

      return {
        success: true,
        response,
        context: null
      };

    } catch (error) {
      console.error('Error executing schedule command:', error);
      return {
        success: false,
        response: this.responseGenerator.generateErrorMessage('Erro ao agendar sessão.'),
        context
      };
    }
  }

  private async executeCancelCommand(
    context: any,
    whatsappNumber: string
  ): Promise<ProcessingResult> {
    
    try {
      // Cancelar sessão
      await this.prisma.session.update({
        where: { id: context.data.sessionId },
        data: { status: 'cancelled' }
      });

      // Limpar contexto
      await this.sessionManager.clearContext(whatsappNumber);

      const datetime = new Date(context.data.proposedDatetime);
      const response = this.responseGenerator.generateCancelSuccess(
        context.data.patientName,
        datetime
      );

      return {
        success: true,
        response,
        context: null
      };

    } catch (error) {
      console.error('Error executing cancel command:', error);
      return {
        success: false,
        response: this.responseGenerator.generateErrorMessage('Erro ao cancelar sessão.'),
        context
      };
    }
  }

  private async findPsychologistByWhatsApp(whatsappNumber: string): Promise<any> {
    return await this.prisma.psychologist.findUnique({
      where: { whatsappNumber }
    });
  }

  private async logMessage(
    psychologistIdOrNumber: string,
    messageType: string,
    content: string
  ): Promise<void> {
    try {
      // Se for um número de WhatsApp, buscar o psicólogo
      let psychologistId = psychologistIdOrNumber;
      
      if (messageType === 'incoming') {
        const psychologist = await this.findPsychologistByWhatsApp(psychologistIdOrNumber);
        psychologistId = psychologist?.id || null;
      }

      await this.prisma.messageLog.create({
        data: {
          psychologistId,
          messageType,
          content,
          metadata: {}
        }
      });
    } catch (error) {
      console.error('Error logging message:', error);
    }
  }

  private isPositiveResponse(message: string): boolean {
    const positive = ['sim', 's', 'yes', 'y', 'ok', 'confirmar', 'confirmo', 'confirma'];
    const normalized = message.toLowerCase().trim();
    return positive.some(word => normalized.includes(word));
  }

  private getDateRange(timeframe: 'day' | 'week' | 'month'): { startDate: Date; endDate: Date } {
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);

    switch (timeframe) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'week':
        // Start of week (Monday)
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        
        // End of week (Sunday)
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate, endDate };
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  async disconnect(): Promise<void> {
    await this.sessionManager.disconnect();
    await this.prisma.$disconnect();
  }
}