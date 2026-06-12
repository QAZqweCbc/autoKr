const fs = require('fs');
const path = require('path');

const accountsPath = path.join(__dirname, 'data', 'accounts.json');

if (!fs.existsSync(accountsPath)) {
  console.error('accounts.json not found');
  process.exit(1);
}

const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));

console.log(`Total accounts: ${accounts.length}\n`);

accounts.forEach((account, index) => {
  const token = account.credentials?.accessToken;

  if (!token) {
    console.log(`[${index + 1}] ${account.email} - NO TOKEN`);
    return;
  }

  const len = token.length;
  const start = token.substring(0, 50);
  const end = token.substring(len - 30);

  let type = 'Unknown';
  let issue = null;

  if (token.startsWith('aoa')) {ype = 'AWS SSO Token (CORRECT)';
    if (len > 300) issue = 'Length abnormal (should be 200-300)';
  } else if (token.startsWith('eyJ')) {
    type = 'JWT Token (WRONG)';
    issue = 'This is a JWT, not AWS SSO Access Token';
  } else if (token.includes('.')) {
    type = 'Possibly JWT (WRONG)';
    issue = 'Contains dots (JWT format)';
  }

  console.log(`[${index + 1}] ${account.email}`);
  console.log(`  Type: ${type}`);
  console.log(`  Length: ${len}`);
  console.log(`  Start: ${start}...`);
  console.log(`  End: ...${end}`);
  if (issue) console.log(`  ISSUE: ${issue}`);
  console.log('');
});

console.log('Correct AWS SSO Access Token should:');
console.log('  - Start with "aoa"');
console.log('  - Length: 200-300 characters');
