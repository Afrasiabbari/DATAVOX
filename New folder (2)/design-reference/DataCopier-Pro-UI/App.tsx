import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Database, Server, Table2, ArrowRightLeft, Settings2, 
  Check, X, Zap, Play, Eye, ShieldCheck, Layers, 
  GripVertical, Plus, Trash2, Search, RefreshCw,
  Activity, Clock, Gauge, Terminal, Copy, Download,
  ChevronDown, Sparkles, ArrowUpRight, Box, Globe,
  FileJson, Cloud, Flame
} from 'lucide-react';

type ConnType = 'PostgreSQL' | 'MySQL' | 'MongoDB' | 'CSV' | 'API' | 'Firebase' | 'S3';
type ConnState = 'idle' | 'testing' | 'success' | 'error';
type Transform = 'direct' | 'uppercase' | 'lowercase' | 'hash' | 'trim' | 'custom';
type Schedule = 'once' | 'hourly' | 'daily';

interface TableInfo {
  id: string;
  name: string;
  rows: number;
  size: string;
  icon: string;
}

interface FieldMapping {
  id: string;
  source: string;
  dest: string;
  transform: Transform;
  required: boolean;
}

const SOURCE_TYPES: { id: ConnType; label: string; icon: any; desc: string }[] = [
  { id: 'PostgreSQL', label: 'PostgreSQL', icon: Database, desc: '14.2+' },
  { id: 'MySQL', label: 'MySQL', icon: Server, desc: '8.0+' },
  { id: 'MongoDB', label: 'MongoDB', icon: Layers, desc: 'Atlas' },
  { id: 'CSV', label: 'CSV File', icon: FileJson, desc: 'Local' },
  { id: 'API', label: 'REST API', icon: Globe, desc: 'HTTP' },
  { id: 'Firebase', label: 'Firebase', icon: Flame, desc: 'Firestore' },
  { id: 'S3', label: 'S3 Bucket', icon: Cloud, desc: 'AWS' },
];

const MOCK_TABLES: TableInfo[] = [
  { id: 'users', name: 'users', rows: 12483, size: '2.4 MB', icon: '👤' },
  { id: 'orders', name: 'orders', rows: 89210, size: '18.7 MB', icon: '📦' },
  { id: 'products', name: 'products', rows: 3421, size: '1.2 MB', icon: '🛍️' },
  { id: 'transactions', name: 'transactions', rows: 45290, size: '12.1 MB', icon: '💳' },
  { id: 'reviews', name: 'reviews', rows: 7834, size: '3.3 MB', icon: '⭐' },
  { id: 'sessions', name: 'user_sessions', rows: 156432, size: '44 MB', icon: '🔐' },
];

const FIELD_POOLS: Record<string, string[]> = {
  users: ['id', 'email', 'full_name', 'created_at', 'last_login', 'status', 'plan', 'avatar_url'],
  orders: ['id', 'user_id', 'total', 'currency', 'status', 'created_at', 'shipping_address'],
  products: ['id', 'sku', 'title', 'price', 'inventory', 'category', 'is_active'],
  transactions: ['id', 'order_id', 'amount', 'method', 'is_fraud', 'processed_at'],
  reviews: ['id', 'product_id', 'rating', 'comment', 'author_id', 'helpful_count'],
  user_sessions: ['id', 'user_id', 'ip', 'user_agent', 'started_at', 'duration_s'],
};

const PREVIEW_ROWS = [
  { id: 'usr_9f2a', email: 'sarah.c@linear.app', full_name: 'Sarah Chen', plan: 'pro', status: 'active' },
  { id: 'usr_1b7c', email: 'marc@stripe.com', full_name: 'Marcus Kim', plan: 'team', status: 'active' },
  { id: 'usr_4d8e', email: 'alex@vercel.co', full_name: 'Alex Rivera', plan: 'enterprise', status: 'active' },
];

export default function App() {
  // Steps
  const [activeStep, setActiveStep] = useState(1);
  const steps = [
    { n: 1, label: 'Source', icon: Database },
    { n: 2, label: 'Destination', icon: Server },
    { n: 3, label: 'Select', icon: Table2 },
    { n: 4, label: 'Map', icon: ArrowRightLeft },
    { n: 5, label: 'Launch', icon: Settings2 },
  ];

  // Source
  const [sourceType, setSourceType] = useState<ConnType>('PostgreSQL');
  const [sourceConn, setSourceConn] = useState('postgresql://user:****@db.prod.internal:5432/main?sslmode=require');
  const [sourceState, setSourceState] = useState<ConnState>('success');
  
  // Dest
  const [destType, setDestType] = useState<ConnType>('MySQL');
  const [destConn, setDestConn] = useState('mysql://analytics:****@warehouse.us-east-1.rds.amazonaws.com:3306/dw');
  const [destState, setDestState] = useState<ConnState>('idle');

  // Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTables, setSelectedTables] = useState<string[]>(['users', 'orders', 'products']);
  
  // Mapping
  const [mappings, setMappings] = useState<FieldMapping[]>([
    { id: '1', source: 'id', dest: 'id', transform: 'direct', required: true },
    { id: '2', source: 'email', dest: 'email_address', transform: 'lowercase', required: true },
    { id: '3', source: 'full_name', dest: 'display_name', transform: 'trim', required: false },
    { id: '4', source: 'created_at', dest: 'created_at', transform: 'direct', required: true },
    { id: '5', source: 'status', dest: 'account_status', transform: 'uppercase', required: false },
  ]);
  const [dragId, setDragId] = useState<string | null>(null);

  // Options
  const [dedupe, setDedupe] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [batchSize, setBatchSize] = useState(2500);
  const [schedule, setSchedule] = useState<Schedule>('once');

  // Copy runtime
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    '[09:42:11] • Initialized DataCopier Pro v2.4.1',
    '[09:42:11] • Source schema introspected (6 tables)',
    '[09:42:12] • Destination ready - warehouse.us-east-1',
  ]);
  const logRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({ copied: 0, speed: 0, eta: '--' });

  // Modals & validation
  const [showPreview, setShowPreview] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  // Records API - save migration jobs
  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await fetch('actions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'records.list', args: { collection: 'migration_jobs', limit: 10 } })
        });
        const json = await res.json();
        if (json.data) setJobs(json.data.records || []);
      } catch {}
    }
    loadJobs();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const filteredTables = useMemo(() => {
    return MOCK_TABLES.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const totalRows = useMemo(() => {
    return MOCK_TABLES.filter(t => selectedTables.includes(t.id)).reduce((a,b)=>a+b.rows, 0);
  }, [selectedTables]);

  // Actions
  const testConnection = (which: 'source' | 'dest') => {
    if (which === 'source') {
      setSourceState('testing');
      setTimeout(() => {
        setSourceState('success');
        setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ✓ Source connected - ${sourceType} latency 24ms`]);
      }, 1200);
    } else {
      setDestState('testing');
      setTimeout(() => {
        setDestState('success');
        setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ✓ Destination connected - ${destType} latency 42ms`]);
      }, 1400);
    }
  };

  const handleAutoMap = () => {
    const newMaps: FieldMapping[] = [];
    selectedTables.slice(0,2).forEach(tableId => {
      const fields = FIELD_POOLS[tableId] || FIELD_POOLS.users;
      fields.slice(0,4).forEach(f => {
        if (!mappings.find(m => m.source === f)) {
          newMaps.push({
            id: Math.random().toString(36).slice(2),
            source: f,
            dest: f,
            transform: 'direct',
            required: false,
          });
        }
      });
    });
    if (newMaps.length) setMappings(m => [...m, ...newMaps.slice(0,5)]);
    setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ⚡ Auto-mapped ${newMaps.length} fields`]);
  };

  const startCopy = async () => {
    if (selectedTables.length === 0) {
      setValidationMsg('Select at least one table to copy');
      setTimeout(()=>setValidationMsg(null), 3000);
      return;
    }
    setCopying(true);
    setProgress(0);
    setStats({ copied: 0, speed: 0, eta: 'calculating...' });
    setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ▶ Starting migration: ${selectedTables.join(', ')} → ${destType}`, `[${new Date().toLocaleTimeString()}]   Batch size ${batchSize.toLocaleString()} | Dedupe ${dedupe ? 'ON' : 'OFF'}`]);

    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setCopying(false);
        setStats(s => ({ ...s, copied: totalRows, speed: 0, eta: 'done' }));
        setLogs(prev => [...prev, 
          `[${new Date().toLocaleTimeString()}] ✓ Completed - ${totalRows.toLocaleString()} records copied`,
          `[${new Date().toLocaleTimeString()}]   Duration 00:02:14 | Avg 1,842 r/s`
        ]);
        // Save job record
        (async () => {
          try {
            await fetch('actions', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                action: 'records.create',
                args: {
                  collection: 'migration_jobs',
                  value: {
                    sourceType, destType,
                    tables: selectedTables,
                    totalRows,
                    batchSize,
                    createdAt: new Date().toISOString(),
                    status: 'completed'
                  }
                }
              })
            });
          } catch {}
        })();
      } else {
        const copiedNow = Math.floor((p/100) * totalRows);
        const speed = Math.floor(1200 + Math.random()*800);
        const remaining = totalRows - copiedNow;
        const etaSec = Math.ceil(remaining / speed);
        setStats({ copied: copiedNow, speed, eta: `00:00:${String(etaSec).padStart(2,'0')}` });
        if (Math.random() > 0.7) {
          const msgs = [
            `→ Copying ${selectedTables[0]} batch ${(copiedNow/batchSize).toFixed(0)}`,
            `✓ Indexed ${selectedTables[0]}.id`,
            `→ Transform applied on ${Math.floor(Math.random()*mappings.length)+1} fields`,
            `✓ Checkpoint saved at ${p.toFixed(1)}%`,
          ];
          setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msgs[Math.floor(Math.random()*msgs.length)]}`]);
        }
      }
      setProgress(p);
    }, 180);
  };

  const validateAll = () => {
    setValidationMsg(null);
    if (sourceState !== 'success') {
      setValidationMsg('Test source connection first');
      setActiveStep(1);
      return;
    }
    if (destState !== 'success') {
      setValidationMsg('Test destination connection');
      setActiveStep(2);
      return;
    }
    if (selectedTables.length === 0) {
      setValidationMsg('Select tables in step 3');
      setActiveStep(3);
      return;
    }
    setValidationMsg('✓ Configuration valid - ready to launch');
    setActiveStep(5);
    setTimeout(()=>setValidationMsg(null), 3000);
    setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ✓ Validation passed - 5 checks OK`]);
  };

  const toggleTable = (id: string) => {
    setSelectedTables(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const removeMapping = (id: string) => setMappings(m => m.filter(x=>x.id!==id));
  const addMapping = () => setMappings(m => [...m, { id: Date.now().toString(), source: '', dest: '', transform: 'direct', required: false }]);

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!dragId || dragId === id) return;
    const from = mappings.findIndex(x=>x.id===dragId);
    const to = mappings.findIndex(x=>x.id===id);
    if (from === -1 || to === -1) return;
    const clone = [...mappings];
    const [moved] = clone.splice(from,1);
    clone.splice(to,0,moved);
    setMappings(clone);
  };

  return (
    <div data-safe-area-inset-root className="min-h-screen w-full bg-[#f8fafc] text-slate-900 selection:bg-indigo-100" style={{ boxSizing: 'border-box', paddingTop: 'var(--safe-area-inset-top)' }}>
      <style>{`
        *{font-family: Inter, -apple-system, sans-serif}
        .mono{font-family: 'JetBrains Mono', monospace}
      `}</style>

      {/* Header */}
      <header data-safe-area-sticky-top className="sticky z-30 border-b border-slate-200/70 backdrop-blur-xl bg-white/80" style={{ top: 'var(--safe-area-inset-top)' }}>
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center shadow-sm">
                <Box className="h-5 w-5" />
              </div>
              <div className="leading-none">
                <div className="flex items-baseline gap-2">
                  <span className="font-[800] text-[17px] tracking-tight">DataCopier</span>
                  <span className="text-[11px] font-bold tracking-widest px-1.5 py-0.5 rounded bg-indigo-600 text-white">PRO</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">v2.4.1 • SOC2 certified</div>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-2 pl-5 border-l border-slate-200">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${copying ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                <span className={`h-2 w-2 rounded-full ${copying ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                {copying ? 'COPYING' : 'READY'} • {selectedTables.length} tables
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 mono">
                <span className="h-1.5 w-1.5 bg-slate-300 rounded-full" />
                {totalRows.toLocaleString()} rows selected
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const txt = JSON.stringify({ sourceType, destType, selectedTables, mappings, batchSize }, null, 2);
                const ta = document.createElement('textarea');
                ta.value = txt;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                setCopiedConfig(true);
                setTimeout(()=>setCopiedConfig(false), 2000);
              }}
              className="hidden sm:inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium hover:bg-slate-50 transition"
            >
              <Copy className="h-4 w-4" /> {copiedConfig ? 'Copied!' : 'Copy config'}
            </button>
            <button className="hidden sm:inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium hover:bg-slate-50">
              <Download className="h-4 w-4" /> Export
            </button>
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center">
              <span className="text-[12px] font-bold">SC</span>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="border-t border-slate-200/60 bg-white/60">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 sm:gap-2 py-3 overflow-x-auto scrollbar-none">
              {steps.map((s, idx) => {
                const isActive = activeStep === s.n;
                const isDone = activeStep > s.n || sourceState==='success' && s.n===1 || destState==='success' && s.n===2;
                return (
                  <React.Fragment key={s.n}>
                    <button
                      onClick={()=>setActiveStep(s.n)}
                      className={`group flex items-center gap-2.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all whitespace-nowrap border
                        ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : isDone ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300' : 'bg-white/50 border-slate-200/60 text-slate-400'}`}
                    >
                      <span className={`grid place-items-center h-5 w-5 rounded-full text-[11px] font-bold ${isActive ? 'bg-white text-slate-900' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {isDone && !isActive ? <Check className="h-3 w-3" /> : s.n}
                      </span>
                      <s.icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                      {s.label}
                    </button>
                    {idx < steps.length-1 && (
                      <div className={`hidden sm:block h-px w-8 mx-1 ${activeStep > s.n ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                    )}
                  </React.Fragment>
                )
              })}
              <div className="ml-auto hidden lg:flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right leading-tight">
                  <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Progress</div>
                  <div className="text-[13px] font-bold mono">{progress.toFixed(0)}% • {stats.copied.toLocaleString()} rows</div>
                </div>
                <div className="h-10 w-[120px] rounded-full bg-slate-100 p-1">
                  <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8 grid grid-cols-12 gap-6">
        {/* Left Column - Forms */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          
          {/* Source Card */}
          <div className={`rounded-[20px] border bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden transition-all ${activeStep===1 ? 'ring-2 ring-indigo-500/20 border-indigo-200' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 grid place-items-center text-indigo-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Source Configuration</h2>
                  <p className="text-[12px] text-slate-500">Where your data lives now</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border
                ${sourceState==='success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : sourceState==='testing' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                {sourceState==='success' ? <><Check className="h-3 w-3"/> Connected</> : sourceState==='testing' ? 'Testing...' : 'Not connected'}
              </span>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-[12px] font-semibold tracking-wide uppercase text-slate-500 mb-3 block">Source Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {SOURCE_TYPES.map(t => {
                    const ActiveIcon = t.icon;
                    const isActive = sourceType===t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={()=>setSourceType(t.id)}
                        className={`group text-left rounded-xl border p-3 transition-all ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
                      >
                        <ActiveIcon className={`h-4 w-4 mb-2 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        <div className={`text-[12px] font-semibold leading-none ${isActive ? 'text-white' : 'text-slate-900'}`}>{t.label}</div>
                        <div className={`text-[10px] mono mt-1 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>{t.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Connection String</label>
                  <span className="text-[11px] mono text-slate-400">AES-256 encrypted at rest</span>
                </div>
                <div className="relative">
                  <input
                    value={sourceConn}
                    onChange={e=>setSourceConn(e.target.value)}
                    placeholder="postgresql://user:password@host:5432/db"
                    className="w-full h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-[132px] text-[13px] mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white transition"
                  />
                  <button
                    onClick={()=>testConnection('source')}
                    disabled={sourceState==='testing'}
                    className="absolute right-1.5 top-1.5 h-[32px] px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-semibold hover:bg-black disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {sourceState==='testing' ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/> : <Zap className="h-3.5 w-3.5"/>}
                    Test
                  </button>
                </div>
                <div className="flex gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 border border-slate-200 mono">SSL: required</span>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 mono">Pool: 10</span>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 mono">Schema: public</span>
                </div>
              </div>
            </div>
          </div>

          {/* Destination Card */}
          <div className={`rounded-[20px] border bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden transition-all ${activeStep===2 ? 'ring-2 ring-indigo-500/20 border-indigo-200' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-violet-50 border border-violet-100 grid place-items-center text-violet-600">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Destination Configuration</h2>
                  <p className="text-[12px] text-slate-500">Where you want data to land</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border
                ${destState==='success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : destState==='testing' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                {destState==='success' ? <><Check className="h-3 w-3"/> Connected</> : destState==='testing' ? 'Testing...' : 'Idle'}
              </span>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {SOURCE_TYPES.map(t => {
                  const Icon = t.icon;
                  const isActive = destType===t.id;
                  return (
                    <button
                      key={`dest-${t.id}`}
                      onClick={()=>setDestType(t.id)}
                      className={`text-left rounded-xl border p-3 transition-all ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      <Icon className={`h-4 w-4 mb-2 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      <div className={`text-[12px] font-semibold ${isActive ? 'text-white' : 'text-slate-900'}`}>{t.label}</div>
                    </button>
                  )
                })}
              </div>
              <div className="relative">
                <input
                  value={destConn}
                  onChange={e=>setDestConn(e.target.value)}
                  className="w-full h-[44px] rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-[132px] text-[13px] mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 focus:bg-white"
                />
                <button
                  onClick={()=>testConnection('dest')}
                  disabled={destState==='testing'}
                  className="absolute right-1.5 top-1.5 h-[32px] px-3.5 rounded-lg bg-slate-900 text-white text-[12px] font-semibold hover:bg-black disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {destState==='testing' ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/> : <Zap className="h-3.5 w-3.5"/>}
                  Test
                </button>
              </div>
            </div>
          </div>

          {/* Data Selection */}
          <div className={`rounded-[20px] border bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden ${activeStep===3 ? 'ring-2 ring-indigo-500/20 border-indigo-200' : 'border-slate-200'}`}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 grid place-items-center text-emerald-600">
                  <Table2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Data Selection</h2>
                  <p className="text-[12px] text-slate-500">{selectedTables.length} of {MOCK_TABLES.length} tables • {totalRows.toLocaleString()} rows total</p>
                </div>
              </div>
              <button
                onClick={()=>setSelectedTables(selectedTables.length===MOCK_TABLES.length ? [] : MOCK_TABLES.map(t=>t.id))}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50"
              >
                {selectedTables.length===MOCK_TABLES.length ? 'Clear all' : 'Select all'}
              </button>
            </div>

            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={e=>setSearchQuery(e.target.value)}
                  placeholder="Search tables, columns..."
                  className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white"
                />
              </div>

              <div className="grid gap-2">
                {filteredTables.map(t => {
                  const isSel = selectedTables.includes(t.id);
                  return (
                    <label key={t.id} className={`group flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${isSel ? 'bg-indigo-50/60 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={()=>toggleTable(t.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 grid place-items-center text-[16px]">{t.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold mono">{t.name}</span>
                          {isSel && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />}
                        </div>
                        <div className="text-[11px] text-slate-500 mono">{t.rows.toLocaleString()} rows • {t.size}</div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5">
                        {(FIELD_POOLS[t.id] || []).slice(0,3).map(f=>(
                          <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 mono">{f}</span>
                        ))}
                        <span className="text-[10px] text-slate-400">+{(FIELD_POOLS[t.id]?.length||0)-3}</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-300 group-hover:text-slate-500 transition ${isSel ? 'rotate-180' : ''}`} />
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Mapping */}
          <div className={`rounded-[20px] border bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden ${activeStep===4 ? 'ring-2 ring-indigo-500/20 border-indigo-200' : 'border-slate-200'}`}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 grid place-items-center text-amber-600">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Mapping & Transform</h2>
                  <p className="text-[12px] text-slate-500">Define how fields move and change</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleAutoMap} className="h-8 inline-flex items-center gap-1.5 px-3 rounded-full bg-slate-900 text-white text-[12px] font-semibold hover:bg-black">
                  <Sparkles className="h-3.5 w-3.5" /> Auto-map
                </button>
                <button onClick={addMapping} className="h-8 inline-flex items-center gap-1.5 px-3 rounded-full border border-slate-200 bg-white text-[12px] font-semibold hover:bg-slate-50">
                  <Plus className="h-3.5 w-3.5" /> Add field
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[40px_1fr_24px_1fr_160px_40px] gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                  <div></div>
                  <div>Source field</div>
                  <div></div>
                  <div>Destination field</div>
                  <div>Transform</div>
                  <div></div>
                </div>
                <div className="divide-y divide-slate-100">
                  {mappings.map(m => (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={()=>handleDragStart(m.id)}
                      onDragOver={e=>handleDragOver(e, m.id)}
                      className={`grid grid-cols-[40px_1fr_24px_1fr_160px_40px] gap-2 px-6 py-3 items-center hover:bg-slate-50/70 group transition ${dragId===m.id ? 'opacity-50 bg-indigo-50' : ''}`}
                    >
                      <button className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          value={m.source}
                          onChange={e=>setMappings(prev=>prev.map(x=>x.id===m.id ? {...x, source: e.target.value} : x))}
                          placeholder="source_col"
                          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                        />
                        {m.required && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-300" />
                      <input
                        value={m.dest}
                        onChange={e=>setMappings(prev=>prev.map(x=>x.id===m.id ? {...x, dest: e.target.value} : x))}
                        placeholder="dest_col"
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                      />
                      <select
                        value={m.transform}
                        onChange={e=>setMappings(prev=>prev.map(x=>x.id===m.id ? {...x, transform: e.target.value as Transform} : x))}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="direct">Direct →</option>
                        <option value="uppercase">UPPERCASE</option>
                        <option value="lowercase">lowercase</option>
                        <option value="hash">Hash (SHA256)</option>
                        <option value="trim">Trim spaces</option>
                        <option value="custom">Custom JS</option>
                      </select>
                      <button onClick={()=>removeMapping(m.id)} className="h-8 w-8 grid place-items-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-amber-50/60 border-t border-amber-100 flex items-center gap-2 text-[12px] text-amber-800">
              <ShieldCheck className="h-4 w-4" />
              <span>PII fields auto-detected: <span className="font-semibold">email</span> will be lowercased & hashed in audit logs</span>
            </div>
          </div>

          {/* Options */}
          <div className={`rounded-[20px] border bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden ${activeStep===5 ? 'ring-2 ring-indigo-500/20 border-indigo-200' : 'border-slate-200'}`}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">Execution Options</h2>
                <p className="text-[12px] text-slate-500">Fine-tune performance and safety</p>
              </div>
            </div>

            <div className="p-6 grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
                  <div>
                    <div className="text-[13px] font-semibold">Deduplicate records</div>
                    <div className="text-[11px] text-slate-500">Skip if PK exists in destination</div>
                  </div>
                  <button
                    onClick={()=>setDedupe(!dedupe)}
                    className={`relative h-6 w-11 rounded-full transition ${dedupe ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${dedupe ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
                  <div>
                    <div className="text-[13px] font-semibold">Overwrite on conflict</div>
                    <div className="text-[11px] text-slate-500">Replace existing rows if duplicate</div>
                  </div>
                  <button
                    onClick={()=>setOverwrite(!overwrite)}
                    className={`relative h-6 w-11 rounded-full transition ${overwrite ? 'bg-slate-900' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${overwrite ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 p-3.5 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[13px] font-semibold">Batch size</div>
                    <span className="text-[12px] mono font-bold px-2 py-1 rounded bg-slate-900 text-white">{batchSize.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={10000}
                    step={100}
                    value={batchSize}
                    onChange={e=>setBatchSize(Number(e.target.value))}
                    className="w-full accent-slate-900 h-1"
                  />
                  <div className="flex justify-between text-[10px] mono text-slate-400 mt-1">
                    <span>100</span><span>5k (balanced)</span><span>10k</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-3.5 bg-white">
                  <div className="text-[13px] font-semibold mb-3">Schedule</div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'once', label: 'One-time', desc: 'Now' },
                      { id: 'hourly', label: 'Hourly', desc: 'Every hour' },
                      { id: 'daily', label: 'Daily', desc: '02:00 UTC' },
                    ] as const).map(s => (
                      <button
                        key={s.id}
                        onClick={()=>setSchedule(s.id)}
                        className={`rounded-xl border p-3 text-left transition ${schedule===s.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="text-[12px] font-semibold">{s.label}</div>
                        <div className={`text-[11px] mono ${schedule===s.id ? 'text-white/60' : 'text-slate-500'}`}>{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 text-white p-4 relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-500/30 blur-xl" />
                  <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase opacity-70">
                    <Clock className="h-4 w-4" /> Estimated
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[22px] font-bold">2m 14s</span>
                    <span className="text-[12px] opacity-60">for {totalRows.toLocaleString()} rows at {batchSize} batch</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[68%] bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="sticky bottom-4 z-20 rounded-[16px] border border-slate-200 bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(15,23,42,0.12)] p-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="h-2 w-full max-w-[200px] rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] mono font-semibold text-slate-500">{progress.toFixed(1)}%</span>
            </div>

            {validationMsg && (
              <div className={`text-[12px] px-3 py-1.5 rounded-full border mono ${validationMsg.startsWith('✓') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                {validationMsg}
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={validateAll}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" /> Validate
              </button>
              <button
                onClick={()=>setShowPreview(true)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Eye className="h-4 w-4" /> Preview 100
              </button>
              <button
                onClick={startCopy}
                disabled={copying}
                className="h-10 px-5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {copying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                {copying ? 'Copying...' : 'Start Copy'}
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400 mono py-2">
            DataCopier encrypts in transit (TLS 1.3) • No data stored on our servers • Audit log exported to your SIEM
          </div>
        </div>

        {/* Right Panel - Logs & Stats */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="lg:sticky lg:top-[132px] space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Copied', value: stats.copied.toLocaleString(), icon: Activity, color: 'indigo' },
                { label: 'Speed', value: stats.speed ? `${stats.speed} r/s` : '--', icon: Gauge, color: 'emerald' },
                { label: 'ETA', value: stats.eta, icon: Clock, color: 'slate' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                    <s.icon className="h-3.5 w-3.5" /> {s.label}
                  </div>
                  <div className="mt-2 text-[16px] font-bold tracking-tight mono">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Live Log Console */}
            <div className="rounded-[20px] border border-slate-800 bg-[#0b1220] shadow-[0_16px_32px_rgba(0,0,0,0.2)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-white/70" />
                  <span className="text-[12px] font-semibold tracking-wide uppercase text-white/80">Live Log</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
              </div>
              <div ref={logRef} className="h-[360px] overflow-auto p-3 space-y-1.5 mono text-[11px] leading-[1.6] scrollbar-thin">
                {logs.map((line, i) => (
                  <div key={i} className="text-white/70 hover:text-white/90 transition-colors whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {line}
                  </div>
                ))}
                {copying && (
                  <div className="flex items-center gap-2 text-indigo-300">
                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                    Streaming...
                  </div>
                )}
              </div>
              <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
                <span className="text-[10px] mono text-white/40">UTF-8 • {logs.length} lines</span>
                <button onClick={()=>setLogs([])} className="text-[10px] mono text-white/50 hover:text-white">Clear</button>
              </div>
            </div>

            {/* Recent Jobs */}
            <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Recent migrations</span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 mono">{jobs.length}</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[220px] overflow-auto">
                {jobs.length===0 ? (
                  <div className="p-8 text-center">
                    <div className="h-10 w-10 mx-auto rounded-xl bg-slate-100 grid place-items-center mb-3 text-slate-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="text-[13px] font-medium text-slate-600">No jobs yet</div>
                    <div className="text-[11px] text-slate-400 mt-1">Completed copies will appear here</div>
                  </div>
                ) : jobs.map((j:any)=>(
                  <div key={j.id} className="p-3 flex items-center gap-3 hover:bg-slate-50">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 grid place-items-center text-emerald-600">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold mono truncate">{(j.value?.tables || []).join(', ')}</div>
                      <div className="text-[11px] text-slate-500">{new Date(j.value?.createdAt).toLocaleTimeString()} • {j.value?.totalRows?.toLocaleString()} rows</div>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">OK</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Help Card */}
            <div className="rounded-[20px] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white grid place-items-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold">Pro tip: Use batch mode</div>
                  <div className="text-[12px] text-slate-600 mt-1 leading-relaxed">For tables &gt;100k rows, keep batch at 2.5k and enable dedupe to avoid memory pressure. Your current config is optimal for 104k rows.</div>
                  <button className="mt-2 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">View docs <ArrowUpRight className="h-3 w-3"/></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/30 backdrop-blur-sm pt-[max(1rem,var(--safe-area-inset-top))] p-4">
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-3xl rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)] overflow-hidden animate-[slideIn_0.3s_ease]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center">
                    <Eye className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold">Preview • First 100 rows</h3>
                    <p className="text-[12px] text-slate-500 mono">users → MySQL • transform applied</p>
                  </div>
                </div>
                <button onClick={()=>setShowPreview(false)} className="h-9 w-9 rounded-xl border border-slate-200 bg-white grid place-items-center hover:bg-slate-50">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-0 overflow-auto max-h-[60vh]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                      <th className="px-4 py-2.5 font-semibold">id</th>
                      <th className="px-4 py-2.5 font-semibold">email_address</th>
                      <th className="px-4 py-2.5 font-semibold">display_name</th>
                      <th className="px-4 py-2.5 font-semibold">plan</th>
                      <th className="px-4 py-2.5 font-semibold">status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PREVIEW_ROWS.map(r=>(
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 mono text-[12px] text-slate-700">{r.id}</td>
                        <td className="px-4 py-2.5 mono text-[12px]">{r.email}</td>
                        <td className="px-4 py-2.5 text-[13px] font-medium">{r.full_name}</td>
                        <td className="px-4 py-2.5"><span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 mono">{r.plan}</span></td>
                        <td className="px-4 py-2.5"><span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">{r.status}</span></td>
                      </tr>
                    ))}
                    {Array.from({ length: 6 }).map((_,i)=>(
                      <tr key={`skeleton-${i}`} className="opacity-60">
                        <td className="px-4 py-2.5"><div className="h-3 w-16 rounded bg-slate-100 animate-pulse" /></td>
                        <td className="px-4 py-2.5"><div className="h-3 w-32 rounded bg-slate-100 animate-pulse" /></td>
                        <td className="px-4 py-2.5"><div className="h-3 w-20 rounded bg-slate-100 animate-pulse" /></td>
                        <td className="px-4 py-2.5"><div className="h-5 w-12 rounded-full bg-slate-100 animate-pulse" /></td>
                        <td className="px-4 py-2.5"><div className="h-5 w-14 rounded-full bg-slate-100 animate-pulse" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] mono text-slate-500">Showing 3 of 100 preview rows • transforms already applied</span>
                <div className="flex gap-2">
                  <button onClick={()=>setShowPreview(false)} className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold">Close</button>
                  <button onClick={()=>{ setShowPreview(false); startCopy(); }} className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-semibold">Looks good, start copy</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
