import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

/* ─── SUPABASE ───────────────────────────────────────────────────────────── */
const SB_URL = "https://svgkcxzbndcvqoiqyrek.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2Z2tjeHpibmRjdnFvaXF5cmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTg2OTMsImV4cCI6MjA4OTk3NDY5M30._arLMObSGt76XjplS6KBI7xr0YUa9wA69cozHqiIf5Q";
const sb = createClient(SB_URL, SB_KEY);

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */
const TODAY = new Date().toISOString().split("T")[0];

const AREA_LABELS = { engenharia:"Engenharia", saude:"Saúde", geral:"Geral" };
const AREA_COLORS = { engenharia:"#3b82f6", saude:"#10b981", geral:"#8b5cf6" };

const DISC_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#f59e0b","#ef4444",
  "#10b981","#0ea5e9","#a855f7","#f97316","#14b8a6",
  "#ec4899","#84cc16","#6366f1","#d946ef","#fb923c",
];

const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

/* ─── PARSE PLANILHA ─────────────────────────────────────────────────────── */
const SAUDE_CURSOS = ["BIOMEDICINA","FARMÁCIA","FARMACIA","FISIOTERAPIA","NUTRIÇÃO","NUTRICAO","ENFERMAGEM","EST. E COSMÉTICA","EST. E COSMETICA","ODONTOLOGIA","MEDICINA"];
const ENG_CURSOS   = ["ENG.","ENGENHARIA","ED. FÍSICA","ED. FISICA","EDUCAÇÃO FÍSICA"];

function detectArea(curso) {
  const up = curso.toUpperCase();
  if (SAUDE_CURSOS.some(s => up.includes(s))) return "saude";
  if (ENG_CURSOS.some(s => up.includes(s))) return "engenharia";
  return "saude";
}

function parseDate(raw) {
  // "19/mai", "19/05", "19/mai/2026"
  const r = raw.trim();
  const m1 = r.match(/^(\d{1,2})[\/\-]([a-zA-Z]{3})/);
  if (m1) {
    const d = m1[1].padStart(2,"0");
    const mi = MONTHS_PT.indexOf(m1[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""));
    if (mi >= 0) return `2026-${String(mi+1).padStart(2,"0")}-${d}`;
    // jun → 06
    const abr = {"jan":1,"fev":2,"mar":3,"abr":4,"mai":5,"jun":6,"jul":7,"ago":8,"set":9,"out":10,"nov":11,"dez":12};
    const k = m1[2].toLowerCase().slice(0,3).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    if (abr[k]) return `2026-${String(abr[k]).padStart(2,"0")}-${d}`;
  }
  const m2 = r.match(/^(\d{1,2})[\/\-](\d{1,2})/);
  if (m2) return `2026-${m2[2].padStart(2,"0")}-${m2[1].padStart(2,"0")}`;
  return null;
}

function parsePlanilha(text) {
  const lines = text.split(/\n/).map(l=>l.trim()).filter(Boolean);
  const rows = [];
  const seen = new Set();

  for (const line of lines) {
    // separador: tab ou pipe ou 2+ espaços consecutivos
    const cols = line.split(/\t|\|/).map(c=>c.trim()).filter(Boolean);
    if (cols.length < 6) continue;

    const curso      = cols[0].replace(/\s+/g," ").trim();
    const disciplina = cols[1].replace(/\s+/g," ").trim();
    const semestre   = cols[2].replace(/\s+/g," ").trim();
    const lab        = cols[3].replace(/\s+/g," ").trim();
    const professor  = cols[4].replace(/\s+/g," ").trim();
    const numAula    = cols[5].replace(/\s+/g," ").trim();
    const dataRaw    = cols[6] || "";
    const horario    = cols[7] || "";

    const data = parseDate(dataRaw);
    if (!data) continue;

    // extrair grupo do semestre
    const grupoMatch = semestre.match(/\(GRUPO\s+([A-Z])\)/i);
    const grupo = grupoMatch ? grupoMatch[1] : null;
    const semLimpo = semestre.replace(/\s*\(GRUPO\s+[A-Z]\)/i,"").trim();

    // horário
    let hIni="", hFim="";
    const hm = horario.match(/(\d{1,2}:\d{2})\s*as\s*(\d{1,2}:\d{2})/i);
    if (hm) { hIni=hm[1]; hFim=hm[2]; }

    const area = detectArea(curso);

    // chave de deduplicação
    const key = `${curso}|${disciplina}|${semLimpo}|${grupo||""}|${lab}|${professor}|${numAula}|${data}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({ curso, disciplina, semestre:semLimpo, grupo, lab, professor, numAula, data, hIni, hFim, area });
  }
  return rows;
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
const fmtDate = s => { if(!s)return""; const [,m,d]=s.split("-"); return `${d}/${m}`; };
const fmtFull = s => { if(!s)return""; const [y,m,d]=s.split("-"); const wd=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][new Date(s+"T12:00:00").getDay()]; return `${wd} ${d}/${m}`; };
const isPast  = s => s && s < TODAY;
const isToday = s => s === TODAY;

/* ─── THEME ──────────────────────────────────────────────────────────────── */
const THEMES = {
  dark:{
    bg:"#080c14",surface:"#0f1623",surface2:"#172032",border:"#1e2d45",
    text:"#e8eef8",text2:"#7a92b4",text3:"#3d5470",
    sidebar:"#0b1220",accent:"#3b82f6",
  },
  light:{
    bg:"#f0f4fa",surface:"#ffffff",surface2:"#f0f4fa",border:"#dde5f0",
    text:"#0d1b2e",text2:"#4b6180",text3:"#9aafc5",
    sidebar:"#ffffff",accent:"#2563eb",
  }
};

/* ─── TOAST ──────────────────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3200); return()=>clearTimeout(t); },[]);
  const colors = { ok:"#10b981", err:"#ef4444", info:"#3b82f6" };
  return (
    <div style={{ position:"fixed",bottom:24,right:24,zIndex:9999,background:colors[type]||colors.info,color:"#fff",padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 8px 32px #0006",maxWidth:360,display:"flex",alignItems:"center",gap:10 }}>
      <span>{type==="ok"?"✓":type==="err"?"✕":"ℹ"}</span>{msg}
      <button onClick={onClose} style={{ marginLeft:"auto",background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:16 }}>×</button>
    </div>
  );
}

/* ─── BADGE / PILL ───────────────────────────────────────────────────────── */
function Pill({ children, color, small }) {
  return <span style={{ display:"inline-flex",alignItems:"center",padding:small?"2px 7px":"3px 10px",borderRadius:20,fontSize:small?10:11,fontWeight:600,letterSpacing:.3,background:`${color}22`,color,border:`1px solid ${color}35` }}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEWS
═══════════════════════════════════════════════════════════════════════════ */

/* ── DASHBOARD ─────────────────────────────────────────────────────────── */
function Dashboard({ discs, turmas, aulas, areaFilter, t }) {
  const fA = a => areaFilter==="geral"||a.area===areaFilter;
  const fT = tt => areaFilter==="geral"||tt.area===areaFilter;

  const aulasF = aulas.filter(a=>{
    const turma = turmas.find(tt=>tt.id===a.turma_id);
    return turma && fT(turma);
  });

  const hoje = aulasF.filter(a=>a.data_aula===TODAY);
  const prox = aulasF.filter(a=>a.data_aula>TODAY).sort((a,b)=>a.data_aula.localeCompare(b.data_aula)).slice(0,6);
  const done = aulasF.filter(a=>a.data_aula<TODAY).length;
  const pend = aulasF.filter(a=>a.data_aula>=TODAY).length;

  const enriched = (list) => list.map(a=>{
    const turma = turmas.find(tt=>tt.id===a.turma_id)||{};
    const disc  = discs.find(d=>d.id===turma.disciplina_id)||{};
    return { ...a, turma, disc };
  });

  return (
    <div>
      {/* stats */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:28 }}>
        {[
          { l:"Disciplinas", v:discs.filter(d=>areaFilter==="geral"||true).length, c:"#3b82f6", i:"📚" },
          { l:"Total de aulas",  v:aulasF.length, c:"#8b5cf6", i:"🎓" },
          { l:"Concluídas", v:done, c:"#10b981", i:"✅" },
          { l:"Pendentes",  v:pend, c:"#f59e0b", i:"⏳" },
        ].map(s=>(
          <div key={s.l} style={{ background:t.surface,border:`1px solid ${t.border}`,borderRadius:16,padding:"18px 20px",display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ width:42,height:42,borderRadius:12,background:`${s.c}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{s.i}</div>
            <div>
              <div style={{ fontSize:24,fontWeight:800,color:s.c,lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:11,color:t.text3,marginTop:4,fontWeight:500 }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* hoje */}
      {hoje.length>0&&(
        <section style={{ marginBottom:28 }}>
          <SectionTitle label={`Hoje — ${fmtFull(TODAY)}`} count={hoje.length} color="#ef4444" t={t}/>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {enriched(hoje).map((a,i)=>(
              <AulaCard key={i} aula={a} t={t}/>
            ))}
          </div>
        </section>
      )}

      {/* próximas */}
      <section>
        <SectionTitle label="Próximas aulas" color="#10b981" t={t}/>
        <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
          {enriched(prox).map((a,i)=>(
            <div key={i} style={{ background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"11px 18px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ width:3,height:34,borderRadius:2,background:a.disc.cor||"#3b82f6",flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:t.text }}>{a.disc.nome||"—"}</div>
                  <div style={{ fontSize:11,color:t.text3 }}>{a.turma.curso}{a.turma.grupo?` · Grp ${a.turma.grupo}`:""} · Prof. {a.turma.professor}</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:12,fontWeight:700,color:t.text2 }}>{fmtFull(a.data_aula)}</div>
                <div style={{ fontSize:11,color:t.text3 }}>Aula {a.numero_aula} · {a.hora_inicio||"—"}</div>
              </div>
            </div>
          ))}
          {prox.length===0&&<EmptyState msg="Nenhuma aula futura encontrada" t={t}/>}
        </div>
      </section>
    </div>
  );
}

function AulaCard({ aula, t }) {
  const c = aula.disc?.cor||"#3b82f6";
  return (
    <div style={{ background:t.surface,border:`1px solid ${t.border}`,borderLeft:`4px solid ${c}`,borderRadius:14,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
      <div style={{ display:"flex",alignItems:"center",gap:14 }}>
        <span style={{ fontSize:24 }}>{aula.disc?.icone||"📚"}</span>
        <div>
          <div style={{ fontSize:14,fontWeight:700,color:t.text }}>{aula.disc?.nome||"—"}</div>
          <div style={{ fontSize:12,color:t.text2,marginTop:2 }}>{aula.turma?.curso} · {aula.turma?.semestre}{aula.turma?.grupo?` · Grp ${aula.turma.grupo}`:""} · {aula.turma?.laboratorio}</div>
        </div>
      </div>
      <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5 }}>
        <Pill color={c}>Aula {aula.numero_aula}</Pill>
        <span style={{ fontSize:11,color:t.text3 }}>{aula.hora_inicio&&aula.hora_fim?`${aula.hora_inicio}–${aula.hora_fim}`:aula.hora_inicio||""} · Prof. {aula.turma?.professor}</span>
      </div>
    </div>
  );
}

/* ── CALENDARIO ────────────────────────────────────────────────────────── */
function CalendarioView({ turmas, aulas, discs, areaFilter, t }) {
  const [cur, setCur] = useState({ y:2026, m:4 });
  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const WD = ["D","S","T","Q","Q","S","S"];
  const days = new Date(cur.y, cur.m+1, 0).getDate();
  const first = new Date(cur.y, cur.m, 1).getDay();

  const aulasF = aulas.filter(a=>{
    if (areaFilter==="geral") return true;
    const tt = turmas.find(t=>t.id===a.turma_id);
    return tt?.area===areaFilter;
  });

  const getDay = d => {
    const ds = `${cur.y}-${String(cur.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return aulasF.filter(a=>a.data_aula===ds).map(a=>{
      const tt=turmas.find(tt=>tt.id===a.turma_id)||{};
      const disc=discs.find(d=>d.id===tt.disciplina_id)||{};
      return {...a,disc,turma:tt};
    });
  };

  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",marginBottom:20,background:t.surface,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden" }}>
        <button onClick={()=>setCur(p=>{const m=p.m-1;return m<0?{y:p.y-1,m:11}:{...p,m}})} style={{ padding:"14px 20px",border:"none",background:"transparent",color:t.text2,cursor:"pointer",fontSize:18,borderRight:`1px solid ${t.border}` }}>‹</button>
        <span style={{ flex:1,textAlign:"center",fontWeight:700,fontSize:16,color:t.text }}>{MONTHS[cur.m]} {cur.y}</span>
        <button onClick={()=>setCur(p=>{const m=p.m+1;return m>11?{y:p.y+1,m:0}:{...p,m}})} style={{ padding:"14px 20px",border:"none",background:"transparent",color:t.text2,cursor:"pointer",fontSize:18,borderLeft:`1px solid ${t.border}` }}>›</button>
      </div>
      <div style={{ background:t.surface,borderRadius:16,border:`1px solid ${t.border}`,overflow:"hidden" }}>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${t.border}` }}>
          {WD.map((w,i)=><div key={i} style={{ textAlign:"center",padding:"10px 0",fontSize:11,fontWeight:700,color:t.text3,letterSpacing:.8 }}>{w}</div>)}
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)" }}>
          {Array.from({length:first}).map((_,i)=><div key={"e"+i} style={{ minHeight:88,background:t.bg,borderRight:`1px solid ${t.border}`,borderBottom:`1px solid ${t.border}`,opacity:.3 }}/>)}
          {Array.from({length:days}).map((_,i)=>{
            const d=i+1;
            const ds=`${cur.y}-${String(cur.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
            const list=getDay(d); const tod=isToday(ds), past=isPast(ds);
            return (
              <div key={d} style={{ minHeight:88,padding:"6px 7px",background:tod?`#1d4ed815`:past?t.bg:t.surface,borderRight:`1px solid ${t.border}`,borderBottom:`1px solid ${t.border}` }}>
                <div style={{ width:24,height:24,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",background:tod?"#3b82f6":"transparent",fontSize:12,fontWeight:tod?700:400,color:tod?"#fff":past?t.text3:t.text2,marginBottom:3 }}>{d}</div>
                {list.slice(0,3).map((a,j)=>(
                  <div key={j} title={a.disc?.nome} style={{ background:`${a.disc?.cor||"#3b82f6"}25`,borderLeft:`2px solid ${a.disc?.cor||"#3b82f6"}`,padding:"2px 5px",borderRadius:4,fontSize:9,marginBottom:2,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500 }}>
                    {a.disc?.nome?.split(" ")[0]||"?"}{a.turma?.grupo?` ${a.turma.grupo}`:""}
                  </div>
                ))}
                {list.length>3&&<div style={{ fontSize:9,color:t.text3 }}>+{list.length-3}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── DISCIPLINAS ────────────────────────────────────────────────────────── */
function DisciplinasView({ discs, setDiscs, turmas, aulas, areaFilter, t, toast }) {
  const [sel, setSel] = useState(null);
  const fileRef = useRef();
  const disc = sel ? discs.find(d=>d.id===sel) : null;

  const discsFiltradas = discs.filter(d=>{
    if (areaFilter==="geral") return true;
    return turmas.some(tt=>tt.disciplina_id===d.id&&tt.area===areaFilter);
  });

  async function uploadPDF(e) {
    const file = e.target.files[0];
    if (!file||file.type!=="application/pdf") return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const { error } = await sb.from("disciplinas").update({ roteiro_nome:file.name, roteiro_url:ev.target.result }).eq("id",sel);
      if (!error) {
        setDiscs(prev=>prev.map(d=>d.id===sel?{...d,roteiro_nome:file.name,roteiro_url:ev.target.result}:d));
        toast("Roteiro anexado!","ok");
      }
    };
    reader.readAsDataURL(file);
  }

  const turmasDisc = disc ? turmas.filter(tt=>tt.disciplina_id===disc.id) : [];

  return (
    <div style={{ display:"grid",gridTemplateColumns:disc?"260px 1fr":"1fr",gap:16,alignItems:"start" }}>
      {/* lista */}
      <div>
        <div style={{ fontSize:11,fontWeight:700,color:t.text3,marginBottom:12,letterSpacing:.8,textTransform:"uppercase" }}>{discsFiltradas.length} disciplinas</div>
        <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
          {discsFiltradas.map(d=>{
            const tCount = turmas.filter(tt=>tt.disciplina_id===d.id).length;
            return (
              <button key={d.id} onClick={()=>setSel(sel===d.id?null:d.id)} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,border:`1px solid ${sel===d.id?d.cor:t.border}`,background:sel===d.id?`${d.cor}12`:t.surface,cursor:"pointer",textAlign:"left",transition:"all .15s",width:"100%" }}>
                <span style={{ fontSize:18,flexShrink:0 }}>{d.icone||"📚"}</span>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:sel===d.id?d.cor:t.text,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{d.nome}</div>
                  <div style={{ fontSize:10,color:t.text3,marginTop:2 }}>{tCount} turma{tCount!==1?"s":""}{d.roteiro_nome?<span style={{ color:d.cor,marginLeft:5 }}>• PDF</span>:null}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* detalhe */}
      {disc&&(
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div style={{ background:t.surface,borderRadius:16,border:`1px solid ${t.border}`,overflow:"hidden" }}>
            <div style={{ background:`${disc.cor}15`,borderBottom:`1px solid ${disc.cor}25`,padding:"16px 22px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <span style={{ fontSize:26 }}>{disc.icone||"📚"}</span>
                <div>
                  <div style={{ fontSize:15,fontWeight:700,color:t.text }}>{disc.nome}</div>
                  <div style={{ fontSize:12,color:t.text2,marginTop:2 }}>{turmasDisc.length} turmas</div>
                </div>
              </div>
              <button onClick={()=>fileRef.current.click()} style={{ padding:"7px 14px",borderRadius:10,border:`1px solid ${disc.cor}50`,background:`${disc.cor}15`,color:disc.cor,fontSize:12,fontWeight:600,cursor:"pointer" }}>
                📄 {disc.roteiro_nome?"Trocar":"Anexar"} Roteiro
              </button>
              <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={uploadPDF}/>
            </div>

            {disc.roteiro_url&&(
              <div style={{ padding:"14px 22px",borderBottom:`1px solid ${t.border}` }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <span>📄</span>
                  <span style={{ fontSize:13,fontWeight:600,color:t.text }}>{disc.roteiro_nome}</span>
                  <Pill color={disc.cor} small>Compartilhado com {turmasDisc.length} turmas</Pill>
                  <a href={disc.roteiro_url} download={disc.roteiro_nome} style={{ marginLeft:"auto",fontSize:11,color:disc.cor,textDecoration:"none",padding:"4px 10px",border:`1px solid ${disc.cor}40`,borderRadius:8 }}>⬇ Baixar</a>
                </div>
                <iframe src={disc.roteiro_url} style={{ width:"100%",height:240,border:"none",borderRadius:10 }} title="Roteiro"/>
              </div>
            )}

            <div style={{ padding:"14px 22px" }}>
              <div style={{ fontSize:11,fontWeight:700,color:t.text3,letterSpacing:.8,textTransform:"uppercase",marginBottom:12 }}>Turmas</div>
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {turmasDisc.map(tt=>{
                  const aulasT = aulas.filter(a=>a.turma_id===tt.id).sort((a,b)=>a.data_aula.localeCompare(b.data_aula));
                  return (
                    <div key={tt.id} style={{ background:t.surface2,borderRadius:12,padding:"12px 16px",border:`1px solid ${t.border}` }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                        <div>
                          <div style={{ fontSize:13,fontWeight:600,color:t.text }}>{tt.curso}</div>
                          <div style={{ fontSize:11,color:t.text2,marginTop:2 }}>{tt.semestre}{tt.grupo?` · Grp ${tt.grupo}`:""} · Prof. {tt.professor}</div>
                          <div style={{ fontSize:11,color:t.text3,marginTop:1 }}>{tt.laboratorio}</div>
                        </div>
                        <Pill color={disc.cor} small>{aulasT.length} aula{aulasT.length!==1?"s":""}</Pill>
                      </div>
                      <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
                        {aulasT.map((a,i)=>{
                          const tod=isToday(a.data_aula), past=isPast(a.data_aula);
                          return (
                            <div key={i} style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:9,background:tod?`${disc.cor}20`:past?t.surface2:t.surface,border:`1px solid ${tod?disc.cor:t.border}`,fontSize:11 }}>
                              <span style={{ fontWeight:700,color:tod?disc.cor:past?t.text3:t.text2 }}>{fmtDate(a.data_aula)}</span>
                              <span style={{ color:t.text3 }}>Aula {a.numero_aula}</span>
                              {tod&&<span style={{ fontSize:9,fontWeight:800,color:disc.cor,background:`${disc.cor}18`,padding:"1px 5px",borderRadius:4 }}>HOJE</span>}
                              {past&&!tod&&<span style={{ fontSize:11,color:t.text3 }}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── IMPORTAR ────────────────────────────────────────────────────────────── */
function ImportarView({ onImported, t, toast }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastImport, setLastImport] = useState(null);

  function handlePreview() {
    const rows = parsePlanilha(text);
    setPreview(rows);
  }

  async function handleImport() {
    if (!preview||preview.length===0) return;
    setLoading(true);
    let added=0, skipped=0;

    // agrupar por disciplina
    const discMap = {};
    for (const r of preview) {
      if (!discMap[r.disciplina]) discMap[r.disciplina] = { cor: DISC_COLORS[Object.keys(discMap).length % DISC_COLORS.length], icone:"📚" };
    }

    // upsert disciplinas
    for (const [nome, extra] of Object.entries(discMap)) {
      await sb.from("disciplinas").upsert({ nome, cor:extra.cor, icone:extra.icone }, { onConflict:"nome", ignoreDuplicates:true });
    }

    // buscar ids
    const { data: discRows } = await sb.from("disciplinas").select("id,nome");
    const discIdMap = Object.fromEntries((discRows||[]).map(d=>[d.nome,d.id]));

    // agrupar por turma
    const turmaMap = {};
    for (const r of preview) {
      const key = `${r.curso}|${r.disciplina}|${r.semestre}|${r.grupo||""}|${r.lab}|${r.professor}`;
      if (!turmaMap[key]) turmaMap[key] = { ...r, discId: discIdMap[r.disciplina] };
    }

    // upsert turmas
    for (const [, tt] of Object.entries(turmaMap)) {
      if (!tt.discId) continue;
      const { data: existing } = await sb.from("turmas").select("id").eq("disciplina_id",tt.discId).eq("curso",tt.curso).eq("semestre",tt.semestre).eq("grupo",tt.grupo||"").eq("professor",tt.professor).single();
      if (!existing) {
        await sb.from("turmas").insert({ disciplina_id:tt.discId, curso:tt.curso, area:tt.area, semestre:tt.semestre, grupo:tt.grupo, laboratorio:tt.lab, professor:tt.professor });
      }
    }

    // buscar turmas
    const { data: turmaRows } = await sb.from("turmas").select("id,disciplina_id,curso,semestre,grupo,professor");

    // inserir aulas
    for (const r of preview) {
      const discId = discIdMap[r.disciplina];
      if (!discId) continue;
      const turma = turmaRows?.find(tt=>tt.disciplina_id===discId&&tt.curso===r.curso&&tt.semestre===r.semestre&&(tt.grupo||"")===(r.grupo||"")&&tt.professor===r.professor);
      if (!turma) continue;
      const { error } = await sb.from("aulas").upsert({
        turma_id:turma.id, numero_aula:r.numAula, data_aula:r.data, hora_inicio:r.hIni, hora_fim:r.hFim
      }, { onConflict:"turma_id,numero_aula,data_aula", ignoreDuplicates:true });
      if (!error) added++; else skipped++;
    }

    setLastImport(preview);
    await onImported();
    setLoading(false);
    toast(`${added} aulas importadas${skipped?`, ${skipped} duplicatas ignoradas`:""}`, "ok");
    setPreview(null);
    setText("");
  }

  async function handleUndo() {
    if (!lastImport) return;
    // remover aulas importadas (por data+numero)
    for (const r of lastImport) {
      await sb.from("aulas").delete().eq("data_aula",r.data).eq("numero_aula",r.numAula);
    }
    await onImported();
    setLastImport(null);
    toast("Última importação desfeita","info");
  }

  const inputStyle = { width:"100%",padding:"12px 14px",borderRadius:12,border:`1px solid ${t.border}`,background:t.surface2,color:t.text,fontSize:12,fontFamily:"monospace",boxSizing:"border-box",resize:"vertical" };

  // agrupar preview por curso
  const porCurso = preview ? preview.reduce((acc,r)=>{
    if (!acc[r.curso]) acc[r.curso]={area:r.area,discs:{}};
    if (!acc[r.curso].discs[r.disciplina]) acc[r.curso].discs[r.disciplina]=[];
    acc[r.curso].discs[r.disciplina].push(r);
    return acc;
  },{}) : {};

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div style={{ background:t.surface,borderRadius:16,border:`1px solid ${t.border}`,padding:"20px 22px" }}>
        <div style={{ fontSize:15,fontWeight:700,color:t.text,marginBottom:4 }}>📋 Importar planilha de aulas</div>
        <div style={{ fontSize:12,color:t.text2,marginBottom:14 }}>Cole o conteúdo separado por <strong>Tab</strong>. Formato: <code style={{background:t.surface2,padding:"1px 6px",borderRadius:4,fontSize:11}}>CURSO | DISCIPLINA | SEMESTRE | LAB | PROFESSOR | AULA N | DATA | HORÁRIO</code></div>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={10} style={inputStyle} placeholder={"BIOMEDICINA\tPRINCÍPIOS FÍSICO-QUÍMICOS LABORATORIAIS\t2° SEMESTRE (GRUPO B)\tLAB. MULTIDISCIPLINAR\tGIANA VITORIA\tAULA 3\t19/mai\t19:00 as 20:20"}/>
        <div style={{ display:"flex",gap:8,marginTop:12,flexWrap:"wrap" }}>
          <button onClick={handlePreview} disabled={!text.trim()} style={{ padding:"10px 22px",borderRadius:10,border:"none",background:t.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",opacity:text.trim()?1:.5 }}>🔍 Extrair e pré-visualizar</button>
          {preview&&preview.length>0&&<button onClick={handleImport} disabled={loading} style={{ padding:"10px 22px",borderRadius:10,border:"none",background:"#10b981",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" }}>{loading?"⏳ Salvando...":"✅ Importar para banco"}</button>}
          {lastImport&&<button onClick={handleUndo} style={{ padding:"10px 18px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text2,fontSize:13,cursor:"pointer" }}>↩ Desfazer última importação</button>}
        </div>
      </div>

      {preview&&(
        <div style={{ background:t.surface,borderRadius:16,border:`1px solid ${t.border}`,padding:"20px 22px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:14,fontWeight:700,color:t.text }}>{preview.length} registros extraídos</div>
            <div style={{ display:"flex",gap:8 }}>
              <Pill color="#3b82f6">{preview.filter(r=>r.area==="engenharia").length} Engenharia</Pill>
              <Pill color="#10b981">{preview.filter(r=>r.area==="saude").length} Saúde</Pill>
            </div>
          </div>
          {preview.length===0
            ? <div style={{ color:t.text3,fontSize:13 }}>Nenhum dado reconhecido. Verifique o formato (separador tab).</div>
            : (
              <div style={{ maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:12 }}>
                {Object.entries(porCurso).map(([curso,data])=>(
                  <div key={curso}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                      <span style={{ fontSize:13,fontWeight:700,color:t.text }}>{curso}</span>
                      <Pill color={AREA_COLORS[data.area]} small>{AREA_LABELS[data.area]}</Pill>
                    </div>
                    {Object.entries(data.discs).map(([disc,rows])=>(
                      <div key={disc} style={{ background:t.surface2,borderRadius:10,padding:"8px 12px",marginBottom:6 }}>
                        <div style={{ fontSize:12,fontWeight:600,color:t.text2,marginBottom:5 }}>{disc} <span style={{ color:t.text3,fontSize:11,fontWeight:400 }}>({rows.length} aulas)</span></div>
                        <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                          {rows.map((r,i)=>(
                            <span key={i} style={{ fontSize:10,background:t.surface,border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 8px",color:t.text2 }}>
                              {fmtDate(r.data)} Aula {r.numAula}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

/* ── KANBAN ─────────────────────────────────────────────────────────────── */
const COLS = [
  {id:"todo",label:"A Fazer",color:"#ef4444",icon:"⏳"},
  {id:"doing",label:"Em Andamento",color:"#f59e0b",icon:"🔄"},
  {id:"done",label:"Concluído",color:"#10b981",icon:"✅"},
];

function KanbanView({ tasks, setTasks, area, t, toast }) {
  const [drag, setDrag] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ titulo:"",descricao:"",prioridade:"media",tag:"",data_vencimento:"",coluna:"todo" });

  const filtered = tasks.filter(tk=>tk.area===area||tk.area==="geral");

  async function saveTask() {
    if (!form.titulo.trim()) return;
    const payload = {...form, area};
    if (modal==="new") {
      const {data,error} = await sb.from("kanban_tasks").insert(payload).select().single();
      if (!error) { setTasks(prev=>[...prev,data]); toast("Tarefa criada","ok"); }
    } else {
      const {data,error} = await sb.from("kanban_tasks").update(payload).eq("id",modal).select().single();
      if (!error) { setTasks(prev=>prev.map(tk=>tk.id===modal?data:tk)); toast("Tarefa atualizada","ok"); }
    }
    setModal(null);
  }

  async function deleteTask(id) {
    await sb.from("kanban_tasks").delete().eq("id",id);
    setTasks(prev=>prev.filter(tk=>tk.id!==id));
    toast("Tarefa removida","info");
  }

  async function moveCol(task, dir) {
    const idx=COLS.findIndex(c=>c.id===task.coluna);
    const newCol=COLS[idx+dir]?.id; if(!newCol)return;
    const {data}=await sb.from("kanban_tasks").update({coluna:newCol}).eq("id",task.id).select().single();
    if(data) setTasks(prev=>prev.map(tk=>tk.id===task.id?data:tk));
  }

  async function onDrop(colId) {
    if(!drag)return;
    const {data}=await sb.from("kanban_tasks").update({coluna:colId}).eq("id",drag.id).select().single();
    if(data) setTasks(prev=>prev.map(tk=>tk.id===drag.id?data:tk));
    setDrag(null);
  }

  const PC = {alta:"#ef4444",media:"#f59e0b",baixa:"#10b981"};
  const inputS={width:"100%",padding:"8px 12px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text,fontSize:13,boxSizing:"border-box",fontFamily:"inherit"};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <button onClick={()=>{setForm({titulo:"",descricao:"",prioridade:"media",tag:"",data_vencimento:"",coluna:"todo"});setModal("new")}} style={{padding:"9px 20px",borderRadius:10,border:"none",background:t.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Nova tarefa</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {COLS.map(col=>(
          <div key={col.id} onDragOver={e=>e.preventDefault()} onDrop={()=>onDrop(col.id)}
            style={{background:t.surface,borderRadius:14,border:`1px solid ${col.color}33`,minHeight:280}}>
            <div style={{padding:"13px 16px",borderBottom:`1px solid ${col.color}33`,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>{col.icon}</span>
              <span style={{fontWeight:700,fontSize:14,color:col.color}}>{col.label}</span>
              <span style={{marginLeft:"auto",background:`${col.color}22`,color:col.color,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700}}>{filtered.filter(tk=>tk.coluna===col.id).length}</span>
            </div>
            <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
              {filtered.filter(tk=>tk.coluna===col.id).map(tk=>(
                <div key={tk.id} draggable onDragStart={()=>setDrag(tk)}
                  style={{background:t.surface2,borderRadius:10,padding:12,border:`1px solid ${t.border}`,cursor:"grab"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:600,color:t.text,lineHeight:1.3,flex:1}}>{tk.titulo}</span>
                    <div style={{display:"flex",gap:3}}>
                      <button onClick={()=>{setForm({titulo:tk.titulo,descricao:tk.descricao||"",prioridade:tk.prioridade,tag:tk.tag||"",data_vencimento:tk.data_vencimento||"",coluna:tk.coluna});setModal(tk.id)}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:13}}>✏️</button>
                      <button onClick={()=>deleteTask(tk.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13}}>🗑</button>
                    </div>
                  </div>
                  {tk.descricao&&<div style={{fontSize:11,color:t.text3,marginBottom:6}}>{tk.descricao}</div>}
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                    <span style={{background:`${PC[tk.prioridade]||"#8b5cf6"}18`,color:PC[tk.prioridade]||"#8b5cf6",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>🔺 {tk.prioridade}</span>
                    {tk.tag&&<span style={{background:`${t.accent}18`,color:t.accent,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>{tk.tag}</span>}
                    {tk.data_vencimento&&<span style={{marginLeft:"auto",fontSize:10,color:t.text3}}>{fmtDate(tk.data_vencimento)}</span>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>moveCol(tk,-1)} disabled={col.id==="todo"} style={{flex:1,padding:"4px 0",borderRadius:6,border:`1px solid ${t.border}`,background:"transparent",color:col.id==="todo"?t.text3:t.text2,cursor:col.id==="todo"?"default":"pointer",fontSize:11}}>← Voltar</button>
                    <button onClick={()=>moveCol(tk,1)} disabled={col.id==="done"} style={{flex:1,padding:"4px 0",borderRadius:6,border:`1px solid ${t.border}`,background:"transparent",color:col.id==="done"?t.text3:"#10b981",cursor:col.id==="done"?"default":"pointer",fontSize:11,fontWeight:600}}>Avançar →</button>
                  </div>
                </div>
              ))}
              {filtered.filter(tk=>tk.coluna===col.id).length===0&&<div style={{textAlign:"center",color:t.text3,padding:"24px 0",fontSize:12}}>Sem tarefas</div>}
            </div>
          </div>
        ))}
      </div>

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"#0009",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{background:t.surface,borderRadius:16,padding:26,width:400,border:`1px solid ${t.border}`,boxShadow:"0 24px 64px #0008"}}>
            <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:18}}>{modal==="new"?"➕ Nova tarefa":"✏️ Editar tarefa"}</div>
            {[["Título","titulo","text"],["Descrição","descricao","text"],["Tag","tag","text"]].map(([l,k,tp])=>(
              <div key={k} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>{l}</div>
                <input type={tp} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={inputS}/>
              </div>
            ))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
              {[["Prioridade","prioridade",["alta","media","baixa"]],["Coluna","coluna",COLS.map(c=>c.id)]].map(([l,k,opts])=>(
                <div key={k}>
                  <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>{l}</div>
                  <select value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={{...inputS,width:"100%"}}>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>
                </div>
              ))}
              <div>
                <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>Vencimento</div>
                <input type="date" value={form.data_vencimento} onChange={e=>setForm(p=>({...p,data_vencimento:e.target.value}))} style={inputS}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={()=>setModal(null)} style={{flex:1,padding:"9px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text2,cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={saveTask} style={{flex:2,padding:"9px",borderRadius:10,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── INVENTÁRIO ─────────────────────────────────────────────────────────── */
function InventarioView({ area, t, toast }) {
  const [labs, setLabs] = useState([]);
  const [items, setItems] = useState([]);
  const [selLab, setSelLab] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({nome:"",categoria:"",quantidade:0,unidade:"un",quantidade_minima:0,localizacao:"",observacoes:""});
  const [search, setSearch] = useState("");

  useEffect(()=>{
    sb.from("laboratorios").select("*").eq("area",area==="geral"?"engenharia":area).then(({data})=>{ setLabs(data||[]); if(data?.length>0)setSelLab(data[0].id); });
  },[area]);

  useEffect(()=>{
    if(!selLab) return;
    sb.from("inventario").select("*").eq("laboratorio_id",selLab).then(({data})=>setItems(data||[]));
  },[selLab]);

  async function saveItem() {
    if(!form.nome.trim()||!selLab) return;
    const payload={...form,laboratorio_id:selLab,quantidade:Number(form.quantidade),quantidade_minima:Number(form.quantidade_minima)};
    if(modal==="new"){
      const{data,error}=await sb.from("inventario").insert(payload).select().single();
      if(!error){setItems(p=>[...p,data]);toast("Item adicionado","ok");}
    } else {
      const{data,error}=await sb.from("inventario").update(payload).eq("id",modal).select().single();
      if(!error){setItems(p=>p.map(i=>i.id===modal?data:i));toast("Item atualizado","ok");}
    }
    setModal(null);
  }

  async function deleteItem(id) {
    await sb.from("inventario").delete().eq("id",id);
    setItems(p=>p.filter(i=>i.id!==id));
    toast("Item removido","info");
  }

  const filtered = items.filter(i=>!search||i.nome.toLowerCase().includes(search.toLowerCase())||i.categoria?.toLowerCase().includes(search.toLowerCase()));
  const baixoEstoque = filtered.filter(i=>i.quantidade<=i.quantidade_minima);
  const inputS={width:"100%",padding:"8px 12px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text,fontSize:13,boxSizing:"border-box",fontFamily:"inherit"};

  return (
    <div>
      {/* labs */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {labs.map(l=>(
          <button key={l.id} onClick={()=>setSelLab(l.id)} style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${selLab===l.id?AREA_COLORS[area]:t.border}`,background:selLab===l.id?`${AREA_COLORS[area]}15`:t.surface,color:selLab===l.id?AREA_COLORS[area]:t.text2,fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {l.nome}
          </button>
        ))}
      </div>

      {selLab&&(
        <>
          {baixoEstoque.length>0&&(
            <div style={{background:"#ef444415",border:"1px solid #ef444430",borderRadius:12,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#ef4444",fontWeight:600}}>
              ⚠️ {baixoEstoque.length} item{baixoEstoque.length!==1?"ns":""} com estoque baixo ou zerado
            </div>
          )}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou categoria…" style={{...inputS,flex:1}}/>
            <button onClick={()=>{setForm({nome:"",categoria:"",quantidade:0,unidade:"un",quantidade_minima:0,localizacao:"",observacoes:""});setModal("new")}} style={{padding:"8px 18px",borderRadius:10,border:"none",background:t.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ Adicionar item</button>
          </div>

          <div style={{background:t.surface,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",padding:"10px 16px",borderBottom:`1px solid ${t.border}`,fontSize:11,fontWeight:700,color:t.text3,letterSpacing:.6,textTransform:"uppercase"}}>
              <span>Item</span><span>Categoria</span><span>Qtd</span><span>Mín.</span><span>Local</span><span></span>
            </div>
            {filtered.length===0&&<div style={{padding:"24px",textAlign:"center",color:t.text3,fontSize:13}}>Nenhum item cadastrado</div>}
            {filtered.map(item=>{
              const low=item.quantidade<=item.quantidade_minima;
              return (
                <div key={item.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",padding:"12px 16px",borderBottom:`1px solid ${t.border}`,alignItems:"center",background:low?`#ef444408`:undefined}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:t.text}}>{item.nome}</div>
                    {item.observacoes&&<div style={{fontSize:11,color:t.text3}}>{item.observacoes}</div>}
                  </div>
                  <span style={{fontSize:12,color:t.text2}}>{item.categoria||"—"}</span>
                  <span style={{fontSize:13,fontWeight:700,color:low?"#ef4444":"#10b981"}}>{item.quantidade} {item.unidade}</span>
                  <span style={{fontSize:12,color:t.text3}}>{item.quantidade_minima} {item.unidade}</span>
                  <span style={{fontSize:12,color:t.text2}}>{item.localizacao||"—"}</span>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>{setForm({nome:item.nome,categoria:item.categoria||"",quantidade:item.quantidade,unidade:item.unidade,quantidade_minima:item.quantidade_minima,localizacao:item.localizacao||"",observacoes:item.observacoes||""});setModal(item.id)}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:14}}>✏️</button>
                    <button onClick={()=>deleteItem(item.id)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"#0009",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{background:t.surface,borderRadius:16,padding:26,width:420,border:`1px solid ${t.border}`}}>
            <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:18}}>{modal==="new"?"➕ Novo item":"✏️ Editar item"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["Nome","nome","text"],["Categoria","categoria","text"],["Localização","localizacao","text"],["Observações","observacoes","text"]].map(([l,k])=>(
                <div key={k} style={{gridColumn:k==="nome"||k==="observacoes"?"1/-1":undefined}}>
                  <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>{l}</div>
                  <input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={inputS}/>
                </div>
              ))}
              {[["Quantidade","quantidade"],["Qtd Mínima","quantidade_minima"]].map(([l,k])=>(
                <div key={k}>
                  <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>{l}</div>
                  <input type="number" value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={inputS}/>
                </div>
              ))}
              <div>
                <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>Unidade</div>
                <select value={form.unidade} onChange={e=>setForm(p=>({...p,unidade:e.target.value}))} style={{...inputS,width:"100%"}}>
                  {["un","kg","g","ml","L","caixa","pacote","rolo","par"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button onClick={()=>setModal(null)} style={{flex:1,padding:"9px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text2,cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={saveItem} style={{flex:2,padding:"9px",borderRadius:10,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── LISTA DE COMPRAS ────────────────────────────────────────────────────── */
function ComprasView({ area, t, toast }) {
  const [labs, setLabs] = useState([]);
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({item:"",quantidade:"",unidade:"un",urgencia:"normal",laboratorio_id:"",observacoes:""});

  useEffect(()=>{
    const q = area==="geral"?sb.from("laboratorios").select("*"):sb.from("laboratorios").select("*").eq("area",area);
    q.then(({data})=>setLabs(data||[]));
    const q2 = area==="geral"?sb.from("lista_compras").select("*,laboratorios(nome)").neq("status","cancelado"):sb.from("lista_compras").select("*,laboratorios(nome)").eq("area",area).neq("status","cancelado");
    q2.then(({data})=>setItems(data||[]));
  },[area]);

  async function saveItem() {
    if(!form.item.trim()) return;
    const payload={...form,area:area==="geral"?"geral":area,quantidade:Number(form.quantidade)||null,laboratorio_id:form.laboratorio_id||null};
    if(modal==="new"){
      const{data,error}=await sb.from("lista_compras").insert(payload).select("*,laboratorios(nome)").single();
      if(!error){setItems(p=>[...p,data]);toast("Item adicionado","ok");}
    } else {
      const{data,error}=await sb.from("lista_compras").update(payload).eq("id",modal).select("*,laboratorios(nome)").single();
      if(!error){setItems(p=>p.map(i=>i.id===modal?data:i));toast("Item atualizado","ok");}
    }
    setModal(null);
  }

  async function toggleStatus(item) {
    const newStatus=item.status==="pendente"?"comprado":"pendente";
    const{data}=await sb.from("lista_compras").update({status:newStatus}).eq("id",item.id).select("*,laboratorios(nome)").single();
    if(data) setItems(p=>p.map(i=>i.id===item.id?data:i));
  }

  const urg={urgente:"#ef4444",normal:"#f59e0b",baixa:"#10b981"};
  const pendentes=items.filter(i=>i.status==="pendente");
  const comprados=items.filter(i=>i.status==="comprado");
  const inputS={width:"100%",padding:"8px 12px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text,fontSize:13,boxSizing:"border-box",fontFamily:"inherit"};

  const ItemRow = ({item})=>(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:`1px solid ${t.border}`,opacity:item.status==="comprado"?.6:1}}>
      <input type="checkbox" checked={item.status==="comprado"} onChange={()=>toggleStatus(item)} style={{width:16,height:16,cursor:"pointer",accentColor:t.accent}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:t.text,textDecoration:item.status==="comprado"?"line-through":"none"}}>{item.item}</div>
        <div style={{fontSize:11,color:t.text3}}>{item.laboratorios?.nome||"Geral"}{item.quantidade?` · ${item.quantidade} ${item.unidade}`:""}</div>
      </div>
      <span style={{background:`${urg[item.urgencia]}18`,color:urg[item.urgencia],borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{item.urgencia}</span>
      <button onClick={()=>{setForm({item:item.item,quantidade:item.quantidade||"",unidade:item.unidade,urgencia:item.urgencia,laboratorio_id:item.laboratorio_id||"",observacoes:item.observacoes||""});setModal(item.id)}} style={{background:"none",border:"none",color:t.text3,cursor:"pointer",fontSize:13}}>✏️</button>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{display:"flex",gap:12}}>
          <div style={{background:t.surface,borderRadius:12,padding:"10px 18px",border:`1px solid ${t.border}`,textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:800,color:"#f59e0b"}}>{pendentes.length}</div>
            <div style={{fontSize:11,color:t.text3}}>pendentes</div>
          </div>
          <div style={{background:t.surface,borderRadius:12,padding:"10px 18px",border:`1px solid ${t.border}`,textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:800,color:"#10b981"}}>{comprados.length}</div>
            <div style={{fontSize:11,color:t.text3}}>comprados</div>
          </div>
        </div>
        <button onClick={()=>{setForm({item:"",quantidade:"",unidade:"un",urgencia:"normal",laboratorio_id:"",observacoes:""});setModal("new")}} style={{padding:"9px 20px",borderRadius:10,border:"none",background:t.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Adicionar item</button>
      </div>

      {items.filter(i=>i.urgencia==="urgente"&&i.status==="pendente").length>0&&(
        <div style={{background:"#ef444415",border:"1px solid #ef444430",borderRadius:12,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#ef4444",fontWeight:600}}>
          🚨 {items.filter(i=>i.urgencia==="urgente"&&i.status==="pendente").length} item(ns) urgente(s) pendentes
        </div>
      )}

      <div style={{background:t.surface,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden"}}>
        {pendentes.length===0&&comprados.length===0&&<div style={{padding:24,textAlign:"center",color:t.text3,fontSize:13}}>Lista vazia</div>}
        {pendentes.map(i=><ItemRow key={i.id} item={i}/>)}
        {comprados.length>0&&(
          <>
            <div style={{padding:"8px 16px",background:t.surface2,fontSize:11,fontWeight:700,color:t.text3,letterSpacing:.6,textTransform:"uppercase"}}>Comprados</div>
            {comprados.map(i=><ItemRow key={i.id} item={i}/>)}
          </>
        )}
      </div>

      {modal&&(
        <div style={{position:"fixed",inset:0,background:"#0009",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
          <div style={{background:t.surface,borderRadius:16,padding:26,width:400,border:`1px solid ${t.border}`}}>
            <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:18}}>{modal==="new"?"➕ Novo item":"✏️ Editar item"}</div>
            {[["Item","item"],["Observações","observacoes"]].map(([l,k])=>(
              <div key={k} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>{l}</div>
                <input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={inputS}/>
              </div>
            ))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>Qtd</div>
                <input type="number" value={form.quantidade} onChange={e=>setForm(p=>({...p,quantidade:e.target.value}))} style={inputS}/>
              </div>
              <div>
                <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>Unidade</div>
                <select value={form.unidade} onChange={e=>setForm(p=>({...p,unidade:e.target.value}))} style={{...inputS,width:"100%"}}>
                  {["un","kg","g","ml","L","caixa","pacote","rolo"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>Urgência</div>
                <select value={form.urgencia} onChange={e=>setForm(p=>({...p,urgencia:e.target.value}))} style={{...inputS,width:"100%"}}>
                  <option value="urgente">Urgente</option>
                  <option value="normal">Normal</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:t.text3,marginBottom:4,fontWeight:600}}>Laboratório</div>
              <select value={form.laboratorio_id} onChange={e=>setForm(p=>({...p,laboratorio_id:e.target.value}))} style={{...inputS,width:"100%"}}>
                <option value="">— Geral —</option>
                {labs.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setModal(null)} style={{flex:1,padding:"9px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text2,cursor:"pointer",fontSize:13}}>Cancelar</button>
              <button onClick={saveItem} style={{flex:2,padding:"9px",borderRadius:10,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── HELPERS UI ─────────────────────────────────────────────────────────── */
function SectionTitle({ label, count, color, t }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
      <div style={{width:3,height:18,borderRadius:2,background:color||t.accent}}/>
      <span style={{fontSize:13,fontWeight:700,color:t.text,letterSpacing:.6,textTransform:"uppercase"}}>{label}</span>
      {count!=null&&<div style={{padding:"2px 9px",borderRadius:20,background:`${color||t.accent}20`,color:color||t.accent,fontSize:11,fontWeight:700}}>{count}</div>}
    </div>
  );
}
function EmptyState({ msg, t }) {
  return <div style={{textAlign:"center",padding:"32px",color:t.text3,fontSize:13}}>{msg}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [dark, setDark] = useState(true);
  const [areaFilter, setAreaFilter] = useState("geral");
  const [view, setView] = useState("dashboard");
  const [discs, setDiscs] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToastMsg] = useState(null);
  const t = dark ? THEMES.dark : THEMES.light;

  const showToast = useCallback((msg, type="info") => setToastMsg({msg,type,id:Date.now()}), []);

  async function loadAll() {
    const [d,tt,a,tk] = await Promise.all([
      sb.from("disciplinas").select("*"),
      sb.from("turmas").select("*"),
      sb.from("aulas").select("*"),
      sb.from("kanban_tasks").select("*"),
    ]);
    setDiscs(d.data||[]); setTurmas(tt.data||[]); setAulas(a.data||[]); setTasks(tk.data||[]);
    setLoading(false);
  }

  useEffect(()=>{ loadAll(); },[]);

  const AREA_NAV = [
    {id:"geral",label:"Geral",color:"#8b5cf6"},
    {id:"engenharia",label:"Engenharia",color:"#3b82f6"},
    {id:"saude",label:"Saúde",color:"#10b981"},
  ];

  const BASE_NAV = [
    {id:"dashboard",label:"Dashboard",icon:"▦"},
    {id:"calendario",label:"Calendário",icon:"◫"},
    {id:"disciplinas",label:"Disciplinas",icon:"◈"},
    {id:"importar",label:"Importar",icon:"⊕"},
    {id:"inventario",label:"Inventário",icon:"📦"},
    {id:"compras",label:"Lista de Compras",icon:"🛒"},
  ];

  // kanban mostra por área
  const KANBAN_NAV = areaFilter!=="geral"
    ? [{id:`kanban_${areaFilter}`,label:`Kanban ${AREA_LABELS[areaFilter]}`,icon:"🗂"}]
    : [{id:"kanban_engenharia",label:"Kanban Eng.",icon:"🔧"},{id:"kanban_saude",label:"Kanban Saúde",icon:"🏥"}];

  const ALL_NAV = [...BASE_NAV, ...KANBAN_NAV];
  const curArea = view.startsWith("kanban_") ? view.replace("kanban_","") : areaFilter;

  const PAGE_LABELS = {
    dashboard:"Dashboard",calendario:"Calendário",disciplinas:"Disciplinas",
    importar:"Importar planilha",inventario:"Inventário",compras:"Lista de Compras",
    kanban_engenharia:"Kanban — Engenharia",kanban_saude:"Kanban — Saúde",
  };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:t.bg,fontFamily:"'DM Sans','Segoe UI',sans-serif",color:t.text,transition:"background .2s"}}>
      {/* SIDEBAR */}
      <aside style={{width:216,background:t.sidebar,borderRight:`1px solid ${t.border}`,display:"flex",flexDirection:"column",padding:0,flexShrink:0,position:"sticky",top:0,height:"100vh"}}>
        {/* logo */}
        <div style={{padding:"22px 18px 18px",borderBottom:`1px solid ${t.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:900,color:"#fff",flexShrink:0}}>U</div>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:t.text,letterSpacing:-.3}}>UNOPAR Labs</div>
              <div style={{fontSize:9,color:t.text3,letterSpacing:1,textTransform:"uppercase"}}>Aulas Práticas</div>
            </div>
          </div>
        </div>

        {/* filtro de área */}
        <div style={{padding:"12px 10px 6px"}}>
          <div style={{fontSize:9,fontWeight:700,color:t.text3,letterSpacing:1.2,textTransform:"uppercase",padding:"0 8px",marginBottom:6}}>Área</div>
          {AREA_NAV.map(a=>(
            <button key={a.id} onClick={()=>setAreaFilter(a.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:10,border:"none",background:areaFilter===a.id?`${a.color}18`:"transparent",color:areaFilter===a.id?a.color:t.text3,fontSize:12,fontWeight:areaFilter===a.id?700:400,cursor:"pointer",textAlign:"left",marginBottom:2,transition:"all .15s"}}>
              <div style={{width:8,height:8,borderRadius:4,background:a.color,flexShrink:0}}/>
              {a.label}
            </button>
          ))}
        </div>

        {/* nav */}
        <nav style={{padding:"8px 10px",flex:1,overflowY:"auto"}}>
          <div style={{fontSize:9,fontWeight:700,color:t.text3,letterSpacing:1.2,textTransform:"uppercase",padding:"0 8px",marginBottom:6,marginTop:8}}>Menu</div>
          {ALL_NAV.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:10,border:"none",background:view===n.id?`${t.accent}18`:"transparent",color:view===n.id?t.accent:t.text2,fontSize:12,fontWeight:view===n.id?600:400,cursor:"pointer",textAlign:"left",marginBottom:2,transition:"all .15s"}}>
              <span style={{fontSize:15,opacity:.85,flexShrink:0}}>{n.icon}</span>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.label}</span>
            </button>
          ))}
        </nav>

        {/* footer */}
        <div style={{padding:"14px 14px",borderTop:`1px solid ${t.border}`}}>
          <button onClick={()=>setDark(d=>!d)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"8px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.text2,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>
            {dark?"☀ Modo Claro":"🌙 Modo Escuro"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{flex:1,padding:"28px 30px",overflowY:"auto"}}>
        <div style={{maxWidth:980,margin:"0 auto"}}>
          {/* header */}
          <div style={{marginBottom:22,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <h1 style={{fontSize:21,fontWeight:800,color:t.text,margin:0,letterSpacing:-.5}}>{PAGE_LABELS[view]||view}</h1>
              <p style={{fontSize:12,color:t.text3,margin:"3px 0 0"}}>
                {areaFilter!=="geral"&&<><span style={{color:AREA_COLORS[areaFilter],fontWeight:600}}>{AREA_LABELS[areaFilter]}</span> · </>}
                {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}
              </p>
            </div>
          </div>

          {loading
            ? <div style={{textAlign:"center",padding:"60px 0",color:t.text3}}>⏳ Carregando dados do Supabase…</div>
            : <>
              {view==="dashboard"   && <Dashboard discs={discs} turmas={turmas} aulas={aulas} areaFilter={areaFilter} t={t}/>}
              {view==="calendario"  && <CalendarioView turmas={turmas} aulas={aulas} discs={discs} areaFilter={areaFilter} t={t}/>}
              {view==="disciplinas" && <DisciplinasView discs={discs} setDiscs={setDiscs} turmas={turmas} aulas={aulas} areaFilter={areaFilter} t={t} toast={showToast}/>}
              {view==="importar"    && <ImportarView onImported={loadAll} t={t} toast={showToast}/>}
              {view==="inventario"  && <InventarioView area={areaFilter==="geral"?"engenharia":areaFilter} t={t} toast={showToast}/>}
              {view==="compras"     && <ComprasView area={areaFilter} t={t} toast={showToast}/>}
              {view==="kanban_engenharia" && <KanbanView tasks={tasks} setTasks={setTasks} area="engenharia" t={t} toast={showToast}/>}
              {view==="kanban_saude"      && <KanbanView tasks={tasks} setTasks={setTasks} area="saude" t={t} toast={showToast}/>}
            </>
          }
        </div>
      </main>

      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToastMsg(null)}/>}
    </div>
  );
}
