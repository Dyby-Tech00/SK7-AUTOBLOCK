const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const readline = require('readline');
const fs = require('fs');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

// --- CONFIGURATION ---
const prefix = "."; // ⚠️ MODIFIE TON PRÉFIXE ICI (ex: "!", "/", ".")
const ownerNumber = "243894096430@s.whatsapp.net"; // ⚠️ TON NUMÉRO ICI
const TG_BOT_TOKEN = '7025486524:AAGNJ3lMa8610p7OAIycwLtNmF9vG8GfboM';

const autoblockUsers = new Set();
const signalerUsers = new Set();
const startTime = Date.now();
let isPublic = false; 

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

function runtime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    return `${d}ᴅ, ${h}ʜ, ${m}ᴍ, ${s}s`;
}

async function startBot() {
    let phoneNumber = "";
    let sessionFolder = "";

    const existingSessions = fs.readdirSync('./').filter(file => file.startsWith('session_'));
    if (existingSessions.length > 0) {
        sessionFolder = existingSessions[0];
        console.log(`♻️  ʟᴏᴀᴅɪɴɢ sᴇssɪᴏɴ: ${sessionFolder}`);
    } else {
        phoneNumber = await question('❓ ᴘʟᴇᴀsᴇ ᴇɴᴛᴇʀ ʏᴏᴜʀ ᴘʜᴏɴᴇ ɴᴜᴍʙᴇʀ: ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        sessionFolder = `session_${phoneNumber}`;
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["SK7-AUTOBLOCK", "Chrome", "20.0.04"]
    });

    if (!socket.authState.creds.registered) {
        if (!phoneNumber) phoneNumber = await question('❓ ʀᴇ-ᴇɴᴛᴇʀ ɴᴜᴍʙᴇʀ: ');
        const code = await socket.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
        console.log(`\n🔗 ʏᴏᴜʀ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ: \x1b[32m${code}\x1b[0m\n`);
    }

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ!');
            await socket.sendMessage(ownerNumber, { 
                text: `✅ *sᴋ7-ᴀᴜᴛᴏʙʟᴏᴄᴋ ɪs ᴏɴʟɪɴᴇ!*\n*ᴘʀᴇғɪx:* [ ${prefix} ]\n*ᴍᴏᴅᴇ:* ${isPublic ? 'ᴘᴜʙʟɪᴄ' : 'sᴇʟғ'}` 
            });
        }
    });

    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // --- LOGIQUE DU PREFIX ---
        if (!messageText.startsWith(prefix)) return; 
        
        const body = messageText.slice(prefix.length).trim();
        const command = body.split(/ +/)[0].toLowerCase();
        const args = body.split(/ +/).slice(1);
        
        const isCreator = sender === ownerNumber;
        if (!isPublic && !isCreator) return;

        const reply = (text) => socket.sendMessage(sender, { text: text }, { quoted: msg });

        switch (command) {
            case 'menu':
            case 'help': {
                const uptimeSeconds = (Date.now() - startTime) / 1000;
                let menuText = `╭━━━━━〔 *✨ sᴋ7-ᴀᴜᴛᴏʙʟᴏᴄᴋ ✨* 〕━━━━━╮\n┃\n`;
                menuText += `┃  ✨ *ʜᴇʟʟᴏ:* @${sender.split('@')[0]}\n`;
                menuText += `┃  🔐 *ᴍᴏᴅᴇ:* ${isPublic ? 'ᴘᴜʙʟɪᴄ' : 'sᴇʟғ'}\n`;
                menuText += `┃  🆙 *ᴜᴘᴛɪᴍᴇ:* ${runtime(uptimeSeconds)}\n┃\n`;
                menuText += `┣━━━━━〔 *🚀 ᴄᴏᴍᴍᴀɴᴅs* 〕━━━━━\n┃\n`;
                menuText += `┃  ┝ ⚡ ${prefix}ᴘɪɴɢ\n`;
                menuText += `┃  ┝ ⚡ ${prefix}ᴜᴘᴛɪᴍᴇ\n`;
                menuText += `┃  ┝ 🛡️ ${prefix}ᴘᴜʙʟɪᴄ\n`;
                menuText += `┃  ┝ 🛡️ ${prefix}sᴇʟғ\n`;
                menuText += `┃  ┝ 🚫 ${prefix}ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴏɴ/ᴏғғ\n`;
                menuText += `┃  ┝ 📢 ${prefix}sɪɢɴᴀʟᴇʀ ᴏɴ/ᴏғғ [ɴᴜᴍ]\n`;
                menuText += `┃  ┝ 🎨 ${prefix}ᴛɢs [ʟɪɴᴋ]\n`;
                menuText += `┃  ┝ 🔄 ${prefix}ʀᴇᴄᴏɴɴᴇᴄᴛ\n┃\n`;
                menuText += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                await socket.sendMessage(sender, { text: menuText, mentions: [sender] });
                break;
            }

            case 'ping': {
                const start = Date.now();
                await reply("⏳ *ᴘɪɴɢɪɴɢ...*");
                await reply(`🏓 *ᴘᴏɴɢ:* ${Date.now() - start}ᴍs`);
                break;
            }

            case 'public': { if (isCreator) isPublic = true; reply("🔓 *ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ ᴀᴄᴛɪᴠé.*"); break; }
            case 'self': { if (isCreator) isPublic = false; reply("🔒 *ᴍᴏᴅᴇ sᴇʟғ ᴀᴄᴛɪᴠé.*"); break; }

            case 'autoblock': {
                if (!isCreator) return;
                if (args[0] === 'on') {
                    autoblockUsers.add(sender);
                    reply("🚫 *ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴀᴄᴛɪᴠᴀᴛᴇᴅ.*");
                    while (autoblockUsers.has(sender)) {
                        await socket.updateBlockStatus(sender, "block");
                        await new Promise(r => setTimeout(r, 10000));
                        if (!autoblockUsers.has(sender)) break;
                        await socket.updateBlockStatus(sender, "unblock");
                        await new Promise(r => setTimeout(r, 10000));
                    }
                } else {
                    autoblockUsers.delete(sender);
                    await socket.updateBlockStatus(sender, "unblock");
                    reply("✅ *ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ.*");
                }
                break;
            }

            case 'signaler': {
                if (!isCreator) return;
                let num = args[1] ? args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
                if (!num) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}sɪɢɴᴀʟᴇʀ ᴏɴ/ᴏғғ [ɴᴜᴍ]`);
                if (args[0] === 'on') {
                    signalerUsers.add(num);
                    reply(`📢 *ʟᴏᴏᴘ sᴛᴀʀᴛᴇᴅ ᴏɴ:* ${args[1]}`);
                    while (signalerUsers.has(num)) {
                        try {
                            await socket.updateBlockStatus(num, "block");
                            await new Promise(r => setTimeout(r, 10000));
                            if (!signalerUsers.has(num)) break;
                            await socket.updateBlockStatus(num, "unblock");
                            await new Promise(r => setTimeout(r, 10000));
                        } catch { signalerUsers.delete(num); break; }
                    }
                } else {
                    signalerUsers.delete(num);
                    await socket.updateBlockStatus(num, "unblock");
                    reply("✅ *sɪɢɴᴀʟᴇʀ sᴛᴏᴘᴘᴇᴅ.*");
                }
                break;
            }

            case 'tgs': {
                if (!args[0]) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}ᴛɢs [ʟɪɴᴋ]`);
                reply("⏳ *ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ sᴛɪᴄᴋᴇʀs...*");
                try {
                    let pack = args[0].split('/addstickers/')[1] || args[0].split('/stickers/')[1];
                    const res = await axios.get(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getStickerSet?name=${pack.split('?')[0]}`);
                    for (let i = 0; i < Math.min(10, res.data.result.stickers.length); i++) {
                        const file = await axios.get(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${res.data.result.stickers[i].file_id}`);
                        const sticker = new Sticker(`https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${file.data.result.file_path}`, {
                            pack: 'sᴋ7-ᴀᴜᴛᴏʙʟᴏᴄᴋ', author: 'ᴅʏʙʏ', type: StickerTypes.ANIMATED
                        });
                        await socket.sendMessage(sender, { sticker: await sticker.toBuffer() });
                    }
                } catch (e) { reply("❌ *ᴇʀʀᴏʀ ғᴇᴛᴄʜɪɴɢ sᴛɪᴄᴋᴇʀs.*"); }
                break;
            }

            case 'uptime': { reply(`🆙 *ᴜᴘᴛɪᴍᴇ:* ${runtime((Date.now() - startTime) / 1000)}`); break; }
            case 'reconnect': { if (isCreator) process.exit(0); break; }
        }
    });
}

startBot();
