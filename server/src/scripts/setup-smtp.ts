import * as readline from 'readline';
import { saveEmailConfig } from '../services/email-config.service';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupSMTP() {
  console.log('📧 SMTP Configuration Wizard');
  console.log('============================\n');

  try {
    const smtpHost = await question('SMTP Host (e.g., smtp.gmail.com): ');
    const smtpPort = await question('SMTP Port (e.g., 587 for TLS, 465 for SSL): ');
    const smtpSecure = await question('Use SSL? (yes/no, default: no): ');
    const smtpUser = await question('SMTP Username (email address): ');
    const smtpPassword = await question('SMTP Password (or authorization code): ');
    const smtpFrom = await question('From Email (default: same as username): ');

    console.log('\n📝 Configuration Summary:');
    console.log(`   Host: ${smtpHost}`);
    console.log(`   Port: ${smtpPort}`);
    console.log(`   Secure: ${smtpSecure === 'yes' ? 'Yes (SSL)' : 'No (TLS)'}`);
    console.log(`   User: ${smtpUser}`);
    console.log(`   From: ${smtpFrom || smtpUser}`);
    console.log('');

    const confirm = await question('Save this configuration? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Configuration cancelled.');
      rl.close();
      process.exit(0);
    }

    // Save to database
    await saveEmailConfig({
      id: 'default',
      smtpHost: smtpHost,
      smtpPort: parseInt(smtpPort),
      smtpSecure: smtpSecure === 'yes',
      smtpUser: smtpUser,
      smtpPassword: smtpPassword,
      smtpFrom: smtpFrom || smtpUser,
    });

    console.log('\n✅ SMTP configuration saved successfully!');
    console.log('');
    console.log('🧪 Test your configuration:');
    console.log('   npm run test:email your-email@example.com');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Configuration failed:', error);
    rl.close();
    process.exit(1);
  }
}

setupSMTP();
