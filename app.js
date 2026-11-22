// Site de aprovação VIclipse: lê catalog.json, mostra os cortes e gera o pedido (issue) de aprovação/edição.
const REPO = location.hostname.endsWith("github.io")
  ? `${location.hostname.split(".")[0]}/${location.pathname.split("/")[1]}`
  : (window.REPO || "");
const STATUS = [["pendente", "Para aprovar"], ["aprovado", "Aprovados (na fila)"], ["postado", "Postados"], ["reprovado", "Reprovados"], ["todos", "Todos"]];
let CAT = [], aba = "pendente", streamer = "todos";

// "NOVO": corte colocado pelo robo que voce ainda nao deu play (guardado neste aparelho)
const KVISTO = "viclipse_vistos";
function vistos() { try { return JSON.parse(localStorage.getItem(KVISTO) || "[]"); } catch (e) { return []; } }
function ehNovo(c) { return !!c.novo && !vistos().includes(c.id); }
function marcaVisto(c) { try { const v = vistos(); if (!v.includes(c.id)) { v.push(c.id); localStorage.setItem(KVISTO, JSON.stringify(v)); } } catch (e) {} }
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = s => (Math.round(s * 10) / 10).toFixed(1);

async function carregar() {
  const r = await fetch("catalog.json?" + Date.now());
  CAT = await r.json();
  desenhaTopo(); desenha();
}
let estilo = "todos";
const ESTN = { noticia: "Notícia (tarja vermelha)", meme: "Faixa branca", tweet: "Estilo Twitter", outro: "Outros" };
function desenhaTopo() {
  const t = document.getElementById("tabs");
  t.innerHTML = STATUS.map(([k, n]) => {
    const q = k === "todos" ? CAT.length : CAT.filter(c => c.status === k).length;
    return `<button class="tab ${aba === k ? "on" : ""}" data-k="${k}">${n} (${q})</button>`;
  }).join("");
  t.querySelectorAll(".tab").forEach(b => b.onclick = () => { aba = b.dataset.k; desenhaTopo(); desenha(); });
  const base = CAT.filter(c => aba === "todos" || c.status === aba);
  const cont = (campo, v) => base.filter(c => (v === "todos" || c[campo] === v)).length;
  const ss = ["todos", ...new Set(CAT.map(c => c.streamer))], es = ["todos", ...new Set(CAT.map(c => c.estilo))];
  const grupo = (tit, lista, campo, atual, nome) => `<div class="mg"><h4>${tit}</h4>` + lista.map(v =>
    `<button class="mi ${atual === v ? "on" : ""}" data-c="${campo}" data-v="${esc(v)}"><span>${v === "todos" ? "Todos" : esc(nome(v))}</span><em>${cont(campo, v)}</em></button>`).join("") + `</div>`;
  document.getElementById("menucats").innerHTML =
    grupo("🎙️ Streamer", ss, "streamer", streamer, v => v) + grupo("🎬 Estilo do corte", es, "estilo", estilo, v => ESTN[v] || v);
  document.querySelectorAll("#menucats .mi").forEach(b => b.onclick = () => {
    if (b.dataset.c === "streamer") streamer = b.dataset.v; else estilo = b.dataset.v;
    desenhaTopo(); desenha(); fechaMenu();
  });
  const f = document.getElementById("filtroativo"), at = [];
  if (streamer !== "todos") at.push(streamer); if (estilo !== "todos") at.push(ESTN[estilo] || estilo);
  f.innerHTML = at.length ? `Filtrando: <b>${esc(at.join(" · "))}</b> <button class="lim" id="limpa">limpar ✕</button>` : "";
  f.style.display = at.length ? "flex" : "none";
  const l = document.getElementById("limpa"); if (l) l.onclick = () => { streamer = "todos"; estilo = "todos"; desenhaTopo(); desenha(); };
}
function abreMenu(qual) {
  document.getElementById("gaveta").classList.add("aberta"); document.getElementById("veu").classList.add("aberto");
  document.getElementById("pcats").style.display = qual === "cats" ? "block" : "none";
  document.getElementById("pconf").style.display = qual === "conf" ? "block" : "none";
  document.getElementById("gtitulo").textContent = qual === "cats" ? "Categorias" : "Configurações";
}
function fechaMenu() { document.getElementById("gaveta").classList.remove("aberta"); document.getElementById("veu").classList.remove("aberto"); }
function desenha() {
  const g = document.getElementById("grid");
  const itens = CAT.filter(c => (aba === "todos" || c.status === aba) && (streamer === "todos" || c.streamer === streamer) && (estilo === "todos" || c.estilo === estilo));
  if (!itens.length) { g.innerHTML = `<div class="empty">Nada aqui.</div>`; return; }
  itens.sort((a, b) => ehNovo(b) - ehNovo(a));
  g.innerHTML = itens.map(card).join("");
  itens.forEach(liga);
}
const EST = { noticia: "Notícia", meme: "Faixa branca", tweet: "Twitter", outro: "Original" };
function card(c) {
  const n = ehNovo(c);
  return `<article class="card ${n ? "novo" : ""}" id="c-${c.id}">
  <div class="vwrap">
    <video controls preload="metadata" playsinline ${c.capa ? `poster="${esc(c.capa)}"` : ""} src="${esc(c.preview || c.url)}"></video>
    <div class="chips"><span class="st ${c.status}">${esc(c.status)}</span>${n ? '<span class="tagnovo">NOVO</span>' : ""}</div>
    <span class="durtag">${fmt(c.dur)} s</span>
  </div>
  <div class="body">
    <h3 class="name">${esc(c.titulo_curto || c.arquivo)}</h3>
    <div class="meta"><span>${esc(c.streamer)}</span><i></i><span>${esc(EST[c.estilo] || c.estilo)}</span>${c.post ? `<i></i><span>post ${esc(c.post)}</span>` : ""}</div>
    ${c.texto_editavel ? `<div class="f destaque"><label>🎬 ${esc(c.texto_rotulo || "Texto no vídeo")}</label><textarea data-f="texto_video" rows="2">${esc(c.texto_video)}</textarea></div>` : ""}
    <details class="edit"><summary>✏️ Legenda, hashtags, tempo e horário</summary>
      <div class="f"><label>Título (YouTube Shorts)</label><input data-f="titulo" value="${esc(c.titulo)}"></div>
      <div class="f"><label>Legenda</label><textarea data-f="legenda">${esc(c.legenda)}</textarea></div>
      <div class="f"><label>Hashtags (máx. 5)</label><input data-f="hashtags" value="${esc((c.hashtags || []).map(h => "#" + h).join(" "))}"></div>
      <div class="trim">
        <div class="f"><label>Início (s)</label><input type="number" step="0.1" min="0" data-f="ini" value="0"></div>
        <button class="sec sm" data-a="mi" title="Usar o tempo atual do vídeo">⏱</button>
        <div class="f"><label>Fim (s)</label><input type="number" step="0.1" min="0" data-f="fim" value="${fmt(c.dur)}"></div>
        <button class="sec sm" data-a="mf" title="Usar o tempo atual do vídeo">⏱</button>
      </div>
      <div class="f"><label>Quando postar</label><input type="datetime-local" data-f="quando"></div>
      <div class="hint">Deixe o horário vazio para postar na hora. ⏱ marca o tempo atual do vídeo.</div>
    </details>
    <div class="btns">
      ${c.status !== "postado" ? `<button class="ok" data-a="ap">✔ Aprovar e postar</button>` : ""}
      ${c.status === "pendente" ? `<button class="no" data-a="rp">✖ Reprovar</button>` : ""}
      <button class="sec" data-a="pv">▶ Prévia</button>
      <a class="btn sec" href="${esc(c.url)}" download="${esc(c.arquivo)}">⬇ Baixar</a>
    </div>
  </div></article>`;
}
function val(el, f) { return el.querySelector(`[data-f="${f}"]`); }
function liga(c) {
  const el = document.getElementById("c-" + c.id), v = el.querySelector("video");
  // so um video toca por vez: ao dar play, pausa os outros
  v.addEventListener("play", () => document.querySelectorAll("video").forEach(o => { if (o !== v && !o.paused) o.pause(); }));
  v.addEventListener("play", () => { marcaVisto(c); el.classList.remove("novo"); el.querySelectorAll(".tagnovo").forEach(t => t.remove()); }, { once: true });
  el.querySelector('[data-a="mi"]').onclick = () => val(el, "ini").value = fmt(v.currentTime);
  el.querySelector('[data-a="mf"]').onclick = () => val(el, "fim").value = fmt(v.currentTime);
  el.querySelector('[data-a="pv"]').onclick = () => {
    const a = +val(el, "ini").value || 0, b = +val(el, "fim").value || c.dur;
    v.currentTime = a; v.play();
    v.ontimeupdate = () => { if (v.currentTime >= b) { v.pause(); v.ontimeupdate = null; } };
  };
  const ap = el.querySelector('[data-a="ap"]'); if (ap) ap.onclick = () => pedido(c, el, "APROVAR");
  const rp = el.querySelector('[data-a="rp"]'); if (rp) rp.onclick = () => pedido(c, el, "REPROVAR");
}
function pedido(c, el, acao) {
  const ini = +val(el, "ini").value || 0, fim = +val(el, "fim").value || c.dur;
  if (fim - ini < 3) { alert("O corte precisa ter pelo menos 3 segundos."); return; }
  const tags = val(el, "hashtags").value.split(/\s+/).map(h => h.replace(/^#/, "")).filter(Boolean).slice(0, 5);
  const q = val(el, "quando").value;
  const d = {
    id: c.id, acao,
    titulo: val(el, "titulo").value, legenda: val(el, "legenda").value, hashtags: tags,
    texto_video: c.texto_editavel ? val(el, "texto_video").value : null,
    ini: Math.abs(ini) < 0.05 ? 0 : ini, fim: Math.abs(fim - c.dur) < 0.05 ? null : fim,
    quando: q ? q + ":00" : null
  };
  const titulo = `[${acao}] ${c.arquivo}`;
  const corpo = "Pedido gerado pelo site de aprovação. Não edite o bloco abaixo.\n\n```json\n" + JSON.stringify(d, null, 1) + "\n```\n";
  const msg = acao === "REPROVAR" ? `Reprovar "${c.titulo_curto}"?` : `Aprovar e postar "${c.titulo_curto}" ${q ? "em " + q.replace("T", " às ") : "AGORA"} no Instagram e no YouTube?`;
  if (!confirm(msg)) return;
  enviar(c, el, titulo, corpo, acao);
}

// ---------- envio direto pela pagina (sem sair do site) ----------
const KTOK = "viclipse_chave";
function chave() { try { return localStorage.getItem(KTOK) || ""; } catch (e) { return ""; } }
function aviso(el, txt, cor) {
  let a = el.querySelector(".aviso");
  if (!a) { a = document.createElement("div"); a.className = "aviso"; el.querySelector(".btns").after(a); }
  a.style.color = cor || "var(--m)"; a.innerHTML = txt;
}
async function gh(caminho, opt = {}) {
  const r = await fetch("https://api.github.com/repos/" + REPO + caminho, {
    ...opt, headers: { "Authorization": "Bearer " + chave(), "Accept": "application/vnd.github+json", "Content-Type": "application/json" }
  });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "chave inválida ou sem permissão" : "erro " + r.status);
  return r.json();
}
async function enviar(c, el, titulo, corpo, acao) {
  if (!chave()) { abrirChave(); return; }
  el.querySelectorAll("button").forEach(b => b.disabled = true);
  aviso(el, acao === "REPROVAR" ? "Enviando reprovação…" : "⏳ Enviando aprovação…");
  try {
    const iss = await gh("/issues", { method: "POST", body: JSON.stringify({ title: titulo, body: corpo }) });
    aviso(el, acao === "REPROVAR" ? "Reprovação enviada. Atualizando…" : "✔ Aprovado! O robô está editando e postando (cerca de 1 minuto)…", "var(--b)");
    acompanhar(c, el, iss.number, 0);
  } catch (e) {
    aviso(el, "Não consegui enviar: " + e.message + ". Confira a chave em 🔑.", "var(--r)");
    el.querySelectorAll("button").forEach(b => b.disabled = false);
  }
}
async function acompanhar(c, el, num, n) {
  if (n > 40) { aviso(el, "O robô está demorando. Recarregue a página daqui a pouco.", "var(--y)"); return; }
  await new Promise(r => setTimeout(r, 10000));
  try {
    const cm = await gh(`/issues/${num}/comments`);
    if (!cm.length) return acompanhar(c, el, num, n + 1);
    const txt = cm[cm.length - 1].body || "";
    const ok = !/^Não|Falta|não está/.test(txt);
    aviso(el, esc(txt).replace(/`/g, ""), ok ? "var(--g)" : "var(--r)");
    setTimeout(carregar, 20000);
  } catch (e) { acompanhar(c, el, num, n + 1); }
}
// chave do GitHub: fica guardada nas Configuracoes (canto superior direito)
function abrirChave() {
  abreMenu("conf"); const i = document.getElementById("inchave"); i.value = chave(); setTimeout(() => i.focus(), 250);
}
function marcaChave() {
  const ok = !!chave(), st = document.getElementById("statuschave");
  st.textContent = ok ? "✔ Chave salva neste aparelho" : "Nenhuma chave salva"; st.style.color = ok ? "var(--g)" : "var(--y)";
  document.getElementById("bconf").classList.toggle("alerta", !ok);
}
document.getElementById("salvachave").onclick = () => {
  const v = document.getElementById("inchave").value.trim(), m = document.getElementById("msgchave");
  if (!v.startsWith("github_pat_") && !v.startsWith("ghp_")) { m.textContent = "Essa não parece uma chave do GitHub."; m.style.color = "var(--r)"; return; }
  try { localStorage.setItem(KTOK, v); } catch (e) { m.textContent = "Este navegador não deixou salvar. Tente outro."; m.style.color = "var(--r)"; return; }
  m.textContent = "Chave salva!"; m.style.color = "var(--g)"; marcaChave(); setTimeout(() => { m.textContent = ""; fechaMenu(); }, 900);
};
document.getElementById("limpachave").onclick = () => { try { localStorage.removeItem(KTOK); } catch (e) {} document.getElementById("inchave").value = ""; marcaChave(); };
document.getElementById("bcats").onclick = () => abreMenu("cats");
document.getElementById("bconf").onclick = () => abreMenu("conf");
document.getElementById("veu").onclick = fechaMenu; document.getElementById("fechag").onclick = fechaMenu;
document.addEventListener("keydown", e => { if (e.key === "Escape") fechaMenu(); });
marcaChave();
carregar();
