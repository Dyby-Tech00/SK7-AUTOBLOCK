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

const autoblockUsers = new Set();
const startTime = Date.now();
const ownerNumber = "33612345678@s.whatsapp.net"; // ⚠️ MODIFIE ICI

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

function runtime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + " ᴅ, " : "";
    var hDisplay = h > 0 ? h + " ʜ, " : "";
    var mDisplay = m > 0 ? m + " ᴍ, " : "";
    var sDisplay = s > 0 ? s + " s" : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
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
        const phoneNumber = await question('❓ ᴘʟᴇᴀsᴇ ᴇɴᴛᴇʀ ʏᴏᴜʀ ᴘʜᴏɴᴇ ɴᴜᴍʙᴇʀ: ');
        const code = await socket.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
        console.log(`\n🔗 ʏᴏᴜʀ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ: \x1b[32m${code}\x1b[0m\n`);
    }

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ!');
        }
    });

    socket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const args = messageText.trim().split(/ +/).slice(1);
        const command = messageText.trim().split(/ +/)[0].toLowerCase();
        const isGroup = sender.endsWith('@g.us');
        const isCreator = sender === ownerNumber;

        switch (command) {
            case '.ping': {
                const start = Date.now();
                await socket.sendMessage(sender, { text: "⏳ *ᴘɪɴɢɪɴɢ...*" });
                const end = Date.now();
                await socket.sendMessage(sender, { text: `🏓 *ᴘᴏɴɢ:* ${end - start}ᴍs` });
                break;
            }

            case '.uptime': {
                const now = Date.now();
                const uptimeSeconds = (now - startTime) / 1000;
                const activeTime = runtime(uptimeSeconds);
                await socket.sendMessage(sender, { text: `🆙 *ᴜᴘᴛɪᴍᴇ:* ${activeTime}` });
                break;
            }

            case '.autoblock': {
                if (!isCreator) return await socket.sendMessage(sender, { text: "❌ *ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ: ᴏɴʟʏ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs.*" });
                if (isGroup) return await socket.sendMessage(sender, { text: "❌ *ᴜsᴇ ᴛʜɪs ɪɴ ᴘʀɪᴠᴀᴛᴇ ᴄʜᴀᴛ (ᴅᴍ).*" });
                if (!args[0]) return await socket.sendMessage(sender, { text: "📌 *ᴜsᴀɢᴇ:*\n.ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴏɴ\n.ᴀᴜᴛᴏʙʟᴏᴄᴋ ᴏғғ" });

                if (args[0] === 'on') {
                    if (autoblockUsers.has(sender)) return await socket.sendMessage(sender, { text: "⚠️ *ᴀʟʀᴇᴀᴅʏ ᴀᴄᴛɪᴠᴇ.*" });
                    autoblockUsers.add(sender);
                    await socket.sendMessage(sender, { text: "🚫 *ᴀᴜᴛᴏʙʟᴏᴄᴋ ʟᴏᴏᴘ ᴀᴄᴛɪᴠᴀᴛᴇᴅ.*" });

                    const runLoop = async (jid) => {
                        while (autoblockUsers.has(jid)) {
                            try {
                                await socket.updateBlockStatus(jid, "block");
                                await new Promise(r => setTimeout(r, 10000));
                                if (!autoblockUsers.has(jid)) break;
                                await socket.updateBlockStatus(jid, "unblock");
                                await new Promise(r => setTimeout(r, 10000));
                            } catch (e) {
                                autoblockUsers.delete(jid);
                                break;
                            }
                        }
                    };
                    runLoop(sender);
                } else if (args[0] === 'off') {
                    autoblockUsers.delete(sender);
                    await socket.updateBlockStatus(sender, "unblock");
                    await socket.sendMessage(sender, { text: "✅ *ᴀᴜᴛᴏʙʟᴏᴄᴋ ʟᴏᴏᴘ ᴅᴇᴀᴄᴛɪᴠᴀᴛᴇᴅ.*" });
                }
                break;
            }
        }
    });
}

startBot();
