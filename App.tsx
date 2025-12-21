
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, Sponsor, Deal, PipelineStage, DiscoveredLead, DiscoverySession, AgentTask, AutomationSettings } from './types';
import Dashboard from './components/Dashboard';
import PipelineBoard from './components/PipelineBoard';
import DiscoveryTab from './components/DiscoveryTab';
import FocusMode from './components/FocusMode';
import SponsorForm from './components/SponsorForm';
import DealDetail from './components/DealDetail';
import { discoverProspects } from './lib/gemini';

const STORAGE_KEY = 'scout_crm_v4_final_auto';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        theme: parsed.theme || 'light',
        activeTask: { status: 'IDLE', phase: '' },
        automationSettings: parsed.automationSettings || {
          n8nWebhookUrl: '',
          autoSignalRefresh: false,
          notifyOnDeploy: true,
          agentFrequency: 'DAILY'
        }
      };
    }
    return {
      sponsors: [],
      deals: [],
      activities: [],
      vault: [],
      discoveryHistory: [],
      currentDiscoveryLeads: [],
      activeTask: { status: 'IDLE', phase: '' },
      automationSettings: {
        n8nWebhookUrl: '',
        autoSignalRefresh: false,
        notifyOnDeploy: true,
        agentFrequency: 'DAILY'
      },
      theme: 'light'
    };
  });

  const [activeTab, setActiveTab] = useState<'extract' | 'board' | 'insights' | 'storage'>('extract');
  const [storageSubTab, setStorageSubTab] = useState<'PARTNERS' | 'VAULT'>('PARTNERS');
  const [isAddingSponsor, setIsAddingSponsor] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const { activeTask, ...saveableState } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveableState));
  }, [state]);

  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  const toggleTheme = () => {
    setState(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light'
    }));
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const startDiscoveryAgent = useCallback(async (description: string, location: string, radius: string, depth: 'STANDARD' | 'DEEP') => {
    setState(prev => ({ 
      ...prev, 
      activeTask: { status: 'SEARCHING', phase: 'Initializing Agent...', query: description, location } 
    }));

    const phases = ['Scanning local clusters...', 'Validating contact nodes...', 'Mapping social handles...', 'Finalizing match DNA...'];
    let phaseIdx = 0;
    
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        activeTask: { ...prev.activeTask, phase: phases[phaseIdx % phases.length] }
      }));
      phaseIdx++;
    }, 2500);

    try {
      const results = await discoverProspects(
        description, 
        location, 
        { whoWeAre: 'Organization', role: 'Agent', targetGoal: 'Partnership' },
        radius, 
        depth
      );
      
      const leadsWithIds = results.map((r: any) => ({
        ...r,
        id: `prospect_${Math.random().toString(36).substr(2, 9)}`
      }));

      const newSession: DiscoverySession = {
        id: `sess_${Date.now()}`,
        query: description,
        location,
        date: new Date().toISOString(),
        leads: leadsWithIds
      };

      setState(prev => ({
        ...prev,
        currentDiscoveryLeads: leadsWithIds,
        discoveryHistory: [newSession, ...prev.discoveryHistory].slice(0, 15),
        activeTask: { status: 'COMPLETED', phase: 'Extraction Complete' }
      }));
      
      showNotification(`Agent found ${leadsWithIds.length} leads`);
    } catch (error) {
      setState(prev => ({ ...prev, activeTask: { status: 'ERROR', phase: 'Agent encountered an error' } }));
    } finally {
      clearInterval(interval);
    }
  }, []);

  const handleAddSponsor = (sponsorData: Omit<Sponsor, 'id'>, dealData: Omit<Deal, 'id' | 'sponsorId'>) => {
    const sponsorId = `sp_${Date.now()}`;
    const dealId = `dl_${Date.now()}`;
    setState(prev => ({
      ...prev,
      sponsors: [...prev.sponsors, { ...sponsorData, id: sponsorId }],
      deals: [...prev.deals, { ...dealData, id: dealId, sponsorId, currentSequenceStep: 1 }],
      activities: [...prev.activities, { id: `act_${Date.now()}`, dealId, type: 'NOTE', content: 'Prospect incorporated into pipeline.', date: new Date().toISOString() }]
    }));
    showNotification(`${sponsorData.companyName} Added to Board`);
  };

  const handleSaveToVault = (lead: DiscoveredLead) => {
    setState(prev => ({
      ...prev,
      vault: [...prev.vault, { ...lead, savedAt: new Date().toISOString() }]
    }));
    showNotification(`${lead.companyName} Saved to Vault`);
  };

  const handleRemoveDeal = (dealId: string) => {
    setState(prev => {
      const deal = prev.deals.find(d => d.id === dealId);
      if (!deal) return prev;
      return {
        ...prev,
        deals: prev.deals.filter(d => d.id !== dealId),
        sponsors: prev.sponsors.filter(s => s.id !== deal.sponsorId),
        activities: prev.activities.filter(a => a.dealId !== dealId)
      };
    });
    setSelectedDealId(null);
    showNotification('Deal archived and removed.');
  };

  const handleUpdateAutomation = (settings: Partial<AutomationSettings>) => {
    setState(prev => ({
      ...prev,
      automationSettings: { ...prev.automationSettings, ...settings }
    }));
    showNotification('Automation Gateway Updated');
  };

  const selectedDeal = useMemo(() => state.deals.find(d => d.id === selectedDealId), [state.deals, selectedDealId]);
  const selectedSponsor = useMemo(() => selectedDeal ? state.sponsors.find(s => s.id === selectedDeal.sponsorId) : null, [selectedDeal, state.sponsors]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--page-bg)] text-[var(--text-main)] transition-colors duration-300">
      {notification && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
          <div className="bg-slate-900 dark:bg-slate-800 text-white px-8 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse"></div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">{notification}</span>
          </div>
        </div>
      )}

      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 px-10 py-5 flex items-center justify-between shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3.5 group cursor-pointer" onClick={() => setActiveTab('extract')}>
            <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <span className="font-black brand-font tracking-tight text-2xl text-slate-900 dark:text-white">SCOUT</span>
          </div>
          <nav className="flex items-center gap-2">
            {[
              { id: 'extract', label: '1. Discovery' },
              { id: 'board', label: '2. Pipeline' },
              { id: 'insights', label: '3. Analytics' },
              { id: 'storage', label: '4. Vault' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id ? 'bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] shadow-md px-8' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme} 
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            {state.theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            )}
          </button>

          <button onClick={() => setIsAddingSponsor(true)} className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-white dark:hover:bg-slate-700 hover:border-slate-400 transition-all active:scale-95">
            Quick Add
          </button>
          <button onClick={() => setIsFocusMode(true)} className="bg-[#2563EB] text-white font-black px-7 py-2.5 rounded-xl text-[10px] tracking-[0.2em] uppercase hover:bg-[#1D4ED8] transition-all shadow-lg shadow-[#2563EB]/20 active:scale-95">
            Power Mode
          </button>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[1600px] mx-auto p-10">
        {activeTab === 'extract' && (
          <DiscoveryTab 
            currentLeads={state.currentDiscoveryLeads}
            onUpdateLeads={(leads) => setState(prev => ({ ...prev, currentDiscoveryLeads: leads }))}
            onAddAsLead={(l) => handleAddSponsor({
              companyName: l.companyName, industry: 'Discovery', contactName: 'Lead Contact', email: l.email || '', phone: l.phone || '', address: l.address, website: l.website, socialLinks: l.socialLinks
            }, { stage: PipelineStage.DISCOVERY, amount: 5000, tier: 'New Prospect', notes: l.matchReasoning, currentSequenceStep: 1 })} 
            onSaveToVault={handleSaveToVault}
            onStartSearch={startDiscoveryAgent}
            activeTask={state.activeTask}
            history={state.discoveryHistory}
          />
        )}
        {activeTab === 'insights' && <Dashboard state={state} onUpdateAutomation={handleUpdateAutomation} />}
        {activeTab === 'board' && <PipelineBoard state={state} onUpdateStage={(id, stage) => setState(prev => ({ ...prev, deals: prev.deals.map(d => d.id === id ? { ...d, stage } : d) }))} onSelectDeal={setSelectedDealId} />}
        {activeTab === 'storage' && (
          <div className="space-y-6 animate-fade-in">
             <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit shadow-sm">
                <button onClick={() => setStorageSubTab('PARTNERS')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${storageSubTab === 'PARTNERS' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Partners</button>
                <button onClick={() => setStorageSubTab('VAULT')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${storageSubTab === 'VAULT' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Vault ({state.vault.length})</button>
             </div>
             <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {storageSubTab === 'PARTNERS' ? (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Company</th>
                        <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Email</th>
                        <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {state.sponsors.map(sponsor => (
                        <tr key={sponsor.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-10 py-6">
                            <p className="font-bold text-slate-900 dark:text-white uppercase brand-font tracking-tight">{sponsor.companyName}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{sponsor.website}</p>
                          </td>
                          <td className="px-10 py-6"><span className="text-sm font-bold text-slate-700 dark:text-slate-300">{sponsor.email || '—'}</span></td>
                          <td className="px-10 py-6"><button onClick={() => { const deal = state.deals.find(d => d.sponsorId === sponsor.id); if (deal) setSelectedDealId(deal.id); }} className="text-[#2563EB] font-black text-[10px] tracking-widest uppercase hover:underline">View Dossier</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {state.vault.map(lead => (
                        <div key={lead.id} className="p-6 border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/30 dark:bg-slate-800/30 flex flex-col justify-between shadow-sm">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="text-lg font-black uppercase brand-font text-slate-900 dark:text-white tracking-tight">{lead.companyName}</h4>
                            </div>
                            <p className="text-[10px] text-slate-500 uppercase font-extrabold mb-4 tracking-widest">{lead.website}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium italic leading-relaxed mb-6 border-l-4 border-slate-200 dark:border-slate-700 pl-4">"{lead.matchReasoning}"</p>
                          </div>
                          <button onClick={() => { handleAddSponsor({ companyName: lead.companyName, industry: 'Vaulted', contactName: 'Lead', email: lead.email || '', website: lead.website, socialLinks: lead.socialLinks }, { stage: PipelineStage.DISCOVERY, amount: 5000, tier: 'Vaulted Lead', notes: lead.matchReasoning, currentSequenceStep: 1 }); setState(prev => ({ ...prev, vault: prev.vault.filter(v => v.id !== lead.id) })); }} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md">Add to Pipeline</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {isAddingSponsor && <SponsorForm onSave={handleAddSponsor} onClose={() => setIsAddingSponsor(false)} />}
      {selectedDeal && selectedSponsor && <DealDetail deal={selectedDeal} sponsor={selectedSponsor} activities={state.activities.filter(a => a.dealId === selectedDealId)} onClose={() => setSelectedDealId(null)} onUpdateStage={(id, stage) => setState(prev => ({ ...prev, deals: prev.deals.map(d => d.id === id ? { ...d, stage } : d) }))} onLogActivity={(id, type, content) => setState(prev => ({ ...prev, activities: [...prev.activities, { id: `act_${Date.now()}`, dealId: id, type, content, date: new Date().toISOString() }] }))} onUpdateDeal={(id, updates) => setState(prev => ({ ...prev, deals: prev.deals.map(d => d.id === id ? { ...d, ...updates } : d) }))} onUpdateSponsor={(id, updates) => setState(prev => ({ ...prev, sponsors: prev.sponsors.map(s => s.id === id ? { ...s, ...updates } : s) }))} onRemoveDeal={handleRemoveDeal} automationSettings={state.automationSettings} />}
      {isFocusMode && <FocusMode deals={state.deals} sponsors={state.sponsors} onLogActivity={(id, type, content) => setState(prev => ({ ...prev, activities: [...prev.activities, { id: `act_${Date.now()}`, dealId: id, type, content, date: new Date().toISOString() }] }))} onClose={() => setIsFocusMode(false)} />}
    </div>
  );
};

export default App;
