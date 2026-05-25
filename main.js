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

// ===== CONFIGURAÇÕES GLOBAIS =====
const prefix = "?";
const CANAL_DE_VOZ_ID = "1471043406544375964";

// 🔥 LISTA DE IDS PERMITIDOS
const ALLOWED_IDS = [
    "932012274569338981",
    "1473488490795896997",
    "569633804537430036",
    "932011766651703358"
];

// ===== FUNÇÃO PRINCIPAL DO BOT =====
function inicializarBot(token) {
    const client = new Client({ checkUpdate: false });
    let statusManual = false;

    // ===== STATUS ROTATIVO =====
    async function rotacaoStatus() {
        const atividades = ["", "", ""];
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
                console.error(`Erro status [${client.user?.tag || 'Desconectado'}]:`, err);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    // ===== GUARDIÃO DA CALL DEFINITIVO =====
    async function manterCallViva() {
        while (true) {
            try {
                const canal = await client.channels.fetch(CANAL_DE_VOZ_ID).catch(() => null);
                if (canal) {
                    // Checa o ID da conexão atual da conta com o gateway de voz
                    const conexaoAtual = client.voice.adapters.get(canal.guild.id);
                    
                    if (!conexaoAtual) {
                        console.log(`📡 [${client.user.tag}] Conectando ao canal de voz via Node.js...`);
                        await client.voice.join(canal, {
                            selfMute: false,
                            selfDeaf: false,
                            video: false
                        });
                        console.log(`✅ [${client.user.tag}] Fixado na call com sucesso!`);
                    }
                }
            } catch (err) {
                console.error(`Erro no monitoramento da call [${client.user?.tag || 'Desconectado'}]:`, err.message || err);
            }
            // Verifica a cada 10 segundos de forma estável
            await new Promise(resolve => setTimeout(resolve, 10000));
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
        // 🛡️ PROTEÇÃO: Ignora se a mensagem não tiver conteúdo escrito (Corrige o erro do log!)
        if (!message || !message.content) return;
        
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
                    codigo = lines.slice(1, -1).join("\n");
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
        // Evita crash se a mensagem editada virar um embed ou ficar sem texto
        if (!after || !after.author || after.author.id === client.user.id) return;
        handleCommand(after);
    });

    client.login(token).catch(err => {
        console.error(`❌ Erro ao fazer login com o token [${token.slice(0, 10)}...]:`, err);
    });
}

// ===== RUN / INICIALIZAÇÃO DOS TOKENS =====
const token1 = process.env.TOKEN;
const token2 = process.env.TOKEN2;

if (!token1 && !token2) {
    console.error("Nenhum TOKEN (TOKEN ou TOKEN2) foi definido nas variáveis de ambiente!");
    process.exit(1);
}

if (token1) {
    inicializarBot(token1);
} else {
    console.log("⚠️ Variável 'TOKEN' não configurada. Pulando...");
}

if (token2) {
    inicializarBot(token2);
} else {
    console.log("⚠️ Variável 'TOKEN2' não configurada. Pulando...");
                }
                    
