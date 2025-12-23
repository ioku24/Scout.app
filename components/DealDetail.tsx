import React, { useState, useEffect } from 'react';
import { Sponsor, Deal, Activity, PipelineStage, AutomationSettings, SenderProfile } from '../types';
import { STAGE_COLORS, STAGE_LABELS } from '../constants';
import { generateOutreachDraft, performDeepSignalSearch, generateOutreachDrafts } from '../lib/gemini';

interface DealDetailProps {
  deal: Deal;
  sponsor: Sponsor;
  activities: Activity[];
  onClose: () => void;
  onUpdateStage: (dealId: string, stage: PipelineStage) => void;
  onLogActivity: (dealId: string, type: 'EMAIL' | 'DM' | 'CALL' | 'NOTE', content: string) => void;
  onUpdateDeal?: (dealId: string, updates: Partial<Deal>) => void;
  onUpdateSponsor?: (sponsorId: string, updates: Partial<Sponsor>) => void;
  onRemoveDeal?: (dealId: string) => void;
  automationSettings?: AutomationSettings;
  senderProfile: SenderProfile;
}

const DealDetail: React.FC<DealDetailProps> = ({ 
  deal, sponsor, activities, onClose, onUpdateStage, onLogActivity, onUpdateDeal, onUpdateSponsor, onRemoveDeal, automationSettings, senderProfile
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState<false | 'EMAIL' | 'IG' | 'LI' | 'X' | 'IQ'>(false);
  const [draftedContent, setDraftedContent] = useState('');
  const [draftPlatform, setDraftPlatform] = useState<'EMAIL' | 'IG' | 'LI' | 'X' | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState('');

  // Perform IQ State (Synced with local inputs for editing before save)
  const [emailDraft, setEmailDraft] = useState(deal.emailDraft || '');
  const [dmDraft, setDmDraft] = useState(deal.dmDraft || '');
  const [nextFollowUp, setNextFollowUp] = useState(deal.nextFollowUp || '');
  const [followUpNote, setFollowUpNote] = useState(deal.followUpNote || '');

  // Ensure local state updates if deal prop changes (e.g. from global state update)
  useEffect(() => {
    setEmailDraft(deal.emailDraft || '');
    setDmDraft(deal.dmDraft || '');
    setNextFollowUp(deal.nextFollowUp || '');
    setFollowUpNote(deal.followUpNote || '');
  }, [deal.id, deal.emailDraft, deal.dmDraft, deal.nextFollowUp, deal.followUpNote]);

  const handleDeepRefresh = async () => {
    if (!onUpdateSponsor) return;
    setIsRefreshing(true);
    try {
      const signal = await performDeepSignalSearch(sponsor.companyName, sponsor.website || '');
      onUpdateSponsor(sponsor.id, { 
        latestSignal: signal, 
        lastIntelligenceRefresh: new Date().toISOString() 
      });
      onLogActivity(deal.id, 'NOTE', `Intelligence update: ${signal}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * PERFORM IQ: Generate strategic multi-channel drafts
   */
  const handleGenerateIQ = async () => {
    setIsGenerating('IQ');
    const persona = {
      teamName: senderProfile.orgName,
      role: senderProfile.role || "Growth Partner",
      summary: senderProfile.goal
    };
    
    const drafts = await generateOutreachDrafts(deal, sponsor, persona);
    
    setEmailDraft(drafts.emailDraft);
    setDmDraft(drafts.dmDraft);
    
    if (onUpdateDeal) {
      onUpdateDeal(deal.id, {
        emailDraft: drafts.emailDraft,
        dmDraft: drafts.dmDraft
      });
    }
    
    setIsGenerating(false);
    onLogActivity(deal.id, 'NOTE', "Perform IQ: Generated structured outreach drafts.");
  };

  /**
   * Sync Perform IQ: Commit current local edits to global state
   */
  const handleSaveFollowUp = () => {
    if (onUpdateDeal) {
      onUpdateDeal(deal.id, {
        emailDraft,
        dmDraft,
        nextFollowUp,
        followUpNote
      });
      onLogActivity(deal.id, 'NOTE', `Updated follow-up plan: ${followUpNote || 'No specific note'}`);
    }
  };

  const handleGenerate = async (platform: 'EMAIL' | 'IG' | 'LI' | 'X') => {
    setIsGenerating(platform);
    const draft = await generateOutreachDraft(
      platform,
      sponsor.companyName,
      sponsor.contactName || 'Valued Partner',
      deal.tier,
      senderProfile,
      sponsor.latestSignal
    );
    setDraftedContent(draft);
    setDraftPlatform(platform);
    setIsGenerating(false);
  };

  const handleExecute = async () => {
    if (!draftPlatform) return;

    setIsDeploying(true);
    setDeploymentStatus('Simulating Human Keystrokes...');

    await new Promise(resolve => setTimeout(resolve, 1200));
    setDeploymentStatus('Injecting to Clipboard...');
    
    try {
      await navigator.clipboard.writeText(draftedContent);
    } catch (err) {
      console.warn("Clipboard access denied.");
    }

    if (automationSettings?.n8nWebhookUrl && automationSettings.notifyOnDeploy) {
      setDeploymentStatus('Triggering n8n Workflow...');
      try {
        await fetch(automationSettings.n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'OUTREACH_DEPLOYED',
            platform: draftPlatform,
            sponsorName: sponsor.companyName,
            dealAmount: deal.amount,
            message: draftedContent,
            timestamp: new Date().toISOString()
          })
        });
      } catch (err) {
        console.warn("Automation Gateway Heartbeat Failed.");
      }
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    setDeploymentStatus('Launching Platform...');

    const links = sponsor.socialLinks as any;
    let targetUrl = '';

    if (draftPlatform === 'EMAIL') {
      const subject = `Partnership Proposal: ${sponsor.companyName} x Scout`;
      window.location.href = `mailto:${sponsor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draftedContent)}`;
    } else {
      if (draftPlatform === 'IG') {
        const handle = links?.instagram?.replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') || sponsor.companyName.toLowerCase().replace(/\s/g, '');
        targetUrl = `https://ig.me/m/${handle}`;
      } else if (draftPlatform === 'LI') {
        targetUrl = links?.linkedIn || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(sponsor.companyName)}`;
      } else if (draftPlatform === 'X') {
        targetUrl = links?.twitter || `https://twitter.com/search?q=${encodeURIComponent(sponsor.companyName)}`;
      }

      if (targetUrl) {
        if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
        window.open(targetUrl, '_blank');
      }
    }

    onLogActivity(deal.id, draftPlatform === 'EMAIL' ? 'EMAIL' : 'DM', `Deployed ${draftPlatform} outreach (Human-Mimic Protocol active).`);
    
    setIsDeploying(false);
    setDraftedContent('');
    setDraftPlatform(null);
  };

  const renderPlatformIcon = (platform: 'EMAIL' | 'IG' | 'LI' | 'X') => {
    const links = sponsor.socialLinks as any;
    const hasLink = platform === 'EMAIL' ? !!sponsor.email : (
      platform === 'IG' ? !!links?.instagram : (
        platform === 'LI' ? !!links?.linkedIn : !!links?.twitter
      )
    );
    
    const isSelected = draftPlatform === platform;
    const isGeneratingThis = isGenerating === platform;

    const baseStyle = "w-16 h-16 rounded-2xl flex items-center justify-center transition-all border shadow-sm group relative overflow-hidden";
    
    const icons = {
      EMAIL: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
      IG: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.058-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
      LI: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>,
      X: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    };

    const colors = {
      EMAIL: isSelected ? "bg-blue-600 text-white border-blue-600 shadow-blue-200" : "bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 border-blue-100 dark:border-blue-800/50",
      IG: isSelected ? "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white border-transparent" : "bg-pink-50/50 dark:bg-pink-900/10 text-[#E4405F] border-pink-100 dark:border-pink-800/50",
      LI: isSelected ? "bg-[#0077B5] text-white border-transparent" : "bg-indigo-50/50 dark:bg-indigo-900/10 text-[#0077B5] border-indigo-100 dark:border-indigo-800/50",
      X: isSelected ? "bg-slate-900 text-white border-transparent dark:bg-white dark:text-slate-900" : "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
    };

    // Don't render button at all if platform link doesn't exist
    if (!hasLink) {
      return null;
    }

    return (
      <button
        key={platform}
        disabled={isGenerating !== false}
        onClick={() => handleGenerate(platform)}
        className={`${baseStyle} ${(colors as any)[platform]} ${isGenerating !== false && !isGeneratingThis ? 'opacity-30' : 'hover:scale-110 active:scale-95'}`}
      >
        {isGeneratingThis ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
        ) : icons[platform]}
        {!hasLink && <div className="absolute inset-0 bg-slate-100/10 backdrop-blur-[1px]"></div>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 transition-colors">
        <header className="p-10 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-start mb-6">
            <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-lg ${STAGE_COLORS[deal.stage]} dark:opacity-80`}>
              {STAGE_LABELS[deal.stage]}
            </span>
            <button onClick={onClose} className="text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white brand-font uppercase leading-tight tracking-tight mb-2">{sponsor.companyName}</h2>
          <div className="flex flex-wrap items-center gap-4">
            <a 
              href={sponsor.website?.startsWith('http') ? sponsor.website : `https://${sponsor.website}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-widest flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              {sponsor.website}
            </a>
            {sponsor.phone && (
              <a 
                href={`tel:${sponsor.phone.replace(/\D/g, '')}`} 
                className="text-[10px] font-black text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white uppercase tracking-widest flex items-center gap-1.5 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 00-1.02.24l-2.2 2.2a15.05 15.05 0 01-6.59-6.59l2.2-2.2a1.02 1.02 0 00.24-1.02A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/></svg>
                {sponsor.phone}
              </a>
            )}
          </div>
        </header>

        <div className="flex-grow overflow-y-auto p-10 space-y-12 bg-slate-50/20 dark:bg-slate-950/20 custom-scrollbar">
          {/* Forensic Dossier (Pro Tier) */}
          {deal.forensicDossier && (
            <section className="bg-slate-900 dark:bg-black p-8 rounded-[2.5rem] text-white border border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[40px] pointer-events-none group-hover:bg-blue-600/20 transition-all"></div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Forensic Dossier (Pro)</h3>
                <div className="flex flex-col items-end gap-1">
                  <div className="px-2.5 py-1 bg-blue-600 rounded text-[8px] font-black uppercase tracking-widest">
                    {deal.forensicDossier.verificationStatus ?? 'UNVERIFIED'}
                  </div>
                  {deal.forensicDossier.createdAt && (
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                      Audited {new Date(deal.forensicDossier.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              
              {deal.forensicDossier.verificationReasoning && (
                <p className="text-base font-bold leading-relaxed mb-8 opacity-95">
                  {deal.forensicDossier.verificationReasoning}
                </p>
              )}
              
              {deal.forensicDossier.forensicAuditTrail && deal.forensicDossier.forensicAuditTrail.length > 0 && (
                <div className="space-y-3 pt-6 border-t border-white/10">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Audit Trail</p>
                  {deal.forensicDossier.forensicAuditTrail.map((step, idx) => (
                    <div key={idx} className="flex gap-4 text-[10px] font-medium text-slate-400 leading-tight">
                      <span className="text-blue-500 font-black">•</span>
                      {step}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Perform IQ: Outreach & Follow-up Section */}
          <section className="bg-white dark:bg-slate-800/80 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-lg space-y-8 transition-all">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-[11px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-[0.3em]">Perform IQ v1</h3>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Strategic Outreach & Triage</p>
              </div>
              <button 
                onClick={handleGenerateIQ} 
                disabled={isGenerating === 'IQ'}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/10 active:scale-95 disabled:opacity-50"
              >
                {isGenerating === 'IQ' ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                )}
                Generate IQ Drafts
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Master Draft</label>
                <textarea 
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  placeholder="Draft will appear here..."
                  className="w-full min-h-[120px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Social DM Master Draft</label>
                <textarea 
                  value={dmDraft}
                  onChange={(e) => setDmDraft(e.target.value)}
                  placeholder="Draft will appear here..."
                  className="w-full min-h-[80px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Next Follow-up</label>
                  <input 
                    type="date"
                    value={nextFollowUp}
                    onChange={(e) => setNextFollowUp(e.target.value)}
                    className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Intent Note</label>
                  <input 
                    type="text"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    placeholder="e.g. Discuss Q3 partnership"
                    className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <button 
                onClick={handleSaveFollowUp}
                className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-600 transition-all active:scale-95 shadow-lg"
              >
                Sync Perform IQ Plan
              </button>
            </div>
          </section>

          {/* Signal Section (Flash) */}
          <section className="bg-white dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] pointer-events-none group-hover:bg-blue-500/10 transition-all"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Forensic Signal</h3>
              <button onClick={handleDeepRefresh} disabled={isRefreshing} className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-3.5 py-2 rounded-xl transition-all border border-blue-100 dark:border-blue-900/30">
                {isRefreshing ? 'Scanning Hub...' : 'Refresh Signal'}
                <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>
            {sponsor.latestSignal ? (
              <p className="text-base italic font-medium text-slate-600 dark:text-slate-400 leading-relaxed border-l-4 border-blue-600 pl-6 py-2">
                "{sponsor.latestSignal}"
              </p>
            ) : (
              <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                 <p className="text-[10px] text-slate-300 dark:text-slate-700 uppercase font-black tracking-widest">No intelligence signal detected</p>
              </div>
            )}
          </section>

          {/* Outreach Section */}
          <section className="space-y-10">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Outreach Launchpad</h3>
            <div className="flex justify-between items-center px-4">
              {(['EMAIL', 'IG', 'LI', 'X'] as const).map(p => renderPlatformIcon(p))}
            </div>
            
            {draftedContent && (
              <div className="bg-[#0F172A] dark:bg-black p-10 rounded-[3rem] text-white space-y-8 animate-in slide-in-from-top-4 shadow-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">AI-Generated {draftPlatform} Proposal</p>
                  <button onClick={() => {
                    navigator.clipboard.writeText(draftedContent);
                  }} className="text-[8px] font-black uppercase text-slate-500 hover:text-white transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 00-2 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    Copy Manually
                  </button>
                </div>
                
                {isDeploying ? (
                  <div className="py-10 flex flex-col items-center justify-center space-y-6">
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                       <div className="bg-blue-500 h-full animate-[progress_2s_ease-in-out_infinite]" style={{width: '60%'}}></div>
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 animate-pulse">{deploymentStatus}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[19px] italic opacity-95 leading-[1.8] font-medium font-serif whitespace-pre-wrap selection:bg-blue-600 selection:text-white">
                      "{draftedContent}"
                    </p>
                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={handleExecute} 
                        className="flex-grow py-5 bg-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-900/40 flex items-center justify-center gap-3"
                      >
                        Deploy Outreach
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                      </button>
                      <button onClick={() => setDraftedContent('')} className="px-8 py-5 bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5">
                        Discard
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Activity Section */}
          <section className="space-y-6 pb-20">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Forensic Timeline</h3>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(a => (
                  <div key={a.id} className="p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors shadow-sm relative group">
                    <div className="flex justify-between mb-2.5">
                      <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em]">{a.type}</span>
                      <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{new Date(a.date).toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-300 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">{a.content}</p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center opacity-20">
                  <p className="text-[9px] font-black uppercase tracking-[0.5em]">No activity logged</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="p-10 border-t border-slate-100 dark:border-slate-800 flex gap-5 bg-white dark:bg-slate-900 transition-colors sticky bottom-0 z-10">
          <select value={deal.stage} onChange={e => onUpdateStage(deal.id, e.target.value as PipelineStage)} className="flex-grow h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl px-8 text-[11px] font-black uppercase tracking-[0.2em] outline-none cursor-pointer text-slate-900 dark:text-white transition-colors focus:border-blue-600 shadow-inner">
            {Object.values(PipelineStage).map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <button 
            onClick={() => onRemoveDeal && onRemoveDeal(deal.id)}
            className="px-10 h-16 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
          >
            Archive
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DealDetail;