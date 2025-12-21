
import { PipelineStage } from './types';

export const STAGE_LABELS: Record<PipelineStage, string> = {
  [PipelineStage.DISCOVERY]: 'Discovery',
  [PipelineStage.OUTREACH_STARTED]: 'Outreach',
  [PipelineStage.NEGOTIATION]: 'Negotiation',
  [PipelineStage.CONTRACT_SENT]: 'Contracting',
  [PipelineStage.SIGNED]: 'Closed Won',
  [PipelineStage.ACTIVE]: 'Active Partner'
};

export const STAGE_COLORS: Record<PipelineStage, string> = {
  [PipelineStage.DISCOVERY]: 'bg-slate-100 text-slate-600',
  [PipelineStage.OUTREACH_STARTED]: 'bg-blue-100 text-blue-700',
  [PipelineStage.NEGOTIATION]: 'bg-purple-100 text-purple-700',
  [PipelineStage.CONTRACT_SENT]: 'bg-indigo-100 text-indigo-700',
  [PipelineStage.SIGNED]: 'bg-green-100 text-green-700',
  [PipelineStage.ACTIVE]: 'bg-emerald-100 text-emerald-700'
};

export const SPONSOR_TIERS = [
  'Community Partner',
  'Silver Sponsor',
  'Gold Sponsor',
  'Title Sponsor',
  'Jersey Sponsor'
];
