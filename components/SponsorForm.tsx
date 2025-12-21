import React, { useState } from 'react';
import { Sponsor, Deal, PipelineStage } from '../types';
import { SPONSOR_TIERS } from '../constants';

interface SponsorFormProps {
  onSave: (sponsor: Omit<Sponsor, 'id'>, deal: Omit<Deal, 'id' | 'sponsorId'>) => void;
  onClose: () => void;
}

const SponsorForm: React.FC<SponsorFormProps> = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    industry: '',
    tier: 'Community Partner',
    amount: 1000,
    stage: PipelineStage.DISCOVERY,
    nextFollowUp: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      {
        companyName: formData.companyName,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        industry: formData.industry,
      },
      {
        stage: formData.stage,
        amount: formData.amount,
        tier: formData.tier,
        nextFollowUp: formData.nextFollowUp,
        notes: formData.notes,
        currentSequenceStep: 1
      }
    );
    onClose();
  };

  const inputClasses = "w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-600/5 transition-all shadow-inner";
  const labelClasses = "text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 block pl-1";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-[0_30px_70px_-10px_rgba(15,23,42,0.25)] dark:shadow-black/50 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white brand-font tracking-tight uppercase leading-none">New Sponsor Prospect</h2>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-2">Initialize Pipeline Entry</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto">
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest border-b border-blue-50 dark:border-blue-900/30 pb-2">1. Identity DNA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className={labelClasses}>Company Name</label>
                <input required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} type="text" className={inputClasses} placeholder="e.g. Detroit Auto Group" />
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>Industry / Niche</label>
                <input required value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} type="text" className={inputClasses} placeholder="e.g. Automotive" />
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>Contact Person</label>
                <input required value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} type="text" className={inputClasses} placeholder="John Doe" />
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>Email Address</label>
                <input required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} type="email" className={inputClasses} placeholder="john@example.com" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest border-b border-blue-50 dark:border-blue-900/30 pb-2">2. Deal Architecture</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-inner transition-colors">
              <div className="space-y-1">
                <label className={labelClasses}>Tier</label>
                <select value={formData.tier} onChange={e => setFormData({...formData, tier: e.target.value})} className={inputClasses}>
                  {SPONSOR_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>Target ($)</label>
                <input value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} type="number" className={inputClasses} />
              </div>
              <div className="space-y-1">
                <label className={labelClasses}>Phase</label>
                <select value={formData.stage} onChange={e => setFormData({...formData, stage: e.target.value as PipelineStage})} className={inputClasses}>
                  {Object.values(PipelineStage).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className={labelClasses}>Next Intercept Date</label>
              <input value={formData.nextFollowUp} onChange={e => setFormData({...formData, nextFollowUp: e.target.value})} type="date" className={inputClasses} />
            </div>
            <div className="space-y-1">
              <label className={labelClasses}>Dossier Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className={`${inputClasses} h-12 pt-3 resize-none`} placeholder="Log initial intelligence..."></textarea>
            </div>
          </div>

          <div className="flex gap-4 pt-6 sticky bottom-0 bg-white dark:bg-slate-900 transition-colors">
            <button type="submit" className="flex-grow h-14 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all">
              Establish Prospect
            </button>
            <button type="button" onClick={onClose} className="px-10 h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SponsorForm;