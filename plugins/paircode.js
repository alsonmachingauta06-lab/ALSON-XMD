'use strict';

const { startSubBot } = require('../lib/subbot');
const { fmt } = require('../lib/theme');

module.exports = {
    commands: ['paircode', 'pcode'],
    description: 'Generate an ALSON-XMD WhatsApp pairing code',
    usage: '.paircode <phone number>',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const { sender, reply } = ctx;

        const number = args.join('').replace(/\D/g, '');

        if (!number) {
            return reply(fmt(
                `🔑 *Alsonxmd Pair Code*\n\n` +
                `Use .paircode <phone number> to connect another WhatsApp number as an ALSON-XMD mini-bot.\n\n` +
                `Example: .paircode 263771234567\n\n` +
                `⚠️ This command will never replace the main ALSON-XMD session.`
            ));
        }

        if (number.length < 7 || number.length > 15) {
            return reply(fmt('⚠️ Please provide a valid international phone number.'));
        }

        const requestorNum = sender.split('@')[0].replace(/\D/g, '');
        const requestorJid = `${requestorNum}@s.whatsapp.net`;

        await reply(fmt(
            `⏳ *Alsonxmd Pairing*\n\n` +
            `📞 Number: +${number}\n` +
            `🔄 Generating your WhatsApp pair code...`
        ));

        try {
            await startSubBot({
                number,
                requestorJid,
                requestorNum,
                mainSock: sock
            });
        } catch (e) {
            console.error(`[PairCode] +${number}: ${e.message}`);
            await reply(fmt(
                `❌ *Pairing failed*\n\n` +
                `Number: +${number}\n` +
                `Error: ${e.message}`
            ));
        }
    }
};
