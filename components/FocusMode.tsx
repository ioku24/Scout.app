import React, { useState, useEffect } from 'react';
import { Deal, Sponsor } from '../types';
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
  onLogActivity: (dealId: string, type: 'EMAIL' | 'DM' | 'CALL' | 'NOTE', content: string) => void;
  onClose: () => void;
}

const FocusMode: React.FC<FocusModeProps> = ({ deals, sponsors, onLogActivity, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [strategy, setStrategy] = useState<SocialStrategy | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentDeal = deals[currentIndex];
  const currentSponsor = sponsors.find(s => s.id === currentDeal?.sponsorId);

  useEffect(() => {
    if (currentSponsor) {
      handlePrepare();
    }
  }, [currentIndex]);

  const handlePrepare = async () => {
    if (!currentSponsor) return;
    setIsLoading(true);
    setDraft('');
    setStrategy(null);
    
    try {
      const platform: 'EMAIL' | 'IG' | 'LI' | 'X' = currentSponsor.socialLinks?.instagram ? 'IG' : (currentSponsor.socialLinks?.linkedIn ? 'LI' : 'EMAIL');
      
      const [newDraft, newStrategy] = await Promise.all([
        generateOutreachDraft(platform, currentSponsor.companyName, currentSponsor.contactName, currentDeal.tier, 'Account Specialist'),
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

      <div className="flex-grow overflow-hidden flex flex-col md:flex-row">
        {/* Left: Forensic Profile & Social Vibe */}
        <div className="w-full md:w-[450px] p-8 border-r border-slate-100 dark:border-slate-800 overflow-y-auto space-y-10 bg-white dark:bg-slate-900 shadow-[10px_0_30px_rgba(0,0,0,0.02)] transition-colors">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tight">{currentSponsor.companyName}</h1>
            <div className="flex items-center gap-3">
              <span className="text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest">{currentSponsor.contactName}</span>
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
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Instagram
              </a>
              <a 
                href={currentSponsor.socialLinks?.linkedIn || '#'}
                target={currentSponsor.socialLinks?.linkedIn ? "_blank" : undefined}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-xs font-black uppercase tracking-widest ${getPlatformStyle('linkedin', !!currentSponsor.socialLinks?.linkedIn)}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                LinkedIn
              </a>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Brand Intelligence
              </h3>
              
              {isLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-20 bg-slate-50 dark:bg-slate-800 rounded-2xl transition-colors"></div>
                  <div className="h-32 bg-slate-50 dark:bg-slate-800 rounded-2xl transition-colors"></div>
                </div>
              ) : strategy ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Focus Themes</p>
                    <div className="flex flex-wrap gap-2">
                      {strategy.contentThemes.map((theme, i) => (
                        <span key={i} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-lg uppercase tracking-tight transition-colors">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Recent Strategy</p>
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 leading-relaxed text-sm text-slate-700 dark:text-slate-400 font-medium italic transition-colors">
                      "{strategy.recentCampaigns}"
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Communication Style</p>
                    <p className="text-sm text-slate-900 dark:text-white font-bold tracking-tight">{strategy.brandVoice}</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl transition-colors">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-600">Analysis pending verification...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: The Hook & Draft Center */}
        <div className="flex-grow p-10 flex flex-col space-y-8 bg-slate-50/30 dark:bg-slate-950/30 overflow-y-auto transition-colors">
          {/* Prominent Hook Suggestion */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"></path></svg>
              Conversation Starter (The Hook)
            </h3>
            {isLoading ? (
               <div className="h-24 bg-blue-100/50 dark:bg-blue-900/20 animate-pulse rounded-[2rem]"></div>
            ) : strategy?.outreachHook ? (
              <div className="bg-blue-600 dark:bg-blue-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 dark:shadow-none relative overflow-hidden group transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-3 text-blue-200">AI Verified Strategy</p>
                <p className="text-2xl font-black leading-tight italic">"{strategy.outreachHook}"</p>
                <div className="mt-4 flex gap-2">
                   <button 
                    onClick={() => navigator.clipboard.writeText(strategy.outreachHook)} 
                    className="text-[10px] font-black uppercase bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
                   >
                     Copy Hook Only
                   </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Full Draft Area */}
          <div className="space-y-4 flex-grow flex flex-col">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Full Partnership Proposal
            </h3>
            <div className="flex-grow bg-white dark:bg-slate-900 p-12 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/40 relative flex flex-col group transition-colors">
               {isLoading ? (
                 <div className="animate-pulse space-y-6 py-8">
                    <div className="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl w-full transition-colors"></div>
                    <div className="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl w-5/6 transition-colors"></div>
                    <div className="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl w-4/6 transition-colors"></div>
                 </div>
               ) : (
                 <div className="text-2xl font-serif text-slate-800 dark:text-slate-200 leading-[1.7] pr-12 whitespace-pre-wrap flex-grow overflow-y-auto custom-scrollbar">
                   {draft}
                 </div>
               )}
               <button 
                onClick={() => {
                  navigator.clipboard.writeText(draft);
                  onLogActivity(currentDeal.id, 'DM', `Power Outreach Sent: ${draft.substring(0, 50)}...`);
                }}
                className="absolute top-10 right-10 p-5 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl hover:bg-blue-600 dark:hover:bg-blue-600"
                title="Copy Proposal"
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
               </button>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(deals.length - 1, prev + 1))}
              className="flex-grow py-8 bg-slate-900 dark:bg-blue-600 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-slate-400 dark:shadow-none hover:bg-blue-600 dark:hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center gap-4 uppercase tracking-tighter"
            >
              Log & Next Prospect
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(deals.length - 1, prev + 1))}
              className="px-12 py-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 rounded-[2rem] font-black text-lg hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-700 transition-all uppercase tracking-widest shadow-sm"
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