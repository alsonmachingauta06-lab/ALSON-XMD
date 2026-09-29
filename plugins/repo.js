'use strict';

const axios  = require('axios');
const moment = require('moment-timezone');

const REPO_URL = '';
const WEBSITE_URL = '';
const WA_CHANNEL = 'https://chat.whatsapp.com/LQMrievFuQW6GyqDRxuvRu';
const SUPPORT_URL = 'https://chat.whatsapp.com/LQMrievFuQW6GyqDRxuvRu';

module.exports = {
    commands:    ['repo', 'repository', 'github'],
    description: 'Show ALSON-XMD project info',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, ctx) => {
        const { contextInfo } = ctx;
        const jid = message.key.remoteJid;

        const caption =
            `*✨ ALSON-XMD — PROJECT INFO*\n\n` +
            `🤖 *Bot:* ALSON-XMD\n` +
            `👤 *Owner:* Alson Machingauta\n` +
            `💻 *Language:* JavaScript\n` +
            `📜 *License:* MIT\n\n` +
            `📦 *Repository:* Not published yet\n` +
            `📢 *Group:* ${WA_CHANNEL}\n\n` +
            `⚡ _Powered by Alson Machingauta_`;

        const imgUrl = 'https://files.catbox.moe/5uli5p.jpeg';

        await sock.sendMessage(jid, {
            image: { url: imgUrl },
            caption,
            contextInfo: {
                ...contextInfo,
                externalAdReply: {
                    title: 'ALSON-XMD — WhatsApp Bot',
                    body: 'ALSON-XMD project information',
                    thumbnailUrl: imgUrl,
                    sourceUrl: WA_CHANNEL,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });
    }
};
