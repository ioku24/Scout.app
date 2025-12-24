import { GoogleGenAI, Type } from "@google/genai";
import { 
  SenderProfile, 
  DataSource, 
  ContactField, 
  FieldEvidence, 
  DiscoveredLead, 
  GroundingLink,
  ContactIntelligence,
  ContactMethodType,
  Deal,
  Sponsor
} from "../types.ts";

/**
 * Internal type representing the high-fidelity raw JSON structure from the model.
 */
type RawDiscoveredLead = {
  companyName: string;
  description: string;
  dnaScore: number;
  matchReasoning: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  contactName?: string;
  socialLinks?: {
    instagram?: string;
    linkedIn?: string;
    twitter?: string;
    facebook?: string;
    youtube?: string;
  };
  latestSignal?: string;
  sources?: string[]; 
  contactEvidence?: {
    website?: FieldEvidence;
    email?: FieldEvidence;
    phone?: FieldEvidence;
    address?: FieldEvidence;
    instagram?: FieldEvidence;
    linkedIn?: FieldEvidence;
    twitter?: FieldEvidence;
    facebook?: FieldEvidence;
    latestSignal?: FieldEvidence;
    contactName?: FieldEvidence;
  };
};

/**
 * Sanitization Helpers
 */
function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let clean = url.trim();
  if (!clean) return undefined;
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }
  try {
    const u = new URL(clean);
    const paramsToStrip = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    paramsToStrip.forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch (e) {
    return clean;
  }
}

function normalizeHandle(handle?: string): string | undefined {
  if (!handle) return undefined;
  let clean = handle.trim();
  if (!clean) return undefined;
  clean = clean.replace(/^@/, '');
  clean = clean.replace(/\/+$/, '');
  return clean;
}

export const normalizeDomain = (url?: string) => {
  if (!url || typeof url !== 'string') return null;
  let domain = url.toLowerCase().trim();
  if (!domain) return null;
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  domain = domain.split(/[/?#]/)[0];
  return domain || null;
};

export const normalizeSocial = (val?: string) => {
  if (!val || typeof val !== 'string') return null;
  const handle = normalizeHandle(val);
  return handle?.toLowerCase() || null;
};

export const getIdentityKeys = (item: { 
  companyName: string; 
  website?: string; 
  address?: string;
  socialLinks?: { instagram?: string; linkedIn?: string; } 
}) => {
  const keys: string[] = [];
  const domain = normalizeDomain(item.website);
  if (domain) keys.push(`dom:${domain}`);
  const ig = normalizeSocial(item.socialLinks?.instagram);
  if (ig) keys.push(`ig:${ig}`);
  if (keys.length === 0) {
    const name = item.companyName.toLowerCase().trim();
    const loc = item.address?.toLowerCase().trim() || '';
    keys.push(`name:${name}|${loc}`);
  }
  return keys;
};

const extractJson = (text: string) => {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    // Attempt standard parse
    return JSON.parse(trimmed);
  } catch (e) {
    // Fallback: look for markdown block
    const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (blockMatch && blockMatch[1]) {
      try {
        return JSON.parse(blockMatch[1].trim());
      } catch (e2) {}
    }
    // Deep fallback: just try to find the first { and last }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    const startArr = trimmed.indexOf('[');
    const endArr = trimmed.lastIndexOf(']');
    
    // Check if it's an array or object
    if (startArr !== -1 && (start === -1 || startArr < start)) {
       try {
         return JSON.parse(trimmed.slice(startArr, endArr + 1));
       } catch (e3) {}
    }
    if (start !== -1) {
       try {
         return JSON.parse(trimmed.slice(start, end + 1));
       } catch (e4) {}
    }
    return null;
  }
};

function mapForensicField(val: string | undefined, evidence?: any): ContactField | undefined {
  const finalValue = val?.trim();
  if (!finalValue) return undefined;
  const rawSource = evidence?.source;
  const source: DataSource = 
    ['official_website', 'google_business', 'directory', 'social', 'manual'].includes(rawSource) 
      ? rawSource as DataSource 
      : 'unknown';
  let confidence = typeof evidence?.confidence === 'number' ? evidence.confidence : 0.5;
  if (typeof evidence?.confidence !== 'number' && source !== 'unknown') {
    confidence = (source === 'official_website' || source === 'google_business') ? 0.9 : 0.7;
  }
  return {
    value: finalValue,
    evidence: {
      source,
      confidence: Math.min(1, Math.max(0, confidence)),
      sourceUrl: normalizeUrl(evidence?.sourceUrl)
    }
  };
}

function mapRawLeadToDiscovered(raw: RawDiscoveredLead, groundingLinks: GroundingLink[]): DiscoveredLead {
  const ce = raw.contactEvidence || {};
  const lead: DiscoveredLead = {
    id: `prospect_${crypto.randomUUID()}`,
    companyName: raw.companyName,
    description: raw.description || raw.matchReasoning,
    website: normalizeUrl(raw.website) || '',
    email: raw.email?.trim(),
    phone: raw.phone?.trim(),
    address: raw.address?.trim(),
    socialLinks: {
      instagram: normalizeHandle(raw.socialLinks?.instagram),
      linkedIn: normalizeUrl(raw.socialLinks?.linkedIn),
      facebook: normalizeUrl(raw.socialLinks?.facebook),
      twitter: normalizeHandle(raw.socialLinks?.twitter),
    },
    dnaScore: raw.dnaScore || 0,
    matchReasoning: raw.matchReasoning || raw.description || '',
    latestSignal: raw.latestSignal,
    groundingSources: groundingLinks,
    sources: raw.sources || [],
    emailField: mapForensicField(raw.email, ce.email),
    phoneField: mapForensicField(raw.phone, ce.phone),
    addressField: mapForensicField(raw.address, ce.address),
    contactNameField: mapForensicField(raw.contactName, ce.contactName),
    websiteField: mapForensicField(raw.website, ce.website),
    instagramField: mapForensicField(raw.socialLinks?.instagram, ce.instagram),
    linkedInField: mapForensicField(raw.socialLinks?.linkedIn, ce.linkedIn),
    twitterField: mapForensicField(raw.socialLinks?.twitter, ce.twitter),
  };
  const enriched: ContactIntelligence[] = [];
  const addIntel = (type: ContactMethodType, value: string | undefined, evKey: string) => {
    if (!value) return;
    enriched.push({
      id: `intel_${crypto.randomUUID()}`,
      type,
      value,
      confidence: 0.8,
      source: "Forensic Discovery",
      lastVerified: new Date().toISOString()
    });
  };
  addIntel('EMAIL', lead.email, 'email');
  addIntel('PHONE', lead.phone, 'phone');
  lead.enrichedContacts = enriched;
  lead.verificationStatus = 'PENDING';
  return lead;
}

/**
 * Discover prospects using Gemini and Google Maps.
 * Note: Uses Gemini 2.5 series as required for Maps grounding.
 */
export const discoverProspects = async (
  description: string,
  location: string,
  context: { whoWeAre: string, role: string, targetGoal: string },
  radius: string = '25',
  depth: 'STANDARD' | 'DEEP' = 'STANDARD',
  userCoords?: { latitude: number; longitude: number }
) => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  // Rule: Maps grounding is only supported in Gemini 2.5 series models.
  const model = 'gemini-2.5-flash-preview';
  const leadLimit = depth === 'DEEP' ? 10 : 5;
  
  const prompt = `Find up to ${leadLimit} business prospects in ${location} within ${radius} miles with high SPONSORSHIP potential.
  DNA: "${description}"
  CONTEXT: ${context.whoWeAre} (${context.role}) seeking partners for: ${context.targetGoal}.
  EXTRACT: Website URL, verified Email, Phone, and social handles (IG, LinkedIn, Twitter, FB).
  Verify the physical location is within range. 
  RETURN THE RESULTS AS A JSON ARRAY OF OBJECTS with fields: companyName, description, dnaScore, matchReasoning, website, email, phone, address, socialLinks {instagram, linkedIn, twitter, facebook}.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: userCoords ? {
          retrievalConfig: { latLng: { latitude: userCoords.latitude, longitude: userCoords.longitude } }
        } : undefined,
      }
    });
    
    const results = extractJson(response.text || '[]') || [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingLinks: GroundingLink[] = groundingChunks.map((chunk: any) => ({
      uri: chunk.maps?.uri || chunk.web?.uri || '',
      title: chunk.maps?.title || chunk.web?.title || 'Verified Grounding'
    })).filter((l: GroundingLink) => l.uri !== '');

    return results.map((raw: any) => mapRawLeadToDiscovered(raw as RawDiscoveredLead, groundingLinks));
  } catch (error) {
    console.error("Prospect Discovery Error:", error);
    return [];
  }
};

/**
 * Search for recent business signals or news using Google Search grounding.
 */
export const performDeepSignalSearch = async (companyName: string, website: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Find the most recent and relevant business "signal" for ${companyName} (${website}). A signal could be a recent award, new product launch, expansion, or partnership. Provide a concise one-sentence summary that would be a great "hook" for outreach.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || "No recent public signals identified.";
  } catch (error) {
    console.error("Deep Signal Search Error:", error);
    return "Signal search unavailable.";
  }
};

/**
 * Generate structured outreach drafts (Email and DM) using Gemini 3 Pro.
 */
export const generateOutreachDrafts = async (deal: Deal, sponsor: Sponsor, persona: { teamName: string, role: string, summary: string }) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Draft high-conversion partnership outreach for ${sponsor.companyName}. 
      Our Context: We are ${persona.teamName}. ${persona.summary}. 
      Deal Tier: ${deal.tier}.
      Target Contact: ${sponsor.contactName || 'Valued Partner'}.
      Recent Signal Found: ${sponsor.latestSignal || 'General industry alignment'}.
      Required Output: One high-impact Email and one short Social DM (IG/LI style).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emailDraft: { type: Type.STRING, description: "Professional but catchy email draft." },
            dmDraft: { type: Type.STRING, description: "Short, snappy social DM draft." }
          },
          required: ["emailDraft", "dmDraft"]
        }
      }
    });
    return extractJson(response.text || '') || { emailDraft: "", dmDraft: "" };
  } catch (error) {
    console.error("Draft Generation Error:", error);
    return { emailDraft: "Drafting failed. Please try manual creation.", dmDraft: "Drafting failed." };
  }
};

/**
 * Generate a single outreach draft for a specific platform.
 */
export const generateOutreachDraft = async (
  platform: 'EMAIL' | 'IG' | 'LI' | 'X',
  companyName: string,
  contactName: string,
  tier: string,
  senderProfile: SenderProfile,
  latestSignal?: string
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a ${platform} outreach message to ${contactName} at ${companyName} for a ${tier} partnership. 
      Our organization: ${senderProfile.orgName}. 
      Our Goal: ${senderProfile.goal}. 
      Recent Signal: ${latestSignal || 'General alignment'}.
      Style: Modern, professional, and outcome-focused.`,
    });
    return response.text || "Failed to generate draft.";
  } catch (error) {
    console.error("Single Draft Error:", error);
    return "Drafting offline.";
  }
};

/**
 * Verify lead information and find missing data points forensically.
 */
export const verifyLeadForensically = async (lead: DiscoveredLead) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform a forensic audit on this business prospect: ${lead.companyName} (${lead.website}). 
      1. Confirm physical existence and location.
      2. Find missing official emails or specific contact people.
      3. Validate social handles (IG, LinkedIn).
      4. Assess "Partnership DNA": Is this company actively sponsoring or growing?`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['VERIFIED', 'COLLISION_DETECTED', 'FAILED'] },
            reasoning: { type: Type.STRING, description: "A summary of the audit findings." },
            auditTrail: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Steps taken to verify." },
            correctedData: {
              type: Type.OBJECT,
              properties: {
                website: { type: Type.STRING },
                email: { type: Type.STRING },
                socialLinks: {
                  type: Type.OBJECT,
                  properties: {
                    instagram: { type: Type.STRING },
                    linkedIn: { type: Type.STRING }
                  }
                }
              }
            }
          },
          required: ["status", "reasoning", "auditTrail"]
        }
      }
    });
    return extractJson(response.text || '');
  } catch (error) {
    console.error("Forensic Verification Error:", error);
    return null;
  }
};

/**
 * Analyze brand voice and social themes to find a specific "hook".
 */
export const getSocialAngle = async (companyName: string, socialUrl: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the brand voice and recent social media presence for ${companyName} (${socialUrl}). 
      Identify content themes, communication style, and a specific "hook" for outreach based on their recent posts.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contentThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
            recentCampaigns: { type: Type.ARRAY, items: { type: Type.STRING } },
            brandVoice: { type: Type.STRING },
            outreachHook: { type: Type.STRING }
          },
          required: ["contentThemes", "recentCampaigns", "brandVoice", "outreachHook"]
        }
      }
    });
    return extractJson(response.text || '');
  } catch (error) {
    console.error("Social Angle Error:", error);
    return null;
  }
};

/**
 * Analyze a public signal (handle or business mention) for potential leads.
 */
export const interceptPublicSignal = async (input: string, platform: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Intercept and analyze a business "signal" from the following ${platform} source: "${input}". 
      Extract the business name, their handle, and a summary of what's happening (the signal). 
      Estimate how well this business might match a partnership opportunity (0-100).`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            senderName: { type: Type.STRING },
            senderHandle: { type: Type.STRING },
            content: { type: Type.STRING },
            identityMatch: { type: Type.NUMBER, description: "Match score 0 to 100." },
            suggestedAction: { type: Type.STRING }
          },
          required: ["senderName", "senderHandle", "content", "identityMatch", "suggestedAction"]
        }
      }
    });
    return extractJson(response.text || '');
  } catch (error) {
    console.error("Signal Intercept Error:", error);
    return null;
  }
};
