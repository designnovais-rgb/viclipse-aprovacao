"""Roda no GitHub Actions quando o dono do repositorio abre uma issue [APROVAR]/[REPROVAR]/[TESTE] pelo site.
1) le o JSON do pedido; 2) baixa o corte da release; 3) se pediu, corta o tempo e redesenha o texto do video (uma recodificacao, trim/atrim = sincronia segura);
4) APROVAR: sobe no Zernio e posta (Instagram + YouTube Shorts) agora ou no horario; TESTE: faz tudo menos postar; REPROVAR: so marca.
5) atualiza catalog.json, sobe o arquivo editado na release, comenta e fecha a issue."""
import os, re, json, subprocess, urllib.request, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

REPO = os.environ["GITHUB_REPOSITORY"]; KEY = os.environ.get("ZERNIO_API_KEY", ""); TAG = "cortes"
corpo = os.environ["ISSUE_BODY"]; titulo_issue = os.environ["ISSUE_TITLE"]; num = os.environ["ISSUE_NUMBER"]
W = 1080
def sh(*a, **k): return subprocess.run(list(a), check=True, **k)
def comenta(msg, fechar=True):
    sh("gh", "issue", "comment", num, "--repo", REPO, "--body", msg)
    if fechar: sh("gh", "issue", "close", num, "--repo", REPO)

m = re.search(r"```json\s*(\{.*?\})\s*```", corpo, re.S)
if not m: comenta("Não encontrei o bloco JSON do pedido. Use os botões do site."); sys.exit(0)
P = json.loads(m.group(1)); acao = P.get("acao", "").upper()
if titulo_issue.startswith("[TESTE]"): acao = "TESTE"
cat = json.load(open("catalog.json", encoding="utf-8")); item = next((c for c in cat if c["id"] == P["id"]), None)
if not item: comenta(f"Corte `{P['id']}` não está no catálogo."); sys.exit(0)

def salva_cat(): json.dump(cat, open("catalog.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if acao == "REPROVAR":
    item["status"] = "reprovado"; salva_cat(); comenta(f"❌ `{item['arquivo']}` marcado como reprovado. Não vai ser postado."); sys.exit(0)

# ---------- 1) baixa o corte ----------
src = "entrada.mp4"; sh("gh", "release", "download", TAG, "--repo", REPO, "--pattern", item["asset"], "--output", src, "--clobber")
def probe(f, k):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", f"format={k}", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip())
dur0 = probe(src, "duration")
ini = float(P.get("ini") or 0); fim = float(P.get("fim") or dur0); fim = min(fim, dur0)
novo_texto = P.get("texto_video"); mudou_texto = item.get("texto_editavel") and novo_texto is not None and novo_texto.strip() != (item.get("texto_video") or "").strip()
precisa = ini > 0.05 or fim < dur0 - 0.05 or mudou_texto

# ---------- 2) texto do video (redesenha a faixa/cabecalho por cima do original) ----------
B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
EMO = next((p for p in ["/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"] if os.path.exists(p)), None)
def cabecalho_tweet(txt, hh=440):
    im = Image.new("RGB", (W, hh), (0, 0, 0)); d = ImageDraw.Draw(im)
    av = Image.open("assets/avatar.png").convert("RGBA").resize((120, 120)); im.paste(av, (40, 34), av)
    fb = ImageFont.truetype(B, 40); fr = ImageFont.truetype(R, 32)
    d.text((184, 40), item.get("nome_pagina", "VIclipse"), font=fb, fill=(255, 255, 255)); bx = 184 + d.textlength(item.get("nome_pagina", "VIclipse"), font=fb) + 16
    d.ellipse([bx, 48, bx + 36, 84], fill=(29, 155, 240)); d.line([(bx + 9, 66), (bx + 16, 74), (bx + 28, 58)], fill=(255, 255, 255), width=5)
    d.text((184, 94), item.get("handle", "@viclipse0"), font=fr, fill=(150, 156, 163))
    fs = 52; f = ImageFont.truetype(B, fs); fe = ImageFont.truetype(EMO, 109) if EMO else None
    lines, cur = [], ""
    for w_ in txt.split():
        t_ = (cur + " " + w_).strip()
        if d.textlength(t_, font=f) <= W - 90: cur = t_
        else: lines.append(cur); cur = w_
    lines.append(cur); y = 182
    for ln in lines[:4]:
        xx = 45
        for ch in ln:
            if ord(ch) >= 0x2190 and fe:
                e = Image.new("RGBA", (136, 128)); ImageDraw.Draw(e).text((0, 0), ch, font=fe, embedded_color=True)
                e = e.resize((int(fs * 1.06), int(fs))); im.paste(e, (int(xx), y + 4), e); xx += fs * 1.1
            else: d.text((xx, y), ch, font=f, fill=(255, 255, 255)); xx += d.textlength(ch, font=f)
        y += int(fs * 1.28)
    return im
def faixa_meme(txt, bh=190):
    im = Image.new("RGB", (W, bh), (255, 255, 255)); d = ImageDraw.Draw(im)
    linhas = txt.upper().replace("\\N", "\n").split("\n")
    if len(linhas) == 1: linhas = textwrap.wrap(linhas[0], max(12, len(linhas[0]) // 2 + 3))[:2]
    fs = 60
    while True:
        f = ImageFont.truetype(B, fs)
        if max(d.textlength(l, font=f) for l in linhas) <= W - 70 or fs <= 34: break
        fs -= 2
    lh = int(fs * 1.12); y0 = (bh - lh * len(linhas)) / 2 - 2
    for i, l in enumerate(linhas): d.text(((W - d.textlength(l, font=f)) / 2, y0 + i * lh), l, font=f, fill=(0, 0, 0))
    return im

saida = src
if precisa:
    entradas = ["-i", src]; dur = fim - ini
    vf = f"[0:v]trim=start={ini:.3f}:end={fim:.3f},setpts=PTS-STARTPTS[v0]"
    if mudou_texto:
        png = (cabecalho_tweet(novo_texto) if item["estilo"] == "tweet" else faixa_meme(novo_texto)); png.save("texto.png")
        entradas += ["-loop", "1", "-i", "texto.png"]; vf += ";[v0][1:v]overlay=0:0:shortest=1[v1]"; vo = "[v1]"
    else: vo = "[v0]"
    af = f"[0:a]atrim=start={ini:.3f}:end={fim:.3f},asetpts=PTS-STARTPTS,aresample=44100:async=1:first_pts=0,afade=t=in:st=0:d=0.03,afade=t=out:st={max(0, dur - 0.3):.2f}:d=0.3,loudnorm=I=-15:TP=-1.0:LRA=11[a0]"
    saida = re.sub(r"\.mp4$", "", item["asset"]) + "_editado.mp4"
    sh("ffmpeg", "-y", "-v", "error", *entradas, "-filter_complex", vf + ";" + af, "-map", vo, "-map", "[a0]", "-t", f"{dur:.3f}",
       "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", saida)
    sh("gh", "release", "upload", TAG, saida, "--repo", REPO, "--clobber")
    item["asset"] = os.path.basename(saida); item["url"] = f"https://github.com/{REPO}/releases/download/{TAG}/{item['asset']}"
    item["dur"] = round(probe(saida, "duration"), 2)
    if mudou_texto: item["texto_video"] = novo_texto

for k in ("titulo", "legenda"):
    if P.get(k) is not None: item[k] = P[k]
if P.get("hashtags"): item["hashtags"] = P["hashtags"][:5]

if acao == "TESTE":
    salva_cat(); comenta(f"🧪 Teste ok (nada foi postado). Edição aplicada: {'sim' if precisa else 'não'}. Arquivo: {item['url']}"); sys.exit(0)

# ---------- 3) posta pelo Zernio ----------
if not KEY: comenta("Falta o segredo ZERNIO_API_KEY no repositório.", fechar=False); sys.exit(1)
def api(met, cam, corpo_=None):
    r = urllib.request.Request("https://zernio.com/api/v1" + cam, method=met, data=json.dumps(corpo_).encode() if corpo_ is not None else None,
                               headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r))
def sobe(caminho, ctype):
    p = api("POST", "/media/presign", {"filename": os.path.basename(caminho), "contentType": ctype, "size": os.path.getsize(caminho)})
    urllib.request.urlopen(urllib.request.Request(p["uploadUrl"], method="PUT", data=open(caminho, "rb").read(), headers={"Content-Type": ctype}))
    return p["publicUrl"]
contas = {c["platform"]: c["_id"] for c in api("GET", "/accounts")["accounts"]}
mv = {"type": "video", "url": sobe(saida, "video/mp4")}
if item.get("capa_arquivo") and os.path.exists(item["capa_arquivo"]): mv["thumbnail"] = sobe(item["capa_arquivo"], "image/png")
texto = item["legenda"] + "\n\n" + " ".join("#" + h for h in item.get("hashtags", [])[:5])
plats = [{"platform": "instagram", "accountId": contas["instagram"]}] if "instagram" in contas else []
if "youtube" in contas:
    plats.append({"platform": "youtube", "accountId": contas["youtube"], "platformSpecificData": {"title": item["titulo"][:100], "visibility": "public", "madeForKids": False}})
post = {"content": texto, "tags": item.get("hashtags", [])[:5], "mediaItems": [mv], "platforms": plats}
if P.get("quando"): post.update({"scheduledFor": P["quando"], "timezone": "America/Sao_Paulo"})
else: post["publishNow"] = True
r = api("POST", "/posts", post)["post"]
item["status"] = "postado" if not P.get("quando") else "aprovado"; item["post"] = r["_id"]; item["quando"] = P.get("quando")
salva_cat()
comenta(f"✅ `{item['arquivo']}` {'agendado para ' + P['quando'] if P.get('quando') else 'enviado para postar agora'} no Zernio (post `{r['_id']}`, status `{r.get('status')}`). Edição aplicada: {'sim' if precisa else 'não'}.")
