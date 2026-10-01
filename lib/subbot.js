'use strict';

/**
 * lib/subbot.js — Sub-bot manager
 *
 * Each approved lend spins up a second Baileys connection.
 * The requestor connects their WhatsApp number as a "linked device"
 * via a pair code.  When they send messages from their phone,
 * message.key.fromMe === true  →  isOwner === true in handler.js.
 * No handler modifications needed.
 */

const fs   = require('fs');
const path = require('path');
const P    = require('pino');

const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason,
} = require('@whiskeysockets/baileys');

// Lazy-require handler to avoid circular dependency (handler→subbot→handler)
function getHandleMessages() {
    return require('../handler').handleMessages;
}

const SUBBOTS_DIR = path.join(__dirname, '../data/subbots');
const LENDS_PATH  = path.join(__dirname, '../data/lends.json');
const PAIRBOTS_PATH = path.join(__dirname, '../data/pairbots.json');

function loadPairBots() {
    try {
        if (fs.existsSync(PAIRBOTS_PATH)) {
            return JSON.parse(fs.readFileSync(PAIRBOTS_PATH, 'utf8'));
        }
    } catch { /* ignore */ }
    return {};
}

function savePairBots(db) {
    try {
        fs.mkdirSync(path.dirname(PAIRBOTS_PATH), { recursive: true });
        fs.writeFileSync(PAIRBOTS_PATH, JSON.stringify(db, null, 2));
    } catch { /* ignore */ }
}

if (!global.subBots) global.subBots = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSubBotDir(number) {
    return path.join(SUBBOTS_DIR, String(number).replace(/\D/g, ''));
}

function loadLends() {
    try {
        if (fs.existsSync(LENDS_PATH)) return JSON.parse(fs.readFileSync(LENDS_PATH, 'utf8'));
    } catch { /* ignore */ }
    return { pending: {}, approved: {}, rejected: {} };
}

function saveLends(db) {
    try {
        fs.mkdirSync(path.dirname(LENDS_PATH), { recursive: true });
        fs.writeFileSync(LENDS_PATH, JSON.stringify(db, null, 2));
    } catch { /* ignore */ }
}

function log(msg) { console.log(`[SubBot] ${msg}`); }

// ─── Core: start one sub-bot ──────────────────────────────────────────────────
async function startSubBot({ number, requestorJid, requestorNum, mainSock, quiet = false }) {
    const cleanNum   = String(number).replace(/\D/g, '');
    const sessionDir = getSubBotDir(cleanNum);
    fs.mkdirSync(sessionDir, { recursive: true });

    const pairBots = loadPairBots();
    pairBots[cleanNum] = {
        number: cleanNum,
        requestorJid,
        requestorNum,
        status: 'connecting',
        addedAt: pairBots[cleanNum]?.addedAt || Date.now()
    };
    savePairBots(pairBots);

    // If a sub-bot for this number is already running, kill old first
    const existing = global.subBots.get(cleanNum);
    if (existing?.sock) {
        try { existing.sock.end(undefined); } catch { /* ignore */ }
    }

    const { state, saveCreds }  = await useMultiFileAuthState(sessionDir);
    let version = [2, 3000, 1035194821]; try { const r = await fetchLatestBaileysVersion(); if (r?.version && r.version.length === 3) version = r.version; } catch {}

    const sock = makeWASocket({
        logger:                     P({ level: 'silent' }),
        printQRInTerminal:          false,
        browser:                    Browsers.ubuntu('Chrome'),
        auth:                       state,
        version,
        markOnlineOnConnect:        true,
        syncFullHistory:            false,
        generateHighQualityLinkPreview: false,
    });

    // Register in global registry
    global.subBots.set(cleanNum, {
        sock,
        number:       cleanNum,
        requestorJid,
        requestorNum,
        status:       'connecting',
        startedAt:    Date.now(),
    });

    sock.ev.on('creds.update', saveCreds);

    // ── Connection state ───────────────────────────────────────────────────
    sock.ev.on('connection.update', async update => {
        const { connection, lastDisconnect } = update;
        const entry = global.subBots.get(cleanNum);

        if (connection === 'close') {
            if (entry) entry.status = 'disconnected';
            const code = lastDisconnect?.error?.output?.statusCode;
            log(`Sub-bot +${cleanNum} disconnected (code ${code})`);
            log(`Sub-bot disconnect detail: ${lastDisconnect?.error?.message || lastDisconnect?.error || 'unknown'}`);
            if (lastDisconnect?.error?.output?.payload) {
                log(`Sub-bot disconnect payload: ${JSON.stringify(lastDisconnect.error.output.payload)}`);
            }

            if (code === DisconnectReason.loggedOut) {
                // Wipe session; remove from registry and lends approved list
                log(`Sub-bot +${cleanNum} logged out — removing session`);
                try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch { /* ignore */ }
                global.subBots.delete(cleanNum);

                // Update lends.json
                const db = loadLends();
                if (db.approved[requestorNum]) {
                    db.approved[requestorNum].status = 'logged_out';
                    saveLends(db);
                }

                if (mainSock && requestorJid) {
                    try {
                        await mainSock.sendMessage(requestorJid, {
                            text: `⚠️ *Sub-bot (+${cleanNum}) was logged out*\n\nYour linked WhatsApp session ended. Request a new lend with \`.lend ${cleanNum}\`.`
                        });
                    } catch { /* ignore */ }
                }
            } else {
                if (code === 405) { global.subBots.delete(cleanNum); return; }
                // Auto-reconnect after delay
                setTimeout(() => {
                    startSubBot({ number: cleanNum, requestorJid, requestorNum, mainSock, quiet: true })
                        .catch(e => log(`Reconnect error for +${cleanNum}: ${e.message}`));
                }, 8000);
            }

        } else if (connection === 'open') {
            if (entry) { entry.status = 'connected'; entry.sock = sock; }
            log(`✅ Sub-bot +${cleanNum} connected`);

            if (!quiet && mainSock && requestorJid) {
                try {
                    await mainSock.sendMessage(requestorJid, {
                        text: `✅ *Sub-bot +${cleanNum} is now live!*\n\n` +
                              `Your bot is connected to WhatsApp and ready to use.\n` +
                              `Send \`.menu\` to it to see all available commands.\n\n` +
                              `_Powered by ALSON-XMD_`
                    });
                } catch { /* ignore */ }
            }
        }
    });

    // ── Request pair code if not yet registered ────────────────────────────
    const credsFile = path.join(sessionDir, 'creds.json');
    let needsPairCode = true;
    if (fs.existsSync(credsFile)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
            if (creds.registered === true) needsPairCode = false;
        } catch { /* ignore */ }
    }

    if (needsPairCode) {
        try {
            // Small delay so the socket handshake completes before requesting code
            await new Promise(r => setTimeout(r, 1500));
            if (typeof sock.requestPairingCode !== "function") throw new Error("Baileys pairing-code API unavailable");
            const code = await sock.requestPairingCode(cleanNum);
            log(`Pair code for +${cleanNum}: ${code}`);

            if (mainSock && requestorJid) {
                const fmt = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
                await mainSock.sendMessage(requestorJid, {
                    text: `🔑 *Alsonxmd Pair Code*\n\n` +
                          `📞 *Number:* +${cleanNum}\n\n` +
                          `┌──────────────┐\n` +
                          `│  \`${fmt}\`  │\n` +
                          `└──────────────┘\n\n` +
                          `*How to connect:*\n` +
                          `1️⃣ Open WhatsApp on your phone\n` +
                          `2️⃣ Tap ⋮ → *Linked Devices* → *Link a Device*\n` +
                          `3️⃣ Tap *Link with phone number instead*\n` +
                          `4️⃣ Enter the code above\n\n` +
                          `⚠️ _Code expires in ~60 seconds — enter it immediately!_\n\n` +
                          `Once linked, your sub-bot will come online automatically.`
                });
            }
        } catch (e) {
            log(`requestPairingCode error for +${cleanNum}: ${e.message}`);
            if (mainSock && requestorJid) {
                try {
                    await mainSock.sendMessage(requestorJid, {
                        text: `❌ Failed to generate pair code for +${cleanNum}: ${e.message}\n\nPlease ask the owner to try again.`
                    });
                } catch { /* ignore */ }
            }
        }
    }

    // ── Wire message handler ───────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages }) => {
        if (!Array.isArray(messages)) return;
        for (const m of messages) {
            if (!m.message) continue;
            const remoteJid = m.key?.remoteJid || '';
            if (remoteJid === 'status@broadcast') continue;
            try {
                await getHandleMessages()(sock, m);
            } catch (e) {
                log(`handleMessages error (+${cleanNum}): ${e.message}`);
            }
        }
    });

    return sock;
}

// ─── Stop a sub-bot ────────────────────────────────────────────────────────────
async function stopSubBot(number) {
    const cleanNum = String(number).replace(/\D/g, '');
    const entry    = global.subBots.get(cleanNum);
    if (!entry) return false;
    try { entry.sock.end(undefined); } catch { /* ignore */ }
    global.subBots.delete(cleanNum);
    log(`Stopped sub-bot +${cleanNum}`);
    return true;
}

// ─── Wipe session files for a number ──────────────────────────────────────────
function wipeSubBotSession(number) {
    const cleanNum   = String(number).replace(/\D/g, '');
    const sessionDir = getSubBotDir(cleanNum);
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ─── Restore approved sub-bots on bot startup ─────────────────────────────────
async function restoreSubBots(mainSock) {
    const db = loadLends();
    const approved = Object.values(db.approved || {});
    const pairBots = loadPairBots();
    const direct = Object.values(pairBots || {});

    const records = [
        ...approved.map(record => ({ ...record, source: 'lend' })),
        ...direct.map(record => ({ ...record, targetNumber: record.number, source: 'paircode' }))
    ];

    if (!records.length) return;

    log(`Restoring ${records.length} sub-bot(s)…`);

    const seen = new Set();

    for (const record of records) {
        const cleanNum = String(record.targetNumber || record.number || '').replace(/\D/g, '');
        if (!cleanNum || seen.has(cleanNum)) continue;
        seen.add(cleanNum);

        if (record.status === 'logged_out') continue;

        const sessionDir = getSubBotDir(cleanNum);
        const credsFile = path.join(sessionDir, 'creds.json');

        if (!fs.existsSync(credsFile)) {
            log(`No session for sub-bot +${cleanNum} — skipping restore`);
            continue;
        }

        try {
            await startSubBot({
                number: cleanNum,
                requestorJid: record.requestorJid,
                requestorNum: record.requestorNum,
                mainSock,
                quiet: true
            });
        } catch (e) {
            log(`Restore failed for +${cleanNum}: ${e.message}`);
        }
    }
}

// ─── Status helpers ────────────────────────────────────────────────────────────
function listSubBots() {
    const list = [];
    for (const [num, entry] of global.subBots) {
        list.push({
            number:      num,
            status:      entry.status,
            requestorNum: entry.requestorNum,
            startedAt:   entry.startedAt,
        });
    }
    return list;
}

module.exports = { startSubBot, stopSubBot, wipeSubBotSession, restoreSubBots, listSubBots, getSubBotDir };
