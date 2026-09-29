'use strict';

const axios = require('axios');
const playdl = require('play-dl');

const BASE = 'https://apis.davidcyriltech.my.id';

async function searchYoutube(query) {
    const isUrl = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(query);
    if (isUrl) {
        try {
            const info = await playdl.video_info(query);
            const d = info.video_details;
            return { url: query, title: d.title || 'Unknown', artist: d.channel?.name || 'Unknown', thumbnail: d.thumbnails?.slice(-1)[0]?.url || '', duration: d.durationRaw || '' };
        } catch {}
        const id = query.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
        return { url: query, title: 'Unknown', artist: 'Unknown', thumbnail: id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '', duration: '' };
    }
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (!results?.length) throw new Error('No results found for: ' + query);
    const v = results[0];
    return { url: v.url, title: v.title || 'Unknown', artist: v.channel?.name || 'Unknown', thumbnail: v.thumbnails?.slice(-1)[0]?.url || '', duration: v.durationRaw || '' };
}

async function downloadMp3(videoUrl) {
    const { execFile } = require("child_process");
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(__dirname, "..", "downloads");
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `play-${Date.now()}.%(ext)s`);
    await new Promise((resolve, reject) => {
        execFile("yt-dlp", ["-x", "--audio-format", "mp3", "--no-playlist", "-o", out, videoUrl], { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || err.message).trim().slice(-500)));
            resolve();
        });
    });
    const files = fs.readdirSync(dir).filter(f => f.startsWith(path.basename(out).split(".")[0]) && f.endsWith(".mp3")).sort();
    if (!files.length) throw new Error("yt-dlp did not produce an MP3 file");
    return path.join(dir, files[files.length - 1]);
}

module.exports = {
    commands:    ['play', 'music', 'song', 'ytmp3', 'ytsong', 'ytaudio'],
    description: 'Search and download a song from YouTube',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, { sender, contextInfo }) => {
        const query = args.join(' ').trim();
        if (!query) {
            return sock.sendMessage(sender, {
                text: '🎵 Usage: `.play <song name or YouTube link>`\nExample: `.play Blinding Lights`',
                contextInfo
            }, { quoted: message });
        }

        await sock.sendMessage(sender, {
            text: `🔍 Searching: *${query}*...`,
            contextInfo
        }, { quoted: message });

        try {
            const track = await searchYoutube(query);

            await sock.sendMessage(sender, {
                image:   { url: track.thumbnail || 'https://files.catbox.moe/5uli5p.jpeg' },
                caption: `🎵 *${track.title}*\n🎤 *Artist:* ${track.artist}\n⏱ *Duration:* ${track.duration}\n\n_Downloading..._`,
                contextInfo
            }, { quoted: message });

            const audioUrl = await downloadMp3(track.url);

            await sock.sendMessage(sender, {
                audio:    { url: audioUrl },
                mimetype: 'audio/mpeg',
                ptt:      false,
                contextInfo
            }, { quoted: message });

            const safeName = track.title.replace(/[^\w\s-]/g, '').trim().slice(0, 50);
            await sock.sendMessage(sender, {
                document: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: `${safeName}.mp3`,
                contextInfo
            }, { quoted: message });

        } catch (err) {
            await sock.sendMessage(sender, {
                text: `❌ *Download failed:* ${err.message}`,
                contextInfo
            }, { quoted: message });
        }
    }
};
