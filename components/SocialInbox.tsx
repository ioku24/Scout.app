
import React, { useState } from 'react';
import { SocialMessage, SocialAccount } from '../types';
import { interceptPublicSignal } from '../lib/gemini';

interface SocialInboxProps {
  accounts: SocialAccount[];
  messages: SocialMessage[];
  onConnect: (platform: 'INSTAGRAM' | 'LINKEDIN') => void;
  onConvert: (message: SocialMessage) => void;
  onAddIntercept?: (message: SocialMessage) => void;
}

const SocialInbox: React.FC<SocialInboxProps> = ({ accounts, messages, onConnect, onConvert, onAddIntercept }) => {
  const [filter, setFilter] = useState<'ALL' | 'INSTAGRAM' | 'LINKEDIN'>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [interceptInput, setInterceptInput] = useState('');
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date());

  const filteredMessages = messages.filter(m => filter === 'ALL' || m.platform === filter);
  const isConnected = (p: string) => accounts.find(a => a.platform === p)?.isConnected;
  const getUsername = (p: string) => accounts.find(a => a.platform === p)?.username || 'unlinked';

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSynced(new Date());
    }, 2000);
  };

  const handleManualIntercept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interceptInput || !onAddIntercept) return;
    
    setIsIntercepting(true);
    // Determine platform based on input or toggle
    const platform = interceptInput.includes('linkedin') ? 'LINKEDIN' : 'INSTAGRAM';
    const result = await interceptPublicSignal(interceptInput, platform);
    
    if (result) {
      onAddIntercept({
        id: `int_${Date.now()}`,
        senderName: result.senderName,
        senderHandle: result.senderHandle,
        platform: platform,
        content: result.content,
        timestamp: new Date().toISOString(),
        identityMatch: result.identityMatch / 100,
        isArchived: false,
        suggestedAction: result.suggestedAction
      });
      setInterceptInput('');
    }
    setIsIntercepting(false);
  };

  return (
    <div className="flex bg-white dark:bg-[#0B1222] rounded-[3rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl h-[calc(100vh-200px)] animate-fade-in transition-colors">
      
      {/* Sidebar: Channel Status */}
      <div className="w-[340px] border-r border-slate-100 dark:border-slate-800 flex flex-col bg-[#FDFDFD] dark:bg-[#0F172A] transition-colors">
        <div className="p-10 space-y-10">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Social Channels</h3>
            <button onClick={handleSync} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
              <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* Instagram Node */}
            <div className={`p-8 rounded-[2.5rem] border-2 transition-all relative overflow-hidden ${isConnected('INSTAGRAM') ? 'bg-white dark:bg-slate-800 border-pink-50 dark:border-pink-900/20 shadow-xl shadow-pink-500/5' : 'bg-slate-50 dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 opacity-60'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </div>
                  <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Instagram</span>
                </div>
                {isConnected('INSTAGRAM') && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>}
              </div>
              <p className="text-[11px] font-bold text-slate-900 dark:text-white mb-1">@{getUsername('INSTAGRAM')}</p>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status: Active Link</p>
            </div>

            {/* LinkedIn Node */}
            <div className={`p-8 rounded-[2.5rem] border-2 transition-all ${isConnected('LINKEDIN') ? 'bg-white dark:bg-slate-800 border-blue-50 dark:border-blue-900/20 shadow-xl' : 'bg-slate-50 dark:bg-slate-900/50 border-dashed border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#0077B5] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </div>
                <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-widest">LinkedIn</span>
              </div>
              <button onClick={() => onConnect('LINKEDIN')} className="w-full h-12 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg">Sync Account</button>
            </div>
          </div>

          <div className="p-8 bg-slate-100/50 dark:bg-slate-800/50 rounded-[2rem] space-y-3 transition-colors">
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Last Bridge Refresh</p>
            <p className="text-[12px] font-bold text-slate-900 dark:text-white">{lastSynced.toLocaleTimeString()}</p>
          </div>
          
          <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
             <div className="p-8 bg-blue-600 dark:bg-blue-700 rounded-[2.5rem] text-white space-y-4 shadow-2xl shadow-blue-500/20 transition-colors">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Identity Scanning</p>
                <form onSubmit={handleManualIntercept} className="space-y-3">
                   <input 
                    value={interceptInput}
                    onChange={e => setInterceptInput(e.target.value)}
                    placeholder="Enter Business or Handle..."
                    className="w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 text-xs text-white placeholder-white/40 outline-none focus:border-white/50 transition-all"
                   />
                   <button 
                    disabled={isIntercepting || !interceptInput}
                    className="w-full h-12 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all disabled:opacity-50"
                   >
                     {isIntercepting ? 'Intercepting...' : 'Force Intercept'}
                   </button>
                </form>
             </div>
          </div>
        </div>
      </div>

      {/* Main Feed */}
      <div className="flex-grow flex flex-col transition-colors">
        <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0F172A] transition-colors sticky top-0 z-10">
          <div className="flex gap-4">
            {['ALL', 'INSTAGRAM', 'LINKEDIN'].map(f => (
              <button key={f} onClick={() => setFilter(f as any)} className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] shadow-xl' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>{f}</button>
            ))}
          </div>
          <span className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{filteredMessages.length} Intercepted Signals</span>
        </div>

        <div className="flex-grow overflow-y-auto p-12 space-y-10 custom-scrollbar bg-[#FAFBFF] dark:bg-[#0B1222] transition-colors">
          {filteredMessages.map(msg => (
            <div key={msg.id} className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800/50 p-12 flex gap-10 hover:shadow-[0_40px_80px_-20px_rgba(15,23,42,0.08)] dark:hover:shadow-black/40 transition-all group">
              
              <div className="flex-shrink-0">
                <div className={`w-20 h-20 rounded-[1.75rem] flex items-center justify-center text-3xl font-black brand-font shadow-inner ${msg.platform === 'INSTAGRAM' ? 'bg-pink-50 dark:bg-pink-900/10 text-pink-500' : 'bg-blue-50 dark:bg-blue-900/10 text-blue-500'}`}>
                  {msg.senderName[0]}
                </div>
              </div>

              <div className="flex-grow">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-3xl font-black text-slate-900 dark:text-white brand-font tracking-tight mb-1">{msg.senderName}</h4>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">@{msg.senderHandle} • {msg.platform}</p>
                  </div>
                  <div className="text-right space-y-3">
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)]" style={{ width: `${msg.identityMatch * 100}%` }}></div>
                      </div>
                      <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Match: {Math.round(msg.identityMatch * 100)}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#F8FAFF] dark:bg-slate-950 p-10 rounded-[2.5rem] border border-blue-50 dark:border-slate-800/50 mb-8 transition-colors">
                   <p className="text-[19px] text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed">"{msg.content}"</p>
                </div>

                <div className="flex items-center justify-between">
                   <span className="bg-[#EEF6FF] dark:bg-blue-900/20 text-[#2563EB] dark:text-blue-400 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 border border-blue-100 dark:border-blue-800/30">
                     <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                     AI Hook: {msg.suggestedAction}
                   </span>
                   <button onClick={() => onConvert(msg)} className="bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] px-10 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.4em] hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all shadow-xl active:scale-95">
                     Incorporate Lead
                   </button>
                </div>
              </div>
            </div>
          ))}

          {filteredMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-40 opacity-20">
              <svg className="w-24 h-24 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              <p className="text-[12px] font-black uppercase tracking-[0.4em]">No active intercepts detected. Trigger a manual scan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialInbox;
