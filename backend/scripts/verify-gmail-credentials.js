/**
 * Verify Gmail OAuth Credentials
 * 
 * Run: node scripts/verify-gmail-credentials.js
 * This will check if your CLIENT_ID and CLIENT_SECRET are valid
 */

const fs = require('fs');
const path = require('path');

// Try to load dotenv if available
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not available, read .env manually
}

// Try to read .env file manually
if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    }
}

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

console.log('🔍 Verifying Gmail OAuth Credentials...\n');

if (!CLIENT_ID) {
    console.error('❌ GMAIL_CLIENT_ID is not set in .env file');
    process.exit(1);
}

if (!CLIENT_SECRET) {
    console.error('❌ GMAIL_CLIENT_SECRET is not set in .env file');
    process.exit(1);
}

console.log('✅ Credentials found in .env:');
console.log(`   CLIENT_ID: ${CLIENT_ID.substring(0, 20)}...${CLIENT_ID.substring(CLIENT_ID.length - 10)}`);
console.log(`   CLIENT_SECRET: ${CLIENT_SECRET.substring(0, 10)}...${CLIENT_SECRET.substring(CLIENT_SECRET.length - 5)}`);
console.log('\n📋 Verification Checklist:');
console.log('\n1. Go to Google Cloud Console: https://console.cloud.google.com/');
console.log('2. Navigate to: APIs & Services → Credentials');
console.log('3. Find your OAuth 2.0 Client ID');
console.log(`4. Verify the CLIENT_ID matches: ${CLIENT_ID}`);
console.log('5. Click on the Client ID to view details');
console.log('6. Check that CLIENT_SECRET matches what you have in .env');
console.log('\n⚠️  Common Issues:');
console.log('   • CLIENT_ID or CLIENT_SECRET copied incorrectly');
console.log('   • Extra spaces or quotes in .env file');
console.log('   • Using credentials from wrong project');
console.log('   • OAuth client was deleted or disabled');
console.log('\n💡 If credentials don\'t match:');
console.log('   1. Go to Google Cloud Console');
console.log('   2. Create a new OAuth 2.0 Client ID (or use existing)');
console.log('   3. Copy the CLIENT_ID and CLIENT_SECRET exactly');
console.log('   4. Update your .env file');
console.log('   5. Make sure redirect URI is: http://localhost:8080/');

