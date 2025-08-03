import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * Create a new psychologist in the database
 */
router.post('/psychologists', async (req: Request, res: Response) => {
  try {
    const { 
      whatsappNumber, 
      fullName, 
      googleCalendarId,
      workingHours = {
        "mon": "09:00-17:00",
        "tue": "09:00-17:00", 
        "wed": "09:00-17:00",
        "thu": "09:00-17:00",
        "fri": "09:00-17:00"
      },
      sessionDurationMinutes = 50,
      timezone = "America/Sao_Paulo"
    } = req.body;

    if (!whatsappNumber || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: whatsappNumber, fullName'
      });
    }

    const psychologist = await prisma.psychologist.create({
      data: {
        whatsappNumber,
        fullName,
        googleCalendarId,
        workingHours,
        sessionDurationMinutes,
        timezone
      }
    });

    logger.info('Psychologist created in database', { 
      psychologistId: psychologist.id,
      whatsappNumber: psychologist.whatsappNumber 
    });

    return res.json({
      success: true,
      message: 'Psychologist created successfully',
      data: psychologist
    });
  } catch (error) {
    logger.error('Failed to create psychologist', { 
      error: error instanceof Error ? error.message : error 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create psychologist',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all psychologists from the database
 */
router.get('/psychologists', async (req: Request, res: Response) => {
  try {
    const psychologists = await prisma.psychologist.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            patients: true,
            sessions: true
          }
        }
      }
    });

    return res.json({
      success: true,
      data: psychologists
    });
  } catch (error) {
    logger.error('Failed to get psychologists', { 
      error: error instanceof Error ? error.message : error 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get psychologists',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update a psychologist in the database
 */
router.put('/psychologists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Psychologist ID is required'
      });
    }

    const psychologist = await prisma.psychologist.update({
      where: { id: id },
      data: updateData
    });

    logger.info('Psychologist updated in database', { psychologistId: id });

    return res.json({
      success: true,
      message: 'Psychologist updated successfully',
      data: psychologist
    });
  } catch (error) {
    logger.error('Failed to update psychologist', { 
      error: error instanceof Error ? error.message : error,
      psychologistId: req.params.id 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to update psychologist',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a psychologist from the database
 */
router.delete('/psychologists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Psychologist ID is required'
      });
    }

    await prisma.psychologist.delete({
      where: { id: id }
    });

    logger.info('Psychologist deleted from database', { psychologistId: id });

    return res.json({
      success: true,
      message: 'Psychologist deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete psychologist', { 
      error: error instanceof Error ? error.message : error,
      psychologistId: req.params.id 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to delete psychologist',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create a new patient
 */
router.post('/patients', async (req: Request, res: Response) => {
  try {
    const { psychologistId, fullName, whatsappNumber, notes } = req.body;

    if (!psychologistId || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: psychologistId, fullName'
      });
    }

    const patient = await prisma.patient.create({
      data: {
        psychologistId,
        fullName,
        whatsappNumber,
        notes
      }
    });

    logger.info('Patient created in database', { 
      patientId: patient.id,
      psychologistId 
    });

    return res.json({
      success: true,
      message: 'Patient created successfully',
      data: patient
    });
  } catch (error) {
    logger.error('Failed to create patient', { 
      error: error instanceof Error ? error.message : error 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create patient',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get patients for a specific psychologist
 */
router.get('/psychologists/:psychologistId/patients', async (req: Request, res: Response) => {
  try {
    const { psychologistId } = req.params;

    if (!psychologistId) {
      return res.status(400).json({
        success: false,
        error: 'Psychologist ID is required'
      });
    }

    const patients = await prisma.patient.findMany({
      where: { psychologistId: psychologistId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            sessions: true
          }
        }
      }
    });

    return res.json({
      success: true,
      data: patients
    });
  } catch (error) {
    logger.error('Failed to get patients', { 
      error: error instanceof Error ? error.message : error,
      psychologistId: req.params.psychologistId 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get patients',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update a patient
 */
router.put('/patients/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    const patient = await prisma.patient.update({
      where: { id: id },
      data: updateData
    });

    logger.info('Patient updated in database', { patientId: id });

    return res.json({
      success: true,
      message: 'Patient updated successfully',
      data: patient
    });
  } catch (error) {
    logger.error('Failed to update patient', { 
      error: error instanceof Error ? error.message : error,
      patientId: req.params.id 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to update patient',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a patient
 */
router.delete('/patients/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    await prisma.patient.delete({
      where: { id: id }
    });

    logger.info('Patient deleted from database', { patientId: id });

    return res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete patient', { 
      error: error instanceof Error ? error.message : error,
      patientId: req.params.id 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to delete patient',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;