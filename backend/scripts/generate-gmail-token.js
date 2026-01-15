/**
 * Generate Gmail OAuth Refresh Token
 * 
 * Run: node scripts/generate-gmail-token.js
 * 
 * Make sure you have GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env file
 * OR set them as environment variables:
 *   export GMAIL_CLIENT_ID=your_client_id
 *   export GMAIL_CLIENT_SECRET=your_client_secret
 */

// Try to load dotenv if available, otherwise use environment variables
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not available, use environment variables directly
    console.log('ℹ️  dotenv not found, using environment variables directly');
}

const fs = require('fs');
const path = require('path');

// Try to read .env file manually if dotenv didn't work
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

const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8080/';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set');
    console.error('   Option 1: Add them to .env file');
    console.error('   Option 2: Set as environment variables:');
    console.error('     export GMAIL_CLIENT_ID=your_client_id');
    console.error('     export GMAIL_CLIENT_SECRET=your_client_secret');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
    // Add your email as a test user in Google Cloud Console OAuth consent screen
});

console.log('🔗 Authorize this app by visiting this URL:');
console.log('\n' + authUrl + '\n');

// Start a simple HTTP server to catch the redirect
const server = http.createServer(async (req, res) => {
    try {
        const queryObject = url.parse(req.url, true).query;
        
        if (queryObject.code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <body>
                        <h1>Authorization Successful!</h1>
                        <p>You can close this window and return to the terminal.</p>
                        <script>setTimeout(() => window.close(), 2000);</script>
                    </body>
                </html>
            `);
            
            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(queryObject.code);
            
            console.log('\n✅ Success! Your tokens:');
            console.log('\n📋 Add these to your .env file:');
            console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
            console.log(`GMAIL_REDIRECT_URI=${REDIRECT_URI}`);
            console.log('\n✅ You can now test the Gmail connection!');
            
            server.close();
            process.exit(0);
        } else if (queryObject.error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <body>
                        <h1>Authorization Failed</h1>
                        <p>Error: ${queryObject.error}</p>
                        <p>${queryObject.error_description || ''}</p>
                    </body>
                </html>
            `);
            console.error('\n❌ Authorization failed:', queryObject.error);
            server.close();
            process.exit(1);
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <body>
                        <h1>Waiting for authorization...</h1>
                        <p>Please complete the authorization in the browser.</p>
                    </body>
                </html>
            `);
        }
    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        server.close();
        process.exit(1);
    }
});

server.listen(8080, () => {
    console.log(`\n🌐 Listening on ${REDIRECT_URI}`);
    console.log('📝 Make sure this redirect URI is registered in Google Cloud Console!');
    console.log('\n⏳ Waiting for authorization...\n');
    
    // Automatically open browser (optional)
    const { exec } = require('child_process');
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin') {
        command = `open "${authUrl}"`;
    } else if (platform === 'win32') {
        command = `start "${authUrl}"`;
    } else {
        command = `xdg-open "${authUrl}"`;
    }
    
    exec(command, (error) => {
        if (error) {
            console.log('⚠️  Could not open browser automatically. Please copy the URL above and open it manually.');
        }
    });
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Error: Port 8080 is already in use.`);
        console.error('   Please stop any other application using port 8080, or change REDIRECT_URI in the script.');
    } else {
        console.error('\n❌ Server error:', error);
    }
    process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Interrupted. Closing server...');
    server.close();
    process.exit(0);
});

