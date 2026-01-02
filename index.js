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


const autoblockUsers = new Set();
const signalerUsers = new Set();
const startTime = Date.now();
const ownerNumber = "243894096430@s.whatsapp.net"; // ⚠️ MODIFIE TON NUMÉRO ICI

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
    } else {
        phoneNumber = await question('❓ ᴇɴᴛᴇʀ ᴘʜᴏɴᴇ ɴᴜᴍʙᴇʀ: ');
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
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!socket.authState.creds.registered) {
        if (!phoneNumber) phoneNumber = await question('❓ ʀᴇ-ᴇɴᴛᴇʀ ɴᴜᴍʙᴇʀ ғᴏʀ ᴘᴀɪʀɪɴɢ: ');
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
            await socket.sendMessage(ownerNumber, { text: `✅ *ʙᴏᴛ ɪs ᴏɴʟɪɴᴇ!*\n*ᴍᴏᴅᴇ:* ${isPublic ? 'ᴘᴜʙʟɪᴄ' : 'sᴇʟғ'}\n*🆙 ᴜᴘᴛɪᴍᴇ:* ${runtime(0)}` });
        }
    });

    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const command = messageText.trim().split(/ +/)[0].toLowerCase();
        const args = messageText.trim().split(/ +/).slice(1);
        const isCreator = sender === ownerNumber;

        if (!isPublic && !isCreator) return; 

        switch (command) {
            case '.menu': {
                const uptimeSeconds = (Date.now() - startTime) / 1000;
                let menuText = `╭━━━━━〔 *✨ ᴀᴜᴛᴏʙʟᴏᴄᴋ-ʙᴏᴛ ✨* 〕━━━━━╮\n┃\n`;
                menuText += `┃  ✨ *ʜᴇʟʟᴏ:* @${sender.split('@')[0]}\n`;
                menuText += `┃  🔐 *ᴍᴏᴅᴇ:* ${isPublic ? 'ᴘᴜʙʟɪᴄ' : 'sᴇʟғ'}\n`;
                menuText += `┃  🆙 *ᴜᴘᴛɪᴍᴇ:* ${runtime(uptimeSeconds)}\n┃\n`;
                menuText += `┣━━━━━〔 *🚀 ᴄᴏᴍᴍᴀɴᴅs* 〕━━━━━\n┃\n`;
                menuText += `┃  ┝ ⚡ .ᴘɪɴɢ / .ᴜᴘᴛɪᴍᴇ\n`;
                menuText += `┃  ┝ 🛡️ .ᴘᴜʙʟɪᴄ / .sᴇʟғ\n`;
                menuText += `┃  ┝ 🚫 .ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴏɴ/ᴏғғ\n`;
                menuText += `┃  ┝ 📢 .sɪɢɴᴀʟᴇʀ ᴏɴ/ᴏғғ [ɴᴜᴍʙᴇʀ]\n`;
                menuText += `┃  ┝ 🔄 .ʀᴇᴄᴏɴɴᴇᴄᴛ\n┃\n`;
                menuText += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                await socket.sendMessage(sender, { text: menuText, mentions: [sender] });
                break;
            }

            case '.ping': {
                const start = Date.now();
                await socket.sendMessage(sender, { text: "⏳ *ᴘɪɴɢɪɴɢ...*" });
                await socket.sendMessage(sender, { text: `🏓 *ᴘᴏɴɢ:* ${Date.now() - start}ᴍs` });
                break;
            }

            case '.public': { if (isCreator) isPublic = true; reply("🔓 *ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ ᴏɴ*"); break; }
            case '.self': { if (isCreator) isPublic = false; reply("🔒 *ᴘʀɪᴠᴀᴛᴇ ᴍᴏᴅᴇ ᴏɴ*"); break; }

            case '.autoblock': {
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

            case '.signaler': {
                if (!isCreator) return;
                let target = args[1] ? args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
                if (!target) return reply("📌 *ᴜsᴀɢᴇ:* .sɪɢɴᴀʟᴇʀ ᴏɴ/ᴏғғ 509xxxxxx");

                if (args[0] === 'on') {
                    signalerUsers.add(target);
                    reply(`📢 *sɪɢɴᴀʟɪɴɢ ʟᴏᴏᴘ sᴛᴀʀᴛᴇᴅ ᴏɴ:* ${args[1]}`);
                    while (signalerUsers.has(target)) {
                        await socket.updateBlockStatus(target, "block");
                        await new Promise(r => setTimeout(r, 10000));
                        if (!signalerUsers.has(target)) break;
                        await socket.updateBlockStatus(target, "unblock");
                        await new Promise(r => setTimeout(r, 10000));
                    }
                } else {
                    signalerUsers.delete(target);
                    await socket.updateBlockStatus(target, "unblock");
                    reply(`✅ *sɪɢɴᴀʟᴇʀ sᴛᴏᴘᴘᴇᴅ ғᴏʀ:* ${args[1]}`);
                }
                break;
            }

            

            case '.reconnect': { if (isCreator) process.exit(0); break; }
        }
        function reply(text) { socket.sendMessage(sender, { text }); }
    });
}

startBot();
