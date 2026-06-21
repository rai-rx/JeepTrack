import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, Truck, Receipt, BarChart3, Bell,
  ChevronRight, ChevronLeft, TrendingUp, TrendingDown,
  Star, Wallet, Plus, Pencil, Trash2, X, AlertCircle, LogOut, Eye, EyeOff,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const KV       = "kv_store_6ecbe82c";
const UNITS_KEY = "fleet_units";
const LOGS_KEY  = "fleet_logs";
const USERS_KEY = "fleet_users";

async function kvGet<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from(KV).select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.value ?? null) as T | null;
}
async function kvSet(key: string, value: unknown): Promise<void> {
  const { error } = await supabase.from(KV).upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Unit        { id:string; plate:string; driver:string; route:string; color:string; boundary:number; }
interface LogEntry    { id:string; unitId:string; date:string; earnings:number; expenses:number; expenseCategory:string; notes:string; }
interface UserAccount { id:string; username:string; password:string; role:"admin"|"unit"; unitId?:string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const UNIT_COLORS  = ["#C0392B","#1565C0","#2E7D32","#6A1B9A","#00695C","#BF360C","#37474F","#AD1457","#0277BD","#558B2F"];
const EXPENSE_CATS = ["Fuel","Maintenance","Repairs","Registration","Insurance","Miscellaneous"];
const MONTH_NAMES  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBR     = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const NAV_ITEMS    = [
  { id:"dashboard", label:"Dashboard", icon:LayoutDashboard },
  { id:"units",     label:"My Units",  icon:Truck },
  { id:"expenses",  label:"Log",       icon:Receipt },
  { id:"analytics", label:"Analytics", icon:BarChart3 },
];
const PAGE_TITLES: Record<string,string> = { dashboard:"Dashboard", units:"My Units", expenses:"Log Expenses", analytics:"Analytics" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid       = () => crypto.randomUUID();
const todayStr  = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const fmtPHP    = (n:number) => { const s=`₱${Math.abs(n).toLocaleString()}`; return n<0?`-${s}`:s; };
const fmtPHPc   = (n:number) => { const a=Math.abs(n); const s=a>=1e6?`₱${(a/1e6).toFixed(1)}M`:a>=1000?`₱${(a/1000).toFixed(0)}k`:`₱${a}`; return n<0?`-${s}`:s; };
const entryNet   = (log:LogEntry, unit?:Unit) => {
  const boundary = unit?.boundary ?? 0;
  const gross = log.earnings - log.expenses;
  return log.earnings >= boundary ? gross - boundary : gross;
};
const entryCost  = (log:LogEntry, unit?:Unit) => {
  const boundary = unit?.boundary ?? 0;
  return log.earnings >= boundary ? log.expenses + boundary : log.expenses;
};
const unitNet   = (uid_:string, logs:LogEntry[], units:Unit[]) => {
  const u=units.find(x=>x.id===uid_);
  if(!u) return 0;
  return logs.filter(l=>l.unitId===uid_).reduce((s,l)=>s+entryNet(l,u),0);
};
const unitStatus= (uid_:string, logs:LogEntry[], units:Unit[]): "profitable"|"money-pit" => unitNet(uid_,logs,units)>=0?"profitable":"money-pit";

// ─── Jeepney Icon ─────────────────────────────────────────────────────────────
const JeepneyIcon = ({color="#C0392B"}:{color?:string}) => (
  <svg viewBox="0 0 96 58" fill="none" className="w-full h-full">
    <ellipse cx="48" cy="56" rx="38" ry="2.5" fill="black" opacity="0.06"/>
    <rect x="22" y="20" width="64" height="24" rx="2.5" fill={color}/>
    <rect x="4" y="13" width="22" height="31" rx="3" fill={color}/>
    <rect x="7.5" y="17" width="14" height="14" rx="1.5" fill="#C9E8F5" opacity="0.85"/>
    <rect x="8" y="17.5" width="6.5" height="13" rx="0.8" fill="#D8EFF8" opacity="0.6"/>
    <line x1="14.5" y1="17" x2="14.5" y2="31" stroke="white" strokeWidth="0.6" opacity="0.5"/>
    <rect x="4" y="8" width="82" height="7" rx="2" fill="#E6A020"/>
    <rect x="32" y="3" width="30" height="6" rx="2" fill="#F5C842"/>
    <circle cx="47" cy="6" r="3" fill={color}/><circle cx="47" cy="6" r="1.5" fill="#F5C842"/>
    <circle cx="38" cy="6" r="1.5" fill={color} opacity="0.7"/><circle cx="56" cy="6" r="1.5" fill={color} opacity="0.7"/>
    <rect x="84" y="20" width="6" height="24" rx="2" fill={color} opacity="0.82"/>
    <rect x="26" y="29" width="56" height="3.5" fill="#F5C842" opacity="0.55"/>
    {[29,41,53,65].map(x=><rect key={x} x={x} y="21" width="9" height="9" rx="1" fill="#C9E8F5" opacity="0.75"/>)}
    <rect x="5" y="18" width="3.5" height="5.5" rx="0.8" fill="#FFFDE7"/>
    <rect x="5" y="25.5" width="3.5" height="3" rx="0.8" fill="#FFCC80"/>
    <rect x="1.5" y="33" width="4.5" height="7" rx="1.5" fill="#D0D0D0"/>
    <rect x="88" y="33" width="4.5" height="7" rx="1.5" fill="#D0D0D0"/>
    <rect x="24" y="20" width="1.5" height="24" fill={color} opacity="0.6"/>
    <circle cx="17" cy="47" r="8" fill="#1A1A1A"/><circle cx="17" cy="47" r="5" fill="#2E2E2E"/><circle cx="17" cy="47" r="2.5" fill="#555"/><circle cx="17" cy="47" r="1" fill="#888"/>
    <circle cx="73" cy="47" r="8" fill="#1A1A1A"/><circle cx="73" cy="47" r="5" fill="#2E2E2E"/><circle cx="73" cy="47" r="2.5" fill="#555"/><circle cx="73" cy="47" r="1" fill="#888"/>
  </svg>
);

// ─── Shared UI ────────────────────────────────────────────────────────────────
const StatusBadge = ({status}:{status:"profitable"|"money-pit"}) =>
  status==="profitable"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Profitable</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200/80 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-red-400"/>Money Pit</span>;

const KpiCard = ({label,value,sub,trend,icon:Icon,accent}:{label:string;value:string;sub:string;trend?:"up"|"down";icon:React.ComponentType<{className?:string}>;accent?:string}) => (
  <div className="bg-card border border-border rounded-xl px-4 py-3.5 lg:px-5 lg:py-4">
    <div className="flex items-center justify-between mb-2.5">
      <span className="text-[9px] lg:text-[10px] text-muted-foreground font-mono tracking-widest uppercase leading-none">{label}</span>
      <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{backgroundColor:accent?`${accent}18`:"#ECEAE5"}}>
        <Icon className="w-3 h-3 lg:w-3.5 lg:h-3.5" style={{color:accent??"#6B6860"} as React.CSSProperties}/>
      </div>
    </div>
    <p className="font-mono text-[18px] lg:text-[22px] font-bold tracking-tight leading-none mb-1.5">{value}</p>
    <p className="text-[10px] lg:text-[11px] text-muted-foreground flex items-center gap-1">
      {trend==="up"&&<TrendingUp className="w-3 h-3 text-emerald-600 flex-shrink-0"/>}
      {trend==="down"&&<TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0"/>}
      <span className="truncate">{sub}</span>
    </p>
  </div>
);

const ChartTip = ({active,payload,label}:{active?:boolean;payload?:{name:string;value:number;color:string}[];label?:string}) =>
  active&&payload?.length?(
    <div className="bg-[#1C2B4A] text-white text-[10px] rounded-md px-2.5 py-1.5 shadow-xl border border-white/10">
      <p className="font-medium mb-1 text-white/60 font-mono">{label}</p>
      {payload.map(e=><p key={e.name} className="font-mono" style={{color:e.color}}>{e.name}: ₱{e.value?.toLocaleString()}</p>)}
    </div>
  ):null;

const Spinner = ({size="sm"}:{size?:"sm"|"lg"}) => (
  <div className={`rounded-full border-2 border-[#1C2B4A]/20 border-t-[#C8922A] animate-spin flex-shrink-0 ${size==="lg"?"w-10 h-10":"w-4 h-4"}`}/>
);

const EmptyState = ({icon:Icon,title,sub}:{icon:React.ComponentType<{className?:string}>;title:string;sub:string}) => (
  <div className="flex flex-col items-center justify-center py-16 lg:py-24 text-muted-foreground px-6 text-center">
    <Icon className="w-9 h-9 mb-4 opacity-25"/>
    <p className="text-[14px] font-medium text-foreground">{title}</p>
    <p className="text-[12px] mt-1 max-w-[240px]">{sub}</p>
  </div>
);

// ─── Input helper ─────────────────────────────────────────────────────────────
const Field = ({label,error,children}:{label:string;error?:string;children:React.ReactNode}) => (
  <div>
    <label className="block text-[10px] font-semibold text-muted-foreground font-mono tracking-widest uppercase mb-1.5">{label}</label>
    {children}
    {error&&<p className="text-[10px] text-red-500 mt-1">{error}</p>}
  </div>
);

const inputCls = (err?:string) =>
  `w-full px-3.5 py-3 rounded-xl border text-[13px] bg-background outline-none focus:ring-2 focus:ring-[#C8922A]/40 transition-shadow ${err?"border-red-400":"border-border"}`;

// ─── Login Screen ─────────────────────────────────────────────────────────────
const LoginScreen = ({onLogin,loading,error}:{onLogin:(u:string,p:string)=>Promise<void>;loading:boolean;error:string}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(username.trim(), password);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 py-8" style={{backgroundColor:"#1C2B4A"}}>
      <div className="w-full max-w-[360px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl" style={{backgroundColor:"#C8922A"}}>
            <svg viewBox="0 0 24 16" fill="none" className="w-9 h-6">
              <rect x="0.5" y="5" width="23" height="9" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="0.5" y="1.5" width="8" height="12" rx="1.5" fill="white"/>
              <rect x="0.5" y="0.5" width="23" height="3" rx="1" fill="#FFD54F"/>
              <circle cx="5.5" cy="15" r="2" fill="white" opacity="0.65"/>
              <circle cx="18.5" cy="15" r="2" fill="white" opacity="0.65"/>
            </svg>
          </div>
          <h1 className="text-white font-bold text-2xl tracking-tight">JeepTrack</h1>
          <p className="text-[13px] mt-1" style={{color:"rgba(255,255,255,0.45)"}}>Fleet Manager · Metro Manila</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-[16px] font-bold tracking-tight">Welcome back</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Sign in to your fleet account</p>
          </div>
          <form onSubmit={handle} className="px-6 pb-6 pt-4 space-y-4">
            <Field label="Username">
              <input
                value={username} onChange={e=>setUsername(e.target.value)}
                placeholder="e.g. admin" autoComplete="username" autoCapitalize="none"
                className={inputCls()} disabled={loading}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  type={showPw?"text":"password"}
                  value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className={`${inputCls()} pr-11`} disabled={loading}
                />
                <button type="button" onClick={()=>setShowPw(v=>!v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
            </Field>

            {error&&(
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px]">
                <AlertCircle className="w-4 h-4 flex-shrink-0"/>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading||!username||!password}
              className="w-full py-3.5 rounded-xl text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity active:opacity-80"
              style={{backgroundColor:"#C8922A"}}>
              {loading?<><Spinner/>Signing in…</>:"Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] mt-6" style={{color:"rgba(255,255,255,0.3)"}}>
          Accounts are created when adding units · Contact your administrator
        </p>
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const DashboardView = ({units,logs}:{units:Unit[];logs:LogEntry[]}) => {
  const [filter,setFilter] = useState<"all"|"profitable"|"money-pit">("all");
  const enriched = useMemo(()=>units.map(u=>{
    const uLogs=logs.filter(l=>l.unitId===u.id);
    const net=uLogs.reduce((s,l)=>s+entryNet(l,u),0);
    const status:("profitable"|"money-pit")=net>=0?"profitable":"money-pit";
    const now=new Date();
    const sparkline=Array.from({length:6},(_,i)=>{
      const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);
      const ml=uLogs.filter(l=>{const ld=new Date(l.date);return ld.getFullYear()===d.getFullYear()&&ld.getMonth()===d.getMonth();});
      return{month:MONTH_NAMES[d.getMonth()].slice(0,3),income:Math.round(ml.reduce((s,l)=>s+l.earnings,0)/1000),maintenance:Math.round(ml.reduce((s,l)=>s+l.expenses,0)/1000)};
    });
    return{...u,net,status,sparkline};
  }),[units,logs]);

  const totalNet=enriched.reduce((s,u)=>s+u.net,0);
  const profitable=enriched.filter(u=>u.status==="profitable");
  const moneyPits=enriched.filter(u=>u.status==="money-pit");
  const best=enriched.length?enriched.reduce((b,u)=>u.net>b.net?u:b,enriched[0]):null;
  const filtered=filter==="all"?enriched:enriched.filter(u=>u.status===filter);

  if(!units.length) return <EmptyState icon={Truck} title="No units registered yet" sub="Go to My Units to add your first jeepney."/>;
  return (
    <div className="px-4 lg:px-7 py-5 lg:py-6 space-y-5 lg:space-y-7">
      <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <KpiCard label="Fleet Net" value={fmtPHPc(totalNet)} sub="All units" trend={totalNet>=0?"up":"down"} icon={Wallet} accent="#C8922A"/>
        <KpiCard label="Profitable" value={`${profitable.length}/${units.length}`} sub={`${Math.round(profitable.length/Math.max(units.length,1)*100)}% of fleet`} trend="up" icon={TrendingUp} accent="#059669"/>
        <KpiCard label="Money Pits" value={`${moneyPits.length}`} sub="Need attention" trend={moneyPits.length>0?"down":undefined} icon={TrendingDown} accent="#DC2626"/>
        {best&&<KpiCard label="Top Unit" value={best.plate} sub={fmtPHPc(best.net)+" net"} trend="up" icon={Star} accent="#C8922A"/>}
      </div>
      <section>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-[14px] lg:text-[15px] font-bold tracking-tight leading-none">Unit Profitability</h2>
            <p className="text-[11px] text-muted-foreground mt-1 hidden sm:block">Last 6 months per unit</p>
          </div>
          <div className="flex items-center bg-secondary rounded-lg p-1 gap-0.5 flex-shrink-0">
            {(["all","profitable","money-pit"] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)} className={`px-2.5 lg:px-3 py-1.5 rounded-md text-[10px] lg:text-[11px] font-medium transition-all whitespace-nowrap ${filter===f?"bg-card text-foreground shadow-sm border border-border":"text-muted-foreground hover:text-foreground"}`}>
                {f==="all"?"All":f==="profitable"?"Profitable":"Money Pit"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(u=>(
            <div key={u.id} className="bg-card border border-border rounded-xl p-4 lg:p-5 active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between mb-1">
                <div className="min-w-0 mr-2">
                  <p className="text-[9px] text-muted-foreground font-mono tracking-widest uppercase mb-0.5">Plate No.</p>
                  <p className="font-mono font-bold text-[14px] lg:text-[15px] tracking-wider">{u.plate}</p>
                </div>
                <StatusBadge status={u.status}/>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3 truncate">{u.route}</p>
              <div className="rounded-lg p-2.5 mb-3.5 h-[64px] lg:h-[68px] flex items-end justify-center overflow-hidden" style={{backgroundColor:`${u.color}12`}}>
                <div className="w-full max-w-[180px] h-full"><JeepneyIcon color={u.color}/></div>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider">Last 6 months</p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="w-3 h-[2px] bg-blue-500 inline-block rounded-full"/>Income</span>
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="w-3 h-[2px] bg-amber-500 inline-block rounded-full"/>Exp.</span>
                  </div>
                </div>
                <div className="h-[48px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={u.sparkline} margin={{top:2,right:2,left:2,bottom:2}}>
                      <Tooltip content={<ChartTip/>} cursor={false}/>
                      <Line type="monotone" dataKey="income" stroke="#3B82F6" strokeWidth={1.5} dot={false} activeDot={{r:2.5,fill:"#3B82F6",strokeWidth:0}}/>
                      <Line type="monotone" dataKey="maintenance" stroke="#F59E0B" strokeWidth={1.5} dot={false} activeDot={{r:2.5,fill:"#F59E0B",strokeWidth:0}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-muted-foreground font-mono tracking-widest uppercase">Net Income</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">{u.driver}</p>
                </div>
                <p className={`font-mono font-bold text-[17px] lg:text-[18px] tracking-tight leading-none ${u.net>=0?"text-emerald-700":"text-red-600"}`}>
                  {u.net<0?"-":""}₱{Math.abs(u.net).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
        {!filtered.length&&<EmptyState icon={Truck} title="No matching units" sub="Try a different filter."/>}
      </section>
    </div>
  );
};

// ─── My Units ─────────────────────────────────────────────────────────────────
type UnitForm = {
  plate:string; driver:string; route:string; color:string; boundary:string;
  username:string; password:string;
};
const BLANK:UnitForm = {plate:"",driver:"",route:"",color:UNIT_COLORS[0],boundary:"2000",username:"",password:""};

const MyUnitsView = ({units,logs,users,onAdd,onEdit,onDelete}:{
  units:Unit[];logs:LogEntry[];users:UserAccount[];
  onAdd:(u:Unit,creds:{username:string;password:string})=>Promise<void>;
  onEdit:(u:Unit,creds?:{username:string;password:string})=>Promise<void>;
  onDelete:(id:string)=>Promise<void>;
}) => {
  const [modal,setModal]     = useState<{open:boolean;mode:"add"|"edit";unit?:Unit}>({open:false,mode:"add"});
  const [form,setForm]       = useState<UnitForm>(BLANK);
  const [errors,setErrors]   = useState<Partial<UnitForm>>({});
  const [saving,setSaving]   = useState(false);
  const [deleteId,setDeleteId]     = useState<string|null>(null);
  const [deletingId,setDeletingId] = useState<string|null>(null);
  const [showPw,setShowPw]   = useState(false);

  const openAdd  = () => { setForm(BLANK); setErrors({}); setShowPw(false); setModal({open:true,mode:"add"}); };
  const openEdit = (u:Unit) => {
    const acct = users.find(a=>a.unitId===u.id);
    setForm({plate:u.plate,driver:u.driver,route:u.route,color:u.color,boundary:String(u.boundary),username:acct?.username??"",password:""});
    setErrors({}); setShowPw(false); setModal({open:true,mode:"edit",unit:u});
  };
  const closeModal = () => { if(!saving) setModal(m=>({...m,open:false})); };

  const validate = ():boolean => {
    const e:Partial<UnitForm>={};
    if(!form.plate.trim())    e.plate="Required";
    if(!form.driver.trim())   e.driver="Required";
    if(!form.route.trim())    e.route="Required";
    if(!form.boundary||isNaN(Number(form.boundary))||Number(form.boundary)<0) e.boundary="Valid amount required";
    if(modal.mode==="add"){
      if(!form.username.trim()) e.username="Required";
      else if(users.find(a=>a.username===form.username.trim()&&a.unitId!==modal.unit?.id)) e.username="Username already taken";
      if(!form.password.trim()) e.password="Required";
      else if(form.password.length<6)               e.password="Min. 6 characters";
    } else {
      if(form.username.trim()&&users.find(a=>a.username===form.username.trim()&&a.unitId!==modal.unit?.id)) e.username="Username already taken";
      if(form.password&&form.password.length<6) e.password="Min. 6 characters";
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if(!validate()) return;
    setSaving(true);
    try {
      const u:Unit={id:modal.unit?.id??uid(),plate:form.plate.trim().toUpperCase(),driver:form.driver.trim(),route:form.route.trim(),color:form.color,boundary:Number(form.boundary)};
      const creds = form.username.trim() ? {username:form.username.trim(),password:form.password} : undefined;
      if(modal.mode==="add") {
        await onAdd(u, {username:form.username.trim(),password:form.password});
      } else {
        await onEdit(u, creds);
      }
      setModal(m=>({...m,open:false}));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id:string) => {
    setDeletingId(id);
    try { await onDelete(id); } finally { setDeletingId(null); setDeleteId(null); }
  };

  return (
    <div className="px-4 lg:px-7 py-5 lg:py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[14px] lg:text-[15px] font-bold tracking-tight">My Units</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{units.length} registered unit{units.length!==1?"s":""}</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white text-[12px] lg:text-[13px] font-medium active:opacity-80 transition-opacity" style={{backgroundColor:"#1C2B4A"}}>
          <Plus className="w-4 h-4"/><span className="hidden sm:inline">Add Unit</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="space-y-3">
        {units.map(u=>{
          const net=unitNet(u.id,logs,units);
          const status:("profitable"|"money-pit")=net>=0?"profitable":"money-pit";
          const uLogs=logs.filter(l=>l.unitId===u.id);
          const acct=users.find(a=>a.unitId===u.id);
          const isDel=deletingId===u.id;
          return (
            <div key={u.id} className={`bg-card border border-border rounded-xl p-4 transition-all ${isDel?"opacity-50":""}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-14 h-9 flex-shrink-0 rounded-lg overflow-hidden" style={{backgroundColor:`${u.color}15`}}><JeepneyIcon color={u.color}/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono font-bold text-[13px] lg:text-[14px] tracking-wider">{u.plate}</p>
                    <StatusBadge status={status}/>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{u.route}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-3 border-y border-border/60">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wide">Driver</p>
                  <p className="text-[12px] font-medium truncate mt-0.5">{u.driver}</p>
                </div>
                <div className="text-center flex-shrink-0">
                  <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wide">Boundary</p>
                  <p className="font-mono text-[12px] font-semibold text-[#C8922A] mt-0.5">{fmtPHP(u.boundary)}<span className="text-muted-foreground font-normal text-[9px]">/day</span></p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-wide">Net</p>
                  <p className={`font-mono text-[12px] font-bold mt-0.5 ${net>=0?"text-emerald-700":"text-red-600"}`}>{fmtPHPc(net)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">{uLogs.length} log{uLogs.length!==1?"s":""}</p>
                  {acct&&<p className="text-[10px] text-muted-foreground font-mono">@{acct.username}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {deleteId===u.id
                    ? <div className="flex items-center gap-2">
                        <span className="text-[11px] text-red-600 font-medium">Delete?</span>
                        <button onClick={()=>handleDelete(u.id)} disabled={isDel} className="h-8 px-3 rounded-lg bg-red-500 text-white text-[11px] font-medium disabled:opacity-50 flex items-center gap-1.5">{isDel&&<Spinner/>}Yes</button>
                        <button onClick={()=>setDeleteId(null)} className="h-8 px-3 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground">No</button>
                      </div>
                    : <>
                        <button onClick={()=>openEdit(u)} disabled={isDel} className="h-9 px-4 rounded-xl border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5 disabled:opacity-40"><Pencil className="w-3.5 h-3.5"/>Edit</button>
                        <button onClick={()=>setDeleteId(u.id)} disabled={isDel} className="h-9 px-3 rounded-xl border border-red-200 text-[12px] text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"><Trash2 className="w-3.5 h-3.5"/></button>
                      </>
                  }
                </div>
              </div>
            </div>
          );
        })}
        {!units.length&&<EmptyState icon={Truck} title="No units yet" sub="Tap Add to register your first jeepney."/>}
      </div>

      {/* ── Modal: flex-col so header + footer are sticky, body scrolls ── */}
      {modal.open&&(
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
          <div className="w-full lg:w-[480px] bg-card rounded-t-2xl lg:rounded-xl shadow-2xl border border-border flex flex-col" style={{maxHeight:"92dvh"}}>

            {/* Fixed header */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-border relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border lg:hidden"/>
              <div className="flex items-center justify-between mt-2 lg:mt-0">
                <h3 className="font-bold text-[14px]">{modal.mode==="add"?"Add New Unit":"Edit Unit"}</h3>
                <button onClick={closeModal} disabled={saving} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary disabled:opacity-40"><X className="w-4 h-4"/></button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{scrollbarWidth:"none"}}>
              {/* Unit details */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground font-mono tracking-widest uppercase mb-3">Unit Details</p>
                <div className="space-y-4">
                  {([["plate","Plate Number","e.g. PUJ-7777"],["driver","Driver Name","Full name"],["route","Route","e.g. Cubao – Monumento"]] as const).map(([k,lbl,ph])=>(
                    <Field key={k} label={lbl} error={errors[k]}>
                      <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} disabled={saving} className={inputCls(errors[k])}/>
                    </Field>
                  ))}
                  <Field label="Daily Boundary (PHP)" error={errors.boundary}>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₱</span>
                      <input type="number" min="0" value={form.boundary} onChange={e=>setForm(f=>({...f,boundary:e.target.value}))} disabled={saving} className={`${inputCls(errors.boundary)} pl-8`}/>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Fixed daily fee the driver remits to the owner.</p>
                  </Field>
                  <Field label="Unit Color">
                    <div className="flex flex-wrap gap-2.5 pt-0.5">
                      {UNIT_COLORS.map(c=>(
                        <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} disabled={saving}
                          className="w-9 h-9 rounded-full border-2 transition-all disabled:opacity-60"
                          style={{backgroundColor:c,borderColor:form.color===c?"#C8922A":"transparent",boxShadow:form.color===c?"0 0 0 2px white,0 0 0 4px #C8922A":"none"}}/>
                      ))}
                    </div>
                  </Field>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border"/>

              {/* Account credentials */}
              <div>
                <p className="text-[10px] font-bold text-muted-foreground font-mono tracking-widest uppercase mb-0.5">Account Credentials</p>
                <p className="text-[11px] text-muted-foreground mb-3">
                  {modal.mode==="add"?"This account lets the unit driver log in to JeepTrack.":"Leave password blank to keep the existing password."}
                </p>
                <div className="space-y-4">
                  <Field label="Username" error={errors.username}>
                    <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="e.g. driver_puj1234"
                      autoCapitalize="none" disabled={saving} className={inputCls(errors.username)}/>
                  </Field>
                  <Field label={modal.mode==="add"?"Password":"New Password (optional)"} error={errors.password}>
                    <div className="relative">
                      <input type={showPw?"text":"password"} value={form.password}
                        onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                        placeholder={modal.mode==="add"?"Min. 6 characters":"Leave blank to keep current"}
                        disabled={saving} className={`${inputCls(errors.password)} pr-11`}/>
                      <button type="button" onClick={()=>setShowPw(v=>!v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                      </button>
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            {/* Fixed footer */}
            <div className="flex-shrink-0 px-5 pt-4 pb-24 lg:pb-5 border-t border-border flex gap-3">
              <button onClick={closeModal} disabled={saving} className="flex-1 py-3 rounded-xl border border-border text-[13px] font-medium text-muted-foreground disabled:opacity-40">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="flex-1 py-3 rounded-xl text-white text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2" style={{backgroundColor:"#1C2B4A"}}>
                {saving&&<Spinner/>}{modal.mode==="add"?"Add Unit":"Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Calendar ─────────────────────────────────────────────────────────────────
const MonthCalendar = ({year,month,logs,unit,onDayClick,selectedDate}:{year:number;month:number;logs:LogEntry[];unit:Unit|undefined;onDayClick:(d:string)=>void;selectedDate:string}) => {
  const dim=new Date(year,month+1,0).getDate(),first=new Date(year,month,1).getDay();
  const cells:(number|null)[]=[...Array(first).fill(null),...Array.from({length:dim},(_,i)=>i+1)];
  while(cells.length%7!==0) cells.push(null);
  const ds:Record<number,"green"|"red">={};
  if(unit){for(let d=1;d<=dim;d++){const s=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;const dl=logs.filter(l=>l.unitId===unit.id&&l.date===s);if(dl.length){const n=dl.reduce((sum,l)=>sum+entryNet(l,unit),0);ds[d]=n>=0?"green":"red";}}}
  const td=new Date(),itm=td.getFullYear()===year&&td.getMonth()===month;
  return (
    <div>
      <div className="grid grid-cols-7 mb-1">{DAY_ABBR.map(d=><div key={d} className="text-center text-[9px] font-mono text-muted-foreground py-1 tracking-wider">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day,i)=>{
          if(!day) return <div key={i}/>;
          const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const s=ds[day],isSel=selectedDate===dateStr,isToday=itm&&td.getDate()===day;
          return(
            <button key={i} onClick={()=>onDayClick(dateStr)} className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-mono transition-all min-h-[36px] ${isSel?"bg-[#1C2B4A] text-white":isToday?"bg-[#C8922A]/15 text-[#C8922A] font-bold":"hover:bg-secondary active:bg-secondary text-foreground"}`}>
              {day}
              {s&&<span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${s==="green"?"bg-emerald-500":"bg-red-400"}`}/>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Net positive</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Net loss</span>
      </div>
    </div>
  );
};

// ─── Log Expenses ─────────────────────────────────────────────────────────────
const LogExpensesView = ({units,logs,onAdd,onDelete,lockedUnit=false}:{units:Unit[];logs:LogEntry[];onAdd:(l:LogEntry)=>Promise<void>;onDelete:(id:string)=>Promise<void>;lockedUnit?:boolean}) => {
  const [selUnitId,setSelUnitId] = useState(units[0]?.id??"");
  const [date,setDate]           = useState(todayStr);
  const [earnings,setEarnings]   = useState("");
  const [expAmt,setExpAmt]       = useState("");
  const [expCat,setExpCat]       = useState("Fuel");
  const [notes,setNotes]         = useState("");
  const [calMonth,setCalMonth]   = useState<{year:number;month:number}>(()=>{const n=new Date();return{year:n.getFullYear(),month:n.getMonth()};});
  const [submitted,setSubmitted] = useState(false);
  const [saving,setSaving]       = useState(false);
  const [deletingId,setDeletingId]=useState<string|null>(null);

  useEffect(()=>{if(units.length&&!units.find(u=>u.id===selUnitId))setSelUnitId(units[0].id);},[units]);

  const selUnit=units.find(u=>u.id===selUnitId);
  const earningsNum=earnings===""?0:Number(earnings)||0;
  const expNum=expAmt===""?0:Number(expAmt)||0;
  const net=earningsNum-expNum;
  const nvb=selUnit?net-selUnit.boundary:null;

  const handleAdd=async()=>{
    if(!selUnitId||!date) return;
    setSaving(true);
    try{
      await onAdd({id:uid(),unitId:selUnitId,date,earnings:earningsNum,expenses:expNum,expenseCategory:expCat,notes});
      setEarnings("");setExpAmt("");setNotes("");setSubmitted(true);setTimeout(()=>setSubmitted(false),2500);
    }finally{setSaving(false);}
  };

  const recentLogs=useMemo(()=>[...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30),[logs]);
  if(!units.length) return <EmptyState icon={Truck} title="No units registered" sub="Add a unit in My Units before logging expenses."/>;

  return (
    <div className="px-4 lg:px-7 py-5 lg:py-6 space-y-5">
      <div>
        <h2 className="text-[14px] lg:text-[15px] font-bold tracking-tight">Log Expenses & Earnings</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Record daily earnings and expenses per unit</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5 space-y-4">
          {submitted&&(
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium">
              <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"><svg viewBox="0 0 8 8" fill="none" className="w-3 h-3"><path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg></span>
              Log entry saved to Supabase.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-semibold text-muted-foreground font-mono tracking-widest uppercase mb-1.5">Unit</label>
              {lockedUnit ? (
                <div className="w-full px-3.5 py-3 rounded-xl border border-border text-[13px] font-mono bg-secondary text-muted-foreground flex items-center gap-2">
                  <Truck className="w-4 h-4 flex-shrink-0"/>
                  {units[0]?.plate ?? "—"}
                </div>
              ) : (
                <select value={selUnitId} onChange={e=>setSelUnitId(e.target.value)} className="w-full px-3.5 py-3 rounded-xl border border-border text-[13px] bg-background outline-none focus:ring-2 focus:ring-[#C8922A]/40">
                  {units.map(u=><option key={u.id} value={u.id}>{u.plate}</option>)}
                </select>
              )}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-semibold text-muted-foreground font-mono tracking-widest uppercase mb-1.5">Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full px-3.5 py-3 rounded-xl border border-border text-[13px] font-mono bg-background outline-none focus:ring-2 focus:ring-[#C8922A]/40"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground font-mono tracking-widest uppercase mb-1.5">Earnings</label>
              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-[13px]">₱</span>
                <input type="number" min="0" value={earnings} onChange={e=>setEarnings(e.target.value)} placeholder="0" className="w-full pl-8 pr-3.5 py-3 rounded-xl border border-border text-[13px] font-mono bg-background outline-none focus:ring-2 focus:ring-[#C8922A]/40"/>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Blank = no operation</p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground font-mono tracking-widest uppercase mb-1.5">Expenses</label>
              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-[13px]">₱</span>
                <input type="number" min="0" value={expAmt} onChange={e=>setExpAmt(e.target.value)} placeholder="0" className="w-full pl-8 pr-3.5 py-3 rounded-xl border border-border text-[13px] font-mono bg-background outline-none focus:ring-2 focus:ring-[#C8922A]/40"/>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground font-mono tracking-widest uppercase mb-1.5">Category</label>
              <select value={expCat} onChange={e=>setExpCat(e.target.value)} className="w-full px-3.5 py-3 rounded-xl border border-border text-[13px] bg-background outline-none focus:ring-2 focus:ring-[#C8922A]/40">
                {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground font-mono tracking-widest uppercase mb-1.5">Notes</label>
              <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional" className="w-full px-3.5 py-3 rounded-xl border border-border text-[13px] bg-background outline-none focus:ring-2 focus:ring-[#C8922A]/40"/>
            </div>
          </div>
          {selUnit&&(
            <div className="rounded-xl border border-border p-4 space-y-2" style={{backgroundColor:"#F9F8F6"}}>
              <p className="text-[9px] font-mono tracking-widest uppercase text-muted-foreground mb-2.5">Daily Computation</p>
              {[["Boundary",fmtPHP(selUnit.boundary),"text-[#C8922A]"],["Gross Earnings",fmtPHP(earningsNum),"text-foreground"],["Other Expenses",`–${fmtPHP(expNum)}`,"text-muted-foreground"]].map(([l,v,c])=>(
                <div key={l} className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{l}</span><span className={`font-mono text-[12px] font-medium ${c}`}>{v}</span></div>
              ))}
              <div className="h-px bg-border my-1.5"/>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">Net Income</span>
                <span className={`font-mono text-[16px] font-bold ${net>=0?"text-emerald-700":"text-red-600"}`}>{fmtPHP(net)}</span>
              </div>
              {nvb!==null&&<div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">vs. Boundary</span>
                <span className={`font-mono text-[11px] font-medium flex items-center gap-1 ${nvb>=0?"text-emerald-600":"text-red-500"}`}>{nvb>=0?<TrendingUp className="w-3 h-3"/>:<TrendingDown className="w-3 h-3"/>}{nvb>=0?"+":""}{fmtPHP(nvb)}</span>
              </div>}
              {nvb!==null&&<div className={`px-3 py-2 rounded-lg text-[11px] font-medium ${nvb>=0?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>{nvb>=0?`Above boundary by ${fmtPHP(nvb)} — good day!`:`Below boundary by ${fmtPHP(Math.abs(nvb))} — shortfall.`}</div>}
            </div>
          )}
          <button onClick={handleAdd} disabled={!selUnitId||!date||saving} className="w-full py-3.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50 active:opacity-80 transition-opacity flex items-center justify-center gap-2" style={{backgroundColor:"#1C2B4A"}}>
            {saving?<><Spinner/>Saving…</>:<><Plus className="w-4 h-4"/>Add Log Entry</>}
          </button>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={()=>setCalMonth(m=>{const d=new Date(m.year,m.month-1,1);return{year:d.getFullYear(),month:d.getMonth()};})} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary active:bg-secondary"><ChevronLeft className="w-4 h-4"/></button>
            <p className="text-[13px] font-semibold">{MONTH_NAMES[calMonth.month]} {calMonth.year}</p>
            <button onClick={()=>setCalMonth(m=>{const d=new Date(m.year,m.month+1,1);return{year:d.getFullYear(),month:d.getMonth()};})} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary active:bg-secondary"><ChevronRight className="w-4 h-4"/></button>
          </div>
          {!lockedUnit && (
            <div className="mb-3">
              <select value={selUnitId} onChange={e=>setSelUnitId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border text-[11px] font-mono bg-background outline-none">
                {units.map(u=><option key={u.id} value={u.id}>{u.plate}</option>)}
              </select>
            </div>
          )}
          <MonthCalendar year={calMonth.year} month={calMonth.month} logs={logs} unit={selUnit} onDayClick={d=>{setDate(d);setCalMonth({year:parseInt(d.slice(0,4)),month:parseInt(d.slice(5,7))-1});}} selectedDate={date}/>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 lg:px-5 py-3.5 border-b border-border flex items-center justify-between">
          <p className="text-[13px] font-semibold">Recent Log Entries</p>
          <p className="text-[11px] text-muted-foreground font-mono">{logs.length} total</p>
        </div>
        {!logs.length
          ? <div className="text-center py-10 text-muted-foreground text-[12px]">No entries yet.</div>
          : <>
              <div className="lg:hidden divide-y divide-border/60">
                {recentLogs.map(l=>{
                  const u=units.find(x=>x.id===l.unitId);
                  const n=entryNet(l,u);
                  const isDel=deletingId===l.id;
                  return(
                    <div key={l.id} className={`px-4 py-3 transition-opacity ${isDel?"opacity-40":""}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div><span className="font-mono font-bold text-[12px]">{u?.plate??"—"}</span><span className="text-muted-foreground text-[11px] ml-2 font-mono">{l.date}</span></div>
                        <button onClick={()=>{setDeletingId(l.id);onDelete(l.id).finally(()=>setDeletingId(null));}} disabled={isDel} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-40 flex-shrink-0">{isDel?<Spinner/>:<Trash2 className="w-3.5 h-3.5"/>}</button>
                      </div>
                      <div className="flex items-center gap-4">
                        <div><p className="text-[9px] text-muted-foreground uppercase font-mono">Earnings</p><p className="font-mono text-[12px] font-medium text-emerald-700">{fmtPHP(l.earnings)}</p></div>
                        <div><p className="text-[9px] text-muted-foreground uppercase font-mono">Expenses</p><p className="font-mono text-[12px] font-medium text-amber-600">{fmtPHP(l.expenses)}</p></div>
                        <div><p className="text-[9px] text-muted-foreground uppercase font-mono">Net</p><p className={`font-mono text-[12px] font-bold ${n>=0?"text-emerald-700":"text-red-600"}`}>{fmtPHP(n)}</p></div>
                        <div className="ml-auto"><span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-muted-foreground">{l.expenseCategory}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="border-b border-border bg-secondary/50">{["Unit","Date","Earnings","Expenses","Net","Category","Notes",""].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-mono text-muted-foreground tracking-widest uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody>{recentLogs.map(l=>{const u=units.find(x=>x.id===l.unitId);const n=entryNet(l,u);const isDel=deletingId===l.id;return(
                    <tr key={l.id} className={`border-b border-border/60 hover:bg-secondary/30 transition-colors ${isDel?"opacity-40":""}`}>
                      <td className="px-4 py-2.5 font-mono font-medium text-[11px]">{u ? `${u.plate ?? "—"} - ${u.driver ?? "No Driver"}` : "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{l.date}</td>
                      <td className="px-4 py-2.5 font-mono text-emerald-700">{fmtPHP(l.earnings)}</td>
                      <td className="px-4 py-2.5 font-mono text-amber-600">{fmtPHP(l.expenses)}</td>
                      <td className={`px-4 py-2.5 font-mono font-semibold ${n>=0?"text-emerald-700":"text-red-600"}`}>{fmtPHP(n)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{l.expenseCategory}</td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[120px]">{l.notes||"—"}</td>
                      <td className="px-4 py-2.5"><button onClick={()=>{setDeletingId(l.id);onDelete(l.id).finally(()=>setDeletingId(null));}} disabled={isDel} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-40">{isDel?<Spinner/>:<Trash2 className="w-3 h-3"/>}</button></td>
                    </tr>
                  );})}</tbody>
                </table>
              </div>
            </>
        }
      </div>
    </div>
  );
};

// ─── Analytics ────────────────────────────────────────────────────────────────
const PIE_COLORS=["#3B82F6","#F59E0B","#10B981","#8B5CF6","#EF4444","#EC4899"];

const AnalyticsView = ({units,logs}:{units:Unit[];logs:LogEntry[]}) => {
  const monthlyData=useMemo(()=>{const map:Record<string,{month:string;earnings:number;costs:number;net:number}>={};logs.forEach(l=>{const d=new Date(l.date),u=units.find(x=>x.id===l.unitId);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(!map[key])map[key]={month:MONTH_NAMES[d.getMonth()].slice(0,3)+" '"+String(d.getFullYear()).slice(2),earnings:0,costs:0,net:0};map[key].earnings+=l.earnings;map[key].costs+=entryCost(l,u);});return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([,v])=>({...v,net:v.earnings-v.costs}));},[logs,units]);
  const unitNetData=useMemo(()=>units.map(u=>({plate:u.plate,net:unitNet(u.id,logs,units),color:u.color})).sort((a,b)=>b.net-a.net),[units,logs]);
  const catData=useMemo(()=>{const m:Record<string,number>={};logs.forEach(l=>{m[l.expenseCategory]=(m[l.expenseCategory]??0)+l.expenses;});return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);},[logs]);
  const totalE=logs.reduce((s,l)=>s+l.earnings,0);
  const totalC=logs.reduce((s,l)=>s+entryCost(l,units.find(u=>u.id===l.unitId)),0);
  const totalNet=totalE-totalC;
  const best=unitNetData[0],worst=unitNetData[unitNetData.length-1];
  if(!units.length||!logs.length) return <EmptyState icon={BarChart3} title="No data to analyze yet" sub="Add units and log expenses to see analytics."/>;
  return (
    <div className="px-4 lg:px-7 py-5 lg:py-6 space-y-5">
      <div><h2 className="text-[14px] lg:text-[15px] font-bold tracking-tight">Analytics</h2><p className="text-[11px] text-muted-foreground mt-0.5">Fleet-wide financial overview</p></div>
      <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
        <KpiCard label="Total Earned" value={fmtPHPc(totalE)} sub="All logs" trend="up" icon={TrendingUp} accent="#059669"/>
        <KpiCard label="Total Costs"  value={fmtPHPc(totalC)} sub="Exp + boundary" trend="down" icon={TrendingDown} accent="#DC2626"/>
        <KpiCard label="Net Profit"   value={fmtPHPc(totalNet)} sub={totalNet>=0?"Profitable":"In deficit"} trend={totalNet>=0?"up":"down"} icon={Wallet} accent="#C8922A"/>
        <KpiCard label="Log Entries"  value={String(logs.length)} sub={`${units.length} unit${units.length!==1?"s":""}`} icon={Star} accent="#1C2B4A"/>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
        <p className="text-[13px] font-semibold mb-0.5">Monthly Earnings vs Costs</p>
        <p className="text-[11px] text-muted-foreground mb-4">All units combined</p>
        <div className="h-[180px] lg:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barGap={3} margin={{top:0,right:8,bottom:0,left:8}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:9,fontFamily:"DM Mono",fill:"#6B6860"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>fmtPHPc(v)} tick={{fontSize:9,fontFamily:"DM Mono",fill:"#6B6860"}} axisLine={false} tickLine={false} width={52}/>
              <Tooltip content={<ChartTip/>} cursor={{fill:"rgba(0,0,0,0.03)"}}/>
              <Bar dataKey="earnings" name="earnings" fill="#3B82F6" radius={[3,3,0,0]} maxBarSize={28}/>
              <Bar dataKey="costs"    name="costs"    fill="#F59E0B" radius={[3,3,0,0]} maxBarSize={28}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block"/>Earnings</span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"/>Costs</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <p className="text-[13px] font-semibold mb-0.5">Net Income by Unit</p>
          <p className="text-[11px] text-muted-foreground mb-4">All-time net per unit</p>
          <div className="h-[160px] lg:h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitNetData} layout="vertical" margin={{top:0,right:8,bottom:0,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false}/>
                <XAxis type="number" tickFormatter={v=>fmtPHPc(v)} tick={{fontSize:9,fontFamily:"DM Mono",fill:"#6B6860"}} axisLine={false} tickLine={false}/>
                <YAxis dataKey="plate" type="category" tick={{fontSize:9,fontFamily:"DM Mono",fill:"#6B6860"}} axisLine={false} tickLine={false} width={65}/>
                <Tooltip content={<ChartTip/>} cursor={{fill:"rgba(0,0,0,0.03)"}}/>
                <Bar dataKey="net" name="net" radius={[0,3,3,0]} maxBarSize={18}>{unitNetData.map((_,i)=><Cell key={i} fill={unitNetData[i].net>=0?"#10B981":"#EF4444"}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <p className="text-[13px] font-semibold mb-0.5">Expense Breakdown</p>
          <p className="text-[11px] text-muted-foreground mb-4">By category</p>
          {catData.length?<>
            <div className="h-[120px] lg:h-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={catData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>{catData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip formatter={(v:number)=>[fmtPHP(v),"Amount"]} contentStyle={{fontSize:11,fontFamily:"DM Mono",background:"#1C2B4A",border:"none",borderRadius:6,color:"white"}}/></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">{catData.slice(0,6).map((c,i)=>(<div key={c.name} className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{backgroundColor:PIE_COLORS[i%PIE_COLORS.length]}}/>{c.name}</span><span className="font-mono text-[11px] font-medium">{fmtPHPc(c.value)}</span></div>))}</div>
          </>:<div className="text-center py-8 text-muted-foreground text-[11px]">No expense data yet.</div>}
        </div>
      </div>
      {best&&worst&&best.plate!==worst.plate&&(
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 flex items-center gap-3"><div className="w-12 h-8 flex-shrink-0 rounded-lg overflow-hidden" style={{backgroundColor:`${best.color}20`}}><JeepneyIcon color={best.color}/></div><div><p className="text-[9px] text-emerald-600 font-mono tracking-widest uppercase">Best Performer</p><p className="font-mono font-bold text-[14px] text-emerald-800">{best.plate}</p><p className="font-mono text-[12px] text-emerald-700">{fmtPHP(best.net)} net</p></div></div>
          <div className="bg-red-50 border border-red-200/80 rounded-xl p-4 flex items-center gap-3"><div className="w-12 h-8 flex-shrink-0 rounded-lg overflow-hidden" style={{backgroundColor:`${worst.color}20`}}><JeepneyIcon color={worst.color}/></div><div><p className="text-[9px] text-red-500 font-mono tracking-widest uppercase">Needs Attention</p><p className="font-mono font-bold text-[14px] text-red-800">{worst.plate}</p><p className="font-mono text-[12px] text-red-600">{fmtPHP(worst.net)} net</p></div></div>
        </div>
      )}
    </div>
  );
};

// ─── Admin account — hardcoded, never stored in KV ───────────────────────────
const ADMIN: UserAccount = { id:"admin", username:"admin", password:"admin123", role:"admin" };

const resolveUser = (username: string, kvUsers: UserAccount[]): UserAccount | undefined =>
  username === "admin" ? ADMIN : kvUsers.find(u => u.username === username);

const isRlsError = (e: any) =>
  typeof e?.message === "string" && e.message.toLowerCase().includes("row-level security");

// ─── App Root ─────────────────────────────────────────────────────────────────
type AppScreen = "loading" | "setup" | "login" | "app";

export default function App() {
  const [screen,setScreen]          = useState<AppScreen>("loading");
  const [currentUser,setCurrentUser] = useState<UserAccount|null>(null);
  const [users,setUsers]            = useState<UserAccount[]>([]);
  const [units,setUnits]            = useState<Unit[]>([]);
  const [logs,setLogs]              = useState<LogEntry[]>([]);
  const [loginError,setLoginError]  = useState("");
  const [loginLoading,setLoginLoading] = useState(false);
  const [toast,setToast]            = useState<{msg:string;type:"error"|"success"}|null>(null);
  const [activeNav,setActiveNav]    = useState("dashboard");

  const showToast = useCallback((msg:string,type:"error"|"success"="error")=>{
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  },[]);

  // ── Init ──────────────────────────────────────────────────────────────────
  const runInit = useCallback(async () => {
    setScreen("loading");
    try {
      // Probe write access first — catches RLS issues before the user tries to save anything
      await kvSet("__write_probe__", 1);

      // Load unit accounts from KV (admin is hardcoded, never in KV)
      const kvUsers = await kvGet<UserAccount[]>(USERS_KEY) ?? [];
      setUsers(kvUsers);

      // Restore session if one exists
      const saved = sessionStorage.getItem("jt_session");
      if (saved) {
        const { username } = JSON.parse(saved);
        const user = resolveUser(username, kvUsers);
        if (user) {
          setCurrentUser(user);
          const [u,l] = await Promise.all([kvGet<Unit[]>(UNITS_KEY), kvGet<LogEntry[]>(LOGS_KEY)]);
          setUnits(u??[]); setLogs(l??[]);
          setScreen("app"); return;
        }
      }
      setScreen("login");
    } catch(e:any) {
      if (isRlsError(e)) { setScreen("setup"); return; }
      showToast(`Supabase connection error: ${e.message}`);
      setScreen("login");
    }
  }, [showToast]);

  useEffect(() => { runInit(); }, []);

  // ── Login ──
  const handleLogin = useCallback(async(username:string, password:string)=>{
    setLoginLoading(true); setLoginError("");
    try {
      // Admin is always verified locally — no KV read required
      if (username === ADMIN.username) {
        if (password !== ADMIN.password) { setLoginError("Incorrect username or password."); return; }
        sessionStorage.setItem("jt_session", JSON.stringify({ username: ADMIN.username }));
        setCurrentUser(ADMIN);
        const [u,l] = await Promise.all([kvGet<Unit[]>(UNITS_KEY), kvGet<LogEntry[]>(LOGS_KEY)]);
        setUnits(u??[]); setLogs(l??[]);
        setScreen("app"); return;
      }

      // Unit accounts live in KV
      const kvUsers = await kvGet<UserAccount[]>(USERS_KEY) ?? [];
      setUsers(kvUsers);
      const user = kvUsers.find(u => u.username === username && u.password === password);
      if (!user) { setLoginError("Incorrect username or password."); return; }
      sessionStorage.setItem("jt_session", JSON.stringify({ username: user.username }));
      setCurrentUser(user);
      const [u,l] = await Promise.all([kvGet<Unit[]>(UNITS_KEY), kvGet<LogEntry[]>(LOGS_KEY)]);
      setUnits(u??[]); setLogs(l??[]);
      setScreen("app");
    } catch(e:any) { setLoginError(`Connection error: ${e.message}`); }
    finally { setLoginLoading(false); }
  },[]);

  // ── Logout ──
  const handleLogout = useCallback(()=>{
    sessionStorage.removeItem("jt_session");
    setCurrentUser(null); setUnits([]); setLogs([]);
    setScreen("login"); setActiveNav("dashboard");
  },[]);

  // ── Unit CRUD (also manages unit accounts in KV — admin account never touched) ──
  const addUnit = useCallback(async(u:Unit, creds:{username:string;password:string})=>{
    try {
      const [cu, kvUsers] = await Promise.all([kvGet<Unit[]>(UNITS_KEY), kvGet<UserAccount[]>(USERS_KEY)]);
      const newUser:UserAccount = {id:uid(), username:creds.username, password:creds.password, role:"unit", unitId:u.id};
      const nextUnits = [...(cu??[]), u];
      const nextUsers = [...(kvUsers??[]), newUser];
      await Promise.all([kvSet(UNITS_KEY, nextUnits), kvSet(USERS_KEY, nextUsers)]);
      setUnits(nextUnits); setUsers(nextUsers);
    } catch(e:any){ showToast(`Failed to add unit: ${e.message}`); throw e; }
  },[showToast]);

  const editUnit = useCallback(async(u:Unit, creds?:{username:string;password:string})=>{
    try {
      const [cu, kvUsers] = await Promise.all([kvGet<Unit[]>(UNITS_KEY), kvGet<UserAccount[]>(USERS_KEY)]);
      const nextUnits = (cu??[]).map(x => x.id===u.id ? u : x);
      let nextUsers = (kvUsers??[]) as UserAccount[];
      if (creds?.username) {
        nextUsers = nextUsers.map(a => a.unitId!==u.id ? a : {
          ...a, username:creds.username, ...(creds.password ? {password:creds.password} : {}),
        });
      }
      await Promise.all([kvSet(UNITS_KEY, nextUnits), kvSet(USERS_KEY, nextUsers)]);
      setUnits(nextUnits); setUsers(nextUsers);
    } catch(e:any){ showToast(`Failed to update unit: ${e.message}`); throw e; }
  },[showToast]);

  const deleteUnit = useCallback(async(id:string)=>{
    try{
      const [cu,cl,cUsers]=await Promise.all([kvGet<Unit[]>(UNITS_KEY),kvGet<LogEntry[]>(LOGS_KEY),kvGet<UserAccount[]>(USERS_KEY)]);
      await Promise.all([kvSet(UNITS_KEY,(cu??[]).filter((u:any)=>u.id!==id)),kvSet(LOGS_KEY,(cl??[]).filter((l:any)=>l.unitId!==id)),kvSet(USERS_KEY,(cUsers??[]).filter((a:any)=>a.unitId!==id))]);
      setUnits(p=>p.filter(u=>u.id!==id)); setLogs(p=>p.filter(l=>l.unitId!==id)); setUsers(p=>p.filter(a=>a.unitId!==id));
    }catch(e:any){ showToast(`Failed to delete unit: ${e.message}`); throw e; }
  },[showToast]);

  const addLog = useCallback(async(l:LogEntry)=>{
    try{ const c=await kvGet<LogEntry[]>(LOGS_KEY)??[]; await kvSet(LOGS_KEY,[l,...c]); setLogs(p=>[l,...p]); }
    catch(e:any){ showToast(`Failed to save log: ${e.message}`); throw e; }
  },[showToast]);

  const deleteLog = useCallback(async(id:string)=>{
    try{ const c=await kvGet<LogEntry[]>(LOGS_KEY)??[]; await kvSet(LOGS_KEY,c.filter((l:any)=>l.id!==id)); setLogs(p=>p.filter(l=>l.id!==id)); }
    catch(e:any){ showToast(`Failed to delete log: ${e.message}`); throw e; }
  },[showToast]);

  // ── Role-based data filtering ─────────────────────────────────────────────
  const isAdmin = currentUser?.role === "admin";

  // Unit accounts only see their own unit + its logs
  const visibleUnits = isAdmin ? units : units.filter(u => u.id === currentUser?.unitId);
  const visibleLogs  = isAdmin ? logs  : logs.filter(l => l.unitId === currentUser?.unitId);

  // Admin sees all 4 tabs; unit users only see Dashboard + Log Expenses
  const visibleNavItems = isAdmin
    ? NAV_ITEMS
    : NAV_ITEMS.filter(n => n.id === "dashboard" || n.id === "expenses");

  // Redirect unit users away from admin-only pages
  useEffect(() => {
    if (!isAdmin && (activeNav === "units" || activeNav === "analytics")) {
      setActiveNav("dashboard");
    }
  }, [isAdmin, activeNav]);

  const profitableCount = visibleUnits.filter(u => unitStatus(u.id, visibleLogs, visibleUnits) === "profitable").length;
  const moneyPitCount   = visibleUnits.filter(u => unitStatus(u.id, visibleLogs, visibleUnits) === "money-pit").length;
  const initials        = (currentUser?.username ?? "").slice(0, 2).toUpperCase();

  // ── Screens ──
  if(screen==="loading") return (
    <div className="flex h-[100dvh] items-center justify-center bg-background font-sans">
      <div className="text-center"><Spinner size="lg"/><p className="text-[13px] font-medium text-foreground mt-4">Loading</p><p className="text-[11px] text-muted-foreground mt-1 font-mono">Connecting to Supabase…</p></div>
    </div>
  );


  if(screen==="login") return (
    <LoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError}/>
  );

  return (
    <div className="min-h-[100dvh] bg-background font-sans">
      {toast&&(
        <div className={`fixed top-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 z-[100] px-4 py-3 rounded-xl shadow-xl border text-[12px] font-medium flex items-center gap-2 ${toast.type==="error"?"bg-red-50 border-red-200 text-red-700":"bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0"/>{toast.msg}
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[224px] flex-col z-40" style={{backgroundColor:"#1C2B4A"}}>
        <div className="px-5 py-5 flex-shrink-0" style={{borderBottom:"1px solid rgba(255,255,255,0.09)"}}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#C8922A"}}>
              <svg viewBox="0 0 24 16" fill="none" className="w-5 h-3.5"><rect x="0.5" y="5" width="23" height="9" rx="1.5" fill="white" opacity="0.9"/><rect x="0.5" y="1.5" width="8" height="12" rx="1.5" fill="white"/><rect x="0.5" y="0.5" width="23" height="3" rx="1" fill="#FFD54F"/><circle cx="5.5" cy="15" r="2" fill="white" opacity="0.65"/><circle cx="18.5" cy="15" r="2" fill="white" opacity="0.65"/></svg>
            </div>
            <div><p className="text-white font-bold text-sm tracking-wide leading-none">JeepTrack</p><p className="text-[9px] tracking-widest uppercase font-mono leading-none mt-1" style={{color:"rgba(255,255,255,0.35)"}}>{isAdmin?"Fleet Manager":"Driver Portal"}</p></div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[9px] font-mono tracking-widest uppercase px-2 mb-2.5" style={{color:"rgba(255,255,255,0.25)"}}>Navigation</p>
          <div className="space-y-0.5">
            {visibleNavItems.map(({id,label,icon:Icon})=>(
              <button key={id} onClick={()=>setActiveNav(id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium transition-all duration-150"
                style={activeNav===id?{backgroundColor:"#C8922A",color:"white"}:{color:"rgba(255,255,255,0.55)"}}
                onMouseEnter={e=>{if(activeNav!==id)(e.currentTarget as HTMLElement).style.backgroundColor="rgba(255,255,255,0.07)";}}
                onMouseLeave={e=>{if(activeNav!==id)(e.currentTarget as HTMLElement).style.backgroundColor="transparent";}}>
                <Icon className="w-4 h-4 flex-shrink-0"/>
                <span className="flex-1 text-left">{label}</span>
                {activeNav===id&&<ChevronRight className="w-3.5 h-3.5 opacity-60"/>}
              </button>
            ))}
          </div>
          {/* Fleet health widget — admin only */}
          {isAdmin && (
            <div className="mt-6 rounded-lg p-3.5" style={{backgroundColor:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)"}}>
              <p className="text-[9px] font-mono tracking-widest uppercase mb-3" style={{color:"rgba(255,255,255,0.25)"}}>Fleet Health</p>
              <div className="flex items-end justify-between mb-3">
                <div><p className="text-white font-mono font-bold text-xl leading-none">{profitableCount}<span className="text-xs font-normal" style={{color:"rgba(255,255,255,0.3)"}}>/{visibleUnits.length}</span></p><p className="text-[10px] mt-1" style={{color:"rgba(255,255,255,0.4)"}}>profitable</p></div>
                <div className="text-right"><p className="font-mono font-bold text-xl leading-none" style={{color:"#F87171"}}>{moneyPitCount}</p><p className="text-[10px] mt-1" style={{color:"rgba(255,255,255,0.4)"}}>money pits</p></div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{backgroundColor:"rgba(255,255,255,0.1)"}}>
                <div className="h-full rounded-full transition-all duration-700" style={{width:`${visibleUnits.length?profitableCount/visibleUnits.length*100:0}%`,backgroundColor:"#34D399"}}/>
              </div>
            </div>
          )}
          {/* Unit info widget — unit users only */}
          {!isAdmin && visibleUnits[0] && (
            <div className="mt-6 rounded-lg p-3.5" style={{backgroundColor:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)"}}>
              <p className="text-[9px] font-mono tracking-widest uppercase mb-2" style={{color:"rgba(255,255,255,0.25)"}}>My Unit</p>
              <p className="text-white font-mono font-bold text-base leading-none">{visibleUnits[0].plate}</p>
              <p className="text-[10px] mt-1 truncate" style={{color:"rgba(255,255,255,0.45)"}}>{visibleUnits[0].route}</p>
              <div className="mt-2 pt-2" style={{borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                <p className="text-[9px] font-mono tracking-widest uppercase mb-0.5" style={{color:"rgba(255,255,255,0.25)"}}>Boundary</p>
                <p className="font-mono text-[13px] font-semibold" style={{color:"#C8922A"}}>₱{visibleUnits[0].boundary.toLocaleString()}<span className="text-[10px] font-normal" style={{color:"rgba(255,255,255,0.35)"}}>/day</span></p>
              </div>
            </div>
          )}
        </nav>
        <div className="px-4 py-4 flex-shrink-0" style={{borderTop:"1px solid rgba(255,255,255,0.09)"}}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold" style={{backgroundColor:"rgba(200,146,42,0.25)",border:"1px solid rgba(200,146,42,0.5)",color:"#C8922A"}}>{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-medium leading-none truncate">{currentUser?.username}</p>
              <p className="text-[10px] font-mono mt-0.5 truncate capitalize" style={{color:"rgba(255,255,255,0.35)"}}>{isAdmin ? "Administrator" : "Driver"}</p>
            </div>
            <button onClick={handleLogout} title="Sign out" className="w-7 h-7 rounded-md flex items-center justify-center transition-colors flex-shrink-0" style={{color:"rgba(255,255,255,0.35)"}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.8)"}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.35)"}>
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:ml-[224px] flex flex-col min-h-[100dvh]">
        <header className="sticky top-0 z-30 bg-card border-b border-border px-4 lg:px-7 py-3.5 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-0">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#C8922A"}}>
                <svg viewBox="0 0 24 16" fill="none" className="w-4 h-2.5"><rect x="0.5" y="5" width="23" height="9" rx="1.5" fill="white" opacity="0.9"/><rect x="0.5" y="1.5" width="8" height="12" rx="1.5" fill="white"/><rect x="0.5" y="0.5" width="23" height="3" rx="1" fill="#FFD54F"/><circle cx="5.5" cy="15" r="2" fill="white" opacity="0.65"/><circle cx="18.5" cy="15" r="2" fill="white" opacity="0.65"/></svg>
              </div>
            </div>
            <div>
              <h1 className="text-[13px] lg:text-base font-bold tracking-tight leading-none">{PAGE_TITLES[activeNav]}</h1>
              <p className="text-[10px] lg:text-[11px] text-muted-foreground font-mono mt-0.5 hidden sm:block">{new Date().toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})} · {isAdmin ? "Fleet Overview" : visibleUnits[0]?.plate ?? "My Unit"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative">
              <Bell className="w-4 h-4"/><span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#C8922A]"/>
            </button>
            <button onClick={handleLogout} className="lg:hidden w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <LogOut className="w-4 h-4"/>
            </button>
            <button onClick={()=>setActiveNav("expenses")} className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[12px] font-medium hover:opacity-90 transition-opacity" style={{backgroundColor:"#1C2B4A"}}>
              <Receipt className="w-3.5 h-3.5"/>Log Expense
            </button>
          </div>
        </header>

        <main className="flex-1 pb-28 lg:pb-6">
          {activeNav==="dashboard" && <DashboardView  units={visibleUnits} logs={visibleLogs}/>}
          {activeNav==="units"     && isAdmin && <MyUnitsView units={units} logs={logs} users={users} onAdd={addUnit} onEdit={editUnit} onDelete={deleteUnit}/>}
          {activeNav==="expenses"  && <LogExpensesView units={visibleUnits} logs={visibleLogs} onAdd={addLog} onDelete={deleteLog} lockedUnit={!isAdmin}/>}
          {activeNav==="analytics" && isAdmin && <AnalyticsView units={units} logs={logs}/>}
        </main>
      </div>

      {/* Mobile FAB */}
      <button onClick={()=>setActiveNav("expenses")}
        className="lg:hidden fixed z-40 right-4 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform"
        style={{bottom:"76px",width:"52px",height:"52px",backgroundColor:"#C8922A",boxShadow:"0 4px 16px rgba(200,146,42,0.4)"}}>
        <Plus className="w-5 h-5"/>
      </button>

      {/* Mobile Bottom Nav — only shows role-permitted tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border" style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div className="flex items-center justify-around px-2 py-1.5">
          {visibleNavItems.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setActiveNav(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px] ${activeNav===id?"text-[#C8922A]":"text-muted-foreground"}`}>
              <Icon className={`w-5 h-5 transition-transform ${activeNav===id?"scale-110":""}`}/>
              <span className={`text-[9px] font-medium tracking-wide ${activeNav===id?"font-semibold":""}`}>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
