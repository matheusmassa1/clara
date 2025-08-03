import { Router, Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp-service';
import { PsychologistWhatsAppMapping } from '../types/whatsapp';

const router = Router();

/**
 * Get WhatsApp service status
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = whatsappService.getStatus();
    return res.json({
      success: true,
      data: status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get WhatsApp status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start WhatsApp service
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    await whatsappService.start();
    return res.json({
      success: true,
      message: 'WhatsApp service started successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to start WhatsApp service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop WhatsApp service
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    await whatsappService.stop();
    return res.json({
      success: true,
      message: 'WhatsApp service stopped successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to stop WhatsApp service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Restart WhatsApp service
 */
router.post('/restart', async (req: Request, res: Response) => {
  try {
    await whatsappService.restart();
    return res.json({
      success: true,
      message: 'WhatsApp service restarted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to restart WhatsApp service',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Register a psychologist
 */
router.post('/psychologists', (req: Request, res: Response) => {
  try {
    const { psychologistId, whatsappNumber, fullName, isActive = true } = req.body;

    if (!psychologistId || !whatsappNumber || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: psychologistId, whatsappNumber, fullName'
      });
    }

    const mapping: PsychologistWhatsAppMapping = {
      psychologistId,
      whatsappNumber,
      fullName,
      isActive
    };

    whatsappService.registerPsychologist(mapping);

    return res.json({
      success: true,
      message: 'Psychologist registered successfully',
      data: mapping
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to register psychologist',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get registered psychologists
 */
router.get('/psychologists', (req: Request, res: Response) => {
  try {
    const psychologists = whatsappService.getRegisteredPsychologists();
    return res.json({
      success: true,
      data: psychologists
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get psychologists',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update psychologist status
 */
router.patch('/psychologists/:whatsappNumber/status', (req: Request, res: Response) => {
  try {
    const { whatsappNumber } = req.params;
    const { isActive } = req.body;

    if (!whatsappNumber) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp number is required'
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean'
      });
    }

    whatsappService.updatePsychologistStatus(whatsappNumber, isActive);

    return res.json({
      success: true,
      message: `Psychologist status updated to ${isActive ? 'active' : 'inactive'}`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update psychologist status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Unregister a psychologist
 */
router.delete('/psychologists/:whatsappNumber', (req: Request, res: Response) => {
  try {
    const { whatsappNumber } = req.params;
    
    if (!whatsappNumber) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp number is required'
      });
    }

    whatsappService.unregisterPsychologist(whatsappNumber);

    return res.json({
      success: true,
      message: 'Psychologist unregistered successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to unregister psychologist',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Send a message to a specific number (for testing)
 */
router.post('/send-message', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, message'
      });
    }

    const messageId = await whatsappService.sendMessage(to, message);

    return res.json({
      success: true,
      message: 'Message sent successfully',
      data: { messageId }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Broadcast message to all psychologists
 */
router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: message'
      });
    }

    await whatsappService.broadcastMessage(message);

    return res.json({
      success: true,
      message: 'Broadcast sent successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to send broadcast',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const isHealthy = whatsappService.isHealthy();
    const statusCode = isHealthy ? 200 : 503;

    return res.status(statusCode).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;