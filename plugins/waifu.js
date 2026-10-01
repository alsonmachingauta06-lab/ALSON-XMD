'use strict';

const axios = require('axios');

const PROMPTS = {
    waifu: 'beautiful anime waifu portrait, high quality',
    neko: 'cute anime neko catgirl, high quality',
    maid: 'beautiful anime maid character, high quality',
    husbando: 'handsome anime husbando portrait, high quality',
    shinobu: 'Shinobu Kocho inspired anime character, butterfly theme',
    megumin: 'Megumin inspired anime character, fantasy magic theme',
    uniform: 'beautiful anime girl wearing school uniform',
    selfies: 'anime girl taking a cute selfie',
    raiden: 'Raiden Shogun inspired anime character, elegant purple theme',
    rias: 'Rias Gremory inspired anime character, red hair',
    kamisato: 'Kamisato Ayaka inspired anime character, elegant ice theme',
    wink: 'cute anime girl winking',
    blush: 'cute blushing anime girl',
    smile: 'cute smiling anime girl',
    wave: 'cute anime girl waving',
    happy: 'happy cheerful anime girl',
    marin: 'Marin Kitagawa inspired anime girl',
    oppai: 'anime character portrait, tasteful fantasy style',
    ero: 'tasteful anime character, non-explicit',
};

const DESCRIPTIONS = {
    waifu: '🌸 Waifu time!',
    neko: '🐱 Neko!',
    maid: '🧹 Maid-sama!',
    husbando: '💪 Husbando!',
    shinobu: '🦋 Shinobu!',
    megumin: '💥 Megumin!',
    uniform: '🎓 School uniform!',
    selfies: '📸 Anime selfie!',
    raiden: '⚡ Raiden Shogun!',
    rias: '😈 Rias Gremory!',
    kamisato: '❄️ Kamisato Ayaka!',
    wink: '😉 Wink~',
    blush: '😳 Blushing~',
    smile: '😊 Smiling~',
    wave: '👋 Waving~',
    happy: '🎉 Happy~',
    marin: '🌸 Marin!',
    oppai: '🌸 Anime!',
    ero: '🔞 Anime!',
};

const COMMANDS = Object.keys(PROMPTS);

async function generateAnimeImage(prompt) {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const seed = Math.floor(Math.random() * 999999);

            const url =
                'https://image.pollinations.ai/prompt/' +
                encodeURIComponent(prompt) +
                `?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 60000
            });

            if (response.data?.length) {
                return Buffer.from(response.data);
            }

            throw new Error('No image returned');
        } catch (e) {
            lastError = e;
            if (attempt < 3) {
                await new Promise(r => setTimeout(r, 1500 * attempt));
            }
        }
    }

    throw lastError || new Error('Image generation failed');
}

module.exports = {
    commands: [...new Set(COMMANDS)],
    description: 'Anime image generator — waifu, neko, maid, husbando, shinobu, megumin and more',
    usage: '.waifu | .neko | .maid | .husbando | .shinobu | .megumin',
    permission: 'public',
    group: true,
    private: true,

    run: async (sock, message, args, ctx) => {
        const { jid, contextInfo } = ctx;

        const rawCmd = (
            message.message?.extendedTextMessage?.text ||
            message.message?.conversation ||
            ''
        ).trim().split(/\s+/)[0].replace(/^\./, '').toLowerCase();

        const prompt = PROMPTS[rawCmd] || PROMPTS.waifu;
        const label = DESCRIPTIONS[rawCmd] || DESCRIPTIONS.waifu;

        try {
            await sock.sendPresenceUpdate('composing', jid);

            const image = await generateAnimeImage(prompt);

            await sock.sendMessage(jid, {
                image,
                caption: `✨ *ALSON-XMD*\n\n${label}`,
                contextInfo
            }, { quoted: message });

        } catch (e) {
            await sock.sendMessage(jid, {
                text: `❌ Image generation failed: ${e.message}`,
                contextInfo
            }, { quoted: message });
        }
    }
};
