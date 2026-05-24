const { Client } = require('discord.js-selfbot-v13');
const client = new Client({ checkUpdate: false });

const CANAL_ID = '1471043406544375964';

client.on('ready', async () => {
    console.log(`🟢 ${client.user.tag} está pronto!`);
    
    try {
        const canal = await client.channels.fetch(CANAL_ID);
        if (canal) {
            // Conecta imitando perfeitamente o aplicativo oficial de desktop
            await canal.connectToVoice({
                selfMute: false,
                selfDeaf: false,
                video: false
            });
            console.log('✅ Fixado na call com sucesso!');
        }
    } catch (err) {
        console.error('Erro ao conectar:', err);
    }
});

// O Railway vai ler o token direto das variáveis de ambiente
client.login(process.env.TOKEN);
      
