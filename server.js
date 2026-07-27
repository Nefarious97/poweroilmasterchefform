/**
 * Power Oil MasterChef - Clubkonnect Airtime API & Google Sheet Integration Server
 * Includes Duplicate Phone & Email Prevention + Server Keep-Alive Pinger
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Parse local .env file if available
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const parts = trimmed.split('=');
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                if (key && !process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
    } catch (e) {
        console.warn('Failed to parse local .env file:', e.message);
    }
}

const PORT = process.env.PORT || 8085;
const PING_INTERVAL_MS = (parseInt(process.env.PING_INTERVAL_SECONDS, 10) || 15) * 1000;

// Duplicate Prevention Storage (Persisted to submissions.json)
const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');
const claimedPhones = new Set();
const claimedEmails = new Set();

function loadSubmissions() {
    try {
        if (fs.existsSync(SUBMISSIONS_FILE)) {
            const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
            const data = JSON.parse(raw);
            (data.phones || []).forEach(p => claimedPhones.add(p));
            (data.emails || []).forEach(e => claimedEmails.add(e.toLowerCase()));
            console.log(`[Duplicate Protection] Loaded ${claimedPhones.size} claimed phones and ${claimedEmails.size} claimed emails.`);
        }
    } catch (e) {
        console.warn('Failed to load submissions storage:', e.message);
    }
}

function saveSubmissionRecord(phone, email) {
    if (phone) claimedPhones.add(phone);
    if (email) claimedEmails.add(email.toLowerCase());
    try {
        fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify({
            phones: Array.from(claimedPhones),
            emails: Array.from(claimedEmails)
        }, null, 2));
    } catch (e) {
        console.warn('Failed to save submission storage:', e.message);
    }
}

// Load existing claimed records on server startup
loadSubmissions();

// MIME Types Map
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf'
};

// Helper: Post submission data to Google Sheet Webhook via native fetch
async function postToGoogleSheet(sheetUrlStr, payload) {
    if (!sheetUrlStr) return;
    try {
        const response = await fetch(sheetUrlStr, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resultText = await response.text();
        console.log('[Google Sheet Log Result]:', response.status, resultText);
    } catch (err) {
        console.warn('[Google Sheet Log Error]:', err.message);
    }
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS Headers for ad embeds
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health Check / Ping endpoint
    if (pathname === '/healthz' || pathname === '/health' || pathname === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'OK', uptime: process.uptime(), timestamp: new Date().toISOString() }));
        return;
    }

    // API TopUp Proxy Route: /api/topup
    if (pathname === '/api/topup') {
        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', () => {
            let bodyParams = {};
            try { bodyParams = JSON.parse(bodyStr); } catch (e) {}

            const name = bodyParams.name || parsedUrl.query.name || '';
            const phone = bodyParams.phone || parsedUrl.query.phone || '';
            const email = (bodyParams.email || parsedUrl.query.email || '').trim();
            const location = bodyParams.location || parsedUrl.query.location || '';
            const knowsChallenge = bodyParams.knowsChallenge || parsedUrl.query.knowsChallenge || '';

            const network = bodyParams.network || parsedUrl.query.network || '01';
            const amount = bodyParams.amount || parsedUrl.query.amount || '200';

            if (!phone) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Phone number is required' }));
                return;
            }

            // Normalize phone number to 11 digits (e.g. 08031234567)
            let cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('234')) {
                cleanPhone = '0' + cleanPhone.slice(3);
            }

            // --- DUPLICATE CHECKING LOGIC ---
            if (claimedPhones.has(cleanPhone)) {
                console.warn(`[Duplicate Blocked] Phone ${cleanPhone} has already claimed airtime.`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    duplicate: true,
                    message: `The phone number ${cleanPhone} has already claimed an airtime reward!`
                }));
                return;
            }

            if (email && claimedEmails.has(email.toLowerCase())) {
                console.warn(`[Duplicate Blocked] Email ${email} has already claimed airtime.`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    duplicate: true,
                    message: `The email address ${email} has already claimed an airtime reward!`
                }));
                return;
            }

            // Process Airtime API Call via Clubkonnect / Nellobyte
            const userId = process.env.CLUBKONNECT_USER_ID || 'CK101284801';
            const apiKey = process.env.CLUBKONNECT_API_KEY || '5G2TFK1JZGX63T1J53U2TXY3732UT86155EK6R6ZI8LV8T72J63FCINN270U58K1';
            const requestId = 'POWEROIL_' + Date.now() + Math.floor(Math.random() * 1000);

            // Official Nellobyte Systems / Clubkonnect Airtime API V1 URL
            const apiUrl = `https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=${encodeURIComponent(userId)}&APIKey=${encodeURIComponent(apiKey)}&MobileNetwork=${encodeURIComponent(network)}&Amount=${encodeURIComponent(amount)}&MobileNumber=${encodeURIComponent(cleanPhone)}&RequestID=${encodeURIComponent(requestId)}`;

            console.log(`[Clubkonnect API Proxy] Dispatching ₦${amount} Airtime to ${cleanPhone} (Network: ${network})...`);

            https.get(apiUrl, (apiRes) => {
                let apiData = '';
                apiRes.on('data', chunk => { apiData += chunk; });
                apiRes.on('end', () => {
                    console.log('[Clubkonnect Response]:', apiData);

                    let jsonResp;
                    try {
                        jsonResp = JSON.parse(apiData);
                    } catch (e) {
                        jsonResp = { rawResponse: apiData };
                    }

                    const isSuccess = jsonResp.statuscode === '100' || jsonResp.status === 'ORDER_RECEIVED' || jsonResp.status === 'ORDER_COMPLETED';

                    if (isSuccess) {
                        // Register phone & email in duplicate prevention record
                        saveSubmissionRecord(cleanPhone, email);
                    }

                    const responsePayload = {
                        success: isSuccess,
                        status: jsonResp.status || (isSuccess ? 'ORDER_RECEIVED' : 'FAILED'),
                        statusCode: jsonResp.statuscode,
                        amount: amount,
                        phone: cleanPhone,
                        network: jsonResp.mobilenetwork || network,
                        orderId: jsonResp.orderid || requestId,
                        walletBalance: jsonResp.walletbalance,
                        message: isSuccess ? 'Airtime dispatched successfully!' : 'Airtime dispatch failed'
                    };

                    // Automatically post submission to Google Sheet Webhook
                    const googleSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
                    if (googleSheetUrl) {
                        postToGoogleSheet(googleSheetUrl, {
                            timestamp: new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }),
                            name: name,
                            phone: cleanPhone,
                            email: email,
                            location: location,
                            knowsChallenge: knowsChallenge,
                            network: jsonResp.mobilenetwork || network,
                            amount: '₦' + amount,
                            orderId: jsonResp.orderid || requestId,
                            airtimeStatus: isSuccess ? 'DISPATCHED' : 'FAILED'
                        });
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(responsePayload));
                });
            }).on('error', (err) => {
                console.error('[Clubkonnect Proxy Error]:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            });
        });
        return;
    }

    // Static File Server
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Automated Keep-Alive Pinger Loop
function startKeepAlivePinger() {
    setInterval(() => {
        const renderUrl = process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${PORT}/healthz`;
        const pinger = renderUrl.startsWith('https') ? https : http;
        
        pinger.get(renderUrl, () => {}).on('error', () => {});
    }, PING_INTERVAL_MS);
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Power Oil MasterChef Ad Server running on port ${PORT}`);
    console.log(`[Duplicate Protection] Active. Prevents duplicate phone & email claims.`);
    console.log(`[Keep-Alive] Automated self-pinger active every ${PING_INTERVAL_MS / 1000} seconds.`);
    startKeepAlivePinger();
});
