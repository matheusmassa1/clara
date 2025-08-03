#!/usr/bin/env ts-node

/**
 * WhatsApp setup utility for clearing auth sessions and fresh setup
 * Usage: npm run whatsapp:setup
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

async function clearAuthSession(): Promise<void> {
  const authPath = path.join(process.cwd(), 'auth_info_baileys');
  
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('🗑️ Cleared existing auth session');
      logger.info('WhatsApp auth session cleared', { authPath });
    } else {
      console.log('ℹ️ No existing auth session to clear');
    }
  } catch (error) {
    console.warn('⚠️ Could not clear auth session:', error);
    logger.error('Failed to clear auth session', { 
      error: error instanceof Error ? error.message : error,
      authPath 
    });
  }
}

async function setupWhatsApp(): Promise<void> {
  console.log('🚀 WhatsApp Setup Utility\n');

  try {
    // Clear any existing auth session for fresh start
    await clearAuthSession();
    
    console.log('\n📝 WhatsApp Connection Tips:');
    console.log('   1. Make sure your phone has stable internet');
    console.log('   2. Keep WhatsApp open while scanning');
    console.log('   3. Scan the QR code quickly (it expires in 30 seconds)');
    console.log('   4. If connection fails, wait 5 minutes before retrying');

    console.log('\n🚀 Next Steps:');
    console.log('   1. Start the main application: npm run dev');
    console.log('   2. Scan the QR code that appears in the terminal');
    console.log('   3. Send a test message to your registered WhatsApp number');

    console.log('\n📱 Your registered number: 5562982337961');
    console.log('   (Dr. Matheus Test Account)');

    console.log('\n💬 Test Commands (send these via WhatsApp):');
    console.log('   "agendar Ana quinta 14h" - Schedule session');
    console.log('   "cancelar João segunda" - Cancel session');
    console.log('   "ver agenda" - View agenda');
    console.log('   "ajuda" - Get help');

    console.log('\n🔗 Available endpoints after starting:');
    console.log('   GET  /api/whatsapp/status - Get service status');
    console.log('   GET  /api/whatsapp/psychologists - List registered psychologists');

    console.log('\n✅ Setup complete! Run `npm run dev` to start the service.\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    logger.error('WhatsApp setup failed', { 
      error: error instanceof Error ? error.message : error 
    });
    process.exit(1);
  }
}

// Run the setup utility
if (require.main === module) {
  setupWhatsApp().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

export { setupWhatsApp };