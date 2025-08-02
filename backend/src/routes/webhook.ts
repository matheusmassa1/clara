import { Router } from 'express';
import { logger } from "../utils/logger";

const router = Router();

router.post("/", async (req, res) => {
    try {
        const { from, message } = req.body;

        logger.info('Received Whatsapp message', { from, message });

        const response = {
            to: from,
            message: `Echo: ${message}`,
            timestamp: new Date().toISOString(),
        };

        res.json(response);
    } catch (error) {
        logger.error('Error processing webhook', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export { router as webhookRouter };