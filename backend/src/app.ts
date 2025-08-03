// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { webhookRouter } from './routes/webhook';
import { healthRouter } from './routes/health';
import { simulatorRouter } from './routes/simulator';
import whatsappRoutes from './routes/whatsapp';
import databaseRoutes from './routes/database';
import { whatsappService } from './services/whatsapp-service';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(morgan('combined', {
    stream: {
        write: (message: string) => logger.info(message.trim())
    }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({
        message: 'Clara Backend API',
        version: '1.0.0',
        status: 'running'
    });
});

app.use('/webhook', webhookRouter);
app.use('/health', healthRouter);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/db', databaseRoutes);
app.use('/simulator', simulatorRouter);

// Serve simulator HTML page
app.get('/simulator-ui', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'simulator.html'));
});

// Serve Clara Dashboard
app.get('/clara-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'clara-dashboard.html'));
});



app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method
    });
});

app.use(errorHandler);

if (require.main === module) {
    app.listen(PORT, async () => {
        logger.info(`Clara Backend running on port ${PORT}`);
        
        // Initialize WhatsApp service
        try {
            logger.info('Initializing WhatsApp service');
            
            // Register your number automatically
            whatsappService.registerPsychologist({
                psychologistId: 'psych-matheus',
                whatsappNumber: '5562982337961', // Registered with 9 (Brazilian mobile pattern)
                fullName: 'Dr. Matheus (Test)',
                isActive: true
            });
            
            await whatsappService.start();
            logger.info('WhatsApp service started successfully');
            console.log('✅ WhatsApp service started successfully!');
            console.log('📱 Check the terminal for QR code or visit: http://localhost:3000/simulator/whatsapp-dashboard');
        } catch (error) {
            logger.error('Failed to start WhatsApp service', { 
                error: error instanceof Error ? error.message : error 
            });
            console.log('💡 You can start it manually via the dashboard at: http://localhost:3000/simulator/whatsapp-dashboard');
        }
    });
}

export { app };