import React, { useState, useEffect } from 'react';
import { Deal, Sponsor, SenderProfile } from '../types';
import { generateOutreachDraft, getSocialAngle } from '../lib/gemini';

interface SocialStrategy {
  contentThemes: string[];
  recentCampaigns: string[];
  brandVoice: string;
  outreachHook: string;
}

interface FocusModeProps {
  deals: Deal[];
  sponsors: Sponsor[];
  senderProfile: SenderProfile;
  onLogActivity: (dealId: string, type: 'EMAIL' | 'DM' | 'CALL' | 'NOTE', content: string) => void;
  onUpdateSenderProfile: (updates: Partial<SenderProfile>) => void;
  onClose: () => void;
}

const FocusMode: React.FC<FocusModeProps> = ({ deals, sponsors, senderProfile, onLogActivity, onUpdateSenderProfile, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [strategy, setStrategy] = useState<SocialStrategy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingSender, setIsEditingSender] = useState(false);

  const currentDeal = deals[currentIndex];
  const currentSponsor = sponsors.find(s => s.id === currentDeal?.sponsorId);

  useEffect(() => {
    if (currentSponsor) {
      handlePrepare();
    }
  }, [currentIndex, currentSponsor?.id]);

  const handlePrepare = async () => {
    if (!currentSponsor) return;
    setIsLoading(true);
    setDraft('');
    setStrategy(null);
    
    try {
      const platform: 'EMAIL' | 'IG' | 'LI' | 'X' = currentSponsor.socialLinks?.instagram ? 'IG' : (currentSponsor.socialLinks?.linkedIn ? 'LI' : 'EMAIL');
      
      const [newDraft, newStrategy] = await Promise.all([
        generateOutreachDraft(platform, currentSponsor.companyName, currentSponsor.contactName || 'Valued Partner', currentDeal.tier, senderProfile, currentSponsor.latestSignal),
        getSocialAngle(currentSponsor.companyName, currentSponsor.socialLinks?.instagram || currentSponsor.socialLinks?.linkedIn || '')
      ]);
      
      setDraft(newDraft);
      setStrategy(newStrategy as SocialStrategy);
    } catch (e) {
      console.error("Preparation failed", e);
    }
    setIsLoading(false);
  };

  const getPlatformStyle = (platform: string, hasValue: boolean) => {
    if (!hasValue) return "text-slate-200 dark:text-slate-800 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-30 cursor-not-allowed";
    switch (platform) {
      case 'instagram': return "text-white border-pink-500 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 shadow-pink-200 dark:shadow-none";
      case 'linkedin': return "text-white border-blue-800 bg-[#0077B5] shadow-blue-100 dark:shadow-none";
      default: return "text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";
    }
  };

  const primarySignal = currentSponsor?.latestSignal;
  const outreachHook = primarySignal 
    ? `Noticed you recently ${primarySignal}`
    : `Came across your business and thought it might be a strong fit.`;

  const handleLogAndNext = () => {
    if (!currentDeal || !currentSponsor) return;

    const platform = currentSponsor.socialLinks?.instagram ? 'DM (IG)' : (currentSponsor.socialLinks?.linkedIn ? 'DM (LI)' : 'EMAIL');
    
    const logMetadata = {
      signalUsed: primarySignal || 'General alignment',
      messageContent: draft,
      channel: platform,
      senderProfileSnapshot: { ...senderProfile },
      timestamp: new Date().toISOString()
    };

    onLogActivity(currentDeal.id, platform.includes('DM') ? 'DM' : 'EMAIL', JSON.stringify(logMetadata, null, 2));
    
    if (currentIndex < deals.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  if (!currentDeal || !currentSponsor) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[60] flex flex-col items-center justify-center transition-colors">
        <h2 className="text-2xl font-bold mb-4 dark:text-white">No outreach tasks left!</h2>
        <button onClick={onClose} className="px-6 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg transition-colors">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#FDFDFD] dark:bg-slate-950 z-[60] flex flex-col animate-in fade-in duration-300 transition-colors">
      <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded tracking-tighter">POWER OUTREACH</span>
          <h2 className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-xs">
            Prospect {currentIndex + 1} of {deals.length}
          </h2>
          <div className="h-4 w-px bg-slate-100 dark:bg-slate-800"></div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sending as:</span>
             <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">{senderProfile.orgName}</span>
             <button 
              onClick={() => setIsEditingSender(true)}
              className="px-2 py-0.5 border border-slate-200 dark:border-slate-800 rounded text-[8px] font-black uppercase tracking-tighter hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
             >
               Edit
             </button>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Progress</span>
              <div className="w-32 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${((currentIndex + 1) / deals.length) * 100}%` }}></div>
              </div>
           </div>
           <button onClick={onClose} className="text-slate-400 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </header>

      {/* Sender Profile Modal */}
      {isEditingSender && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl space-y-8 border border-slate-100 dark:border-slate-800 transition-colors">
            <div>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white brand-font uppercase tracking-tight">Sender Profile</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Personalize outreach context</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Organization Name</label>
                  <input 
                    value={senderProfile.orgName}
                    onChange={(e) => onUpdateSenderProfile({ orgName: e.target.value })}
                    placeholder="My organization"
                    className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-bold outline-none focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Your Role (Optional)</label>
                  <input 
                    value={senderProfile.role}
                    onChange={(e) => onUpdateSenderProfile({ role: e.target.value })}
                    placeholder="Account Specialist"
                    className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-bold outline-none focus:border-blue-600"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Your Goal</label>
                <input 
                  value={senderProfile.goal}
                  onChange={(e) => onUpdateSenderProfile({ goal: e.target.value })}
                  placeholder="looking to connect with high-fit partners"
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-bold outline-none focus:border-blue-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Offer One-Liner</label>
                <input 
                  value={senderProfile.offerOneLiner}
                  onChange={(e) => onUpdateSenderProfile({ offerOneLiner: e.target.value })}
                  placeholder="we offer a mutually beneficial partnership"
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-bold outline-none focus:border-blue-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Call to Action Style</label>
                <select 
                  value={senderProfile.ctaStyle}
                  onChange={(e) => onUpdateSenderProfile({ ctaStyle: e.target.value as any })}
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-xs font-bold outline-none focus:border-blue-600"
                >
                  <option value="quick_chat">Quick Chat (10 mins)</option>
                  <option value="email_reply">Email Reply</option>
                  <option value="book_call">Calendar Link</option>
                </select>
              </div>
            </div>
            <button 
              onClick={() => {
                setIsEditingSender(false);
                handlePrepare(); // Re-generate with new context
              }}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
            >
              Save & Refresh Proposals
            </button>
          </div>
        </div>
      )}

      <div className="flex-grow overflow-hidden flex flex-col md:flex-row">
        {/* Left: Profile & Intel */}
        <div className="w-full md:w-[450px] p-8 border-r border-slate-100 dark:border-slate-800 overflow-y-auto space-y-10 bg-white dark:bg-slate-900 transition-colors">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tight">{currentSponsor.companyName}</h1>
            <div className="flex items-center gap-3">
              <span className="text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest">{currentSponsor.contactName || 'Valued Partner'}</span>
              <span className="w-1.5 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full"></span>
              <span className="text-slate-400 dark:text-slate-600 text-[10px] uppercase font-black tracking-widest">{currentSponsor.industry}</span>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex gap-3">
              <a 
                href={currentSponsor.socialLinks?.instagram ? `https://instagram.com/${currentSponsor.socialLinks.instagram}` : '#'}
                target={currentSponsor.socialLinks?.instagram ? "_blank" : undefined}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-xs font-black uppercase tracking-widest ${getPlatformStyle('instagram', !!currentSponsor.socialLinks?.instagram)}`}
              >
                Instagram
              </a>
              <a 
                href={currentSponsor.socialLinks?.linkedIn || '#'}
                target={currentSponsor.socialLinks?.linkedIn ? "_blank" : undefined}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-xs font-black uppercase tracking-widest ${getPlatformStyle('linkedin', !!currentSponsor.socialLinks?.linkedIn)}`}
              >
                LinkedIn
              </a>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                Brand Intelligence
              </h3>
              
              {isLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-20 bg-slate-50 dark:bg-slate-800 rounded-2xl"></div>
                  <div className="h-32 bg-slate-50 dark:bg-slate-800 rounded-2xl"></div>
                </div>
              ) : strategy ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Focus Themes</p>
                    <div className="flex flex-wrap gap-2">
                      {strategy.contentThemes.map((theme, i) => (
                        <span key={i} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-lg uppercase tracking-tight">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Communication Style</p>
                    <p className="text-sm text-slate-900 dark:text-white font-bold tracking-tight">{strategy.brandVoice}</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-600">No forensic vibe detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Hook & Draft */}
        <div className="flex-grow p-10 flex flex-col space-y-8 bg-slate-50/30 dark:bg-slate-950/30 overflow-y-auto transition-colors">
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              The Hook
            </h3>
            {isLoading ? (
               <div className="h-24 bg-blue-100/50 dark:bg-blue-900/20 animate-pulse rounded-[2rem]"></div>
            ) : (
              <div className="bg-blue-600 dark:bg-blue-700 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-3 text-blue-200">AI Grounded Hook</p>
                <p className="text-2xl font-black leading-tight italic">"{outreachHook}"</p>
              </div>
            )}
          </div>

          <div className="space-y-4 flex-grow flex flex-col">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              Full Proposal
            </h3>
            <div className="flex-grow bg-white dark:bg-slate-900 p-12 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl relative flex flex-col">
               {isLoading ? (
                 <div className="animate-pulse space-y-6 py-8">
                    <div className="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl w-full"></div>
                    <div className="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl w-5/6"></div>
                    <div className="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl w-4/6"></div>
                 </div>
               ) : (
                 <div className="text-2xl font-serif text-slate-800 dark:text-slate-200 leading-[1.7] pr-12 whitespace-pre-wrap flex-grow overflow-y-auto">
                   {draft}
                 </div>
               )}
               <button 
                onClick={() => {
                  navigator.clipboard.writeText(draft);
                  onLogActivity(currentDeal.id, 'DM', `Copied Proposal for ${currentSponsor.companyName}`);
                }}
                className="absolute top-10 right-10 p-5 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl hover:bg-blue-600"
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
               </button>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <button 
              onClick={handleLogAndNext}
              className="flex-grow py-8 bg-slate-900 dark:bg-blue-600 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-slate-400 dark:shadow-none hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-4 uppercase"
            >
              Log & Next Prospect
            </button>
            <button 
              onClick={() => currentIndex < deals.length - 1 ? setCurrentIndex(prev => prev + 1) : onClose()}
              className="px-12 py-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 rounded-[2rem] font-black text-lg hover:text-slate-900 transition-all uppercase"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusMode;