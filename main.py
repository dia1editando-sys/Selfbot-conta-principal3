import os
import discord
import asyncio
import time
from flask import Flask
from threading import Thread

# ===== WEB (Railway) =====
app = Flask(__name__)

@app.route("/")
def home():
    return "OK", 200

def run_web():
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

def start_web():
    Thread(target=run_web, daemon=True).start()

start_web()

# ===== DISCORD =====
client = discord.Client(self_bot=True)

# ===== CONFIG =====
prefix = "?"
start_time = time.time()
CANAL_DE_VOZ_ID = 1471043406544375964

# 🔥 LISTA DE IDS PERMITIDOS
ALLOWED_IDS = [
    932012274569338981,
    1473488490795896997, 569633804537430036, 932011766651703358
]

status_manual = False

# ===== STATUS ROTATIVO =====
async def rotacao_status():
    await client.wait_until_ready()
    i = 0

    while True:
        try:
            if status_manual:
                await asyncio.sleep(5)
                continue

            atividades = [
                discord.Activity(type=discord.ActivityType.playing, name="Arena Breakout"),
                discord.Activity(type=discord.ActivityType.playing, name="Arena Breakout"),
                discord.Activity(type=discord.ActivityType.playing, name="Arena Breakout")
            ]

            await client.change_presence(
                status=discord.Status.dnd,
                activity=atividades[i % len(atividades)]
            )

            i += 1
            await asyncio.sleep(10)

        except Exception as e:
            print("Erro status:", e)
            await asyncio.sleep(5)

# ===== REPARO DO ERRO 4014 (Sustentação Direta via WebSocket) =====
async def manter_call_viva():
    await client.wait_until_ready()
    while True:
        try:
            # Pega o ID da guilda (servidor) baseado no canal
            canal = client.get_channel(CANAL_DE_VOZ_ID) or await client.fetch_channel(CANAL_DE_VOZ_ID)
            
            if canal:
                guild = canal.guild
                vc = guild.voice_client

                # Se não estiver na call, força o envio do pacote do gateway
                if not vc or not vc.is_connected():
                    print("⚠️ Erro 4014 detectado ou bot fora. Forçando reconexão limpa...")
                    
                    # Desconecta qualquer sessão fantasma anterior antes
                    if vc:
                        try:
                            await vc.disconnect(force=True)
                        except Exception:
                            pass
                    
                    # Conecta usando o fallback de WebSocket
                    await canal.connect(reconnect=True, self_mute=False, self_deaf=False)
                
                elif vc.channel.id != canal.id:
                    await vc.move_to(canal)

        except Exception as e:
            print(f"Erro no monitoramento de voz: {e}")
            
        # Espera 10 segundos antes da próxima checagem automática
        await asyncio.sleep(10)

# ===== EVENTOS =====
@client.event
async def on_ready():
    print(f"🟢 Logado como {client.user} | ID: {client.user.id}")
    client.loop.create_task(rotacao_status())
    client.loop.create_task(manter_call_viva())

# ===== HANDLER DE COMANDO =====
async def handle_command(message):
    global status_manual

    content = message.content.strip()
    print("MSG:", content, "| AUTHOR:", message.author.id)

    if message.author.id != client.user.id and message.author.id not in ALLOWED_IDS:
        return

    # ===== EVAL =====
    if content.startswith(f"{prefix}eval"):
        if message.author.id not in ALLOWED_IDS:
            return

        codigo = content[len(f"{prefix}eval"):].strip()

        if not codigo:
            await message.channel.send("Sem código.")
            return

        import io
        import contextlib
        import traceback

        if codigo.startswith("```"):
            codigo = "\n".join(codigo.split("\n")[1:-1])

        stdout = io.StringIO()

        try:
            exec_code = "async def _exec(message, client):\n"
            for linha in codigo.split("\n"):
                exec_code += f"    {linha}\n"

            local_vars = {}
            exec(exec_code, globals(), local_vars)

            with contextlib.redirect_stdout(stdout):
                resultado = await local_vars["_exec"](message, client)

            saida = stdout.getvalue()
            resposta = "✅ Código executado com sucesso!\n"

            if saida:
                if len(saida) > 1900:
                    saida = saida[:1900] + "\n... (cortado)"
                resposta += f"📤 Saída:\n```py\n{saida}\n```"

            if resultado is not None:
                resultado_str = str(resultado)
                if len(resultado_str) > 1900:
                    resultado_str = resultado_str[:1900] + "\n... (cortado)"
                resposta += f"\n📥 Retorno:\n```py\n{resultado_str}\n```"

            if not saida and resultado is None:
                resposta += "ℹ️ Nenhuma saída foi produzida."

            await message.channel.send(resposta)

        except Exception:
            erro = traceback.format_exc()
            if len(erro) > 1900:
                erro = erro[:1900] + "\n... (cortado)"
            await message.channel.send(f"❌ Erro ao executar:\n```py\n{erro}\n```")

    # ===== setstatus =====
    elif content.startswith(f"{prefix}setstatus"):
        try:
            args = content.split()
            if len(args) < 2:
                await message.channel.send("Uso: ?setstatus online/dnd/idle/invisible")
                return

            status_map = {
                "online": discord.Status.online,
                "idle": discord.Status.idle,
                "dnd": discord.Status.dnd,
                "invisible": discord.Status.invisible
            }

            status_arg = args[1].lower()

            if status_arg in status_map:
                status_manual = True
                await client.change_presence(status=status_map[status_arg])
                await message.channel.send(f"Status: {status_arg}")
            else:
                await message.channel.send("Status inválido")
        except Exception as e:
            await message.channel.send(f"Erro: {e}")

    # ===== resetstatus =====
    elif content.startswith(f"{prefix}resetstatus"):
        status_manual = False
        await message.channel.send("Status automático ativado")

    # ===== say =====
    elif content.startswith(f"{prefix}say"):
        try:
            corpo = content[len(f"{prefix}say"):].strip()
            if not corpo:
                return

            args = corpo.split(" ", 1)
            if args[0].isdigit() and len(args[0]) >= 17:
                canal_id = int(args[0])
                canal = client.get_channel(canal_id)
                if canal:
                    texto_para_enviar = args[1] if len(args) > 1 else "..."
                    await canal.send(texto_para_enviar)
                else:
                    await message.channel.send(corpo)
            else:
                await message.channel.send(corpo)
        except Exception as e:
            print(f"Erro no say: {e}")

# ===== EVENTOS =====
@client.event
async def on_message(message):
    await handle_command(message)

@client.event
async def on_message_edit(before, after):
    if after.author.id == client.user.id:
        return
    await handle_command(after)

# ===== RUN =====
token = os.environ.get("TOKEN")
if not token:
    raise Exception("TOKEN não definido")

client.run(token)
