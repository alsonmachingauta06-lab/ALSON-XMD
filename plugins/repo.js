'use strict';

const axios  = require('axios');
const moment = require('moment-timezone');

const REPO_URL = 'https://github.com/alsonmachingauta06-lab/ALSON-XMD';
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
            `📦 *Repository:* ${REPO_URL}\n` +
            `📢 *Group:* ${WA_CHANNEL}\n\n` +
            `⚡ _Powered by Alson Machingauta_`;

        const imgUrl = 'https://raw.githubusercontent.com/alsonmachingauta06-lab/ALSON-XMD/main/data/alsonxmd.png';

        await sock.sendMessage(jid, {
            image: { url: imgUrl },
            caption,
            contextInfo: {
                ...contextInfo,
                externalAdReply: {
                    title: 'ALSON-XMD — WhatsApp Bot',
                    body: 'ALSON-XMD project information',
                    thumbnailUrl: imgUrl,
                    sourceUrl: REPO_URL,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });
    }
};
