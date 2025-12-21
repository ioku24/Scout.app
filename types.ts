
export enum PipelineStage {
  DISCOVERY = 'DISCOVERY',
  OUTREACH_STARTED = 'OUTREACH_STARTED',
  NEGOTIATION = 'NEGOTIATION',
  CONTRACT_SENT = 'CONTRACT_SENT',
  SIGNED = 'SIGNED',
  ACTIVE = 'ACTIVE'
}

export interface Sponsor {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  address?: string;
  industry: string;
  website?: string;
  socialLinks?: {
    instagram?: string;
    linkedIn?: string;
    twitter?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
  };
  lastIntelligenceRefresh?: string;
  latestSignal?: string;
}

export interface DiscoveredLead {
  id: string;
  companyName: string;
  description: string;
  website: string;
  email?: string;
  phone?: string;
  address?: string;
  socialLinks: {
    instagram?: string;
    linkedIn?: string;
    facebook?: string;
    twitter?: string;
  };
  dnaScore: number;
  matchReasoning: string;
  savedAt?: string;
}

export interface DiscoverySession {
  id: string;
  query: string;
  location: string;
  date: string;
  leads: DiscoveredLead[];
}

export interface Deal {
  id: string;
  sponsorId: string;
  stage: PipelineStage;
  amount: number;
  tier: string;
  nextFollowUp?: string;
  notes: string;
  currentSequenceStep: number;
  contractEndDate?: string;
}

export interface AgentTask {
  status: 'IDLE' | 'SEARCHING' | 'COMPLETED' | 'ERROR';
  phase: string;
  query?: string;
  location?: string;
}

export interface AutomationSettings {
  n8nWebhookUrl: string;
  autoSignalRefresh: boolean;
  notifyOnDeploy: boolean;
  agentFrequency: 'HOURLY' | 'DAILY' | 'WEEKLY';
}

export interface AppState {
  sponsors: Sponsor[];
  deals: Deal[];
  activities: Activity[];
  vault: DiscoveredLead[];
  discoveryHistory: DiscoverySession[];
  currentDiscoveryLeads: DiscoveredLead[];
  activeTask: AgentTask;
  automationSettings: AutomationSettings;
  theme: 'light' | 'dark';
}

export interface Activity {
  id: string;
  dealId: string;
  type: 'EMAIL' | 'DM' | 'CALL' | 'NOTE';
  content: string;
  date: string;
}

export interface SocialAccount {
  platform: 'INSTAGRAM' | 'LINKEDIN';
  isConnected: boolean;
  username: string;
}

export interface SocialMessage {
  id: string;
  senderName: string;
  senderHandle: string;
  platform: 'INSTAGRAM' | 'LINKEDIN';
  content: string;
  timestamp: string;
  identityMatch: number;
  isArchived: boolean;
  suggestedAction: string;
}
