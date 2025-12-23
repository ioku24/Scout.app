import React, { useState } from 'react';
import { Workflow, WorkflowStep } from '../types';

interface WorkflowBuilderProps {
  workflows: Workflow[];
  onSave: (workflow: Workflow) => void;
  onDelete: (id: string) => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ workflows, onSave, onDelete }) => {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  
  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

  const createNewBlueprint = () => {
    const newWf: Workflow = {
      id: `wf_${Date.now()}`,
      name: 'Untitled Blueprint',
      isActive: false,
      steps: [
        { id: 'step_1', type: 'TRIGGER', label: 'Manual Event', config: { trigger: 'MANUAL' } }
      ]
    };
    onSave(newWf);
    setActiveWorkflowId(newWf.id);
  };

  const addStep = (type: 'AGENT' | 'ACTION') => {
    if (!activeWorkflow) return;
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      type,
      label: type === 'AGENT' ? 'Gemini Intelligence' : 'Deploy Payload',
      config: type === 'AGENT' ? { persona: 'RESEARCHER' } : { action: 'WEBHOOK' }
    };
    onSave({ ...activeWorkflow, steps: [...activeWorkflow.steps, newStep] });
  };

  const removeStep = (stepId: string) => {
    if (!activeWorkflow) return;
    onSave({ ...activeWorkflow, steps: activeWorkflow.steps.filter(s => s.id !== stepId) });
  };

  return (
    <div className="flex h-[calc(100vh-200px)] animate-fade-in gap-8">
      {/* Sidebar: Blueprint List */}
      <div className="w-80 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-soft transition-colors">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800">
           <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mb-4">Flow Blueprints</h3>
           <button 
            onClick={createNewBlueprint}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 active:scale-95"
           >
             Create New Flow
           </button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-2">
           {workflows.map(wf => (
             <button 
              key={wf.id} 
              onClick={() => setActiveWorkflowId(wf.id)}
              className={`w-full p-6 rounded-[1.5rem] text-left transition-all border flex items-center justify-between group ${activeWorkflowId === wf.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-100 dark:border-slate-800 hover:border-blue-600/30'}`}
             >
               <div className="min-w-0">
                 <p className="text-sm font-black uppercase tracking-tight brand-font truncate">{wf.name}</p>
                 <p className={`text-[9px] font-bold uppercase mt-1 ${wf.isActive ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {wf.isActive ? 'Active & Live' : 'Idle Draft'}
                 </p>
               </div>
               <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${wf.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
             </button>
           ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-grow bg-[#FAFBFF] dark:bg-black/20 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative transition-colors">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        {!activeWorkflow ? (
          <div className="m-auto text-center space-y-6 opacity-30 relative z-10">
            <div className="w-20 h-20 border-4 border-slate-300 dark:border-slate-700 rounded-full mx-auto flex items-center justify-center">
               <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <p className="text-[12px] font-black uppercase tracking-[0.5em]">Select a Blueprint to Engineer</p>
          </div>
        ) : (
          <>
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex justify-between items-center relative z-20">
               <input 
                value={activeWorkflow.name}
                onChange={(e) => onSave({ ...activeWorkflow, name: e.target.value })}
                className="bg-transparent border-none text-2xl font-black text-slate-900 dark:text-white uppercase brand-font tracking-tight outline-none w-1/2 focus:text-blue-600 transition-colors"
               />
               <div className="flex gap-4">
                  <button 
                    onClick={() => onSave({ ...activeWorkflow, isActive: !activeWorkflow.isActive })}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${activeWorkflow.isActive ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                  >
                    {activeWorkflow.isActive ? 'Live' : 'Go Live'}
                  </button>
                  <button onClick={() => { onDelete(activeWorkflow.id); setActiveWorkflowId(null); }} className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
               </div>
            </div>

            <div className="flex-grow p-12 overflow-y-auto flex flex-col items-center gap-12 custom-scrollbar relative z-10">
               {activeWorkflow.steps.map((step, idx) => (
                 <React.Fragment key={step.id}>
                    <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-8 shadow-xl relative group hover:border-blue-500/30 transition-all">
                       <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-[11px] font-black shadow-md z-20 group-hover:bg-blue-600 group-hover:text-white transition-colors">{idx + 1}</div>
                       
                       <div className="flex justify-between items-start mb-6">
                          <div>
                             <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-md ${
                               step.type === 'TRIGGER' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' : 
                               step.type === 'AGENT' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                             }`}>
                               {step.type} NODE
                             </span>
                             <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase brand-font tracking-tight mt-2">{step.label}</h4>
                          </div>
                          {idx !== 0 && (
                            <button onClick={() => removeStep(step.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-1">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                          )}
                       </div>

                       <div className="space-y-4">
                          {step.type === 'TRIGGER' && (
                            <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none transition-colors focus:border-blue-600">
                               <option>Manual Event Trigger</option>
                               <option>Pipeline Stage: Discovery</option>
                               <option>Scheduled: Daily Scan</option>
                            </select>
                          )}
                          {step.type === 'AGENT' && (
                            <div className="space-y-4">
                               <div className="grid grid-cols-2 gap-2">
                                  <button className="py-2.5 rounded-xl border border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-black uppercase tracking-widest">Intelligence</button>
                                  <button className="py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">Writer</button>
                               </div>
                               <textarea 
                                placeholder="Custom Instructions for Gemini..."
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-[11px] font-medium italic text-slate-600 dark:text-slate-400 outline-none h-24 resize-none focus:border-blue-600 transition-colors"
                               ></textarea>
                            </div>
                          )}
                          {step.type === 'ACTION' && (
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                               <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                 n8n Payload Integration
                               </p>
                               <p className="text-[9px] font-medium text-emerald-700/60 leading-relaxed uppercase">Data will be pushed to the Production Gateway configured in Analytics.</p>
                            </div>
                          )}
                       </div>
                    </div>

                    {idx < activeWorkflow.steps.length - 1 && (
                      <div className="w-0.5 h-12 bg-slate-200 dark:bg-slate-800 relative z-0">
                         <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-2">
                            <svg className="w-4 h-4 text-slate-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                         </div>
                      </div>
                    )}
                 </React.Fragment>
               ))}

               {/* Add Menu */}
               <div className="flex flex-col items-center gap-4 mt-8 pb-10">
                  <div className="flex gap-3">
                     <button onClick={() => addStep('AGENT')} className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-blue-600 hover:shadow-xl transition-all shadow-sm active:scale-95">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                        </div>
                        Add Intelligence Agent
                     </button>
                     <button onClick={() => addStep('ACTION')} className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-purple-600 hover:shadow-xl transition-all shadow-sm active:scale-95">
                        <div className="w-6 h-6 bg-purple-600 text-white rounded-lg flex items-center justify-center">
                           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                        </div>
                        Add Deployment Action
                     </button>
                  </div>
               </div>
            </div>

            {/* Canvas Footer */}
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex justify-between items-center relative z-20">
               <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Health:</span>
                  <div className="flex gap-1">
                     {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-4 bg-emerald-500/30 rounded-full animate-shimmer"></div>)}
                  </div>
               </div>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Autonomous Engine Ready</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilder;