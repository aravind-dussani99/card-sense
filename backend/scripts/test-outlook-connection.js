/**
 * Test script to verify Outlook IMAP connection
 * Run with: node scripts/test-outlook-connection.js
 */

const fs = require('fs');
const path = require('path');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// Load env vars (support running without dotenv installed)
(() => {
    try {
        require('dotenv').config();
    } catch (e) {
        // Ignore if dotenv is not installed
    }

    if (!process.env.OUTLOOK_USER && !process.env.OUTLOOK_PASSWORD) {
        const envPath = path.resolve(__dirname, '..', '.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
            for (const line of lines) {
                if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
                const [key, ...rest] = line.split('=');
                const value = rest.join('=').trim().replace(/^"/, '').replace(/"$/, '');
                if (key && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
    }
})();

const config = {
    user: process.env.OUTLOOK_USER,
    password: process.env.OUTLOOK_PASSWORD,
    host: process.env.OUTLOOK_HOST || 'outlook.office365.com',
    port: parseInt(process.env.OUTLOOK_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

console.log('Testing Outlook IMAP connection...');
console.log('User:', config.user);
console.log('Host:', config.host);
console.log('Port:', config.port);

if (!config.user || !config.password) {
    console.error('❌ OUTLOOK_USER and OUTLOOK_PASSWORD must be set in .env file');
    process.exit(1);
}

const imap = new Imap(config);

imap.once('ready', () => {
    console.log('✅ Connected to Outlook IMAP server');
    
    imap.openBox('INBOX', false, (err, box) => {
        if (err) {
            console.error('❌ Error opening INBOX:', err);
            imap.end();
            process.exit(1);
        }
        
        console.log('✅ Opened INBOX');
        console.log('Total messages:', box.messages.total);
        
        // Search for unread emails
        imap.search(['UNSEEN'], (err, results) => {
            if (err) {
                console.error('❌ Error searching:', err);
                imap.end();
                process.exit(1);
            }
            
            console.log('✅ Found', results.length, 'unread emails');
            
            if (results.length > 0) {
                // Fetch first email
                const fetch = imap.fetch(results.slice(0, 1), { bodies: '' });
                
                fetch.on('message', (msg) => {
                    msg.on('body', (stream) => {
                        simpleParser(stream, (err, parsed) => {
                            if (err) {
                                console.error('❌ Error parsing:', err);
                                return;
                            }
                            
                            console.log('\n✅ Successfully fetched email:');
                            console.log('Subject:', parsed.subject);
                            console.log('From:', parsed.from?.text);
                            console.log('Date:', parsed.date);
                            console.log('Body length:', (parsed.text || parsed.html || '').length, 'characters');
                            
                            imap.end();
                            console.log('\n✅ Outlook connection test successful!');
                            process.exit(0);
                        });
                    });
                });
            } else {
                console.log('ℹ️  No unread emails to fetch');
                imap.end();
                process.exit(0);
            }
        });
    });
});

imap.once('error', (err) => {
    console.error('❌ IMAP connection error:', err);
    process.exit(1);
});

imap.connect();
