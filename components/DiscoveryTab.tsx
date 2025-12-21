
import React, { useState, useEffect } from 'react';
import { DiscoveredLead, DiscoverySession, AgentTask } from '../types';

interface DiscoveryTabProps {
  currentLeads: DiscoveredLead[];
  onUpdateLeads: (leads: DiscoveredLead[]) => void;
  onAddAsLead: (lead: DiscoveredLead) => void;
  onSaveToVault: (lead: DiscoveredLead) => void;
  onStartSearch: (description: string, location: string, radius: string, depth: 'STANDARD' | 'DEEP') => void;
  activeTask: AgentTask;
  history: DiscoverySession[];
}

const DiscoveryTab: React.FC<DiscoveryTabProps> = ({ 
  currentLeads, 
  onUpdateLeads, 
  onAddAsLead, 
  onSaveToVault, 
  onStartSearch,
  activeTask,
  history 
}) => {
  const [description, setDescription] = useState(activeTask.query || '');
  const [location, setLocation] = useState(activeTask.location || '');
  const [radius, setRadius] = useState('25');
  const [depth, setDepth] = useState<'STANDARD' | 'DEEP'>('STANDARD');
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (activeTask.query && !description) setDescription(activeTask.query);
    if (activeTask.location && !location) setLocation(activeTask.location);
  }, [activeTask.query, activeTask.location]);

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice transcription is not supported in this browser.");
      return;
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    if (isListening) recognition.stop();
    else recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartSearch(description, location, radius, depth);
  };

  const getPlatformIcon = (platform: string, url?: string) => {
    const isActive = !!url;
    const baseClass = "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 border shadow-sm";
    
    if (!isActive) {
      return (
        <div className={`${baseClass} bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-700 opacity-20`}>
          {getSvgForPlatform(platform)}
        </div>
      );
    }

    const activeStyles: Record<string, string> = {
      instagram: "bg-pink-50 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30 text-[#E4405F] hover:shadow-[0_0_15px_rgba(228,64,95,0.2)]",
      linkedIn: "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-[#0077B5] hover:shadow-[0_0_15px_rgba(0,119,181,0.2)]",
      facebook: "bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 text-[#1877F2] hover:shadow-[0_0_15px_rgba(24,119,242,0.2)]",
      twitter: "bg-slate-900 dark:bg-white border-slate-700 dark:border-slate-200 text-white dark:text-slate-900 hover:shadow-lg"
    };

    return (
      <a 
        href={url.startsWith('http') ? url : `https://${url}`} 
        target="_blank" 
        rel="noopener noreferrer"
        className={`${baseClass} ${activeStyles[platform] || activeStyles.twitter} hover:scale-110 active:scale-95`}
      >
        {getSvgForPlatform(platform)}
      </a>
    );
  };

  const getSvgForPlatform = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>;
      case 'linkedIn':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>;
      case 'facebook':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
      case 'twitter':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto pb-40">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-soft relative overflow-hidden transition-all duration-300">
        
        <div className="flex items-center justify-between mb-10 pb-8 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white brand-font tracking-tight uppercase leading-none">Discovery Hub</h2>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mt-3">Intelligent Prospect Search</p>
          </div>
          
          <button onClick={() => setShowHistory(!showHistory)} className="px-7 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 transition-all flex items-center gap-3 shadow-sm bg-slate-50/50 dark:bg-slate-900">
            <svg className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
            Search Logs
          </button>
        </div>

        {showHistory && (
          <div className="mb-10 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-4">
            {history.length > 0 ? history.map(s => (
              <button key={s.id} onClick={() => { setDescription(s.query); setLocation(s.location); onUpdateLeads(s.leads); setShowHistory(false); }} className="text-left p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-white dark:hover:bg-slate-700 transition-all group shadow-sm">
                <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate mb-1">{s.query}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">{s.location} • {new Date(s.date).toLocaleDateString()}</p>
              </button>
            )) : (
              <div className="col-span-4 py-8 text-center bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No previous extractions found</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest pl-1">Target Location</label>
              <input 
                required 
                disabled={activeTask.status === 'SEARCHING'} 
                value={location} 
                onChange={e => setLocation(e.target.value)} 
                placeholder="City, State or Zip Code" 
                className="w-full h-14 bg-slate-50 dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-600/5 transition-all shadow-inner disabled:opacity-50" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest pl-1">Search Radius</label>
              <div className="relative">
                <select 
                  disabled={activeTask.status === 'SEARCHING'} 
                  value={radius} 
                  onChange={e => setRadius(e.target.value)} 
                  className="w-full h-14 bg-slate-50 dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-2xl px-6 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-600/5 cursor-pointer appearance-none disabled:opacity-50"
                >
                  {['10', '25', '50', '100'].map(r => <option key={r} value={r}>{r} Miles Radius</option>)}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest pl-1">Search Depth</label>
              <div className="grid grid-cols-2 gap-2 h-14 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-[#CBD5E1] dark:border-slate-700">
                 <button 
                  type="button" 
                  disabled={activeTask.status === 'SEARCHING'} 
                  onClick={() => setDepth('STANDARD')} 
                  className={`rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${depth === 'STANDARD' ? 'bg-[#EAF2FF] dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                 >
                   Standard
                 </button>
                 <button 
                  type="button" 
                  disabled={activeTask.status === 'SEARCHING'} 
                  onClick={() => setDepth('DEEP')} 
                  className={`rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${depth === 'DEEP' ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                 >
                   Deep Scan
                 </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 relative">
            <div className="flex flex-col gap-1 mb-2 pl-1">
              <label className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Prospect DNA</label>
              <p className="text-[10px] font-medium text-slate-500">Describe the niche, size, and personality of your ideal partner to calibrate the extraction agent.</p>
            </div>
            <textarea 
              required 
              disabled={activeTask.status === 'SEARCHING'} 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="e.g. Locally owned sustainable cafes with a strong social media presence in the downtown area..." 
              className="w-full h-40 bg-slate-50 dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-[2rem] p-8 text-lg font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-8 focus:ring-blue-600/5 transition-all resize-none leading-relaxed shadow-inner disabled:opacity-50" 
            />
            <button 
              type="button" 
              onClick={toggleListening} 
              disabled={activeTask.status === 'SEARCHING'} 
              className={`absolute bottom-6 right-6 p-4 rounded-2xl transition-all shadow-lg ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-blue-100'} disabled:opacity-30`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
            </button>
          </div>

          <button 
            type="submit" 
            disabled={activeTask.status === 'SEARCHING'} 
            className="w-full h-14 bg-[#C7D7FF] text-blue-700 dark:text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] shadow-sm hover:bg-blue-600 hover:text-white active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-4"
          >
            {activeTask.status === 'SEARCHING' ? (
              <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>{activeTask.phase}</>
            ) : (
              'Start Extraction Agent'
            )}
          </button>
        </form>
      </div>

      {currentLeads.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {currentLeads.map(lead => (
            <div key={lead.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 flex flex-col h-[520px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)] hover:border-blue-200 transition-all group overflow-hidden relative">
              
              {/* Header: Identity Cluster */}
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white brand-font uppercase truncate tracking-tight">{lead.companyName}</h3>
                  <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase truncate tracking-widest mt-0.5">{lead.address}</p>
                </div>
                <a 
                  href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg hover:text-blue-600 hover:bg-blue-50 border border-slate-100 dark:border-slate-700 transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </a>
              </div>
              
              {/* Score Cluster: Forensic DNA */}
              <div className="bg-slate-900 dark:bg-[#111827] rounded-[2rem] p-5 mb-6 text-white space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/10 blur-[40px] pointer-events-none"></div>
                <div className="flex justify-between items-center relative z-10">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Match DNA Score</span>
                  <span className="text-xl font-black brand-font">{lead.dnaScore}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 dark:bg-slate-700 rounded-full overflow-hidden border border-white/5 relative z-10">
                  <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${lead.dnaScore}%` }}></div>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400 font-medium italic line-clamp-2 relative z-10">"{lead.matchReasoning}"</p>
              </div>

              {/* Data Nodes: Contact Grid (HubSpot Style) */}
              <div className="space-y-4 mb-6 flex-grow">
                 <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                   <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Email Node</span>
                   <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 truncate max-w-[160px]">{lead.email || 'None Detected'}</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                   <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Phone Node</span>
                   <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 truncate max-w-[160px]">{lead.phone || 'None Detected'}</span>
                 </div>
                 
                 {/* Social Bridge: Real Brand Identities */}
                 <div className="flex justify-center gap-3 pt-2">
                   {['instagram', 'linkedIn', 'facebook', 'twitter'].map(platform => 
                      <React.Fragment key={platform}>
                        {getPlatformIcon(platform, (lead.socialLinks as any)[platform])}
                      </React.Fragment>
                   )}
                 </div>
              </div>

              {/* Terminal: Action Deployment */}
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button 
                  onClick={() => onAddAsLead(lead)} 
                  className="py-3.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/10 hover:bg-blue-700 active:scale-95 transition-all"
                >
                  Add to Board
                </button>
                <button 
                  onClick={() => onSaveToVault(lead)} 
                  className="py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all shadow-sm"
                >
                  Save to Vault
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscoveryTab;
