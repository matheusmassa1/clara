// src/routes/simulator.ts
import { Router, Request, Response } from 'express';
import { MessageProcessor } from '../services/message-processor';
import { PrismaClient } from '@prisma/client';
import { SimulationMessage } from '../types';
import path from 'path';

const router = Router();
const messageProcessor = new MessageProcessor();
const prisma = new PrismaClient();

// Store simulation sessions in memory (in production, use Redis)
const simulationSessions: { [sessionId: string]: SimulationMessage[] } = {};

// Helper function to ensure return statements
function sendErrorResponse(res: any, status: number, message: string) {
  return res.status(status).json({ error: message });
}

// Create new simulation session
router.post('/sessions', async (req, res) => {
  try {
    const { psychologistWhatsApp, psychologistName } = req.body;

    if (!psychologistWhatsApp) {
      return sendErrorResponse(res, 400, 'WhatsApp number is required');
    }

    const sessionId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    simulationSessions[sessionId] = [];

    // Check if psychologist exists, create if not
    let psychologist = await prisma.psychologist.findUnique({
      where: { whatsappNumber: psychologistWhatsApp }
    });

    if (!psychologist && psychologistName) {
      psychologist = await prisma.psychologist.create({
        data: {
          whatsappNumber: psychologistWhatsApp,
          fullName: psychologistName,
          workingHours: {
            seg: '09:00-17:00',
            ter: '09:00-17:00',
            qua: '09:00-17:00',
            qui: '09:00-17:00',
            sex: '09:00-17:00',
            sab: 'closed',
            dom: 'closed'
          }
        }
      });
    }

    res.json({
      sessionId,
      psychologist: psychologist ? {
        id: psychologist.id,
        name: psychologist.fullName,
        whatsappNumber: psychologist.whatsappNumber
      } : null,
      message: psychologist 
        ? `Simulação iniciada para ${psychologist.fullName}` 
        : 'Simulação iniciada - psicólogo não encontrado'
    });

  } catch (error) {
    console.error('Error creating simulation session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message in simulation
router.post('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, psychologistWhatsApp } = req.body;

    if (!simulationSessions[sessionId]) {
      return sendErrorResponse(res, 404, 'Simulation session not found');
    }

    if (!message || !psychologistWhatsApp) {
      return sendErrorResponse(res, 400, 'Message and WhatsApp number are required');
    }

    // Add user message to session
    const userMessage: SimulationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      sender: 'psychologist',
      content: message
    };

    simulationSessions[sessionId].push(userMessage);

    // Process message through Clara
    const result = await messageProcessor.processMessage(psychologistWhatsApp, message);

    // Add Clara's response to session
    const claraMessage: SimulationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      sender: 'clara',
      content: result.response,
      ...(result.context && { context: result.context })
    };

    simulationSessions[sessionId].push(claraMessage);

    res.json({
      userMessage,
      claraMessage,
      success: result.success,
      error: result.error
    });

  } catch (error) {
    console.error('Error processing simulation message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get simulation session messages
router.get('/sessions/:sessionId/messages', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!simulationSessions[sessionId]) {
      return res.status(404).json({ error: 'Simulation session not found' });
    }

    return res.json({
      sessionId,
      messages: simulationSessions[sessionId],
      messageCount: simulationSessions[sessionId].length
    });

  } catch (error) {
    console.error('Error getting simulation messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear simulation session
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!simulationSessions[sessionId]) {
      return res.status(404).json({ error: 'Simulation session not found' });
    }

    delete simulationSessions[sessionId];

    return res.json({ message: 'Simulation session cleared' });

  } catch (error) {
    console.error('Error clearing simulation session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all active simulation sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = Object.keys(simulationSessions).map(sessionId => {
      const session = simulationSessions[sessionId];
      return {
        sessionId,
        messageCount: session?.length || 0,
        lastActivity: session && session.length > 0 
          ? session[session.length - 1]?.timestamp
          : null
      };
    });

    return res.json({ sessions });

  } catch (error) {
    console.error('Error getting simulation sessions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get psychologist data for simulation
router.get('/psychologists', async (req, res) => {
  try {
    const psychologists = await prisma.psychologist.findMany({
      select: {
        id: true,
        fullName: true,
        whatsappNumber: true,
        workingHours: true,
        _count: {
          select: {
            patients: true,
            sessions: true
          }
        }
      }
    });

    return res.json({ psychologists });

  } catch (error) {
    console.error('Error getting psychologists:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create test data for simulation
router.post('/test-data/:psychologistId', async (req, res) => {
  try {
    const { psychologistId } = req.params;

    // Create test patients
    const patients = await Promise.all([
      prisma.patient.create({
        data: {
          psychologistId,
          fullName: 'Ana Silva'
        }
      }),
      prisma.patient.create({
        data: {
          psychologistId,
          fullName: 'João Santos'
        }
      }),
      prisma.patient.create({
        data: {
          psychologistId,
          fullName: 'Maria Costa'
        }
      })
    ]);

    // Create test sessions
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(14, 0, 0, 0);

    await Promise.all([
      prisma.session.create({
        data: {
          psychologistId,
          patientId: patients[0].id,
          scheduledAt: tomorrow,
          durationMinutes: 50
        }
      }),
      prisma.session.create({
        data: {
          psychologistId,
          patientId: patients[1].id,
          scheduledAt: nextWeek,
          durationMinutes: 50
        }
      })
    ]);

    return res.json({
      message: 'Test data created',
      patients: patients.length,
      sessions: 2
    });

  } catch (error) {
    console.error('Error creating test data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get suggested test commands
router.get('/test-commands', (req, res) => {
  const commands = [
    {
      category: 'Agendamento',
      commands: [
        'Agendar Ana quinta 14h',
        'Marcar João segunda 10:30',
        'Agendar Maria amanhã 15h',
        'Agendar Carlos 25/01 16h'
      ]
    },
    {
      category: 'Cancelamento',
      commands: [
        'Cancelar Ana quinta',
        'Desmarcar João segunda',
        'Cancelar Maria amanhã'
      ]
    },
    {
      category: 'Visualização',
      commands: [
        'Mostrar semana',
        'Ver agenda hoje',
        'Minha agenda',
        'Agenda da semana'
      ]
    },
    {
      category: 'Ajuda',
      commands: [
        'Ajuda',
        'Comandos',
        'Como usar',
        'O que posso fazer'
      ]
    },
    {
      category: 'Casos Edge',
      commands: [
        'Agendar Pedro quinta 14h', // Conflito se Ana já tem 14h
        'Agendar Teste domingo 10h', // Fora do horário
        'Cancelar Inexistente hoje', // Paciente que não existe
        'Agendar Roberto ontem 10h' // No passado
      ]
    }
  ];

  return res.json({ commands });
});

// WhatsApp Dashboard route
router.get('/whatsapp-dashboard', (req: Request, res: Response) => {
  return res.sendFile(path.join(__dirname, '../views/whatsapp-dashboard.html'));
});

export { router as simulatorRouter };