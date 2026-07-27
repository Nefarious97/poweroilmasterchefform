/**
 * Power Oil MasterChef - Clubkonnect ₦200 Airtime API Server
 * Secure Environment Variables & Render Deployment Ready
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

    // Health Check endpoint for Render
    if (pathname === '/healthz' || pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'OK', app: 'Power Oil MasterChef Form' }));
        return;
    }

    // API TopUp Proxy Route: /api/topup
    if (pathname === '/api/topup') {
        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', () => {
            let bodyParams = {};
            try { bodyParams = JSON.parse(bodyStr); } catch (e) {}

            const phone = bodyParams.phone || parsedUrl.query.phone || '';
            const network = bodyParams.network || parsedUrl.query.network || '01';
            const amount = bodyParams.amount || parsedUrl.query.amount || '200';

            if (!phone) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Phone number is required' }));
                return;
            }

            let cleanPhone = phone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('234')) {
                cleanPhone = '0' + cleanPhone.slice(3);
            }

            // Securely read credentials from Environment Variables
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

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: isSuccess,
                        status: jsonResp.status || (isSuccess ? 'ORDER_RECEIVED' : 'FAILED'),
                        statusCode: jsonResp.statuscode,
                        amount: amount,
                        phone: cleanPhone,
                        network: jsonResp.mobilenetwork || network,
                        orderId: jsonResp.orderid || requestId,
                        walletBalance: jsonResp.walletbalance
                    }));
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Power Oil MasterChef Ad Server running on port ${PORT}`);
});
