const { Client } = require('discord.js-selfbot-v13');
const express = require('express');

// ===== WEB (Railway) =====
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('OK');
});

app.listen(port, () => {
    console.log(`🌐 Servidor Web rodando na porta ${port}`);
});

// ===== DISCORD =====
const client = new Client({ checkUpdate: false });

const prefix = "?";
const CANAL_DE_VOZ_ID = "1471043406544375964";

// 🔥 LISTA DE IDS PERMITIDOS
const ALLOWED_IDS = [
    "932012274569338981",
    "1473488490795896997",
    "569633804537430036",
    "932011766651703358"
];

let statusManual = false;

// ===== STATUS ROTATIVO =====
async function rotacaoStatus() {
    const atividades = ["Arena Breakout", "Arena Breakout", "Arena Breakout"];
    let i = 0;

    while (true) {
        try {
            if (statusManual) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            client.user.setPresence({
                status: 'dnd',
                activities: [{
                    name: atividades[i % atividades.length],
                    type: 'PLAYING'
                }]
            });

            i++;
            await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (err) {
            console.error("Erro status:", err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// ===== GUARDIÃO DA CALL (COM TRACKING DE ERRO DETALHADO) =====
async function manterCallViva() {
    while (true) {
        try {
            const canal = await client.channels.fetch(CANAL_DE_VOZ_ID).catch(() => null);
            if (canal) {
                const guilda = canal.guild;
                const estouNaCall = guilda.voiceStates.cache.get(client.user.id)?.channelId === canal.id;
                
                if (!estouNaCall) {
                    console.log(`📡 Tentando estabelecer conexão com a call: ${canal.name}...`);
                    
                    await client.voice.join(canal, {
                        selfMute: false,
                        selfDeaf: false,
                        video: false
                    });
                    
                    console.log("✅ Conexão bem-sucedida e fixada via WebSocket!");
                }
            } else {
                console.log("⚠️ Canal de voz não encontrado. Verifique se o ID está correto ou se o bot tem acesso.");
            }
        } catch (err) {
            console.error("❌ O Discord rejeitou a conexão de voz externa:", err.message || err);
        }
        await new Promise(resolve => setTimeout(resolve, 12000));
    }
}

// ===== EVENTOS =====
client.on('ready', () => {
    console.log(`🟢 Logado com sucesso como: ${client.user.tag}`);
    rotacaoStatus();
    manterCallViva();
});

// ===== HANDLER DE COMANDO =====
async function handleCommand(message) {
    if (!message.content) return;
    let content = message.content.trim();
    
    if (message.author.id !== client.user.id && !ALLOWED_IDS.includes(message.author.id)) {
        return;
    }

    // ===== EVAL =====
    if (content.startsWith(`${prefix}eval`)) {
        let codigo = content.slice(`${prefix}eval`.length).trim();
        if (!codigo) {
            return message.channel.send("Sem código.");
        }

        if (codigo.startsWith("```")) {
            const linhas = codigo.split("\n");
            if (linhas[0].startsWith("```js") || linhas[0].startsWith("```javascript") || linhas[0].startsWith("```py")) {
                codigo = linhas.slice(1, -1).join("\n");
            } else {
                codigo = Array.isArray(linhas) ? linhas.slice(1, -1).join("\n") : codigo;
            }
        }

        try {
            const evaledFunc = new Function('message', 'client', `return (async () => { ${codigo} })()`);
            let resultado = await evaledFunc(message, client);

            if (typeof resultado !== "string") {
                resultado = require('util').inspect(resultado, { depth: 0 });
            }

            let resposta = "✅ Código executado com sucesso!\n";
            if (resultado && resultado !== "undefined") {
                if (resultado.length > 1900) resultado = resultado.slice(0, 1900) + "\n... (cortado)";
                resposta += `📥 Retorno:\n\`\`\`js\n${resultado}\n\`\`\``;
            } else {
                resposta += "ℹ️ Nenhuma saída foi produzida.";
            }

            await message.channel.send(resposta);
        } catch (err) {
            let erro = err.stack || err.toString();
            if (erro.length > 1900) erro = erro.slice(0, 1900) + "\n... (cortado)";
            await message.channel.send(`❌ Erro ao executar:\n\`\`\`js\n${erro}\n\`\`\``);
        }
    }

    // ===== SETSTATUS =====
    else if (content.startsWith(`${prefix}setstatus`)) {
        const args = content.split(/\s+/);
        if (args.length < 2) {
            return message.channel.send("Uso: ?setstatus online/dnd/idle/invisible");
        }

        const statusArg = args[1].toLowerCase();
        const validStatuses = ["online", "idle", "dnd", "invisible"];

        if (validStatuses.includes(statusArg)) {
            statusManual = true;
            client.user.setPresence({ status: statusArg });
            await message.channel.send(`Status: ${statusArg}`);
        } else {
            await message.channel.send("Status inválido");
        }
    }

    // ===== RESETSTATUS =====
    else if (content.startsWith(`${prefix}resetstatus`)) {
        statusManual = false;
        await message.channel.send("Status automático ativado");
    }

    // ===== SAY =====
    else if (content.startsWith(`${prefix}say`)) {
        try {
            const corpo = content.slice(`${prefix}say`.length).trim();
            if (!corpo) return;

            const args = corpo.split(/\s+/, 1);
            const primeiroArg = args[0];

            if (/^\d{17,20}$/.test(primeiroArg)) {
                const canalId = primeiroArg;
                const textoParaEnviar = corpo.slice(canalId.length).trim() || "...";
                
                const canal = await client.channels.fetch(canalId).catch(() => null);
                if (canal && canal.isText()) {
                    await canal.send(textoParaEnviar);
                } else {
                    await message.channel.send(corpo);
                }
            } else {
                await message.channel.send(corpo);
            }
        } catch (err) {
            console.error("Erro no say:", err);
        }
    }
}

client.on('messageCreate', handleCommand);
client.on('messageUpdate', async (before, after) => {
    if (!after.author || after.author.id === client.user.id) return;
    handleCommand(after);
});

// ===== RUN =====
const token = process.env.TOKEN;
if (!token) {
    console.error("TOKEN não definido nas variáveis de ambiente!");
    process.exit(1);
}

client.login(token);
                
