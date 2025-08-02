// src/__tests__/services/message-processor.test.ts
import { MessageProcessor } from '../../services/message-processor';
import { CommandParser } from '../../services/command-parser';
import { SessionManager } from '../../services/session-manager';
import { ValidationLayer } from '../../services/validation-layer';
import { ResponseGenerator } from '../../services/response-generator';
import { ConversationStep } from '../../types';

// Mock all dependencies
jest.mock('@prisma/client');
jest.mock('../../services/command-parser');
jest.mock('../../services/session-manager');
jest.mock('../../services/validation-layer');
jest.mock('../../services/response-generator');

describe('MessageProcessor', () => {
  let processor: MessageProcessor;
  let mockPrisma: any;
  let mockCommandParser: jest.Mocked<CommandParser>;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockValidationLayer: jest.Mocked<ValidationLayer>;
  let mockResponseGenerator: jest.Mocked<ResponseGenerator>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mocks
    mockCommandParser = {
      parse: jest.fn()
    } as any;

    mockSessionManager = {
      getContext: jest.fn(),
      createContext: jest.fn(),
      updateContext: jest.fn(),
      clearContext: jest.fn(),
      disconnect: jest.fn()
    } as any;

    mockValidationLayer = {
      validateScheduleCommand: jest.fn(),
      validateCancelCommand: jest.fn(),
      findPatientByName: jest.fn()
    } as any;

    mockResponseGenerator = {
      generateWelcomeMessage: jest.fn(),
      generateErrorMessage: jest.fn(),
      generateHelpMessage: jest.fn(),
      generateUnknownCommandMessage: jest.fn(),
      generateScheduleConfirmation: jest.fn(),
      generateCancelConfirmation: jest.fn(),
      generateConfirmationPrompt: jest.fn(),
      generateScheduleSuccess: jest.fn(),
      generateCancelSuccess: jest.fn(),
      generateConflictMessage: jest.fn(),
      generateValidationErrors: jest.fn(),
      generateNewPatientConfirmation: jest.fn(),
      generateAgendaView: jest.fn()
    } as any;

    mockPrisma = {
      psychologist: {
        findUnique: jest.fn()
      },
      patient: {
        create: jest.fn(),
        findFirst: jest.fn()
      },
      session: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn()
      },
      messageLog: {
        create: jest.fn()
      },
      $disconnect: jest.fn()
    };

    // Create processor instance
    processor = new MessageProcessor();

    // Inject mocks
    (processor as any).commandParser = mockCommandParser;
    (processor as any).sessionManager = mockSessionManager;
    (processor as any).validationLayer = mockValidationLayer;
    (processor as any).responseGenerator = mockResponseGenerator;
    (processor as any).prisma = mockPrisma;
  });

  describe('processMessage - New User Flow', () => {
    it('should welcome new users when psychologist not found', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'Oi';

      mockSessionManager.getContext.mockResolvedValue(null);
      mockPrisma.psychologist.findUnique.mockResolvedValue(null);
      mockResponseGenerator.generateWelcomeMessage.mockReturnValue('Bem-vindo!');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Bem-vindo!');
      expect(mockPrisma.messageLog.create).toHaveBeenCalledTimes(2); // incoming + response
    });

    it('should create context for existing psychologist', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'agendar ana quinta 14h';
      const psychologist = { id: 'psych-1', name: 'Dr. Test' };
      const context = { 
        psychologistId: 'psych-1', 
        step: ConversationStep.COMMAND_PARSING,
        data: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      mockSessionManager.getContext.mockResolvedValue(null);
      mockPrisma.psychologist.findUnique.mockResolvedValue(psychologist);
      mockSessionManager.createContext.mockResolvedValue(context);
      mockCommandParser.parse.mockReturnValue({
        action: 'schedule',
        patient: 'Ana',
        datetime: new Date('2024-08-08T14:00:00'),
        confidence: 0.9,
        originalText: message
      });
      mockValidationLayer.validateScheduleCommand.mockResolvedValue({
        isValid: true,
        conflicts: { hasConflict: false },
        patient: { id: 'patient-1', fullName: 'Ana' },
        errors: []
      });
      mockSessionManager.updateContext.mockResolvedValue(context);
      mockResponseGenerator.generateScheduleConfirmation.mockReturnValue('Confirmar agendamento?');
      mockResponseGenerator.generateConfirmationPrompt.mockReturnValue('\n\nDigite "sim" para confirmar.');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(mockSessionManager.createContext).toHaveBeenCalledWith(whatsappNumber, 'psych-1');
      expect(result.success).toBe(true);
    });
  });

  describe('processMessage - Schedule Command Flow', () => {
    const baseContext = {
      psychologistId: 'psych-1',
      step: ConversationStep.COMMAND_PARSING,
      data: {},
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    };

    it('should handle valid schedule command with existing patient', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'agendar ana quinta 14h';
      const datetime = new Date('2024-08-08T14:00:00');

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'schedule',
        patient: 'Ana',
        datetime,
        confidence: 0.9,
        originalText: message
      });
      mockValidationLayer.validateScheduleCommand.mockResolvedValue({
        isValid: true,
        conflicts: { hasConflict: false },
        patient: { id: 'patient-1', fullName: 'Ana' },
        errors: []
      });
      mockSessionManager.updateContext.mockResolvedValue({
        ...baseContext,
        step: ConversationStep.AWAITING_CONFIRMATION
      });
      mockResponseGenerator.generateScheduleConfirmation.mockReturnValue('Confirmar agendamento Ana quinta 14h?');
      mockResponseGenerator.generateConfirmationPrompt.mockReturnValue('\n\nDigite "sim" para confirmar.');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Confirmar agendamento');
      expect(mockValidationLayer.validateScheduleCommand).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'schedule', patient: 'Ana' }),
        'psych-1'
      );
    });

    it('should handle schedule conflicts', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'agendar ana quinta 14h';
      const datetime = new Date('2024-08-08T14:00:00');

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'schedule',
        patient: 'Ana',
        datetime,
        confidence: 0.9,
        originalText: message
      });
      mockValidationLayer.validateScheduleCommand.mockResolvedValue({
        isValid: false,
        conflicts: {
          hasConflict: true,
          conflictingSession: {
            patientName: 'João',
            startTime: '14:00',
            endTime: '14:50'
          },
          availableSlots: []
        },
        errors: []
      });
      mockResponseGenerator.generateConflictMessage.mockReturnValue('⚠️ Conflito detectado!');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('⚠️ Conflito detectado!');
      expect(mockResponseGenerator.generateConflictMessage).toHaveBeenCalled();
    });

    it('should handle new patient registration', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'agendar carlos quinta 14h';
      const datetime = new Date('2024-08-08T14:00:00');

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'schedule',
        patient: 'Carlos',
        datetime,
        confidence: 0.9,
        originalText: message
      });
      mockValidationLayer.validateScheduleCommand.mockResolvedValue({
        isValid: true,
        conflicts: { hasConflict: false },
        patient: null, // New patient
        errors: []
      });
      mockSessionManager.updateContext.mockResolvedValue({
        ...baseContext,
        step: ConversationStep.AWAITING_PATIENT_REGISTRATION
      });
      mockResponseGenerator.generateNewPatientConfirmation.mockReturnValue('Criar novo paciente Carlos?');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Criar novo paciente Carlos?');
      expect(result.context?.step).toBe(ConversationStep.AWAITING_PATIENT_REGISTRATION);
    });

    it('should handle validation errors', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'agendar ana quinta 25h'; // Invalid hour

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'schedule',
        patient: 'Ana',
        datetime: undefined, // Invalid datetime
        confidence: 0.3,
        originalText: message
      });
      mockValidationLayer.validateScheduleCommand.mockResolvedValue({
        isValid: false,
        conflicts: { hasConflict: false },
        errors: ['Horário inválido']
      });
      mockResponseGenerator.generateValidationErrors.mockReturnValue('❌ Horário inválido');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('❌ Horário inválido');
    });
  });

  describe('processMessage - Cancel Command Flow', () => {
    const baseContext = {
      psychologistId: 'psych-1',
      step: ConversationStep.COMMAND_PARSING,
      data: {},
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    };

    it('should handle valid cancel command', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'cancelar ana quinta';
      const datetime = new Date('2024-08-08T14:00:00');
      const session = {
        id: 'session-1',
        scheduledAt: datetime,
        durationMinutes: 50,
        patient: { fullName: 'Ana' }
      };

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'cancel',
        patient: 'Ana',
        datetime,
        confidence: 0.85,
        originalText: message
      });
      mockValidationLayer.validateCancelCommand.mockResolvedValue({
        isValid: true,
        session,
        errors: []
      });
      mockSessionManager.updateContext.mockResolvedValue({
        ...baseContext,
        step: ConversationStep.AWAITING_CONFIRMATION
      });
      mockResponseGenerator.generateCancelConfirmation.mockReturnValue('Confirmar cancelamento Ana quinta?');
      mockResponseGenerator.generateConfirmationPrompt.mockReturnValue('\n\nDigite "sim" para confirmar.');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toContain('Confirmar cancelamento');
      expect(mockValidationLayer.validateCancelCommand).toHaveBeenCalled();
    });

    it('should handle cancel command with no session found', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'cancelar ana quinta';

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'cancel',
        patient: 'Ana',
        datetime: new Date('2024-08-08T14:00:00'),
        confidence: 0.85,
        originalText: message
      });
      mockValidationLayer.validateCancelCommand.mockResolvedValue({
        isValid: false,
        errors: ['Nenhuma sessão encontrada para Ana nesta data']
      });
      mockResponseGenerator.generateValidationErrors.mockReturnValue('❌ Sessão não encontrada');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('❌ Sessão não encontrada');
    });
  });

  describe('processMessage - Confirmation Flow', () => {
    it('should execute schedule command on positive confirmation', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'sim';
      const context = {
        psychologistId: 'psych-1',
        step: ConversationStep.AWAITING_CONFIRMATION,
        currentCommand: 'schedule',
        data: {
          patientName: 'Ana',
          proposedDatetime: '2024-08-08T14:00:00Z'
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      mockSessionManager.getContext.mockResolvedValue(context);
      mockValidationLayer.findPatientByName.mockResolvedValue({
        id: 'patient-1',
        fullName: 'Ana'
      });
      mockPrisma.psychologist.findUnique.mockResolvedValue({
        sessionDurationMinutes: 50
      });
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-1'
      });
      mockSessionManager.clearContext.mockResolvedValue(undefined);
      mockResponseGenerator.generateScheduleSuccess.mockReturnValue('✅ Sessão agendada com sucesso!');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('✅ Sessão agendada com sucesso!');
      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: {
          psychologistId: 'psych-1',
          patientId: 'patient-1',
          scheduledAt: new Date('2024-08-08T14:00:00Z'),
          durationMinutes: 50
        }
      });
      expect(mockSessionManager.clearContext).toHaveBeenCalledWith(whatsappNumber);
    });

    it('should execute cancel command on positive confirmation', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'confirmo';
      const context = {
        psychologistId: 'psych-1',
        step: ConversationStep.AWAITING_CONFIRMATION,
        currentCommand: 'cancel',
        data: {
          sessionId: 'session-1',
          patientName: 'Ana',
          proposedDatetime: '2024-08-08T14:00:00Z'
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      mockSessionManager.getContext.mockResolvedValue(context);
      mockPrisma.session.update.mockResolvedValue({ id: 'session-1' });
      mockSessionManager.clearContext.mockResolvedValue(undefined);
      mockResponseGenerator.generateCancelSuccess.mockReturnValue('✅ Sessão cancelada com sucesso!');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('✅ Sessão cancelada com sucesso!');
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { status: 'cancelled' }
      });
    });

    it('should cancel operation on negative response', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'não';
      const context = {
        psychologistId: 'psych-1',
        step: ConversationStep.AWAITING_CONFIRMATION,
        currentCommand: 'schedule',
        data: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      mockSessionManager.getContext.mockResolvedValue(context);
      mockSessionManager.clearContext.mockResolvedValue(undefined);

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('❌ Operação cancelada.');
      expect(result.context).toBeNull();
      expect(mockSessionManager.clearContext).toHaveBeenCalledWith(whatsappNumber);
    });
  });

  describe('processMessage - Patient Registration Flow', () => {
    it('should create patient and continue with scheduling', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'sim';
      const context = {
        psychologistId: 'psych-1',
        step: ConversationStep.AWAITING_PATIENT_REGISTRATION,
        data: {
          patientName: 'Carlos',
          proposedDatetime: '2024-08-08T14:00:00Z'
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      mockSessionManager.getContext.mockResolvedValue(context);
      mockPrisma.patient.create.mockResolvedValue({
        id: 'patient-new',
        fullName: 'Carlos'
      });
      mockSessionManager.updateContext.mockResolvedValue({
        ...context,
        step: ConversationStep.AWAITING_CONFIRMATION
      });
      mockResponseGenerator.generateScheduleConfirmation.mockReturnValue('Confirmar agendamento Carlos?');
      mockResponseGenerator.generateConfirmationPrompt.mockReturnValue('\n\nDigite "sim" para confirmar.');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toContain('✅ Paciente Carlos criado!');
      expect(result.response).toContain('Confirmar agendamento Carlos?');
      expect(mockPrisma.patient.create).toHaveBeenCalledWith({
        data: {
          psychologistId: 'psych-1',
          fullName: 'Carlos'
        }
      });
    });

    it('should cancel patient creation on negative response', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'não';
      const context = {
        psychologistId: 'psych-1',
        step: ConversationStep.AWAITING_PATIENT_REGISTRATION,
        data: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      mockSessionManager.getContext.mockResolvedValue(context);
      mockSessionManager.clearContext.mockResolvedValue(undefined);

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('❌ Paciente não foi criado. Operação cancelada.');
      expect(result.context).toBeNull();
    });
  });

  describe('processMessage - Other Commands', () => {
    const baseContext = {
      psychologistId: 'psych-1',
      step: ConversationStep.COMMAND_PARSING,
      data: {},
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    };

    it('should handle view agenda command', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'ver agenda';

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'view',
        timeframe: 'week',
        confidence: 0.95,
        originalText: message
      });
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockResponseGenerator.generateAgendaView.mockReturnValue('📅 Agenda da semana vazia');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('📅 Agenda da semana vazia');
      expect(mockPrisma.session.findMany).toHaveBeenCalled();
    });

    it('should handle help command', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'ajuda';

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'help',
        confidence: 1.0,
        originalText: message
      });
      mockResponseGenerator.generateHelpMessage.mockReturnValue('ℹ️ Como usar o Clara...');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('ℹ️ Como usar o Clara...');
    });

    it('should handle unknown command', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'blablabla';

      mockSessionManager.getContext.mockResolvedValue(baseContext);
      mockCommandParser.parse.mockReturnValue({
        action: 'unknown',
        confidence: 0,
        originalText: message
      });
      mockResponseGenerator.generateUnknownCommandMessage.mockReturnValue('❓ Comando não reconhecido');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(true);
      expect(result.response).toBe('❓ Comando não reconhecido');
    });
  });

  describe('Error Handling', () => {
    it('should handle and log errors gracefully', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'agendar ana quinta 14h';

      mockSessionManager.getContext.mockRejectedValue(new Error('Redis connection failed'));
      mockResponseGenerator.generateErrorMessage.mockReturnValue('❌ Erro interno');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(false);
      expect(result.response).toBe('❌ Erro interno');
      expect(result.error).toBe('Redis connection failed');
    });

    it('should handle patient creation errors', async () => {
      const whatsappNumber = '+5511999999999';
      const message = 'sim';
      const context = {
        psychologistId: 'psych-1',
        step: ConversationStep.AWAITING_PATIENT_REGISTRATION,
        data: { patientName: 'Carlos' },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      };

      mockSessionManager.getContext.mockResolvedValue(context);
      mockPrisma.patient.create.mockRejectedValue(new Error('Database error'));
      mockResponseGenerator.generateErrorMessage.mockReturnValue('❌ Erro ao criar paciente');

      const result = await processor.processMessage(whatsappNumber, message);

      expect(result.success).toBe(false);
      expect(result.response).toBe('❌ Erro ao criar paciente');
    });
  });

  describe('Utility Methods', () => {
    it('should correctly identify positive responses', async () => {
      const positiveResponses = ['sim', 's', 'SIM', 'yes', 'ok', 'confirmar', 'confirmo'];
      
      for (const response of positiveResponses) {
        const result = (processor as any).isPositiveResponse(response);
        expect(result).toBe(true);
      }
    });

    it('should correctly identify negative responses', async () => {
      const negativeResponses = ['não', 'nao', 'cancelar', 'never'];
      
      for (const response of negativeResponses) {
        const result = (processor as any).isPositiveResponse(response);
        expect(result).toBe(false);
      }
    });

    it('should format time correctly', async () => {
      const date = new Date('2024-08-08T14:30:00');
      const result = (processor as any).formatTime(date);
      
      expect(result).toBe('14:30');
    });
  });
});