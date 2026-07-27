import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, Wallet, HeartHandshake, Syringe, Package, Stethoscope,
  Receipt, Users, Megaphone, FlaskConical, Plus, Pencil, Trash2, X,
  AlertTriangle, TrendingUp, TrendingDown, Activity, Building2,
  CalendarDays, Sparkles, ChevronDown, LogOut, Loader2, Lock,
} from "lucide-react";

/* ============================== SUPABASE (REST direto, sem SDK) ============================== */
const SUPABASE_URL = "https://xzvxoytjuaisrqpchrnn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dnhveXRqdWFpc3JxcGNocm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMTk1NDAsImV4cCI6MjEwMDY5NTU0MH0.EXS0U9xsQNB_ZTd7BkVt4HMzuIMXKiGZf1E1Fw9AjEk";

async function sbRest(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token || ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}
async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || "Falha na autenticação");
  return data;
}

/* ============================== TOKENS VISUAIS ============================== */
const T = {
  ink: "#132030", inkSoft: "#1E3040", canvas: "#F7F4EC", card: "#FFFFFF",
  border: "#E7E2D6", text: "#1B2733", muted: "#71818C",
  coral: "#E1704F", coralDeep: "#C4553A", teal: "#2E7D74", tealDeep: "#215B54",
  amber: "#C98A2E", amberDeep: "#A66E1F", purple: "#7C5C8A", purpleDeep: "#61446E",
  rose: "#C4527A", roseDeep: "#9E3E60", green: "#3E8F63", red: "#C24A3B",
};
const PALETTES = { coral: T.coral, teal: T.teal, amber: T.amber, purple: T.purple, rose: T.rose, ink: T.ink, green: T.green, red: T.red };
const CHART_SET = [T.coral, T.teal, T.amber, T.purple, T.rose, T.tealDeep, T.coralDeep];
const CONVENIOS = ["Bradesco Saúde", "Unimed", "IPSM", "AMMP", "Orizon", "Sancoop", "Particular"];

const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const fmtPct = (v) => `${(Number(v) || 0).toFixed(0)}%`;
const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d + "T00:00:00"); return isNaN(dt) ? d : dt.toLocaleDateString("pt-BR"); };
const monthKey = (d) => (d || "").slice(0, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const weekdayLong = () => new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const monthToDate = (m) => (m && m.length === 7 ? `${m}-01` : m || todayISO().slice(0, 7) + "-01");

const DRE_LINHAS_RECEITA = ["Receita de Convênios", "Receita Particular", "Receita de Vacinas", "Outras Receitas"];
const DRE_LINHAS_CUSTO = ["Custos com Insumos", "Custos com Serviços Médicos"];
const DRE_LINHAS_DESPESA = ["Despesas com Pessoal", "Despesas Administrativas", "Despesas com Marketing", "Outras Despesas"];
const DRE_LINHAS_IMPOSTO = ["Impostos"];
const TODAS_LINHAS_DRE = [...DRE_LINHAS_RECEITA, ...DRE_LINHAS_CUSTO, ...DRE_LINHAS_DESPESA, ...DRE_LINHAS_IMPOSTO];

/* ============================== MAPEAMENTO POR MÓDULO (app <-> banco) ============================== */
const MODULES = {
  financeiro: { table: "financeiro_transacoes", order: "data.desc",
    toDb: (r) => ({ data: r.data, tipo: r.tipo, linha_dre: r.linha, descricao: r.descricao, valor: r.valor }),
    fromDb: (r) => ({ id: r.id, data: r.data, tipo: r.tipo, linha: r.linha_dre, descricao: r.descricao, valor: r.valor }) },
  convenios: { table: "atendimentos_convenio", order: "data.desc",
    toDb: (r) => ({ data: r.data, convenio: r.convenio, quantidade: r.quantidade, valor: r.valor }),
    fromDb: (r) => ({ id: r.id, data: r.data, convenio: r.convenio, quantidade: r.quantidade, valor: r.valor }) },
  vacinas: { table: "estoque_vacinas", order: "nome.asc",
    toDb: (r) => ({ nome: r.nome, qtd_estoque: r.qtdEstoque, qtd_vendida_mes: r.qtdVendidaMes, qtd_minima: r.qtdMinima, valor_compra: r.valorCompra, valor_venda: r.valorVenda }),
    fromDb: (r) => ({ id: r.id, nome: r.nome, qtdEstoque: r.qtd_estoque, qtdVendidaMes: r.qtd_vendida_mes, qtdMinima: r.qtd_minima, valorCompra: r.valor_compra, valorVenda: r.valor_venda }) },
  insumos: { table: "estoque_insumos", order: "nome.asc",
    toDb: (r) => ({ nome: r.nome, categoria: r.categoria, qtd: r.qtd, qtd_minima: r.qtdMinima, unidade_medida: r.unidade, valor_unitario: r.valorUnitario }),
    fromDb: (r) => ({ id: r.id, nome: r.nome, categoria: r.categoria, qtd: r.qtd, qtdMinima: r.qtd_minima, unidade: r.unidade_medida, valorUnitario: r.valor_unitario }) },
  producao: { table: "producao_medica", order: "mes.desc",
    toDb: (r) => ({ profissional: r.profissional, mes: monthToDate(r.mes), atendimentos: r.atendimentos, receita: r.receita, custo: r.custo }),
    fromDb: (r) => ({ id: r.id, profissional: r.profissional, mes: monthKey(r.mes), atendimentos: r.atendimentos, receita: r.receita, custo: r.custo }) },
  contas: { table: "contas_pagar", order: "vencimento.asc",
    toDb: (r) => ({ descricao: r.descricao, categoria: r.categoria, valor: r.valor, vencimento: r.vencimento, status: r.status, data_pagamento: r.dataPagamento || null }),
    fromDb: (r) => ({ id: r.id, descricao: r.descricao, categoria: r.categoria, valor: r.valor, vencimento: r.vencimento, status: r.status, dataPagamento: r.data_pagamento }) },
  pessoal: { table: "departamento_pessoal", order: "mes.desc",
    toDb: (r) => ({ nome: r.nome, cargo: r.cargo, equipe: r.equipe, mes: monthToDate(r.mes || todayISO().slice(0, 7)), meta_mensal: r.metaMensal, ligacoes: r.ligacoes, mensagens: r.mensagens, agendados: r.agendados }),
    fromDb: (r) => ({ id: r.id, nome: r.nome, cargo: r.cargo, equipe: r.equipe, mes: monthKey(r.mes), metaMensal: r.meta_mensal, ligacoes: r.ligacoes, mensagens: r.mensagens, agendados: r.agendados }) },
  marketing: { table: "marketing_leads", order: "data.desc",
    toDb: (r) => ({ data: r.data, nome: r.nome, canal: r.canal, status: r.status }),
    fromDb: (r) => ({ id: r.id, data: r.data, nome: r.nome, canal: r.canal, status: r.status }) },
  procedimentos: { table: "procedimentos_especiais", order: "data.desc",
    toDb: (r) => ({ tipo: r.tipo, paciente: r.paciente, data: r.data, status: r.status, valor: r.valor }),
    fromDb: (r) => ({ id: r.id, tipo: r.tipo, paciente: r.paciente, data: r.data, status: r.status, valor: r.valor }) },
};

/* ============================== CONTEXTOS ============================== */
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const UnidadeContext = createContext(null);
const useUnidade = () => useContext(UnidadeContext);

/* ============================== PRIMITIVOS VISUAIS ============================== */
function IconChip({ icon: Icon, tone = "ink", size = 18, box = 38 }) {
  const color = PALETTES[tone] || T.ink;
  return <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: box, height: box, background: `${color}17` }}><Icon size={size} style={{ color }} /></div>;
}
function KpiCard({ label, value, sub, tone = "ink", icon: Icon }) {
  const color = PALETTES[tone] || T.ink;
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-w-0 shadow-sm hover:shadow-md transition-shadow" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase" style={{ color: T.muted, letterSpacing: "0.07em" }}>{label}</span>
        {Icon ? <IconChip icon={Icon} tone={tone} size={13} box={26} /> : null}
      </div>
      <span className="text-2xl font-bold truncate" style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
      {sub ? <span className="text-xs font-medium" style={{ color }}>{sub}</span> : null}
    </div>
  );
}
function SectionHeader({ icon, title, subtitle, tone = "ink" }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <IconChip icon={icon} tone={tone} size={20} box={46} />
      <div><h2 className="text-xl font-bold leading-tight" style={{ color: T.text, fontFamily: "'Sora', sans-serif" }}>{title}</h2><p className="text-sm" style={{ color: T.muted }}>{subtitle}</p></div>
    </div>
  );
}
function Card({ children, className = "", style = {} }) {
  return <div className={`rounded-2xl p-5 shadow-sm ${className}`} style={{ background: T.card, border: `1px solid ${T.border}`, ...style }}>{children}</div>;
}
function Btn({ children, onClick, variant = "primary", icon: Icon, small, tone = "ink", disabled }) {
  const color = PALETTES[tone] || T.ink;
  const styles = {
    primary: { background: color, color: "#fff", opacity: disabled ? 0.6 : 1 },
    ghost: { background: "transparent", color: T.text, border: `1px solid ${T.border}` },
    danger: { background: "transparent", color: T.red, border: `1px solid ${T.red}44` },
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0 ${small ? "px-2.5 py-1.5 text-xs" : "px-4 py-2.5 text-sm"}`} style={styles[variant]}>
      {Icon ? <Icon size={small ? 13 : 15} /> : null}{children}
    </button>
  );
}
function Progress({ pct, tone }) {
  const color = tone || (pct >= 100 ? T.green : pct >= 70 ? T.amber : T.red);
  return <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} /></div>;
}
function Badge({ children, tone = "muted" }) {
  const map = {
    green: { bg: `${T.green}18`, color: T.green }, amber: { bg: `${T.amber}18`, color: T.amberDeep },
    red: { bg: `${T.red}18`, color: T.red }, ink: { bg: `${T.ink}12`, color: T.ink },
    muted: { bg: `${T.muted}14`, color: T.muted }, coral: { bg: `${T.coral}18`, color: T.coralDeep },
    teal: { bg: `${T.teal}18`, color: T.tealDeep }, purple: { bg: `${T.purple}18`, color: T.purpleDeep },
  };
  const s = map[tone] || map.muted;
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>{children}</span>;
}
function Field({ label, children }) {
  return <label className="flex flex-col gap-1 flex-1 min-w-[140px]"><span className="text-[11px] font-semibold uppercase" style={{ color: T.muted, letterSpacing: "0.05em" }}>{label}</span>{children}</label>;
}
const inputStyle = { border: `1px solid ${T.border}`, color: T.text, background: "#FBFAF6" };
function FieldInput({ f, value, onChange }) {
  if (f.type === "select") {
    return (
      <select className="rounded-lg px-3 py-2 text-sm outline-none w-full" style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Selecione…</option>
        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return <input type={f.type === "currency" ? "number" : f.type} step={f.type === "currency" || f.type === "number" ? "0.01" : undefined}
    className="rounded-lg px-3 py-2 text-sm outline-none w-full" style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder || ""} />;
}

/* ============================== LOGIN ============================== */
function LoginScreen() {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const [nome, setNome] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      if (mode === "login") await login(email, senha);
      else { await signUp(email, senha, nome); setMsg({ tone: "green", text: "Conta criada! Se seu projeto exigir confirmação por e-mail, verifique sua caixa de entrada antes de entrar." }); setMode("login"); }
    } catch (e) { setMsg({ tone: "red", text: e.message }); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${T.ink}, ${T.tealDeep})` }}>
      <div className="w-full max-w-sm rounded-2xl p-7" style={{ background: T.card }}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.coral}, ${T.coralDeep})` }}><HeartHandshake size={19} color="#fff" /></div>
          <div><div className="font-bold" style={{ color: T.text, fontFamily: "'Sora', sans-serif" }}>Olhar de Mãe</div><div className="text-xs" style={{ color: T.muted }}>Painel de Gestão da Rede</div></div>
        </div>
        <div className="flex gap-2 mb-5">
          <button onClick={() => setMode("login")} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: mode === "login" ? T.ink : "#F1EEE4", color: mode === "login" ? "#fff" : T.muted }}>Entrar</button>
          <button onClick={() => setMode("signup")} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: mode === "signup" ? T.ink : "#F1EEE4", color: mode === "signup" ? "#fff" : T.muted }}>Criar conta</button>
        </div>
        <div className="flex flex-col gap-3">
          {mode === "signup" && <Field label="Seu nome"><input className="rounded-lg px-3 py-2 text-sm outline-none w-full" style={inputStyle} value={nome} onChange={(e) => setNome(e.target.value)} /></Field>}
          <Field label="E-mail"><input type="email" className="rounded-lg px-3 py-2 text-sm outline-none w-full" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Senha"><input type="password" className="rounded-lg px-3 py-2 text-sm outline-none w-full" style={inputStyle} value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
          {msg && <div className="text-sm" style={{ color: msg.tone === "red" ? T.red : T.green }}>{msg.text}</div>}
          <Btn onClick={submit} disabled={busy || !email || !senha}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} {mode === "login" ? "Entrar" : "Criar minha conta"}</Btn>
        </div>
        <p className="text-xs mt-5" style={{ color: T.muted }}>Cada colaborador acessa com seu próprio e-mail. No primeiro acesso, você vai preencher seu nome e cargo.</p>
      </div>
    </div>
  );
}

function OnboardingPerfil({ onDone }) {
  const { session, unidadesIniciais } = useAuth();
  const [nome, setNome] = useState(""); const [cargo, setCargo] = useState(""); const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null);
  const salvar = async () => {
    setBusy(true); setErro(null);
    try {
      const unidadePadrao = unidadesIniciais[0];
      await sbRest("perfis", { method: "POST", token: session.access_token, body: { id: session.user.id, nome, cargo, unidade_id: unidadePadrao ? unidadePadrao.id : null, papel: "colaborador" } });
      onDone();
    } catch (e) { setErro(e.message); }
    setBusy(false);
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.canvas }}>
      <Card className="w-full max-w-sm">
        <p className="font-bold mb-1" style={{ color: T.text, fontFamily: "'Sora', sans-serif" }}>Complete seu perfil</p>
        <p className="text-sm mb-4" style={{ color: T.muted }}>Só precisamos disso uma vez.</p>
        <div className="flex flex-col gap-3">
          <Field label="Seu nome"><input className="rounded-lg px-3 py-2 text-sm outline-none w-full" style={inputStyle} value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="Cargo"><input className="rounded-lg px-3 py-2 text-sm outline-none w-full" style={inputStyle} value={cargo} onChange={(e) => setCargo(e.target.value)} /></Field>
          {erro && <div className="text-sm" style={{ color: T.red }}>{erro}</div>}
          <Btn onClick={salvar} disabled={busy || !nome}>{busy ? <Loader2 size={14} className="animate-spin" /> : null} Concluir</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================== FORMULÁRIO DIÁRIO / EDIÇÃO ============================== */
function DailyEntryPanel({ tone, fields, onSubmit, cta = "Registrar lançamento" }) {
  const blank = () => { const b = {}; fields.forEach((f) => { b[f.key] = f.default !== undefined ? f.default : ""; }); return b; };
  const [form, setForm] = useState(blank()); const [busy, setBusy] = useState(false);
  const color = PALETTES[tone] || T.ink;
  return (
    <div className="rounded-2xl p-5 mb-6" style={{ background: `linear-gradient(135deg, ${color}10, ${color}05)`, border: `1px solid ${color}30` }}>
      <div className="flex items-center gap-2 mb-3.5">
        <CalendarDays size={15} style={{ color }} /><span className="text-sm font-bold" style={{ color: T.text, fontFamily: "'Sora', sans-serif" }}>Lançamento de hoje</span>
        <span className="text-xs" style={{ color: T.muted }}>— preencha aqui diariamente</span>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        {fields.map((f) => <Field key={f.key} label={f.label}><FieldInput f={f} value={form[f.key]} onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))} /></Field>)}
        <Btn tone={tone} icon={busy ? undefined : Plus} disabled={busy} onClick={async () => {
          const missing = fields.some((f) => f.required !== false && (form[f.key] === "" || form[f.key] === undefined));
          if (missing) return;
          setBusy(true); await onSubmit(form); setForm(blank()); setBusy(false);
        }}>{busy ? <Loader2 size={14} className="animate-spin" /> : null} {cta}</Btn>
      </div>
    </div>
  );
}
function EditModal({ title, fields, initial, onSave, onClose }) {
  const [form, setForm] = useState(() => { const base = {}; fields.forEach((f) => { base[f.key] = initial[f.key] ?? ""; }); return base; });
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#13203099" }} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" style={{ background: T.card }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <h3 className="font-bold" style={{ color: T.text, fontFamily: "'Sora', sans-serif" }}>{title}</h3><button onClick={onClose}><X size={18} style={{ color: T.muted }} /></button>
        </div>
        <div className="p-5 flex flex-col gap-3.5">{fields.map((f) => <Field key={f.key} label={f.label}><FieldInput f={f} value={form[f.key]} onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))} /></Field>)}</div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.border}` }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={busy} onClick={async () => { setBusy(true); await onSave(form); setBusy(false); }}>{busy ? <Loader2 size={14} className="animate-spin" /> : null} Salvar alterações</Btn>
        </div>
      </div>
    </div>
  );
}
function RecordsTable({ columns, rows, onEdit, onDelete }) {
  if (!rows.length) return <div className="text-center py-10 text-sm" style={{ color: T.muted }}>Nenhum registro ainda. Use o lançamento de hoje, acima, para começar.</div>;
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm min-w-[640px]">
        <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{columns.map((c) => <th key={c.key} className="text-left py-2 px-2 font-semibold text-[11px] uppercase" style={{ color: T.muted }}>{c.label}</th>)}<th className="w-16"></th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{ borderBottom: `1px solid ${T.border}` }} className="hover:bg-black/[0.02]">
              {columns.map((c) => <td key={c.key} className="py-2.5 px-2" style={{ color: T.text }}>{c.render ? c.render(row) : row[c.key]}</td>)}
              <td className="py-2.5 px-2"><div className="flex items-center gap-2.5 justify-end"><button onClick={() => onEdit(row)}><Pencil size={13} style={{ color: T.muted }} /></button><button onClick={() => onDelete(row)}><Trash2 size={13} style={{ color: T.red }} /></button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Hook: CRUD real no Supabase, isolado pela unidade selecionada */
function useRecords(moduleKey) {
  const { session } = useAuth();
  const { unidadeId } = useUnidade();
  const cfg = MODULES[moduleKey];
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const reload = useCallback(async () => {
    if (!unidadeId) return;
    setLoading(true); setErro(null);
    try {
      const rows = await sbRest(`${cfg.table}?unidade_id=eq.${unidadeId}&select=*&order=${cfg.order}`, { token: session.access_token });
      setData((rows || []).map(cfg.fromDb));
    } catch (e) { setErro(e.message); }
    setLoading(false);
  }, [unidadeId, cfg.table]);

  useEffect(() => { reload(); }, [reload]);

  const add = async (record) => {
    try {
      await sbRest(cfg.table, { method: "POST", token: session.access_token, body: { ...cfg.toDb(record), unidade_id: unidadeId } });
      await reload();
    } catch (e) { alert("Não foi possível salvar: " + e.message); }
  };
  const update = async (id, record) => {
    try { await sbRest(`${cfg.table}?id=eq.${id}`, { method: "PATCH", token: session.access_token, body: cfg.toDb(record) }); await reload(); }
    catch (e) { alert("Não foi possível salvar: " + e.message); }
  };
  const remove = async (id) => {
    try { await sbRest(`${cfg.table}?id=eq.${id}`, { method: "DELETE", token: session.access_token }); await reload(); }
    catch (e) { alert("Não foi possível remover: " + e.message); }
  };
  return { data, add, update, remove, loading, erro };
}

function normalizeForm(fields, form) {
  const out = {};
  fields.forEach((f) => { out[f.key] = (f.type === "number" || f.type === "currency") ? Number(form[f.key] || 0) : form[f.key]; });
  return out;
}
function ChartCard({ title, height = 260, children }) {
  return <Card className="mb-5"><p className="text-[11px] font-semibold uppercase mb-3" style={{ color: T.muted, letterSpacing: "0.06em" }}>{title}</p><div style={{ width: "100%", height }}><ResponsiveContainer>{children}</ResponsiveContainer></div></Card>;
}
function ModuleShell({ icon, title, subtitle, tone, dailyFields, dailyCta, fields, columns, rows, onAdd, onUpdate, onDelete, kpis, charts, extra, loading, erro }) {
  const [editing, setEditing] = useState(null);
  return (
    <div>
      <SectionHeader icon={icon} title={title} subtitle={subtitle} tone={tone} />
      {erro && <Card className="mb-5" style={{ borderColor: `${T.red}55` }}><span className="text-sm" style={{ color: T.red }}>Erro ao carregar dados: {erro}</span></Card>}
      {kpis && kpis.length > 0 && <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, minmax(0,1fr))` }}>{kpis.map((k, i) => <KpiCard key={i} {...k} />)}</div>}
      <DailyEntryPanel tone={tone} fields={dailyFields} cta={dailyCta} onSubmit={(form) => onAdd(normalizeForm(fields, form))} />
      {charts}{extra}
      <Card>
        <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: T.muted, letterSpacing: "0.06em" }}>Histórico de registros</p>
        {loading ? <div className="text-center py-10 text-sm" style={{ color: T.muted }}><Loader2 size={16} className="animate-spin inline mr-2" />Carregando…</div> :
          <RecordsTable columns={columns} rows={rows} onEdit={setEditing} onDelete={(r) => { if (confirm("Remover este registro?")) onDelete(r.id); }} />}
      </Card>
      {editing && <EditModal title="Editar registro" fields={fields} initial={editing} onClose={() => setEditing(null)} onSave={async (form) => { await onUpdate(editing.id, normalizeForm(fields, form)); setEditing(null); }} />}
    </div>
  );
}

/* ============================== MÓDULOS ============================== */
function FinanceiroModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("financeiro");
  const fields = [
    { key: "data", label: "Data", type: "date", default: todayISO() },
    { key: "tipo", label: "Tipo", type: "select", options: ["entrada", "saida"] },
    { key: "linha", label: "Linha do DRE", type: "select", options: TODAS_LINHAS_DRE },
    { key: "descricao", label: "Descrição", type: "text" },
    { key: "valor", label: "Valor (R$)", type: "currency" },
  ];
  const columns = [
    { key: "data", label: "Data", render: (r) => fmtDate(r.data) },
    { key: "tipo", label: "Tipo", render: (r) => <Badge tone={r.tipo === "entrada" ? "green" : "red"}>{r.tipo === "entrada" ? "Entrada" : "Saída"}</Badge> },
    { key: "linha", label: "Linha DRE" }, { key: "descricao", label: "Descrição" },
    { key: "valor", label: "Valor", render: (r) => <span style={{ color: r.tipo === "entrada" ? T.green : T.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(r.valor)}</span> },
  ];
  const entradas = data.filter((r) => r.tipo === "entrada").reduce((s, r) => s + r.valor, 0);
  const saidas = data.filter((r) => r.tipo === "saida").reduce((s, r) => s + r.valor, 0);
  const saldo = entradas - saidas;
  const porMes = useMemo(() => { const map = {}; data.forEach((r) => { const m = monthKey(r.data); if (!map[m]) map[m] = { mes: m, entradas: 0, saidas: 0 }; map[m][r.tipo === "entrada" ? "entradas" : "saidas"] += r.valor; }); return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)); }, [data]);
  const dreLinha = (linhas) => linhas.map((l) => ({ linha: l, valor: data.filter((r) => r.linha === l).reduce((s, r) => s + r.valor, 0) })).filter((x) => x.valor > 0);
  const receitas = dreLinha(DRE_LINHAS_RECEITA), custos = dreLinha(DRE_LINHAS_CUSTO), despesas = dreLinha(DRE_LINHAS_DESPESA), impostos = dreLinha(DRE_LINHAS_IMPOSTO);
  const totalReceita = receitas.reduce((s, x) => s + x.valor, 0), totalCustos = custos.reduce((s, x) => s + x.valor, 0);
  const lucroBruto = totalReceita - totalCustos, totalDespesas = despesas.reduce((s, x) => s + x.valor, 0), totalImpostos = impostos.reduce((s, x) => s + x.valor, 0);
  const resultado = lucroBruto - totalDespesas - totalImpostos;
  const margem = totalReceita ? (resultado / totalReceita) * 100 : 0;
  const DreLine = ({ label, value, bold }) => (
    <div className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${T.border}`, paddingLeft: bold ? 0 : 16 }}>
      <span className={bold ? "font-bold" : ""} style={{ color: bold ? T.text : T.muted, fontSize: bold ? 14 : 13 }}>{label}</span>
      <span className={bold ? "font-bold" : ""} style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{fmtBRL(value)}</span>
    </div>
  );
  return (
    <ModuleShell icon={Wallet} title="Financeiro" subtitle="Fluxo de caixa, entradas, saídas e DRE consolidado" tone="coral" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Registrar movimento" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Entradas", value: fmtBRL(entradas), tone: "green", icon: TrendingUp }, { label: "Saídas", value: fmtBRL(saidas), tone: "red", icon: TrendingDown },
        { label: "Resultado do período", value: fmtBRL(saldo), tone: saldo >= 0 ? "green" : "red", icon: Activity }, { label: "Margem líquida", value: fmtPct(margem), tone: margem >= 0 ? "green" : "red" }]}
      charts={<div className="grid md:grid-cols-2 gap-5">
        <ChartCard title="Entradas x saídas por mês"><BarChart data={porMes}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="mes" tick={{ fontSize: 11, fill: T.muted }} /><YAxis tick={{ fontSize: 11, fill: T.muted }} tickFormatter={(v) => `${v / 1000}k`} /><Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="entradas" name="Entradas" fill={T.green} radius={[4, 4, 0, 0]} /><Bar dataKey="saidas" name="Saídas" fill={T.red} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
        <ChartCard title="Composição da receita"><PieChart><Pie data={receitas} dataKey="valor" nameKey="linha" innerRadius={55} outerRadius={85} paddingAngle={2}>{receitas.map((_, i) => <Cell key={i} fill={CHART_SET[i % CHART_SET.length]} />)}</Pie><Tooltip formatter={(v) => fmtBRL(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ChartCard>
      </div>}
      extra={<Card className="mb-5"><p className="text-[11px] font-semibold uppercase mb-3" style={{ color: T.muted, letterSpacing: "0.06em" }}>DRE — Demonstrativo de Resultado</p>
        <div className="max-w-lg">{receitas.map((r) => <DreLine key={r.linha} label={r.linha} value={r.valor} />)}<DreLine label="(=) Receita Total" value={totalReceita} bold />
        {custos.map((r) => <DreLine key={r.linha} label={`(-) ${r.linha}`} value={r.valor} />)}<DreLine label="(=) Lucro Bruto" value={lucroBruto} bold />
        {despesas.map((r) => <DreLine key={r.linha} label={`(-) ${r.linha}`} value={r.valor} />)}{impostos.map((r) => <DreLine key={r.linha} label={`(-) ${r.linha}`} value={r.valor} />)}
        <div className="flex justify-between py-2 mt-1"><span className="font-bold text-sm" style={{ color: T.text }}>(=) Resultado do Período</span><span className="font-bold" style={{ color: resultado >= 0 ? T.green : T.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(resultado)}</span></div></div></Card>} />
  );
}

function ConveniosModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("convenios");
  const fields = [{ key: "data", label: "Data", type: "date", default: todayISO() }, { key: "convenio", label: "Convênio", type: "select", options: CONVENIOS }, { key: "quantidade", label: "Qtd. atendimentos", type: "number" }, { key: "valor", label: "Valor repassado (R$)", type: "currency" }];
  const columns = [{ key: "data", label: "Data", render: (r) => fmtDate(r.data) }, { key: "convenio", label: "Convênio" }, { key: "quantidade", label: "Atendimentos" }, { key: "valor", label: "Valor", render: (r) => fmtBRL(r.valor) }];
  const porConvenio = useMemo(() => { const map = {}; data.forEach((r) => { if (!map[r.convenio]) map[r.convenio] = { convenio: r.convenio, quantidade: 0, valor: 0 }; map[r.convenio].quantidade += Number(r.quantidade); map[r.convenio].valor += Number(r.valor); }); return Object.values(map).sort((a, b) => b.valor - a.valor); }, [data]);
  const totalAtend = data.reduce((s, r) => s + Number(r.quantidade), 0), totalValor = data.reduce((s, r) => s + Number(r.valor), 0); const lider = porConvenio[0];
  return (
    <ModuleShell icon={HeartHandshake} title="Atendimentos por Convênio" subtitle="Bradesco Saúde, Unimed, IPSM, AMMP, Orizon, Sancoop e particular" tone="teal" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Registrar atendimentos" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Atendimentos", value: fmtNum(totalAtend), icon: Activity, tone: "teal" }, { label: "Valor repassado", value: fmtBRL(totalValor), tone: "green" }, { label: "Convênio líder", value: lider ? lider.convenio : "—", tone: "coral" }, { label: "Ticket médio", value: fmtBRL(totalAtend ? totalValor / totalAtend : 0) }]}
      charts={<div className="grid md:grid-cols-2 gap-5">
        <ChartCard title="Atendimentos por convênio"><BarChart data={porConvenio} layout="vertical" margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} /><XAxis type="number" tick={{ fontSize: 11, fill: T.muted }} /><YAxis type="category" dataKey="convenio" width={110} tick={{ fontSize: 11, fill: T.muted }} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey="quantidade" fill={T.teal} radius={[0, 4, 4, 0]} /></BarChart></ChartCard>
        <ChartCard title="Faturamento por convênio"><PieChart><Pie data={porConvenio} dataKey="valor" nameKey="convenio" innerRadius={55} outerRadius={85} paddingAngle={2}>{porConvenio.map((_, i) => <Cell key={i} fill={CHART_SET[i % CHART_SET.length]} />)}</Pie><Tooltip formatter={(v) => fmtBRL(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ChartCard>
      </div>} />
  );
}

function VacinasModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("vacinas");
  const fields = [{ key: "nome", label: "Nome da vacina", type: "text" }, { key: "qtdEstoque", label: "Qtd. em estoque", type: "number" }, { key: "qtdVendidaMes", label: "Vendida no mês", type: "number" }, { key: "qtdMinima", label: "Estoque mínimo", type: "number" }, { key: "valorCompra", label: "Valor compra (un.)", type: "currency" }, { key: "valorVenda", label: "Valor revenda (un.)", type: "currency" }];
  const columns = [{ key: "nome", label: "Vacina" }, { key: "qtdEstoque", label: "Em estoque", render: (r) => <span className="flex items-center gap-1.5">{r.qtdEstoque}{r.qtdEstoque < r.qtdMinima && <AlertTriangle size={12} style={{ color: T.red }} />}</span> }, { key: "qtdVendidaMes", label: "Vendidas/mês" }, { key: "valorCompra", label: "Compra (un.)", render: (r) => fmtBRL(r.valorCompra) }, { key: "valorVenda", label: "Venda (un.)", render: (r) => fmtBRL(r.valorVenda) }, { key: "margem", label: "Margem", render: (r) => <span style={{ color: T.green }}>{fmtPct(r.valorVenda ? ((r.valorVenda - r.valorCompra) / r.valorVenda) * 100 : 0)}</span> }];
  const valorEstoqueCompra = data.reduce((s, r) => s + r.qtdEstoque * r.valorCompra, 0), valorEstoqueVenda = data.reduce((s, r) => s + r.qtdEstoque * r.valorVenda, 0), receitaVendasMes = data.reduce((s, r) => s + r.qtdVendidaMes * r.valorVenda, 0);
  const abaixoMinimo = data.filter((r) => r.qtdEstoque < r.qtdMinima);
  return (
    <ModuleShell icon={Syringe} title="Estoque de Vacinas" subtitle="Vendas, estoque atual, valor de compra e de revenda" tone="amber" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Atualizar/cadastrar vacina" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Estoque (custo)", value: fmtBRL(valorEstoqueCompra) }, { label: "Estoque (revenda)", value: fmtBRL(valorEstoqueVenda), tone: "green" }, { label: "Receita de vendas/mês", value: fmtBRL(receitaVendasMes), tone: "coral" }, { label: "Abaixo do mínimo", value: abaixoMinimo.length, tone: abaixoMinimo.length ? "red" : "green" }]}
      charts={<ChartCard title="Estoque atual x estoque mínimo, por vacina"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="nome" tick={{ fontSize: 10, fill: T.muted }} interval={0} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11, fill: T.muted }} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="qtdEstoque" name="Em estoque" fill={T.amber} radius={[4, 4, 0, 0]} /><Bar dataKey="qtdMinima" name="Mínimo" fill={`${T.amber}55`} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>}
      extra={abaixoMinimo.length > 0 && <Card className="mb-5" style={{ borderColor: `${T.red}55` }}><div className="flex items-center gap-2 mb-1"><AlertTriangle size={15} style={{ color: T.red }} /><span className="font-semibold text-sm" style={{ color: T.red }}>Reposição necessária</span></div><p className="text-sm" style={{ color: T.muted }}>{abaixoMinimo.map((r) => r.nome).join(", ")} — abaixo do estoque mínimo.</p></Card>} />
  );
}

function InsumosModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("insumos");
  const fields = [{ key: "nome", label: "Item", type: "text" }, { key: "categoria", label: "Categoria", type: "select", options: ["Material médico", "EPI", "Limpeza", "Escritório", "Outros"] }, { key: "qtd", label: "Qtd. atual", type: "number" }, { key: "qtdMinima", label: "Qtd. mínima", type: "number" }, { key: "unidade", label: "Unidade", type: "text", placeholder: "caixa, litro…" }, { key: "valorUnitario", label: "Valor unitário (R$)", type: "currency" }];
  const columns = [{ key: "nome", label: "Item" }, { key: "categoria", label: "Categoria" }, { key: "qtd", label: "Qtd.", render: (r) => <span className="flex items-center gap-1.5">{r.qtd} {r.unidade}{r.qtd < r.qtdMinima && <AlertTriangle size={12} style={{ color: T.red }} />}</span> }, { key: "qtdMinima", label: "Mínimo" }, { key: "valorUnitario", label: "Valor unit.", render: (r) => fmtBRL(r.valorUnitario) }, { key: "total", label: "Valor total", render: (r) => fmtBRL(r.qtd * r.valorUnitario) }];
  const valorTotal = data.reduce((s, r) => s + r.qtd * r.valorUnitario, 0); const critico = data.filter((r) => r.qtd < r.qtdMinima);
  return (
    <ModuleShell icon={Package} title="Estoque de Insumos" subtitle="Materiais médicos, EPIs, limpeza e escritório" tone="amber" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Atualizar/cadastrar item" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Itens cadastrados", value: data.length }, { label: "Valor em estoque", value: fmtBRL(valorTotal) }, { label: "Ponto crítico", value: critico.length, tone: critico.length ? "red" : "green" }, { label: "Categorias", value: new Set(data.map((r) => r.categoria)).size }]}
      charts={<ChartCard title="Itens críticos (atual x mínimo)"><BarChart data={critico.length ? critico : data}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="nome" tick={{ fontSize: 10, fill: T.muted }} interval={0} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11, fill: T.muted }} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="qtd" name="Atual" fill={T.amber} radius={[4, 4, 0, 0]} /><Bar dataKey="qtdMinima" name="Mínimo" fill={`${T.amber}55`} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>} />
  );
}

function ProducaoModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("producao");
  const fields = [{ key: "profissional", label: "Profissional", type: "text" }, { key: "mes", label: "Mês (AAAA-MM)", type: "text", placeholder: todayISO().slice(0, 7), default: todayISO().slice(0, 7) }, { key: "atendimentos", label: "Atendimentos", type: "number" }, { key: "receita", label: "Receita gerada (R$)", type: "currency" }, { key: "custo", label: "Custo/repasse (R$)", type: "currency" }];
  const columns = [{ key: "profissional", label: "Profissional" }, { key: "mes", label: "Mês" }, { key: "atendimentos", label: "Atendimentos" }, { key: "receita", label: "Receita", render: (r) => fmtBRL(r.receita) }, { key: "custo", label: "Custo", render: (r) => fmtBRL(r.custo) }, { key: "rentabilidade", label: "Rentabilidade", render: (r) => { const rent = r.receita - r.custo; return <span style={{ color: rent >= 0 ? T.green : T.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(rent)}</span>; } }, { key: "margem", label: "Margem", render: (r) => fmtPct(r.receita ? ((r.receita - r.custo) / r.receita) * 100 : 0) }];
  const chartData = data.map((r) => ({ profissional: r.profissional.replace(/^Dr[a]?\.\s*/, ""), receita: r.receita, custo: r.custo, rentabilidade: r.receita - r.custo }));
  const totalReceita = data.reduce((s, r) => s + r.receita, 0), totalCusto = data.reduce((s, r) => s + r.custo, 0); const maisRentavel = [...data].sort((a, b) => (b.receita - b.custo) - (a.receita - a.custo))[0];
  return (
    <ModuleShell icon={Stethoscope} title="Produção Médica" subtitle="Produção e rentabilidade por profissional" tone="teal" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Registrar produção" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Receita gerada", value: fmtBRL(totalReceita), tone: "green" }, { label: "Custo/repasse", value: fmtBRL(totalCusto), tone: "red" }, { label: "Rentabilidade", value: fmtBRL(totalReceita - totalCusto), tone: (totalReceita - totalCusto) >= 0 ? "green" : "red" }, { label: "Mais rentável", value: maisRentavel ? maisRentavel.profissional.split(" ").slice(0, 2).join(" ") : "—", tone: "coral" }]}
      charts={<ChartCard title="Rentabilidade por profissional"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="profissional" tick={{ fontSize: 11, fill: T.muted }} /><YAxis tick={{ fontSize: 11, fill: T.muted }} tickFormatter={(v) => `${v / 1000}k`} /><Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="receita" name="Receita" fill={T.teal} radius={[4, 4, 0, 0]} /><Bar dataKey="custo" name="Custo" fill={`${T.teal}55`} radius={[4, 4, 0, 0]} /><Bar dataKey="rentabilidade" name="Rentabilidade" fill={T.green} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>} />
  );
}

function ContasModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("contas");
  const fields = [{ key: "descricao", label: "Descrição", type: "text" }, { key: "categoria", label: "Categoria", type: "select", options: ["Fornecedores", "Aluguel", "Salários", "Impostos", "Serviços", "Outros"] }, { key: "valor", label: "Valor (R$)", type: "currency" }, { key: "vencimento", label: "Vencimento", type: "date", default: todayISO() }, { key: "status", label: "Status", type: "select", options: ["Pendente", "Pago", "Atrasado"] }, { key: "dataPagamento", label: "Data de pagamento", type: "date", required: false }];
  const columns = [{ key: "descricao", label: "Descrição" }, { key: "categoria", label: "Categoria" }, { key: "valor", label: "Valor", render: (r) => fmtBRL(r.valor) }, { key: "vencimento", label: "Vencimento", render: (r) => fmtDate(r.vencimento) }, { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Pago" ? "green" : r.status === "Atrasado" ? "red" : "amber"}>{r.status}</Badge> }];
  const pendentes = data.filter((r) => r.status !== "Pago"), pagos = data.filter((r) => r.status === "Pago"); const atrasados = data.filter((r) => r.status === "Atrasado" || (r.status === "Pendente" && r.vencimento < todayISO()));
  const totalPendente = pendentes.reduce((s, r) => s + r.valor, 0), totalPago = pagos.reduce((s, r) => s + r.valor, 0);
  const proximos = pendentes.filter((r) => { const diff = (new Date(r.vencimento) - new Date(todayISO())) / 86400000; return diff >= 0 && diff <= 7; }).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const porCategoria = useMemo(() => { const map = {}; pendentes.forEach((r) => { map[r.categoria] = (map[r.categoria] || 0) + r.valor; }); return Object.entries(map).map(([categoria, valor]) => ({ categoria, valor })); }, [pendentes]);
  return (
    <ModuleShell icon={Receipt} title="Contas a Pagar" subtitle="Contas pendentes e pagas, mês a mês" tone="coral" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Lançar conta" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Total pendente", value: fmtBRL(totalPendente), tone: "amber" }, { label: "Total pago", value: fmtBRL(totalPago), tone: "green" }, { label: "Atrasadas", value: atrasados.length, tone: atrasados.length ? "red" : "green" }, { label: "Vencendo em 7 dias", value: proximos.length, tone: proximos.length ? "amber" : "green" }]}
      charts={<ChartCard title="Valor pendente por categoria"><BarChart data={porCategoria}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="categoria" tick={{ fontSize: 11, fill: T.muted }} /><YAxis tick={{ fontSize: 11, fill: T.muted }} /><Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey="valor" fill={T.coral} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>}
      extra={proximos.length > 0 && <Card className="mb-5" style={{ borderColor: `${T.amber}55` }}><div className="flex items-center gap-2 mb-2"><AlertTriangle size={15} style={{ color: T.amber }} /><span className="font-semibold text-sm" style={{ color: T.text }}>Vencimentos nos próximos 7 dias</span></div><div className="flex flex-col gap-1.5">{proximos.map((r) => (<div key={r.id} className="flex justify-between text-sm"><span style={{ color: T.muted }}>{r.descricao} — {fmtDate(r.vencimento)}</span><span style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtBRL(r.valor)}</span></div>))}</div></Card>} />
  );
}

function PessoalModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("pessoal");
  const fields = [{ key: "nome", label: "Colaborador(a)", type: "text" }, { key: "cargo", label: "Cargo", type: "text" }, { key: "equipe", label: "Equipe", type: "select", options: ["Recepção", "Financeiro", "Marketing", "Enfermagem", "Administrativo", "Outra"] }, { key: "mes", label: "Mês (AAAA-MM)", type: "text", default: todayISO().slice(0, 7) }, { key: "metaMensal", label: "Meta mensal (agendados)", type: "number" }, { key: "ligacoes", label: "Ligações atendidas", type: "number" }, { key: "mensagens", label: "Mensagens respondidas", type: "number" }, { key: "agendados", label: "Pacientes agendados", type: "number" }];
  const withPct = data.map((r) => ({ ...r, pct: r.metaMensal ? (r.agendados / r.metaMensal) * 100 : (r.ligacoes + r.mensagens > 0 ? 100 : 0) }));
  const columns = [{ key: "nome", label: "Colaborador(a)" }, { key: "equipe", label: "Equipe" }, { key: "ligacoes", label: "Ligações" }, { key: "mensagens", label: "Mensagens" }, { key: "agendados", label: "Agendados" }, { key: "pct", label: "Meta atingida", render: (r) => (<div className="flex items-center gap-2 min-w-[110px]"><Progress pct={r.pct} /><span className="text-xs font-semibold" style={{ color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtPct(r.pct)}</span></div>) }];
  const porEquipe = useMemo(() => { const map = {}; withPct.forEach((r) => { if (!map[r.equipe]) map[r.equipe] = { equipe: r.equipe, soma: 0, n: 0 }; map[r.equipe].soma += r.pct; map[r.equipe].n += 1; }); return Object.values(map).map((e) => ({ equipe: e.equipe, media: e.soma / e.n })).sort((a, b) => b.media - a.media); }, [withPct]);
  const destaque = [...withPct].sort((a, b) => b.pct - a.pct)[0]; const mediaGeral = withPct.length ? withPct.reduce((s, r) => s + r.pct, 0) / withPct.length : 0;
  return (
    <ModuleShell icon={Users} title="Departamento Pessoal" subtitle="Produtividade individual, metas e desempenho por equipe" tone="purple" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Registrar desempenho" fields={fields} columns={columns} rows={withPct} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Colaboradores", value: data.length }, { label: "Meta média", value: fmtPct(mediaGeral), tone: mediaGeral >= 90 ? "green" : mediaGeral >= 70 ? "amber" : "red" }, { label: "Destaque do mês", value: destaque ? destaque.nome : "—", tone: "purple" }, { label: "Equipe líder", value: porEquipe[0] ? porEquipe[0].equipe : "—" }]}
      charts={<div className="grid md:grid-cols-2 gap-5">
        <ChartCard title="Meta atingida por colaborador(a)"><BarChart data={withPct} layout="vertical" margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} /><XAxis type="number" tick={{ fontSize: 11, fill: T.muted }} tickFormatter={(v) => `${v}%`} /><YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11, fill: T.muted }} /><Tooltip formatter={(v) => `${v.toFixed(0)}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey="pct" radius={[0, 4, 4, 0]}>{withPct.map((r, i) => <Cell key={i} fill={r.pct >= 100 ? T.green : r.pct >= 70 ? T.amber : T.red} />)}</Bar></BarChart></ChartCard>
        <ChartCard title="Desempenho médio por equipe"><BarChart data={porEquipe}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="equipe" tick={{ fontSize: 10, fill: T.muted }} interval={0} angle={-10} textAnchor="end" height={50} /><YAxis tick={{ fontSize: 11, fill: T.muted }} tickFormatter={(v) => `${v}%`} /><Tooltip formatter={(v) => `${v.toFixed(0)}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey="media" fill={T.purple} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>
      </div>} />
  );
}

function MarketingModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("marketing");
  const fields = [{ key: "data", label: "Data", type: "date", default: todayISO() }, { key: "nome", label: "Nome do lead", type: "text" }, { key: "canal", label: "Canal", type: "select", options: ["Instagram", "Facebook", "WhatsApp", "Google", "Indicação", "Outro"] }, { key: "status", label: "Status", type: "select", options: ["Novo", "Contatado", "Agendado", "Convertido", "Perdido"] }];
  const columns = [{ key: "data", label: "Data", render: (r) => fmtDate(r.data) }, { key: "nome", label: "Lead" }, { key: "canal", label: "Canal" }, { key: "status", label: "Status", render: (r) => { const tone = { Novo: "ink", Contatado: "amber", Agendado: "amber", Convertido: "green", Perdido: "red" }[r.status]; return <Badge tone={tone}>{r.status}</Badge>; } }];
  const porCanal = useMemo(() => { const map = {}; data.forEach((r) => { map[r.canal] = (map[r.canal] || 0) + 1; }); return Object.entries(map).map(([canal, total]) => ({ canal, total })).sort((a, b) => b.total - a.total); }, [data]);
  const porStatus = useMemo(() => { const ordem = ["Novo", "Contatado", "Agendado", "Convertido", "Perdido"]; const map = {}; data.forEach((r) => { map[r.status] = (map[r.status] || 0) + 1; }); return ordem.filter((s) => map[s]).map((status) => ({ status, total: map[status] })); }, [data]);
  const convertidos = data.filter((r) => r.status === "Convertido").length; const taxaConversao = data.length ? (convertidos / data.length) * 100 : 0; const agendadosPendentes = data.filter((r) => r.status === "Agendado").length;
  return (
    <ModuleShell icon={Megaphone} title="Marketing — Leads" subtitle="Leads recebidos via redes sociais e canais digitais" tone="rose" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Registrar lead" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Leads no período", value: data.length }, { label: "Taxa de conversão", value: fmtPct(taxaConversao), tone: taxaConversao >= 20 ? "green" : "amber" }, { label: "Canal líder", value: porCanal[0] ? porCanal[0].canal : "—", tone: "rose" }, { label: "Agendados aguardando", value: agendadosPendentes, tone: "amber" }]}
      charts={<div className="grid md:grid-cols-2 gap-5">
        <ChartCard title="Funil de status dos leads"><BarChart data={porStatus}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="status" tick={{ fontSize: 11, fill: T.muted }} /><YAxis tick={{ fontSize: 11, fill: T.muted }} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey="total" radius={[4, 4, 0, 0]}>{porStatus.map((_, i) => <Cell key={i} fill={CHART_SET[i % CHART_SET.length]} />)}</Bar></BarChart></ChartCard>
        <ChartCard title="Leads por canal"><PieChart><Pie data={porCanal} dataKey="total" nameKey="canal" innerRadius={55} outerRadius={85} paddingAngle={2}>{porCanal.map((_, i) => <Cell key={i} fill={CHART_SET[i % CHART_SET.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ChartCard>
      </div>} />
  );
}

function ProcedimentosModulo() {
  const { data, add, update, remove, loading, erro } = useRecords("procedimentos");
  const fields = [{ key: "tipo", label: "Tipo de procedimento", type: "select", options: ["Teste Genético", "Fototerapia"] }, { key: "paciente", label: "Paciente (iniciais/idade)", type: "text" }, { key: "data", label: "Data", type: "date", default: todayISO() }, { key: "status", label: "Status", type: "select", options: ["Solicitado", "Em Andamento", "Concluído", "Cancelado"] }, { key: "valor", label: "Valor (R$)", type: "currency" }];
  const columns = [{ key: "tipo", label: "Tipo", render: (r) => <Badge tone={r.tipo === "Teste Genético" ? "purple" : "teal"}>{r.tipo}</Badge> }, { key: "paciente", label: "Paciente" }, { key: "data", label: "Data", render: (r) => fmtDate(r.data) }, { key: "status", label: "Status", render: (r) => { const tone = { Solicitado: "muted", "Em Andamento": "amber", "Concluído": "green", Cancelado: "red" }[r.status]; return <Badge tone={tone}>{r.status}</Badge>; } }, { key: "valor", label: "Valor", render: (r) => fmtBRL(r.valor) }];
  const porTipo = useMemo(() => { const map = {}; data.forEach((r) => { if (!map[r.tipo]) map[r.tipo] = { tipo: r.tipo, total: 0, receita: 0 }; map[r.tipo].total += 1; map[r.tipo].receita += r.valor; }); return Object.values(map); }, [data]);
  const concluidos = data.filter((r) => r.status === "Concluído"), pendentes = data.filter((r) => r.status === "Solicitado" || r.status === "Em Andamento"); const receitaTotal = concluidos.reduce((s, r) => s + r.valor, 0);
  return (
    <ModuleShell icon={FlaskConical} title="Testes Genéticos e Fototerapia" subtitle="Procedimentos especiais por paciente" tone="teal" loading={loading} erro={erro}
      dailyFields={fields} dailyCta="Registrar procedimento" fields={fields} columns={columns} rows={data} onAdd={add} onUpdate={update} onDelete={remove}
      kpis={[{ label: "Procedimentos", value: data.length }, { label: "Concluídos", value: concluidos.length, tone: "green" }, { label: "Em andamento", value: pendentes.length, tone: "amber" }, { label: "Receita (concluídos)", value: fmtBRL(receitaTotal), tone: "teal" }]}
      charts={<ChartCard title="Volume por tipo de procedimento"><BarChart data={porTipo}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="tipo" tick={{ fontSize: 11, fill: T.muted }} /><YAxis tick={{ fontSize: 11, fill: T.muted }} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="total" name="Qtd." fill={T.teal} radius={[4, 4, 0, 0]} /></BarChart></ChartCard>} />
  );
}

/* ============================== VISÃO GERAL ============================== */
function VisaoGeral() {
  const { unidade } = useUnidade();
  const financeiro = useRecords("financeiro"), atendimentos = useRecords("convenios"), vacinas = useRecords("vacinas"), insumos = useRecords("insumos"), contas = useRecords("contas"), pessoal = useRecords("pessoal"), leads = useRecords("marketing"), procedimentos = useRecords("procedimentos");
  const anyLoading = [financeiro, atendimentos, vacinas, insumos, contas, pessoal, leads, procedimentos].some((m) => m.loading);
  const entradas = financeiro.data.filter((r) => r.tipo === "entrada").reduce((s, r) => s + r.valor, 0);
  const saidas = financeiro.data.filter((r) => r.tipo === "saida").reduce((s, r) => s + r.valor, 0);
  const resultado = entradas - saidas;
  const totalAtendConvenio = atendimentos.data.reduce((s, r) => s + Number(r.quantidade), 0);
  const alertaVacinas = vacinas.data.filter((v) => v.qtdEstoque < v.qtdMinima).length;
  const alertaInsumos = insumos.data.filter((i) => i.qtd < i.qtdMinima).length;
  const contasPendentes = contas.data.filter((c) => c.status !== "Pago").reduce((s, c) => s + c.valor, 0);
  const contasAtrasadas = contas.data.filter((c) => c.status === "Atrasado" || (c.status === "Pendente" && c.vencimento < todayISO())).length;
  const metaMedia = pessoal.data.length ? pessoal.data.reduce((s, p) => s + (p.metaMensal ? Math.min((p.agendados / p.metaMensal) * 100, 999) : 0), 0) / pessoal.data.length : 0;
  const leadsConvertidos = leads.data.filter((l) => l.status === "Convertido").length;
  const taxaConversao = leads.data.length ? (leadsConvertidos / leads.data.length) * 100 : 0;
  const procConcluidos = procedimentos.data.filter((p) => p.status === "Concluído").length;
  const porConvenio = useMemo(() => { const map = {}; atendimentos.data.forEach((r) => { map[r.convenio] = (map[r.convenio] || 0) + Number(r.valor); }); return Object.entries(map).map(([convenio, valor]) => ({ convenio, valor })).sort((a, b) => b.valor - a.valor); }, [atendimentos.data]);
  const fluxoPorMes = useMemo(() => { const map = {}; financeiro.data.forEach((r) => { const m = monthKey(r.data); if (!map[m]) map[m] = { mes: m, entradas: 0, saidas: 0 }; map[m][r.tipo === "entrada" ? "entradas" : "saidas"] += r.valor; }); return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).map((r) => ({ ...r, saldo: r.entradas - r.saidas })); }, [financeiro.data]);
  const alertas = [
    alertaVacinas > 0 && { texto: `${alertaVacinas} vacina(s) abaixo do estoque mínimo`, tone: "red" },
    alertaInsumos > 0 && { texto: `${alertaInsumos} insumo(s) em ponto crítico`, tone: "red" },
    contasAtrasadas > 0 && { texto: `${contasAtrasadas} conta(s) atrasada(s) ou vencendo`, tone: "amber" },
    resultado < 0 && { texto: "Resultado financeiro do período está negativo", tone: "red" },
  ].filter(Boolean);

  if (anyLoading) return <div className="text-center py-20" style={{ color: T.muted }}><Loader2 size={20} className="animate-spin inline mr-2" />Carregando painel…</div>;

  return (
    <div>
      <div className="relative rounded-3xl mb-7 p-7 overflow-hidden" style={{ background: `linear-gradient(135deg, ${T.ink}, ${T.tealDeep})` }}>
        <div className="absolute rounded-full" style={{ width: 220, height: 220, background: `${T.coral}30`, filter: "blur(50px)", top: -80, right: -60 }} />
        <div className="absolute rounded-full" style={{ width: 160, height: 160, background: `${T.teal}40`, filter: "blur(40px)", bottom: -60, left: 40 }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1"><Sparkles size={14} style={{ color: T.coral }} /><span className="text-xs font-semibold uppercase" style={{ color: "#E8DED2", letterSpacing: "0.08em" }}>{weekdayLong()}</span></div>
          <h1 className="text-2xl font-bold mb-5" style={{ color: "#fff", fontFamily: "'Sora', sans-serif" }}>{unidade ? unidade.nome : "Clínica Olhar de Mãe"}</h1>
          <div className="flex flex-wrap gap-x-9 gap-y-4">
            {[{ label: "Resultado do período", value: fmtBRL(resultado) }, { label: "Atendimentos (convênios)", value: fmtNum(totalAtendConvenio) }, { label: "Leads no período", value: fmtNum(leads.data.length) }, { label: "Contas pendentes", value: fmtBRL(contasPendentes) }, { label: "Meta média (equipe)", value: fmtPct(metaMedia) }].map((v, i) => (
              <div key={i} className="flex items-center gap-2.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: T.coral, boxShadow: `0 0 0 5px ${T.coral}30` }} />
                <div><div className="text-[10px] uppercase" style={{ color: "#B9CBCE", letterSpacing: "0.07em" }}>{v.label}</div><div className="text-lg font-bold" style={{ color: "#fff", fontFamily: "'IBM Plex Mono', monospace" }}>{v.value}</div></div></div>
            ))}
          </div>
        </div>
      </div>
      {alertas.length > 0 && <Card className="mb-6" style={{ borderColor: `${T.red}40` }}><div className="flex items-center gap-2 mb-2"><AlertTriangle size={15} style={{ color: T.red }} /><span className="font-semibold text-sm" style={{ color: T.text }}>Pontos de atenção</span></div><div className="flex flex-col gap-1.5">{alertas.map((a, i) => (<div key={i} className="flex items-center gap-2 text-sm"><span className="w-1.5 h-1.5 rounded-full" style={{ background: a.tone === "red" ? T.red : T.amber }} /><span style={{ color: T.muted }}>{a.texto}</span></div>))}</div></Card>}
      <div className="grid gap-3 mb-6 md:grid-cols-4">
        <KpiCard label="Entradas do período" value={fmtBRL(entradas)} tone="green" icon={TrendingUp} />
        <KpiCard label="Saídas do período" value={fmtBRL(saidas)} tone="red" icon={TrendingDown} />
        <KpiCard label="Taxa de conversão (leads)" value={fmtPct(taxaConversao)} tone="rose" />
        <KpiCard label="Procedimentos concluídos" value={procConcluidos} tone="teal" />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <ChartCard title="Fluxo de caixa por mês"><AreaChart data={fluxoPorMes}><CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} /><XAxis dataKey="mes" tick={{ fontSize: 11, fill: T.muted }} /><YAxis tick={{ fontSize: 11, fill: T.muted }} tickFormatter={(v) => `${v / 1000}k`} /><Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Area type="monotone" dataKey="saldo" stroke={T.coral} fill={`${T.coral}30`} strokeWidth={2} name="Saldo" /></AreaChart></ChartCard>
        <ChartCard title="Faturamento por convênio"><PieChart><Pie data={porConvenio} dataKey="valor" nameKey="convenio" innerRadius={55} outerRadius={85} paddingAngle={2}>{porConvenio.map((_, i) => <Cell key={i} fill={CHART_SET[i % CHART_SET.length]} />)}</Pie><Tooltip formatter={(v) => fmtBRL(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ChartCard>
      </div>
    </div>
  );
}

/* ============================== UNIDADES ============================== */
function UnidadesModulo() {
  const { unidadeId, unidades, setUnidadeId, addUnidade, reloadUnidades } = useUnidade();
  const { perfil } = useAuth();
  const [novo, setNovo] = useState(""); const [busy, setBusy] = useState(false); const [erro, setErro] = useState(null);
  const isAdmin = perfil && perfil.papel === "admin";
  return (
    <div>
      <SectionHeader icon={Building2} title="Unidades da Rede" subtitle="Cada clínica Olhar de Mãe da rede, com dados isolados" tone="ink" />
      {!isAdmin && <Card className="mb-5" style={{ borderColor: `${T.amber}55` }}><span className="text-sm" style={{ color: T.text }}>Somente administradores podem criar novas unidades. Fale com quem administra a conta para adicionar uma filial.</span></Card>}
      {isAdmin && <Card className="mb-5">
        <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: T.muted, letterSpacing: "0.06em" }}>Adicionar nova unidade</p>
        <div className="flex gap-3 flex-wrap items-end">
          <Field label="Nome da unidade"><input className="rounded-lg px-3 py-2 text-sm outline-none w-64" style={inputStyle} placeholder="ex: Olhar de Mãe — Norte Shopping" value={novo} onChange={(e) => setNovo(e.target.value)} /></Field>
          <Btn icon={busy ? undefined : Plus} disabled={busy} onClick={async () => { if (!novo.trim()) return; setBusy(true); setErro(null); try { await addUnidade(novo.trim()); setNovo(""); } catch (e) { setErro(e.message); } setBusy(false); }}>{busy ? <Loader2 size={14} className="animate-spin" /> : null} Adicionar unidade</Btn>
        </div>
        {erro && <p className="text-sm mt-2" style={{ color: T.red }}>{erro}</p>}
      </Card>}
      <Card>
        <p className="text-[11px] font-semibold uppercase mb-3" style={{ color: T.muted, letterSpacing: "0.06em" }}>Unidades cadastradas</p>
        <div className="flex flex-col gap-2">
          {unidades.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: u.id === unidadeId ? `${T.coral}12` : "#FBFAF6", border: `1px solid ${u.id === unidadeId ? T.coral + "55" : T.border}` }}>
              <div className="flex items-center gap-3"><IconChip icon={Building2} tone={u.id === unidadeId ? "coral" : "ink"} size={15} box={32} /><div><div className="font-semibold text-sm" style={{ color: T.text }}>{u.nome}</div>{u.id === unidadeId && <div className="text-xs" style={{ color: T.coralDeep }}>Unidade selecionada agora</div>}</div></div>
              {u.id !== unidadeId && <Btn small variant="ghost" onClick={() => setUnidadeId(u.id)}>Selecionar</Btn>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================== MENU ============================== */
const MENU = [
  { group: "Visão", items: [{ key: "visao", label: "Visão Geral", icon: LayoutDashboard, tone: "coral" }] },
  { group: "Financeiro", items: [{ key: "financeiro", label: "Fluxo & DRE", icon: Wallet, tone: "coral" }, { key: "contas", label: "Contas a Pagar", icon: Receipt, tone: "coral" }] },
  { group: "Atendimento Clínico", items: [{ key: "convenios", label: "Convênios", icon: HeartHandshake, tone: "teal" }, { key: "producao", label: "Produção Médica", icon: Stethoscope, tone: "teal" }, { key: "procedimentos", label: "Testes e Fototerapia", icon: FlaskConical, tone: "teal" }] },
  { group: "Estoque", items: [{ key: "vacinas", label: "Vacinas", icon: Syringe, tone: "amber" }, { key: "insumos", label: "Insumos", icon: Package, tone: "amber" }] },
  { group: "Pessoas", items: [{ key: "pessoal", label: "Departamento Pessoal", icon: Users, tone: "purple" }] },
  { group: "Marketing", items: [{ key: "marketing", label: "Leads", icon: Megaphone, tone: "rose" }] },
  { group: "Rede", items: [{ key: "unidades", label: "Unidades", icon: Building2, tone: "ink" }] },
];

/* ============================== APP INTERNO (autenticado) ============================== */
function AppInner() {
  const [tab, setTab] = useState("visao");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, perfil } = useAuth();
  const activeMeta = MENU.flatMap((g) => g.items).find((i) => i.key === tab) || MENU[0].items[0];
  const renderTab = () => {
    switch (tab) {
      case "visao": return <VisaoGeral />;
      case "financeiro": return <FinanceiroModulo />;
      case "convenios": return <ConveniosModulo />;
      case "vacinas": return <VacinasModulo />;
      case "insumos": return <InsumosModulo />;
      case "producao": return <ProducaoModulo />;
      case "contas": return <ContasModulo />;
      case "pessoal": return <PessoalModulo />;
      case "marketing": return <MarketingModulo />;
      case "procedimentos": return <ProcedimentosModulo />;
      case "unidades": return <UnidadesModulo />;
      default: return null;
    }
  };
  return (
    <div style={{ background: T.canvas, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap'); * { box-sizing: border-box; }`}</style>
      <div className="flex">
        <aside className={`fixed md:static z-40 top-0 left-0 h-full md:h-auto w-72 flex-shrink-0 transition-transform overflow-y-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`} style={{ background: `linear-gradient(180deg, ${T.ink}, ${T.inkSoft})`, minHeight: "100vh" }}>
          <div className="px-5 py-6 flex items-center gap-2.5" style={{ borderBottom: "1px solid #FFFFFF14" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${T.coral}, ${T.coralDeep})` }}><HeartHandshake size={19} color="#fff" /></div>
            <div><div className="text-sm font-bold" style={{ color: "#fff", fontFamily: "'Sora', sans-serif" }}>Olhar de Mãe</div><div className="text-xs" style={{ color: "#8FA0AC" }}>Painel de Gestão da Rede</div></div>
          </div>
          <UnidadeSwitcher />
          <nav className="p-3 flex flex-col gap-4">
            {MENU.map((g) => (
              <div key={g.group}>
                <div className="px-3 mb-1.5 text-[10px] font-bold uppercase" style={{ color: "#5E7180", letterSpacing: "0.09em" }}>{g.group}</div>
                <div className="flex flex-col gap-1">
                  {g.items.map((n) => { const active = tab === n.key; const color = PALETTES[n.tone] || T.coral;
                    return <button key={n.key} onClick={() => { setTab(n.key); setSidebarOpen(false); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-colors" style={{ background: active ? "#FFFFFF14" : "transparent", color: active ? "#fff" : "#A9B7C1", borderLeft: active ? `3px solid ${color}` : "3px solid transparent" }}><n.icon size={16} style={{ color: active ? color : "#8194A0" }} /><span className="flex-1">{n.label}</span></button>; })}
                </div>
              </div>
            ))}
          </nav>
          <div className="px-5 py-4 mt-2 flex items-center justify-between">
            <div className="text-xs truncate" style={{ color: "#8FA0AC" }}>{perfil ? perfil.nome : ""}</div>
            <button onClick={logout} className="flex items-center gap-1 text-xs" style={{ color: "#B9C3CC" }}><LogOut size={13} /> Sair</button>
          </div>
        </aside>
        {sidebarOpen && <div className="fixed inset-0 z-30 md:hidden" style={{ background: "#00000055" }} onClick={() => setSidebarOpen(false)} />}
        <main className="flex-1 min-w-0">
          <div className="md:hidden flex items-center justify-between px-4 py-3" style={{ background: T.ink }}>
            <span className="text-sm font-bold" style={{ color: "#fff" }}>Olhar de Mãe — {activeMeta.label}</span>
            <button onClick={() => setSidebarOpen(true)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "#FFFFFF1A", color: "#fff" }}>Menu</button>
          </div>
          <div className="p-4 md:p-8 max-w-6xl mx-auto">{renderTab()}</div>
        </main>
      </div>
    </div>
  );
}
function UnidadeSwitcher() {
  const { unidadeId, unidades, setUnidadeId } = useUnidade(); const [open, setOpen] = useState(false);
  const atual = unidades.find((u) => u.id === unidadeId) || unidades[0];
  return (
    <div className="px-3 pt-4 pb-1 relative">
      <div className="text-[10px] font-bold uppercase mb-1.5 px-1" style={{ color: "#5E7180", letterSpacing: "0.09em" }}>Unidade ativa</div>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm" style={{ background: "#FFFFFF12", color: "#fff" }}>
        <span className="flex items-center gap-2 truncate"><Building2 size={14} style={{ color: T.coral }} /><span className="truncate">{atual ? atual.nome : "—"}</span></span><ChevronDown size={14} style={{ color: "#8FA0AC" }} />
      </button>
      {open && <div className="absolute left-3 right-3 mt-1 rounded-xl overflow-hidden z-50 shadow-lg" style={{ background: T.inkSoft, border: "1px solid #FFFFFF20" }}>
        {unidades.map((u) => <button key={u.id} onClick={() => { setUnidadeId(u.id); setOpen(false); }} className="w-full text-left px-3 py-2.5 text-sm" style={{ color: u.id === unidadeId ? T.coral : "#D6DEE2", background: u.id === unidadeId ? "#FFFFFF10" : "transparent" }}>{u.nome}</button>)}
      </div>}
    </div>
  );
}

/* ============================== PROVEDOR DE UNIDADE ============================== */
function UnidadeProvider({ children }) {
  const { session, perfil } = useAuth();
  const [unidades, setUnidades] = useState([]);
  const [unidadeId, setUnidadeId] = useState(null);
  const [loading, setLoading] = useState(true);

  const reloadUnidades = useCallback(async () => {
    const rows = await sbRest("unidades?select=*&order=nome.asc", { token: session.access_token });
    setUnidades(rows || []);
    return rows || [];
  }, [session.access_token]);

  useEffect(() => {
    (async () => {
      const rows = await reloadUnidades();
      setUnidadeId(perfil && perfil.unidade_id ? perfil.unidade_id : (rows[0] ? rows[0].id : null));
      setLoading(false);
    })();
  }, [reloadUnidades]);

  const addUnidade = async (nome) => {
    const row = await sbRest("unidades", { method: "POST", token: session.access_token, body: { nome } });
    await reloadUnidades();
    if (row && row[0]) setUnidadeId(row[0].id);
  };

  if (loading || !unidadeId) return <div className="min-h-screen flex items-center justify-center" style={{ background: T.canvas, color: T.muted }}><Loader2 size={20} className="animate-spin mr-2" /> Carregando unidades…</div>;

  const unidade = unidades.find((u) => u.id === unidadeId);
  return <UnidadeContext.Provider value={{ unidadeId, unidade, unidades, setUnidadeId, addUnidade, reloadUnidades }}>{children}</UnidadeContext.Provider>;
}

/* ============================== PROVEDOR DE AUTENTICAÇÃO ============================== */
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [checkingPerfil, setCheckingPerfil] = useState(false);
  const [unidadesIniciais, setUnidadesIniciais] = useState([]);

  const carregarPerfil = async (sess) => {
    setCheckingPerfil(true);
    try {
      const rows = await sbRest(`perfis?id=eq.${sess.user.id}&select=*`, { token: sess.access_token });
      if (rows && rows[0]) setPerfil(rows[0]);
      else {
        const un = await sbRest("unidades?select=*&order=nome.asc", { token: sess.access_token });
        setUnidadesIniciais(un || []);
        setPerfil(null);
      }
    } catch (e) { setPerfil(null); }
    setCheckingPerfil(false);
  };

  const login = async (email, senha) => { const data = await sbAuth("token?grant_type=password", { email, password: senha }); setSession(data); await carregarPerfil(data); };
  const signUp = async (email, senha, nome) => { const data = await sbAuth("signup", { email, password: senha, data: { nome } }); if (data.access_token) { setSession(data); await carregarPerfil(data); } };
  const logout = () => { setSession(null); setPerfil(null); };

  const value = { session, perfil, login, signUp, logout, unidadesIniciais };

  if (!session) return <AuthContext.Provider value={value}><LoginScreen /></AuthContext.Provider>;
  if (checkingPerfil) return <div className="min-h-screen flex items-center justify-center" style={{ background: T.canvas, color: T.muted }}><Loader2 size={20} className="animate-spin mr-2" /> Verificando perfil…</div>;
  if (!perfil) return (
    <AuthContext.Provider value={value}>
      <OnboardingPerfil onDone={() => carregarPerfil(session)} />
    </AuthContext.Provider>
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ============================== APP ROOT ============================== */
export default function ClinicaOlharDeMaeApp() {
  return (
    <AuthProvider>
      <UnidadeProvider>
        <AppInner />
      </UnidadeProvider>
    </AuthProvider>
  );
}
