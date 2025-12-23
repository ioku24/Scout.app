
import React, { useState, useEffect } from 'react';
import { DiscoveredLead, DiscoverySession, AgentTask, SenderProfile } from '../types';
import { getIdentityKeys, verifyLeadForensically } from '../lib/gemini';

interface DiscoveryTabProps {
  currentLeads: DiscoveredLead[];
  onUpdateLeads: (leads: DiscoveredLead[]) => void;
  onAddAsLead: (lead: DiscoveredLead) => void;
  onSaveToVault: (lead: DiscoveredLead) => void;
  onStartSearch: (description: string, location: string, radius: string, depth: 'STANDARD' | 'DEEP', coords?: {latitude: number, longitude: number}) => void;
  activeTask: AgentTask;
  history: DiscoverySession[];
  onClearSession: () => void;
  processedIds: string[];
  onLeadVerified?: (lead: DiscoveredLead) => void;
  senderProfile: SenderProfile;
  onUpdateSenderProfile: (updates: Partial<SenderProfile>) => void;
}

const DiscoveryTab: React.FC<DiscoveryTabProps> = ({
  currentLeads,
  onUpdateLeads,
  onAddAsLead,
  onSaveToVault,
  onStartSearch,
  activeTask,
  history,
  onClearSession,
  processedIds,
  onLeadVerified,
  senderProfile,
  onUpdateSenderProfile
}) => {
  const [description, setDescription] = useState(activeTask.query || '');
  const [location, setLocation] = useState(activeTask.location || '');
  const [radius, setRadius] = useState('25');
  const [depth, setDepth] = useState<'STANDARD' | 'DEEP'>('STANDARD');
  const [showHistory, setShowHistory] = useState(false);
  const [searchLogs, setSearchLogs] = useState<string[]>([]);
  const [dnaPreview, setDnaPreview] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<DiscoveredLead | null>(null);

  // Guided Builder State
  const [builder, setBuilder] = useState({
    industry: 'Sporting goods brands',
    size: '11-50',
    intent: 'Seeking sponsorships',
    channels: {
      instagram: false,
      linkedIn: false,
      website: false,
      facebook: false,
      twitter: false
    }
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn("Location access denied. Falling back to text-based location.")
      );
    }
  }, []);

  useEffect(() => {
    if (activeTask.query && !description) setDescription(activeTask.query);
    if (activeTask.location && !location) setLocation(activeTask.location);
    
    if (activeTask.status === 'SEARCHING') {
      const sources = ['LinkedIn', 'Google Maps', 'Yelp', 'Instagram', 'Facebook', 'Twitter'];
      setSearchLogs([`[SIGNAL] Initiating forensic scan on ${location}...`]);
      const interval = setInterval(() => {
        const source = sources[Math.floor(Math.random() * sources.length)];
        const action = ['Intercepting', 'Grounding', 'Validating', 'Mapping', 'Scraping'][Math.floor(Math.random() * 5)];
        setSearchLogs(prev => [...prev, `[${action.toUpperCase()}] ${source} data node...`].slice(-6));
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [activeTask.status, location]);

  const handleBuildDNA = () => {
    const selectedChannels = Object.entries(builder.channels)
      .filter(([_, checked]) => checked)
      .map(([name]) => {
        if (name === 'linkedIn') return 'LinkedIn';
        if (name === 'facebook') return 'Facebook';
        if (name === 'twitter') return 'Twitter/X';
        return name.charAt(0).toUpperCase() + name.slice(1);
      });
    
    const channelsCsvOrAny = selectedChannels.length > 0 ? selectedChannels.join(', ') : 'Any available';
    const loc = location || 'your target city';
    const rad = radius || '25';
    const sizeDescriptor = builder.size === 'Any Size' ? 'of any company size' : `businesses with ${builder.size} employees`;

    const dnaString = `Find ${builder.industry} that are ${sizeDescriptor} within ${rad} miles of ${loc}. Prioritize prospects showing: ${builder.intent}. Required Data: Website, Email, Phone Number, and Social Media handles (${channelsCsvOrAny}). Optimize for partnership fit and responsiveness. Return only public, verified, and forensic information extracted from official sources.`;

    setDnaPreview(dnaString);
  };

  const handleUseProfile = () => {
    if (dnaPreview) {
      setDescription(dnaPreview);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartSearch(description, location, radius, depth, userCoords || undefined);
  };

  const isProcessed = (lead: DiscoveredLead) => {
    const leadKeys = getIdentityKeys(lead);
    return leadKeys.some(key => processedIds.includes(key));
  };

  const handleChannelChange = (channel: keyof typeof builder.channels) => {
    setBuilder(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: !prev.channels[channel]
      }
    }));
  };

  const handleVerifyLead = async (leadId: string) => {
    const lead = currentLeads.find(l => l.id === leadId);
    if (!lead) return;

    onUpdateLeads(currentLeads.map(l => l.id === leadId ? { ...l, verificationStatus: 'VERIFYING' } : l));

    const result = await verifyLeadForensically(lead);
    
    if (result) {
      const updatedLead: DiscoveredLead = { 
        ...lead, 
        verificationStatus: result.status, 
        verificationReasoning: result.reasoning,
        forensicAuditTrail: result.auditTrail,
        website: result.correctedData?.website || lead.website,
        email: result.correctedData?.email || lead.email,
        socialLinks: {
          ...lead.socialLinks,
          ...result.correctedData?.socialLinks
        }
      };
      
      onUpdateLeads(currentLeads.map(l => l.id === leadId ? updatedLead : l));
      
      // Notify App to sync any existing deals created from this lead
      if (onLeadVerified) {
        onLeadVerified(updatedLead);
      }
    } else {
      onUpdateLeads(currentLeads.map(l => l.id === leadId ? { ...l, verificationStatus: 'FAILED' } : l));
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'VERIFIED': return <div className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">Verified</div>;
      case 'VERIFYING': return <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 text-[8px] font-black rounded uppercase tracking-widest border border-blue-100 dark:border-blue-800 animate-pulse">Auditing...</div>;
      case 'COLLISION_DETECTED': return <div className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[8px] font-black rounded uppercase tracking-widest border border-orange-200 dark:border-orange-800">Collision</div>;
      case 'FAILED': return <div className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[8px] font-black rounded uppercase tracking-widest border border-red-200 dark:border-red-800">Rejected</div>;
      default: return <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[8px] font-black rounded uppercase tracking-widest border border-slate-200 dark:border-slate-700">Pending</div>;
    }
  };

  return (
    <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto pb-40">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-10 shadow-soft relative overflow-hidden transition-all">
        <div className="flex items-center justify-between mb-10 pb-8 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white brand-font tracking-tight uppercase leading-none">Discovery Hub</h2>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mt-3">Intelligent Prospect Search</p>
          </div>
          <div className="flex gap-4">
            {userCoords && (
               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Spatial Lock: ON</span>
               </div>
            )}
            <button onClick={() => setShowHistory(!showHistory)} className="px-7 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all flex items-center gap-3">
              Logs
            </button>
            {(currentLeads.length > 0 || activeTask.status === 'SEARCHING') && (
              <button onClick={onClearSession} className="px-7 py-3 rounded-xl border border-red-200 dark:border-red-900/30 text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 transition-all">
                Clear Workspace
              </button>
            )}
          </div>
        </div>

        {/* Guided DNA Builder */}
        <div className="mb-12 p-8 bg-blue-50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100 dark:border-blue-800/50 space-y-8 transition-all">
           <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em]">Guided DNA Builder</h3>
              <p className="text-[9px] font-bold text-blue-400 uppercase">Construct forensic profile</p>
           </div>

           {/* Sender Profile Section */}
           <div className="p-6 bg-white/60 dark:bg-slate-800/40 rounded-2xl border border-blue-200/50 dark:border-blue-700/30 space-y-5">
              <h4 className="text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-[0.25em]">Your Organization Context</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Who We Are</label>
                  <input
                    type="text"
                    value={senderProfile.orgName}
                    onChange={e => onUpdateSenderProfile({ orgName: e.target.value })}
                    placeholder="e.g., Detroit Youth Basketball League"
                    className="w-full h-11 bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 rounded-xl px-4 text-xs font-medium outline-none shadow-sm transition-colors focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Your Role</label>
                  <input
                    type="text"
                    value={senderProfile.role || ''}
                    onChange={e => onUpdateSenderProfile({ role: e.target.value })}
                    placeholder="e.g., Program Director"
                    className="w-full h-11 bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 rounded-xl px-4 text-xs font-medium outline-none shadow-sm transition-colors focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Target Goal</label>
                  <input
                    type="text"
                    value={senderProfile.goal}
                    onChange={e => onUpdateSenderProfile({ goal: e.target.value })}
                    placeholder="e.g., Secure sponsorships for youth programs"
                    className="w-full h-11 bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 rounded-xl px-4 text-xs font-medium outline-none shadow-sm transition-colors focus:border-blue-600"
                  />
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Industry</label>
                <select 
                  value={builder.industry}
                  onChange={e => setBuilder({...builder, industry: e.target.value})}
                  className="w-full h-11 bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 rounded-xl px-4 text-xs font-bold outline-none shadow-sm transition-colors"
                >
                  <option>Sporting goods brands</option>
                  <option>Health & wellness</option>
                  <option>Local businesses</option>
                  <option>Media companies</option>
                  <option>Fitness tech</option>
                  <option>Trades & contractors</option>
                  <option>Nutrition brands</option>
                  <option>Fitness equipment suppliers</option>
                  <option>Travel & hospitality</option>
                  <option>Digital marketing agencies</option>
                  <option>Financial services</option>
                  <option>Automotive</option>
                  <option>Real estate</option>
                  <option>Technology companies</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Company Size</label>
                <select
                  value={builder.size}
                  onChange={e => setBuilder({...builder, size: e.target.value})}
                  className="w-full h-11 bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 rounded-xl px-4 text-xs font-bold outline-none shadow-sm transition-colors"
                >
                  <option>Any Size</option>
                  <option>1-10</option>
                  <option>11-50</option>
                  <option>51-200</option>
                  <option>201-500</option>
                  <option>500+</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Intent Signal</label>
                <select 
                  value={builder.intent}
                  onChange={e => setBuilder({...builder, intent: e.target.value})}
                  className="w-full h-11 bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 rounded-xl px-4 text-xs font-bold outline-none shadow-sm transition-colors"
                >
                  <option>Seeking sponsorships</option>
                  <option>Expanding brand presence</option>
                  <option>Launching community initiatives</option>
                  <option>Promoting events</option>
                  <option>New product launches</option>
                  <option>Opening new locations</option>
                  <option>Recently funded</option>
                  <option>Other</option>
                </select>
              </div>
           </div>

           <div className="space-y-3">
             <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Required Channels & Contact Data</label>
             <div className="flex flex-wrap gap-3">
               {(['instagram', 'linkedIn', 'facebook', 'twitter', 'website'] as const).map((channel) => (
                 <button
                   key={channel}
                   type="button"
                   onClick={() => handleChannelChange(channel)}
                   className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                     builder.channels[channel as keyof typeof builder.channels]
                       ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md'
                       : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:border-blue-600/30'
                   }`}
                 >
                   <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
                     builder.channels[channel as keyof typeof builder.channels] ? 'bg-blue-400' : 'bg-slate-300 dark:bg-slate-700'
                   }`}></div>
                   {channel === 'linkedIn' ? 'LinkedIn' : channel === 'twitter' ? 'Twitter/X' : channel.charAt(0).toUpperCase() + channel.slice(1)}
                 </button>
               ))}
             </div>
           </div>

           <button 
            type="button"
            onClick={handleBuildDNA}
            className="w-full py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 active:scale-[0.98]"
           >
             Generate Profile Preview
           </button>

           {dnaPreview && (
             <div className="mt-6 space-y-4 animate-fade-in">
                <div className="space-y-2">
                   <p className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-widest pl-1">Preview</p>
                   <div className="p-5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/50 rounded-2xl text-[11px] font-medium leading-relaxed text-slate-700 dark:text-slate-300 italic">
                      "{dnaPreview}"
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                    onClick={handleUseProfile}
                    className="flex-grow py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md active:scale-95"
                   >
                     Use this profile
                   </button>
                   <button 
                    onClick={() => setDnaPreview(null)}
                    className="px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-all"
                   >
                     Clear
                   </button>
                </div>
             </div>
           )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest pl-1">Target Location</label>
              <input required disabled={activeTask.status === 'SEARCHING'} value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State" className="w-full h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 text-sm font-bold outline-none focus:border-blue-600 transition-all shadow-inner" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest pl-1">Radius (Miles)</label>
              <select disabled={activeTask.status === 'SEARCHING'} value={radius} onChange={e => setRadius(e.target.value)} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 text-sm font-bold outline-none cursor-pointer shadow-inner">
                {['10', '25', '50', '100'].map(r => <option key={r} value={r}>{r} Miles</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest pl-1">Search Depth</label>
              <div className="grid grid-cols-2 gap-2 h-14 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                 <button type="button" onClick={() => setDepth('STANDARD')} className={`rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${depth === 'STANDARD' ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500'}`}>Standard</button>
                 <button type="button" onClick={() => setDepth('DEEP')} className={`rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${depth === 'DEEP' ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900' : 'text-slate-500'}`}>Deep Scan</button>
              </div>
            </div>
          </div>

          <div className="space-y-2 relative">
            <div className="flex flex-col mb-1">
              <label className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest pl-1">Who do you want Scout to find?</label>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight pl-1">Use the builder above or write it in your own words.</p>
            </div>
            <textarea required disabled={activeTask.status === 'SEARCHING'} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your ideal partner..." className="w-full h-40 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] p-8 text-lg font-medium outline-none focus:border-blue-600 transition-all resize-none shadow-inner" />
          </div>

          {activeTask.status === 'SEARCHING' && (
            <div className="bg-[#0B1222] rounded-3xl p-6 font-mono text-[10px] text-emerald-500/80 border border-white/5 shadow-2xl space-y-1.5 transition-colors">
              {searchLogs.map((log, idx) => <p key={idx}><span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span> {log}</p>)}
            </div>
          )}

          <button type="submit" disabled={activeTask.status === 'SEARCHING'} className="w-full h-14 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] shadow-lg hover:shadow-blue-600/30 transition-all flex items-center justify-center gap-4 active:scale-95">
            {activeTask.status === 'SEARCHING' ? 'Forensic Scan in Progress...' : 'Start Discovery Agent'}
          </button>
        </form>
      </div>

      {/* Leads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentLeads.map(lead => {
          const processed = isProcessed(lead);
          const isVerifying = lead.verificationStatus === 'VERIFYING';

          return (
            <div 
              key={lead.id} 
              onClick={() => setSelectedProspect(lead)}
              className={`bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 flex flex-col shadow-soft hover:border-blue-400 transition-all group overflow-hidden relative cursor-pointer ${processed ? 'opacity-60 grayscale-[0.5]' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(lead.verificationStatus)}
                    {lead.verificationStatus !== 'VERIFIED' && lead.verificationStatus !== 'COLLISION_DETECTED' && !processed && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleVerifyLead(lead.id); }}
                        disabled={isVerifying}
                        className="text-[8px] font-black uppercase text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                      >
                        {isVerifying ? 'Running Pro...' : 'Verify'}
                      </button>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white brand-font uppercase truncate">{lead.companyName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate mt-0.5">{lead.website}</p>
                </div>
                <div className="bg-slate-900 dark:bg-blue-600 px-3 py-1 rounded-lg text-white text-[10px] font-black brand-font ml-3">{lead.dnaScore}%</div>
              </div>
              
              <div className="flex-grow space-y-4">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Match DNA</p>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-snug line-clamp-3 italic">"{lead.matchReasoning}"</p>
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                  {lead.email && <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400" title={lead.email}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z"/></svg></div>}
                  {lead.phone && <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400" title={lead.phone}><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 00-1.02.24l-2.2 2.2a15.05 15.05 0 01-6.59-6.59l2.2-2.2a1.02 1.02 0 00.24-1.02A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/></svg></div>}
                  {lead.socialLinks?.instagram && <div className="p-2 rounded-lg bg-pink-50 dark:bg-pink-900/10 text-pink-600 dark:text-pink-400"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.058-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></div>}
                  {lead.socialLinks?.linkedIn && <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                <button 
                  disabled={processed || isVerifying} 
                  onClick={(e) => { e.stopPropagation(); onAddAsLead(lead); }} 
                  className="py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {processed ? 'In System' : lead.verificationStatus === 'VERIFIED' ? 'Ready to Pro' : 'Incorporate'}
                </button>
                <button 
                  disabled={processed || isVerifying} 
                  onClick={(e) => { e.stopPropagation(); onSaveToVault(lead); }} 
                  className="py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all border border-slate-100 dark:border-slate-700 active:scale-95 disabled:opacity-50"
                >
                  {processed ? 'Archived' : 'To Vault'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enlarged Preview Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in" onClick={() => setSelectedProspect(null)}>
          <div 
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col transition-all" 
            onClick={e => e.stopPropagation()}
          >
            <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedProspect.verificationStatus)}
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white brand-font tracking-tight uppercase leading-none">{selectedProspect.companyName}</h2>
                <a href={selectedProspect.website} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mt-3 block hover:underline">
                  {selectedProspect.website}
                </a>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-slate-900 dark:bg-blue-600 px-5 py-2 rounded-xl text-white text-lg font-black brand-font">{selectedProspect.dnaScore}% Match</div>
                <button onClick={() => setSelectedProspect(null)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white transition-all">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>

            <div className="p-10 space-y-10 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {selectedProspect.verificationReasoning && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em]">Forensic Audit Reasoning (Pro)</h3>
                  <div className="p-8 bg-slate-900 text-white rounded-[2rem] border border-white/5">
                     <p className="text-sm font-bold leading-relaxed">
                       {selectedProspect.verificationReasoning}
                     </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Match Profile (Flash)</h3>
                <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-800/50">
                   <p className="text-base font-medium text-slate-700 dark:text-slate-300 italic leading-relaxed">
                     "{selectedProspect.matchReasoning}"
                   </p>
                </div>
              </div>

              {selectedProspect.forensicAuditTrail && (
                <div className="space-y-4">
                   <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Audit Trail</h3>
                   <div className="space-y-2">
                     {selectedProspect.forensicAuditTrail.map((step, idx) => (
                       <div key={idx} className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                         <span className="text-blue-600">•</span>
                         {step}
                       </div>
                     ))}
                   </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Contact Payload</h3>
                  <div className="space-y-3">
                    {selectedProspect.email && (
                      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z"/></svg></div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{selectedProspect.email}</span>
                      </div>
                    )}
                    {selectedProspect.phone && (
                      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 00-1.02.24l-2.2 2.2a15.05 15.05 0 01-6.59-6.59l2.2-2.2a1.02 1.02 0 00.24-1.02A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/></svg></div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{selectedProspect.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Social Footprint</h3>
                  <div className="flex flex-wrap gap-4">
                    {selectedProspect.socialLinks.instagram && (
                      <a href={`https://instagram.com/${selectedProspect.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-pink-50 dark:bg-pink-900/10 rounded-2xl border border-pink-100 dark:border-pink-800/30 hover:bg-pink-100 transition-all group active:scale-95">
                         <div className="text-pink-600 dark:text-pink-400"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.058-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></div>
                         <span className="text-[10px] font-black uppercase text-pink-600 dark:text-pink-400">Instagram</span>
                      </a>
                    )}
                    {selectedProspect.socialLinks.linkedIn && (
                      <a href={selectedProspect.socialLinks.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 hover:bg-indigo-100 transition-all group active:scale-95">
                         <div className="text-indigo-600 dark:text-indigo-400"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></div>
                         <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">LinkedIn</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {selectedProspect.latestSignal && (
                <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                  <h3 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em]">Intercepted Signal</h3>
                  <div className="p-8 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-800/30">
                     <p className="text-sm font-bold text-emerald-900 dark:text-emerald-400">
                       {selectedProspect.latestSignal}
                     </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-10 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-4 sticky bottom-0 z-10 transition-colors">
               <button 
                disabled={isProcessed(selectedProspect) || selectedProspect.verificationStatus === 'VERIFYING'} 
                onClick={() => { onAddAsLead(selectedProspect!); setSelectedProspect(null); }}
                className="flex-grow py-5 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
               >
                 {isProcessed(selectedProspect) ? 'Already in Pipeline' : 'Incorporate Prospect'}
               </button>
               {selectedProspect.verificationStatus !== 'VERIFIED' && !isProcessed(selectedProspect) && (
                 <button 
                  onClick={() => handleVerifyLead(selectedProspect!.id)}
                  disabled={selectedProspect.verificationStatus === 'VERIFYING'}
                  className="px-10 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
                 >
                   Verify First
                 </button>
               )}
               <button 
                disabled={isProcessed(selectedProspect) || selectedProspect.verificationStatus === 'VERIFYING'} 
                onClick={() => { onSaveToVault(selectedProspect!); setSelectedProspect(null); }}
                className="px-10 py-5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-white transition-all active:scale-95 disabled:opacity-50"
               >
                 Save to Vault
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoveryTab;
