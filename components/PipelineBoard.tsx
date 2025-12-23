import React from 'react';
import { AppState, PipelineStage, Deal, Sponsor } from '../types';
import { STAGE_LABELS, STAGE_COLORS } from '../constants';

interface PipelineBoardProps {
  state: AppState;
  onUpdateStage: (dealId: string, newStage: PipelineStage) => void;
  onSelectDeal: (dealId: string) => void;
}

const PipelineBoard: React.FC<PipelineBoardProps> = ({ state, onUpdateStage, onSelectDeal }) => {
  const stages = Object.values(PipelineStage);
  
  // Logic: Identify follow-ups due today or overdue
  const today = new Date().toISOString().split('T')[0];
  const dueDeals = state.deals.filter(deal => 
    deal.nextFollowUp && 
    deal.nextFollowUp <= today &&
    deal.stage !== PipelineStage.SIGNED && 
    deal.stage !== PipelineStage.ACTIVE
  );

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Triage Section: Follow-ups Today */}
      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm transition-colors">
        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mb-6 pl-2">Follow-ups Today</h3>
        
        {dueDeals.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {dueDeals.map(deal => {
              const sponsor = state.sponsors.find(s => s.id === deal.sponsorId);
              const isOverdue = deal.nextFollowUp && deal.nextFollowUp < today;
              
              return (
                <div 
                  key={deal.id}
                  onClick={() => onSelectDeal(deal.id)}
                  className="flex-shrink-0 w-80 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 cursor-pointer hover:border-blue-600/40 transition-all group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${STAGE_COLORS[deal.stage]}`}>
                      {STAGE_LABELS[deal.stage]}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${isOverdue ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                      {isOverdue ? 'Overdue' : 'Due Today'} • {deal.nextFollowUp}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white brand-font uppercase mb-1 truncate">
                    {sponsor?.companyName || 'Unknown Entity'}
                  </h4>
                  {deal.followUpNote && (
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 italic truncate">
                      "{deal.followUpNote}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 px-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center">
            <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em]">No follow-ups due today.</p>
          </div>
        )}
      </section>

      {/* Main Board View */}
      <div className="flex overflow-x-auto pb-10 space-x-6 min-h-[calc(100vh-450px)] scrollbar-hide">
        {stages.map((stage) => {
          const stageDeals = state.deals.filter(d => d.stage === stage);
          const stageValue = stageDeals.reduce((sum, d) => sum + d.amount, 0);

          return (
            <div key={stage} className="flex-shrink-0 w-80 flex flex-col group/column">
              <div className="flex items-center justify-between mb-5 px-2">
                <div className="flex flex-col">
                  <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      stage === PipelineStage.SIGNED || stage === PipelineStage.ACTIVE ? 'bg-emerald-500' : 
                      stage === PipelineStage.DISCOVERY ? 'bg-slate-400' : 'bg-blue-600'
                    }`}></div>
                    {STAGE_LABELS[stage]}
                  </h3>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-tight">Cap: ${stageValue.toLocaleString()}</span>
                </div>
                <span className="bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
                  {stageDeals.length}
                </span>
              </div>
              
              <div className="bg-slate-200/40 dark:bg-slate-800/20 p-3 rounded-2xl flex-grow space-y-4 border border-slate-200/50 dark:border-slate-700/50 transition-colors group-hover/column:bg-slate-200/60 dark:group-hover/column:bg-slate-800/40">
                {stageDeals.map(deal => {
                  const sponsor = state.sponsors.find(s => s.id === deal.sponsorId);
                  const hasCriticalData = !!(sponsor?.email || sponsor?.phone);
                  const isDueToday = deal.nextFollowUp && deal.nextFollowUp <= today;
                  
                  return (
                    <div 
                      key={deal.id} 
                      onClick={() => onSelectDeal(deal.id)}
                      className={`bg-white dark:bg-slate-900 p-6 rounded-xl border shadow-sm transition-all cursor-pointer group/card ${
                        isDueToday ? 'border-blue-600/40' : 'border-slate-200 dark:border-slate-800'
                      } hover:border-blue-600/60 dark:hover:border-blue-500/60 hover:shadow-xl hover:shadow-slate-900/5 dark:hover:shadow-black/20 hover:-translate-y-1`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 group-hover/card:text-blue-600 dark:group-hover/card:text-blue-500 transition-colors">{deal.tier}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">${deal.amount.toLocaleString()}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-1 leading-tight uppercase brand-font">{sponsor?.companyName}</h4>
                      
                      {/* Forensic Badge Section */}
                      <div className="flex items-center gap-2 mt-1 mb-3">
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-900 dark:bg-slate-800 text-slate-100">
                          {deal.forensicDossier?.verificationStatus ?? 'UNVERIFIED'}
                        </span>

                        {deal.forensicDossier?.createdAt && (
                          <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-[0.15em]">
                            Verified {new Date(deal.forensicDossier.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {isDueToday && (
                         <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            Follow-up Due
                         </div>
                      )}

                      {hasCriticalData && (
                        <div className="flex gap-2 mt-4 mb-2">
                          {sponsor?.email && (
                            <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md flex items-center gap-2 border border-blue-100 dark:border-blue-800/50">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z"/></svg>
                              <span className="text-[8px] font-black uppercase">Mail Ready</span>
                            </div>
                          )}
                          {sponsor?.phone && (
                            <div className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md flex items-center gap-2 border border-emerald-100 dark:border-emerald-800/50">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 00-1.02.24l-2.2 2.2a15.05 15.05 0 01-6.59-6.59l2.2-2.2a1.02 1.02 0 00.24-1.02A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/></svg>
                              <span className="text-[8px] font-black uppercase">Direct</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between transition-colors">
                        <span className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Action Required</span>
                        <svg className="w-4 h-4 text-slate-200 dark:text-slate-700 group-hover/card:text-blue-600 dark:group-hover/card:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                      </div>
                    </div>
                  );
                })}
                {stageDeals.length === 0 && (
                  <div className="h-24 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center opacity-30 transition-colors">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Station Idle</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineBoard;