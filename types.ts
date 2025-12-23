export enum PipelineStage {
  DISCOVERY = 'DISCOVERY',
  OUTREACH_STARTED = 'OUTREACH_STARTED',
  NEGOTIATION = 'NEGOTIATION',
  CONTRACT_SENT = 'CONTRACT_SENT',
  SIGNED = 'SIGNED',
  ACTIVE = 'ACTIVE'
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type DataSource = 'official_website' | 'google_business' | 'directory' | 'social' | 'manual' | 'unknown';

export interface FieldEvidence {
  source: DataSource;
  confidence: number; // 0..1
  sourceUrl?: string;
}

export interface ContactField {
  value: string;
  evidence: FieldEvidence;
}

export type LegacyOrForensicField = string | ContactField;

export interface SenderProfile {
  orgName: string;
  role?: string;
  goal: string;
  offerOneLiner: string;
  ctaStyle: 'quick_chat' | 'email_reply' | 'book_call';
}

/** 
 * Supported contact methods for enriched lead intelligence 
 */
export type ContactMethodType = 'EMAIL' | 'PHONE' | 'LINKEDIN' | 'INSTAGRAM' | 'TWITTER' | 'OTHER';

/**
 * Metadata for a single contact point, tracking source and confidence
 */
export interface ContactIntelligence {
  id: string;
  type: ContactMethodType;
  value: string;
  confidence: number; // Score from 0.0 to 1.0
  source: string; // The origin of this data (e.g., 'Google Search', 'Public PDF', 'Corporate Header')
  lastVerified?: string;
  isPrimary?: boolean;
}

export interface GroundingLink {
  uri: string;
  title: string;
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
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
  };
  lastIntelligenceRefresh?: string;
  latestSignal?: string;
  primarySignalSource?: string;
  /** Enriched contact metadata with confidence scores and sources */
  enrichedContacts?: ContactIntelligence[];

  // Forensic Shadow Fields
  emailField?: ContactField;
  phoneField?: ContactField;
  addressField?: ContactField;
  contactNameField?: ContactField;
  websiteField?: ContactField;
  instagramField?: ContactField;
  linkedInField?: ContactField;
  linkedinField?: ContactField;
  twitterField?: ContactField;
  youtubeField?: ContactField;
}

export interface ForensicDossier {
  sourceLeadId?: string;    // id from DiscoveredLead
  verificationStatus?: 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'COLLISION_DETECTED';
  verificationReasoning?: string;   // short summary
  forensicAuditTrail?: string[];    // bullet-style reasoning steps
  createdAt?: string;               // ISO timestamp
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
    instagram: string | undefined;
    linkedIn: string | undefined;
    linkedin?: string;
    facebook?: string;
    twitter: string | undefined;
  };
  dnaScore: number;
  matchReasoning: string;
  savedAt?: string;
  latestSignal?: string;
  /** Grounding metadata from Maps or Search */
  groundingSources?: GroundingLink[];
  /** Enriched contact metadata with confidence scores and sources */
  enrichedContacts?: ContactIntelligence[];

  // Forensic Shadow Fields
  emailField?: ContactField;
  phoneField?: ContactField;
  addressField?: ContactField;
  contactNameField?: ContactField;
  websiteField?: ContactField;
  instagramField?: ContactField;
  linkedInField?: ContactField;
  linkedinField?: ContactField;
  twitterField?: ContactField;
  youtubeField?: ContactField;

  sources?: string[];
  latestSignalEvidence?: FieldEvidence;

  // Escalation Metadata
  verificationStatus?: 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'COLLISION_DETECTED';
  verificationReasoning?: string;
  forensicAuditTrail?: string[];
}

export interface DiscoverySession {
  id: string;
  query: string;
  location: string;
  radius: string;
  depth: 'STANDARD' | 'DEEP';
  date: string;
  leads: DiscoveredLead[];
}

export interface Deal {
  id: string;
  sponsorId: string;
  stage: PipelineStage;
  amount: number;
  tier: string;
  nextFollowUp?: string; // ISO date string
  notes: string;
  currentSequenceStep: number;
  contractEndDate?: string;
  forensicDossier?: ForensicDossier;
  followUpNote?: string; // Triage intent note
  emailDraft?: string;   // Generated email copy
  dmDraft?: string;      // Generated social DM copy
}

export interface AgentTask {
  status: 'IDLE' | 'SEARCHING' | 'COMPLETED' | 'ERROR';
  phase: string;
  query?: string;
  location?: string;
}

export interface WorkflowStep {
  id: string;
  type: 'TRIGGER' | 'AGENT' | 'ACTION';
  label: string;
  config: any;
}

export interface Workflow {
  id: string;
  name: string;
  isActive: boolean;
  steps: WorkflowStep[];
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
  workflows: Workflow[];
  socialMessages: SocialMessage[];
  socialAccounts: SocialAccount[];
  senderProfile: SenderProfile;
  theme: 'light' | 'dark';
}

export interface Activity {
  id: string;
  dealId: string;
  type: 'EMAIL' | 'DM' | 'CALL' | 'NOTE';
  content: string;
  date: string;
  isAiGenerated?: boolean;
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
  sourceUrl?: string;
}