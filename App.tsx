import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, Sponsor, Deal, PipelineStage, DiscoveredLead, DiscoverySession, AgentTask, AutomationSettings, Workflow, SocialMessage, SocialAccount, SenderProfile, ForensicDossier } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import PipelineBoard from './components/PipelineBoard.tsx';
import DiscoveryTab from './components/DiscoveryTab.tsx';
import FocusMode from './components/FocusMode.tsx';
import SponsorForm from './components/SponsorForm.tsx';
import DealDetail from './components/DealDetail.tsx';
import WorkflowBuilder from './components/WorkflowBuilder.tsx';
import SocialInbox from './components/SocialInbox.tsx';
import { discoverProspects, discoverProspectsDeepScan, getIdentityKeys } from './lib/gemini.ts';

const STORAGE_KEY = 'scout_crm_v4_final_auto_v5';
const CURRENT_STATE_VERSION = 1;

const migrateState = (payload: any): AppState => {
  if (!payload || !payload.stateVersion) return payload;
  return payload.state;
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    let baseState: any = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      baseState = parsed ? migrateState(parsed) : null;
    } catch (e) {
      console.warn("Failed to hydrate state from storage:", e);
    }

    if (!baseState) {
      baseState = {
        sponsors: [],
        deals: [],
        activities: [],
        vault: [],
        discoveryHistory: [],
        currentDiscoveryLeads: [],
        workflows: [],
        socialMessages: [],
        socialAccounts: [
          { platform: 'INSTAGRAM', isConnected: true, username: 'scout_hq' },
          { platform: 'LINKEDIN', isConnected: false, username: '' }
        ],
        senderProfile: {
          orgName: "My organization",
          role: "",
          goal: "looking to connect with high-fit partners",
          offerOneLiner: "we offer a mutually beneficial partnership",
          ctaStyle: "quick_chat"
        },
        automationSettings: {
          n8nWebhookUrl: '',
          autoSignalRefresh: false,
          notifyOnDeploy: true,
          agentFrequency: 'DAILY'
        },
        theme: 'light'
      };
    }

    return {
      ...baseState,
      senderProfile: baseState.senderProfile || {
        orgName: "My organization",
        role: "",
        goal: "looking to connect with high-fit partners",
        offerOneLiner: "we offer a mutually beneficial partnership",
        ctaStyle: "quick_chat"
      },
      activeTask: { status: 'IDLE', phase: '' }
    } as AppState;
  });

  const [activeTab, setActiveTab] = useState<'extract' | 'signals' | 'board' | 'insights' | 'flows' | 'storage'>('extract');
  const [isAddingSponsor, setIsAddingSponsor] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const { activeTask, ...persistentState } = state;
    const payload = {
      stateVersion: CURRENT_STATE_VERSION,
      state: persistentState
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

  const processedKeys = useMemo(() => {
    const keys = new Set<string>();
    state.sponsors.forEach(s => getIdentityKeys(s).forEach(k => keys.add(k)));
    state.vault.forEach(v => getIdentityKeys(v).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [state.sponsors, state.vault]);

  const startDiscoveryAgent = useCallback(async (description: string, location: string, radius: string, depth: 'STANDARD' | 'DEEP', coords?: {latitude: number, longitude: number}) => {
    setState(prev => ({
      ...prev,
      activeTask: {
        status: 'SEARCHING',
        phase: depth === 'DEEP' ? 'Deep Scan: Initializing Gemini + Apollo.io...' : 'Initializing Agent...',
        query: description,
        location
      }
    }));

    try {
      // Choose between Standard Scan (Gemini only) or Deep Scan (Gemini + Apollo)
      const results = depth === 'DEEP'
        ? await discoverProspectsDeepScan(
            description,
            location,
            { whoWeAre: state.senderProfile.orgName, role: state.senderProfile.role || 'Agent', targetGoal: state.senderProfile.goal },
            radius,
            coords
          )
        : await discoverProspects(
            description,
            location,
            { whoWeAre: state.senderProfile.orgName, role: state.senderProfile.role || 'Agent', targetGoal: state.senderProfile.goal },
            radius,
            depth,
            coords
          );
      
      const leadsWithIds = results.map((r: any) => ({
        ...r,
        id: `prospect_${Math.random().toString(36).substr(2, 9)}`
      }));

      const newSession: DiscoverySession = {
        id: `sess_${Date.now()}`,
        query: description,
        location,
        radius,
        depth,
        date: new Date().toISOString(),
        leads: leadsWithIds
      };

      setState(prev => ({
        ...prev,
        currentDiscoveryLeads: leadsWithIds,
        discoveryHistory: [newSession, ...prev.discoveryHistory].slice(0, 15),
        activeTask: { status: 'COMPLETED', phase: 'Extraction Complete' }
      }));
      
      showNotification(`Agent found ${leadsWithIds.length} leads with Maps grounding.`);
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, activeTask: { status: 'ERROR', phase: 'Agent encountered an error' } }));
    }
  }, [state.senderProfile]);

  const handleAddSponsor = (sponsorData: Omit<Sponsor, 'id'>, dealData: Omit<Deal, 'id' | 'sponsorId'>) => {
    const sponsorId = `sp_${Date.now()}`;
    const dealId = `dl_${Date.now()}`;
    
    setState(prev => ({
      ...prev,
      sponsors: [...prev.sponsors, { ...sponsorData, id: sponsorId }],
      deals: [...prev.deals, { ...dealData, id: dealId, sponsorId, currentSequenceStep: 1 }],
      activities: [
        ...prev.activities, 
        { id: `act_${Date.now()}`, dealId, type: 'NOTE', content: 'Lead incorporated', date: new Date().toISOString() }
      ],
    }));
    showNotification(`${sponsorData.companyName} Added to Board`);
  };

  const syncForensicDossierFromLead = useCallback((updatedLead: DiscoveredLead) => {
    setState(prev => {
      const updatedDeals = prev.deals.map(deal => {
        if (deal.forensicDossier?.sourceLeadId !== updatedLead.id) {
          return deal;
        }

        const updatedDossier: ForensicDossier = {
          sourceLeadId: updatedLead.id,
          verificationStatus: updatedLead.verificationStatus,
          verificationReasoning: updatedLead.verificationReasoning,
          forensicAuditTrail: updatedLead.forensicAuditTrail ?? [],
          createdAt: deal.forensicDossier?.createdAt ?? new Date().toISOString(),
        };

        return {
          ...deal,
          forensicDossier: updatedDossier
        };
      });

      const updatedSponsors = prev.sponsors.map(sponsor => {
        // Find if this sponsor belongs to a deal being updated
        const associatedDeal = updatedDeals.find(d => d.sponsorId === sponsor.id && d.forensicDossier?.sourceLeadId === updatedLead.id);
        if (!associatedDeal) return sponsor;

        return {
          ...sponsor,
          website: updatedLead.website || sponsor.website,
          email: updatedLead.email || sponsor.email,
          socialLinks: {
            ...sponsor.socialLinks,
            ...updatedLead.socialLinks
          }
        };
      });

      return {
        ...prev,
        deals: updatedDeals,
        sponsors: updatedSponsors
      };
    });
    showNotification(`Forensic sync complete for ${updatedLead.companyName}`);
  }, []);

  const handleIncorporateSignal = (message: SocialMessage) => {
    const sponsorData: Omit<Sponsor, 'id'> = {
      companyName: message.senderName,
      contactName: message.senderName,
      email: '',
      industry: 'Social Lead',
      socialLinks: { 
        instagram: message.platform === 'INSTAGRAM' ? `https://instagram.com/${message.senderHandle}` : undefined,
        linkedIn: message.platform === 'LINKEDIN' ? message.senderHandle : undefined
      },
      latestSignal: message.content,
      primarySignalSource: message.platform
    };

    const dealData: Omit<Deal, 'id' | 'sponsorId'> = {
      stage: PipelineStage.DISCOVERY,
      amount: 5000,
      tier: 'Community Partner',
      notes: `Intercepted Signal: ${message.content}`,
      currentSequenceStep: 1
    };

    handleAddSponsor(sponsorData, dealData);
    setState(prev => ({
      ...prev,
      socialMessages: prev.socialMessages.map(m => m.id === message.id ? { ...m, isArchived: true } : m)
    }));
  };

  const handleUpdateSenderProfile = (updates: Partial<SenderProfile>) => {
    setState(prev => ({
      ...prev,
      senderProfile: { ...prev.senderProfile, ...updates }
    }));
  };

  const handleAddIntercept = (msg: SocialMessage) => {
    setState(prev => ({
      ...prev,
      socialMessages: [msg, ...prev.socialMessages]
    }));
    showNotification(`New Signal Found for ${msg.senderName}`);
  };

  const handleUpdateAutomation = (settings: Partial<AutomationSettings>) => {
    setState(prev => ({
      ...prev,
      automationSettings: { ...prev.automationSettings, ...settings }
    }));
    showNotification('Automation Gateway Updated');
  };

  const handleLogActivity = (dealId: string, type: 'EMAIL' | 'DM' | 'CALL' | 'NOTE', content: string) => {
    setState(prev => ({
      ...prev,
      activities: [...prev.activities, { id: `act_${Date.now()}`, dealId, type, content, date: new Date().toISOString() }]
    }));
  };

  const handleUpdateStage = (dealId: string, newStage: PipelineStage) => {
    setState(prev => ({
      ...prev,
      deals: prev.deals.map(d => d.id === dealId ? { ...d, stage: newStage } : d)
    }));
  };

  const handleUpdateSponsor = (sponsorId: string, updates: Partial<Sponsor>) => {
    setState(prev => ({
      ...prev,
      sponsors: prev.sponsors.map(s => s.id === sponsorId ? { ...s, ...updates } : s)
    }));
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
    showNotification('Deal archived.');
  };

  const selectedDeal = useMemo(() => state.deals.find(d => d.id === selectedDealId), [state.deals, selectedDealId]);
  const selectedSponsor = useMemo(() => selectedDeal ? state.sponsors.find(s => s.id === selectedDeal.sponsorId) : null, [selectedDeal, state.sponsors]);
  const dealActivities = useMemo(() => state.activities.filter(a => a.dealId === selectedDealId), [state.activities, selectedDealId]);

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
          <nav className="flex items-center gap-1">
            {[
              { id: 'extract', label: 'Extract' },
              { id: 'signals', label: 'Signals' },
              { id: 'board', label: 'Pipeline' },
              { id: 'insights', label: 'Insights' },
              { id: 'flows', label: 'Flows' },
              { id: 'storage', label: 'Vault' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id ? 'bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
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
          
          <button 
            onClick={() => setIsFocusMode(true)}
            className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            Power Mode
          </button>
        </div>
      </header>

      <main className="flex-grow p-10 overflow-y-auto">
        {activeTab === 'extract' && (
          <DiscoveryTab 
            currentLeads={state.currentDiscoveryLeads}
            onUpdateLeads={(leads) => setState(prev => ({ ...prev, currentDiscoveryLeads: leads }))}
            onAddAsLead={(lead) => {
              const forensicDossier: ForensicDossier = {
                sourceLeadId: lead.id,
                verificationStatus: lead.verificationStatus,
                verificationReasoning: lead.verificationReasoning,
                forensicAuditTrail: lead.forensicAuditTrail ?? [],
                createdAt: new Date().toISOString(),
              };

              handleAddSponsor(
                { 
                  companyName: lead.companyName, 
                  contactName: '', 
                  email: lead.email || '', 
                  phone: lead.phone || '', 
                  industry: 'Discovery Match',
                  website: lead.website,
                  socialLinks: lead.socialLinks,
                  address: lead.address,
                  latestSignal: lead.latestSignal,
                  primarySignalSource: 'Discovery Agent'
                },
                { 
                  stage: PipelineStage.DISCOVERY, 
                  amount: 2500, 
                  tier: 'Prospect', 
                  notes: lead.matchReasoning, 
                  currentSequenceStep: 1,
                  forensicDossier
                }
              );
            }}
            onSaveToVault={(lead) => setState(prev => ({ ...prev, vault: [...prev.vault, { ...lead, savedAt: new Date().toISOString() }] }))}
            onStartSearch={startDiscoveryAgent}
            activeTask={state.activeTask}
            history={state.discoveryHistory}
            onClearSession={() => setState(prev => ({ ...prev, currentDiscoveryLeads: [], activeTask: { status: 'IDLE', phase: '' } }))}
            processedIds={processedKeys}
            onLeadVerified={syncForensicDossierFromLead}
          />
        )}

        {activeTab === 'signals' && (
          <SocialInbox 
            accounts={state.socialAccounts}
            messages={state.socialMessages.filter(m => !m.isArchived)}
            onConnect={(p) => setState(prev => ({ ...prev, socialAccounts: prev.socialAccounts.map(a => a.platform === p ? { ...a, isConnected: true, username: 'scout_synced' } : a) }))}
            onConvert={handleIncorporateSignal}
            onAddIntercept={handleAddIntercept}
          />
        )}

        {activeTab === 'board' && (
          <PipelineBoard state={state} onUpdateStage={handleUpdateStage} onSelectDeal={setSelectedDealId} />
        )}

        {activeTab === 'insights' && (
          <Dashboard state={state} onUpdateAutomation={handleUpdateAutomation} onNavigateToFlows={() => setActiveTab('flows')} />
        )}

        {activeTab === 'flows' && (
          <WorkflowBuilder 
            workflows={state.workflows} 
            onSave={(wf) => setState(prev => ({ ...prev, workflows: prev.workflows.map(w => w.id === wf.id ? wf : w).concat(prev.workflows.find(w => w.id === wf.id) ? [] : [wf]) }))}
            onDelete={(id) => setState(prev => ({ ...prev, workflows: prev.workflows.filter(w => w.id !== id) }))}
          />
        )}

        {activeTab === 'storage' && (
          <div className="space-y-12 animate-fade-in max-w-[1400px] mx-auto">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {state.vault.map(v => (
                 <div key={v.id} className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between group transition-colors">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <h4 className="text-3xl font-black text-slate-900 dark:text-white brand-font uppercase tracking-tight">{v.companyName}</h4>
                        <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Saved {new Date(v.savedAt || '').toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed mb-8">{v.matchReasoning}</p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          setState(prev => ({ ...prev, vault: prev.vault.filter(item => item.id !== v.id) }));
                          handleAddSponsor(
                            { companyName: v.companyName, contactName: '', email: v.email || '', industry: 'From Vault', website: v.website, socialLinks: v.socialLinks, address: v.address, latestSignal: v.latestSignal, primarySignalSource: 'Vault' },
                            { stage: PipelineStage.DISCOVERY, amount: 1000, tier: 'Vault Prospect', notes: 'Pulled from cold vault.', currentSequenceStep: 1 }
                          );
                        }}
                        className="flex-grow py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10"
                      >
                        Push to Board
                      </button>
                      <button 
                        onClick={() => setState(prev => ({ ...prev, vault: prev.vault.filter(item => item.id !== v.id) }))}
                        className="px-8 py-4 bg-slate-50 dark:bg-slate-800 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                 </div>
               ))}
               {state.vault.length === 0 && (
                 <div className="col-span-full py-40 text-center opacity-20">
                    <p className="text-[12px] font-black uppercase tracking-[0.5em]">The Vault is currently empty.</p>
                 </div>
               )}
             </div>
          </div>
        )}
      </main>

      {isAddingSponsor && (
        <SponsorForm onSave={handleAddSponsor} onClose={() => setIsAddingSponsor(false)} />
      )}

      {selectedDeal && selectedSponsor && (
        <DealDetail 
          deal={selectedDeal}
          sponsor={selectedSponsor}
          activities={dealActivities}
          onClose={() => setSelectedDealId(null)}
          onUpdateStage={handleUpdateStage}
          onLogActivity={handleLogActivity}
          onUpdateSponsor={handleUpdateSponsor}
          onRemoveDeal={handleRemoveDeal}
          automationSettings={state.automationSettings}
          senderProfile={state.senderProfile}
        />
      )}

      {isFocusMode && (
        <FocusMode 
          deals={state.deals.filter(d => d.stage === PipelineStage.DISCOVERY || d.stage === PipelineStage.OUTREACH_STARTED)}
          sponsors={state.sponsors}
          senderProfile={state.senderProfile}
          onLogActivity={handleLogActivity}
          onUpdateSenderProfile={handleUpdateSenderProfile}
          onClose={() => setIsFocusMode(false)}
        />
      )}
    </div>
  );
};

export default App;