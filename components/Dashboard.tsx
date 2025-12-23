
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AppState, PipelineStage, AutomationSettings } from '../types';
import { STAGE_LABELS } from '../constants';

interface DashboardProps {
  state: AppState;
  onUpdateAutomation?: (settings: Partial<AutomationSettings>) => void;
  onNavigateToFlows?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, onUpdateAutomation, onNavigateToFlows }) => {
  const [configTarget, setConfigTarget] = useState<'N8N' | 'AGENT' | null>(null);
  const isDark = state.theme === 'dark';
  
  const pipelineValue = state.deals.reduce((acc, deal) => acc + deal.amount, 0);
  const signedDeals = state.deals.filter(d => d.stage === PipelineStage.SIGNED || d.stage === PipelineStage.ACTIVE);
  const totalRevenue = signedDeals.reduce((acc, deal) => acc + deal.amount, 0);
  
  const stageData = Object.values(PipelineStage).map(stage => {
    const value = state.deals
      .filter(d => d.stage === stage)
      .reduce((acc, d) => acc + d.amount, 0);
    return { name: STAGE_LABELS[stage], value };
  });

  const COLORS = isDark 
    ? ['#475569', '#3B82F6', '#60A5FA', '#2563EB', '#1D4ED8', '#10B981', '#34D399']
    : ['#94A3B8', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', '#059669', '#10B981'];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Gross Pipeline</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white brand-font">${pipelineValue.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Contracted Yield</p>
          <p className="text-4xl font-black text-blue-600 dark:text-blue-500 brand-font">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Active Ops</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white brand-font">{signedDeals.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10">Revenue Velocity</h3>
          <div className="w-full" style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1E293B" : "#F2F5FA"} vertical={false} />
                <XAxis dataKey="name" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94A3B8' : '#64748B' }} className="uppercase tracking-widest" />
                <YAxis fontSize={10} fontWeight={700} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} tick={{ fill: isDark ? '#94A3B8' : '#64748B' }} />
                <Tooltip cursor={{ fill: isDark ? '#1E293B' : '#F2F5FA' }} contentStyle={{ backgroundColor: isDark ? '#0B1222' : '#FFFFFF', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: '900' }} />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {stageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Automation & Agentic Hub */}
        <div className="bg-[#0F172A] dark:bg-black p-10 rounded-[3rem] text-white flex flex-col shadow-2xl relative overflow-hidden group transition-colors">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 blur-[100px] pointer-events-none group-hover:bg-blue-600/20 transition-all duration-700"></div>
          
          <div className="flex justify-between items-center mb-10 relative z-10">
             <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em]">Automation Hub</h3>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Live</span>
             </div>
          </div>
          
          <div className="space-y-6 relative z-10 flex-grow">
            {/* n8n Workflow Node */}
            <div 
              onClick={() => setConfigTarget('N8N')}
              className="p-6 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between group/node hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-black text-xs shadow-inner">n8n</div>
                <div>
                  <p className="text-[12px] font-black uppercase tracking-widest mb-0.5">n8n Pipeline</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">
                    {state.automationSettings?.n8nWebhookUrl ? 'Webhook Configured' : 'Connect Endpoint'}
                  </p>
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-600 group-hover/node:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
            </div>

            {/* Agentic Scout Node */}
            <div 
              onClick={() => setConfigTarget('AGENT')}
              className="p-6 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between group/node hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                  <p className="text-[12px] font-black uppercase tracking-widest mb-0.5">Intelligence Agent</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">
                    {state.automationSettings?.autoSignalRefresh ? 'Autonomy: Enabled' : 'Autonomy: Disabled'}
                  </p>
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-600 group-hover/node:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
            </div>

            {/* Event Log (Pseudo-terminal) */}
            <div className="mt-4 p-5 bg-black/40 rounded-2xl border border-white/5 font-mono text-[9px] text-slate-500 space-y-2 max-h-[120px] overflow-hidden transition-colors">
               <p><span className="text-blue-500">PROMPT:</span> Triage Agent initialized...</p>
               <p><span className="text-emerald-500">SYNC:</span> Webhook heartbeat detected.</p>
               <p><span className="text-slate-600">IDLE:</span> Waiting for deployment event.</p>
            </div>
          </div>

          <button className="mt-8 w-full py-5 bg-white text-[#0F172A] rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] hover:bg-blue-50 transition-all shadow-xl active:scale-95">
            Initialize New Agent
          </button>
        </div>
      </div>

      {/* Configuration Modals */}
      {configTarget === 'N8N' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl space-y-8 border border-slate-100 dark:border-slate-800 transition-colors">
            <div>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white brand-font uppercase tracking-tight">n8n Gateway</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">External Webhook Gateway</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Production Webhook URL</label>
                <input 
                  value={state.automationSettings?.n8nWebhookUrl || ''} 
                  onChange={(e) => onUpdateAutomation?.({ n8nWebhookUrl: e.target.value })}
                  placeholder="https://primary-n8n.your-host.com/..." 
                  className="w-full h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-600 shadow-inner"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                 <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Trigger on Deploy</span>
                 <input 
                  type="checkbox" 
                  checked={state.automationSettings?.notifyOnDeploy || false}
                  onChange={(e) => onUpdateAutomation?.({ notifyOnDeploy: e.target.checked })}
                  className="w-5 h-5 accent-blue-600"
                 />
              </div>
            </div>
            <button onClick={() => setConfigTarget(null)} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest">Save Gateway</button>
          </div>
        </div>
      )}

      {configTarget === 'AGENT' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl space-y-8 border border-slate-100 dark:border-slate-800 transition-colors">
            <div>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white brand-font uppercase tracking-tight">Agent Control</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Autonomous Intelligence Control</p>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                 <div>
                   <p className="text-[11px] font-black uppercase text-slate-900 dark:text-white">Auto-Signal Refresh</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase">Perform forensic background scans</p>
                 </div>
                 <input 
                  type="checkbox" 
                  checked={state.automationSettings?.autoSignalRefresh || false}
                  onChange={(e) => onUpdateAutomation?.({ autoSignalRefresh: e.target.checked })}
                  className="w-6 h-6 accent-blue-600"
                 />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Scan Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                   {(['HOURLY', 'DAILY', 'WEEKLY'] as const).map(freq => (
                     <button 
                      key={freq}
                      onClick={() => onUpdateAutomation?.({ agentFrequency: freq })}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-tighter border transition-all ${state.automationSettings?.agentFrequency === freq ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}
                     >
                       {freq}
                     </button>
                   ))}
                </div>
              </div>
            </div>
            <button onClick={() => setConfigTarget(null)} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest">Update Autonomy</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
