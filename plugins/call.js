'use strict';

const os = require('os');
const { getStr } = require('../lib/theme');

module.exports = {
    commands:    ['call', 'support'],
    description: 'Support panel',
    permission:  'public',
    group:       true,
    private:     true,
    run: async (sock, message, args, { sender, contextInfo }) => {
        const botName = getStr('botName') || 'ALSON-XMD';
        const pic     = getStr('pic1') || 'https://files.catbox.moe/5uli5p.jpeg';

        const harareTime = new Date().toLocaleTimeString('en-ZW', {
            hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Africa/Harare'
        });
        const harareDate = new Date().toLocaleDateString('en-ZW', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Harare'
        });

        const uptime  = process.uptime();
        const hours   = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const sub = args[0]?.toLowerCase() || 'menu';

        if (sub === 'status') {
            return sock.sendMessage(sender, {
                text:
`🖥️ *System Status*

⏰ ${harareTime} — ${harareDate}
⏳ Uptime: ${hours}h ${minutes}m ${seconds}s
💻 Platform: ${os.platform()} ${os.arch()}
🧠 Memory: ${(os.freemem() / 1048576).toFixed(0)} MB free of ${(os.totalmem() / 1048576).toFixed(0)} MB`,
                contextInfo
            }, { quoted: message });
        }

    }
};
