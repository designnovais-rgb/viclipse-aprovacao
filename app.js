// Site de aprovação VIclipse: lê catalog.json, mostra os cortes e gera o pedido (issue) de aprovação/edição.
const REPO = location.hostname.endsWith("github.io")
  ? `${location.hostname.split(".")[0]}/${location.pathname.split("/")[1]}`
  : (window.REPO || "");
const STATUS = [["pendente", "Para aprovar"], ["aprovado", "Aprovados (na fila)"], ["postado", "Postados"], ["reprovado", "Reprovados"], ["todos", "Todos"]];
let CAT = [], aba = "pendente", streamer = "todos";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = s => (Math.round(s * 10) / 10).toFixed(1);

async function carregar() {
  const r = await fetch("catalog.json?" + Date.now());
  CAT = await r.json();
  desenhaTopo(); desenha();
}
function desenhaTopo() {
  const t = document.getElementById("tabs");
  t.innerHTML = STATUS.map(([k, n]) => {
    const q = k === "todos" ? CAT.length : CAT.filter(c => c.status === k).length;
    return `<button class="tab ${aba === k ? "on" : ""}" data-k="${k}">${n} (${q})</button>`;
  }).join("");
  t.querySelectorAll(".tab").forEach(b => b.onclick = () => { aba = b.dataset.k; desenhaTopo(); desenha(); });
  const ss = ["todos", ...new Set(CAT.map(c => c.streamer))];
  const f = document.getElementById("filters");
  f.innerHTML = ss.map(s => `<button class="chip ${streamer === s ? "on" : ""}" data-s="${esc(s)}">${s === "todos" ? "Todos os streamers" : esc(s)}</button>`).join("");
  f.querySelectorAll(".chip").forEach(b => b.onclick = () => { streamer = b.dataset.s; desenhaTopo(); desenha(); });
}
function desenha() {
  const g = document.getElementById("grid");
  const itens = CAT.filter(c => (aba === "todos" || c.status === aba) && (streamer === "todos" || c.streamer === streamer));
  if (!itens.length) { g.innerHTML = `<div class="empty">Nada aqui.</div>`; return; }
  g.innerHTML = itens.map(card).join("");
  itens.forEach(liga);
}
function card(c) {
  const editTexto = c.texto_editavel;
  return `<div class="card" id="c-${c.id}">
  <video controls preload="metadata" playsinline ${c.capa ? `poster="${esc(c.capa)}"` : ""} src="${esc(c.url)}"></video>
  <div class="body">
    <div class="top"><span class="name">${esc(c.titulo_curto || c.arquivo)}</span><span class="st ${c.status}">${c.status}</span></div>
    <div class="dur">${esc(c.streamer)} · ${esc(c.estilo)} · ${fmt(c.dur)} s${c.post ? ` · post ${esc(c.post)}` : ""}</div>
    ${editTexto ? `<div><label>${esc(c.texto_rotulo || "Texto no vídeo")}</label><textarea data-f="texto_video">${esc(c.texto_video)}</textarea></div>` : ""}
    <div><label>Título (YouTube Shorts)</label><input data-f="titulo" value="${esc(c.titulo)}"></div>
    <div><label>Legenda</label><textarea data-f="legenda">${esc(c.legenda)}</textarea></div>
    <div><label>Hashtags (máx. 5, separadas por espaço)</label><input data-f="hashtags" value="${esc((c.hashtags || []).map(h => "#" + h).join(" "))}"></div>
    <div class="trim">
      <div><label>Início (s)</label><input type="number" step="0.1" min="0" data-f="ini" value="0"></div>
      <button class="sec" data-a="mi">⏱ aqui</button>
      <div><label>Fim (s)</label><input type="number" step="0.1" min="0" data-f="fim" value="${fmt(c.dur)}"></div>
      <button class="sec" data-a="mf">⏱ aqui</button>
    </div>
    <div class="row"><div><label>Quando postar</label><input type="datetime-local" data-f="quando"></div></div>
    <div class="hint">Deixe "quando postar" vazio para postar na hora. Use ⏱ para marcar o tempo atual do vídeo.</div>
    <div class="btns">
      ${c.status !== "postado" ? `<button class="ok" data-a="ap">✔ Aprovar e postar</button>` : ""}
      ${c.status === "pendente" ? `<button class="no" data-a="rp">✖ Reprovar</button>` : ""}
      <button class="sec" data-a="pv">▶ Prévia do corte</button>
      <a class="btn sec" href="${esc(c.url)}" download="${esc(c.arquivo)}">⬇ Baixar</a>
    </div>
  </div></div>`;
}
function val(el, f) { return el.querySelector(`[data-f="${f}"]`); }
function liga(c) {
  const el = document.getElementById("c-" + c.id), v = el.querySelector("video");
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
  const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(titulo)}&body=${encodeURIComponent(corpo)}`;
  window.open(url, "_blank");
}
carregar();
