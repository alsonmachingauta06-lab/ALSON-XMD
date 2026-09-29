'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

module.exports = {
    commands:    ['owner', 'creator'],
    description: 'Show bot owner contact information',
    permission:  'public',
    group:       true,
    private:     true,
    run: async (sock, message, args, { sender, jid, contextInfo }) => {
        const ownerNumber = (config.OWNER_NUMBER || global.botNum || '').replace(/\D/g, '');
        const ownerName   = config.OWNER_NAME || 'Alson Machingauta';

        const vcard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${ownerName}`,
            'ORG:ALSON-XMD',
            `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}`,
            'END:VCARD'
        ].join('\n');

        await sock.sendMessage(sender, {
            contacts: {
                displayName: ownerName,
                contacts: [{ vcard }]
            },
        }, { quoted: message });

    }
};
