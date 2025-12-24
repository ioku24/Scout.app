
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
  Deal
} from "../types.ts";
import { fullEnrichment, isApolloConfigured } from "./apollo";
import { scrapeSocialLinks, mergeSocialLinks } from "./scraper";
import { enrichLeadWithApollo } from "./gemini-helpers";

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

const getAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY environment variable is not defined. Please add it to your .env file.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Sanitization Helpers
 */
function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let clean = url.trim();
  if (!clean) return undefined;
  
  // Ensure protocol
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }
  
  // Strip common tracking params
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
    return JSON.parse(trimmed);
  } catch (e) {
    const match = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {}
    }
    const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (blockMatch && blockMatch[1]) {
      try {
        return JSON.parse(blockMatch[1].trim());
      } catch (e2) {}
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

  if (ce.latestSignal) {
    lead.latestSignalEvidence = {
      source: (ce.latestSignal.source as DataSource) || 'unknown',
      confidence: ce.latestSignal.confidence || 0.7,
      sourceUrl: normalizeUrl(ce.latestSignal.sourceUrl)
    };
  }

  const enriched: ContactIntelligence[] = [];
  const addIntelligence = (type: ContactMethodType, value: string | undefined, evidenceKey: keyof NonNullable<RawDiscoveredLead['contactEvidence']>) => {
    if (!value) return;
    const evidence = ce[evidenceKey];
    const sourceStr = evidence?.source?.replace(/_/g, ' ') || "Public Discovery";
    let confidence = typeof evidence?.confidence === 'number' ? evidence.confidence : 0.5;
    if (typeof evidence?.confidence !== 'number') {
      if (evidenceKey === 'website' || evidenceKey === 'email') confidence = 0.9;
      else if (['instagram', 'linkedin', 'facebook', 'twitter'].some(s => evidenceKey.toLowerCase().includes(s))) confidence = 0.7;
    }

    enriched.push({
      id: `intel_${crypto.randomUUID()}`,
      type,
      value: value,
      confidence: Math.min(1, Math.max(0, confidence)),
      source: sourceStr,
      lastVerified: new Date().toISOString(),
      isPrimary: !enriched.some(e => e.type === type)
    });
  };

  addIntelligence('OTHER', lead.website, 'website');
  addIntelligence('EMAIL', lead.email, 'email');
  addIntelligence('PHONE', lead.phone, 'phone');
  addIntelligence('INSTAGRAM', lead.socialLinks.instagram, 'instagram');
  addIntelligence('LINKEDIN', lead.socialLinks.linkedIn, 'linkedIn');
  addIntelligence('TWITTER', lead.socialLinks.twitter, 'twitter');

  lead.enrichedContacts = enriched;
  lead.verificationStatus = 'PENDING';

  return lead;
}

export const discoverProspects = async (
  description: string,
  location: string,
  context: { whoWeAre: string, role: string, targetGoal: string },
  radius: string = '25',
  depth: 'STANDARD' | 'DEEP' = 'STANDARD',
  userCoords?: { latitude: number; longitude: number }
) => {
  const ai = getAI();
  const model = 'gemini-2.5-flash';
  
  const leadLimit = depth === 'DEEP' ? 20 : 10;
  
  const prompt = `SEARCH_GOAL: Find up to ${leadLimit} business prospects in ${location} within ${radius} miles with high SPONSORSHIP potential for a sports organization.
  DNA_PROFILE: "${description}"
  USER_CONTEXT: From ${context.whoWeAre} (${context.role}), seeking partners for: ${context.targetGoal}.
  
  SPONSORSHIP_FIT_SIGNALS (PRIORITIZE THESE):
  1. Companies explicitly seeking sponsorships or brand partners.
  2. Brands expanding their presence or launching community initiatives.
  3. Local businesses promoting upcoming events or new product lines.
  4. Recently funded companies (Seed, Series A, etc.) looking for visibility.
  5. Organizations with strong local community alignment and active CSR programs.

  EXTRACTION_PROTOCOL (FORENSIC ACCURACY REQUIRED):
  1. Act as a digital investigator. DO NOT guess social media handles.
  2. YOU MUST specifically search for verified social links (Instagram, Facebook, X/Twitter, LinkedIn) typically located in the business website's FOOTER or CONTACT page.
  3. For each prospect, extract: Full Website URL, verified Email, verified direct Phone Number, and all available social handles.
  4. Verify the physical location is within ${radius} miles of ${location}.
  5. Return ONLY a valid JSON array of objects.

  SCHEMA:
  {
    "companyName": "string",
    "description": "string (Why they are a great sponsorship fit)",
    "dnaScore": number (0-100),
    "matchReasoning": "string (Focus on sponsorship alignment)",
    "website": "url",
    "email": "string?",
    "phone": "string?",
    "address": "string?",
    "socialLinks": { "instagram": "handle", "linkedIn": "url", "twitter": "handle", "facebook": "url" },
    "latestSignal": "string (Recent news or post summary showing sponsorship potential)",
    "contactEvidence": { "FIELD": { "source": "official_website | google_business | social", "confidence": 0-1, "sourceUrl": "url" } }
  }`;

  try {
    const response = await ai.models.generateContent({
      model: model,
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

    const mappedLeads = results.map((raw: any) => mapRawLeadToDiscovered(raw as RawDiscoveredLead, groundingLinks));

    // STANDARD SCAN: Return immediately (no scraping for speed)
    // DEEP SCAN: HTML scraping is handled in discoverProspectsDeepScan()
    console.log(`✅ ${depth} Scan complete: Found ${mappedLeads.length} leads`);

    return mappedLeads;
  } catch (error) {
    console.error("Forensic Discovery failure:", error);
    return [];
  }
};

/**
 * ESCALATION PROTOCOL: Forensic Audit using Gemini 3 Pro + HTML Scraping
 * Performs deep reasoning to disambiguate and verify lead data.
 *
 * PHASE 2.1 UPDATE: Now integrates direct HTML scraping to ensure
 * social media links are actually verified from the website footer.
 */
export const verifyLeadForensically = async (lead: DiscoveredLead) => {
  const ai = getAI();
  const model = 'gemini-3-pro-preview';

  console.log(`\n🔍 FORENSIC VERIFICATION: ${lead.companyName}`);

  // STEP 1: Run HTML scraper first to get ground truth from website footer
  let scrapedSocialLinks: any = {};
  if (lead.website) {
    console.log('   Step 1: Running HTML scraper for ground truth...');
    scrapedSocialLinks = await scrapeSocialLinks(lead.website);

    if (Object.keys(scrapedSocialLinks).length > 0) {
      console.log(`   ✅ HTML Scraper found ${Object.keys(scrapedSocialLinks).length} social link(s)`);
    } else {
      console.log('   ⚠️ HTML Scraper found no social links in footer');
    }
  }

  // STEP 2: Run Gemini verification for business logic validation
  console.log('   Step 2: Running Gemini Pro verification...');

  const prompt = `FORENSIC_AUDIT_PROTOCOL: Verify the following business entity for a high-value partnership.
  ENTITY: ${lead.companyName}
  WEBSITE: ${lead.website}
  LOCATION: ${lead.address || 'Unknown'}
  CLAIMED_SOCIAL_HANDLES: ${JSON.stringify(lead.socialLinks)}
  ACTUAL_SCRAPED_HANDLES: ${JSON.stringify(scrapedSocialLinks)}

  TASKS:
  1. DISAMBIGUATION: Ensure this is not a collision with another company of similar name. Check if it's a specific franchise location vs corporate headquarters.
  2. DATA_INTEGRITY: The ACTUAL_SCRAPED_HANDLES were directly extracted from the website HTML footer. Use these as ground truth. If CLAIMED_SOCIAL_HANDLES differ from ACTUAL_SCRAPED_HANDLES, the scraped data is correct.
  3. RISK_ASSESSMENT: Detect if the website is down, parked, or significantly outdated.
  4. ALIGNMENT: Does this entity truly match the sponsorship intent: "${lead.description}"?

  IMPORTANT: Trust ACTUAL_SCRAPED_HANDLES over CLAIMED_SOCIAL_HANDLES since they came directly from the website HTML.

  RETURN JSON:
  {
    "status": "VERIFIED | FAILED | COLLISION_DETECTED",
    "reasoning": "string (Forensic verdict on sponsorship potential and data accuracy)",
    "auditTrail": ["string (step by step verification notes, mention if scraped data corrected claimed data)"],
    "correctedData": {
      "website": "string?",
      "email": "string?",
      "socialLinks": { "instagram": "string?", "linkedIn": "string?", "facebook": "string?", "twitter": "string?" }
    }
  }`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const geminiResult = extractJson(response.text || '{}');

    // STEP 3: Merge scraped data with Gemini corrections
    if (geminiResult && geminiResult.correctedData) {
      // Prioritize scraped social links (ground truth from HTML)
      geminiResult.correctedData.socialLinks = mergeSocialLinks(
        geminiResult.correctedData.socialLinks || {},
        scrapedSocialLinks
      );

      console.log('   ✅ Verification complete');
      console.log(`   Status: ${geminiResult.status}`);
      console.log(`   Reasoning: ${geminiResult.reasoning?.substring(0, 100)}...`);

      if (Object.keys(scrapedSocialLinks).length > 0) {
        console.log('   📊 Social links verified via HTML scraping');
      }
    }

    return geminiResult;
  } catch (error) {
    console.error("   ❌ Forensic Audit failure:", error);
    return null;
  }
};

export const generateOutreachDraft = async (
  platform: string,
  companyName: string,
  contactName: string,
  tier: string,
  sender: SenderProfile,
  latestSignal?: string
) => {
  const ai = getAI();
  
  const ctaMap = {
    quick_chat: "Open to a quick 10-minute chat to see if there’s a fit?",
    email_reply: "If it’s easier, feel free to reply here and I can send details.",
    book_call: "If you’re open, I can share a link to book a quick call."
  };

  const prompt = `Write a highly personalized ${platform} sponsorship proposal.
  
  SENDER IDENTITY (USE THIS EXACT DATA):
  - Organization: ${sender.orgName}
  - My Role: ${sender.role || 'Partnership Manager'}
  - My Goal: ${sender.goal}
  - My Offer: ${sender.offerOneLiner}
  
  RECIPIENT CONTEXT:
  - Name: ${contactName}
  - Company: ${companyName}
  - Proposed Tier: ${tier}
  - Recent Signal: ${latestSignal || 'Community growth or expansion'}
  
  CONSTRUCTION RULES:
  1. EXACTLY 3 SENTENCES.
  2. Sentence 1: Personalized hook referencing the SIGNAL (e.g. "I saw ${companyName} is expanding their community reach...").
  3. Sentence 2: Professional bridge: "I’m with ${sender.orgName} and we're ${sender.goal} through local sports." 
  4. Sentence 3: Direct CTA: "${ctaMap[sender.ctaStyle as keyof typeof ctaMap]}".
  5. STYLE: Professional, direct, and outcome-oriented. NO generic pleasantries. NO greetings or signatures.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || "Failed to generate draft.";
  } catch (error) {
    return "Failed to generate draft.";
  }
};

/**
 * PERFORM IQ v1: Advanced multi-channel outreach generation
 * Generates personalized drafts based on Deal data and User Persona.
 */
export async function generateOutreachDrafts(
  deal: Deal,
  company: { companyName: string; website?: string; contactName?: string; latestSignal?: string },
  persona: { teamName: string; role: string; summary: string }
): Promise<{ emailDraft: string; dmDraft: string }> {
  const ai = getAI();
  
  const prompt = `
PERFORM_IQ_OUTREACH_ENGINE

You are writing sponsorship outreach for a sports team.

SENDER (TEAM CONTEXT)
- Team/Org: ${persona.teamName}
- Sender Role: ${persona.role}
- Mission/Summary: ${persona.summary}

RECIPIENT (PROSPECT CONTEXT)
- Company: ${company.companyName}
- Website: ${company.website || 'N/A'}
- Tier Target: ${deal.tier}
- Forensic Reasoning (sponsorship fit): ${deal.forensicDossier?.verificationReasoning || 'Strong brand alignment for community visibility.'}
- Latest Signal: ${company.latestSignal || 'Expansion, funding, or local community activation.'}

TASK
1) Write ONE concise cold email:
   - Include a clear Subject line regarding partnership.
   - Max 200 words.
   - Make the value for the company explicit (brand exposure, audience engagement, CSR impact).
   - Do NOT use clichés like "Hope this email finds you well".

2) Write ONE concise social DM:
   - Max 80 words.
   - Suitable for LinkedIn or Instagram DM.
   - Friendly, direct, and easy to reply to regarding a sponsorship opportunity.

FORMAT
Return STRICT JSON with exactly two string fields:
{
  "emailDraft": "<subject + body as plain text>",
  "dmDraft": "<dm copy as plain text>"
}

- No markdown.
- No bullet lists.
- No extra keys.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });
    
    // In this SDK, response.text is a getter that returns the text property of the first candidate.
    const responseText = response.text || '{}';
    const result = extractJson(responseText);
    
    return {
      emailDraft: result?.emailDraft || "Failed to generate email draft.",
      dmDraft: result?.dmDraft || "Failed to generate DM draft."
    };
  } catch (error) {
    console.error("Perform IQ failure:", error);
    return { emailDraft: "Error generating draft.", dmDraft: "Error generating draft." };
  }
}

/**
 * VALUE PROP GENERATOR: Create customized value proposition for a specific prospect
 *
 * Uses prospect context (industry, signals, location, tier) + sender's base value prop
 * to generate a 2-3 sentence customized value proposition.
 */
export async function generateValueProposition(
  deal: { tier: string; forensicDossier?: { verificationReasoning?: string } },
  sponsor: { companyName: string; website?: string; industry?: string; address?: string; latestSignal?: string },
  senderProfile: { orgName: string; role?: string; goal: string; offerOneLiner: string }
): Promise<string> {
  const ai = getAI();

  const prompt = `
VALUE_PROPOSITION_GENERATOR

You are creating a customized value proposition for a sponsorship proposal.

SENDER CONTEXT (Your Organization)
- Organization: ${senderProfile.orgName}
- Role: ${senderProfile.role || 'Partnership Manager'}
- Mission: ${senderProfile.goal}
- Base Value Prop: "${senderProfile.offerOneLiner}"

PROSPECT CONTEXT (Target Company)
- Company: ${sponsor.companyName}
- Website: ${sponsor.website || 'N/A'}
- Industry: ${sponsor.industry || 'Unknown'}
- Location: ${sponsor.address || 'Unknown'}
- Sponsorship Tier: ${deal.tier}
- Latest Signal: ${sponsor.latestSignal || 'Community growth or brand expansion'}
- Forensic Reasoning: ${deal.forensicDossier?.verificationReasoning || 'Strong alignment for sponsorship partnership'}

TASK
Create a customized value proposition specifically for ${sponsor.companyName}.

REQUIREMENTS:
1. 2-3 sentences maximum
2. Start with the base value prop: "${senderProfile.offerOneLiner}"
3. Customize it by referencing:
   - Their industry context
   - Their latest signal (recent news/activity)
   - Their location (local community angle)
   - The sponsorship tier they're being offered
4. Make it outcome-focused (what they GET, not what you offer)
5. Be specific to ${sponsor.companyName}, not generic

STYLE:
- Professional and direct
- Focus on tangible benefits (brand exposure, audience reach, community impact)
- Avoid marketing clichés
- Sound like a confident partnership proposal

OUTPUT FORMAT:
Return ONLY the value proposition text (2-3 sentences). No JSON, no markdown, no extra formatting.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }], // Allow web search for context
      }
    });

    const valueProp = response.text?.trim() || "Failed to generate value proposition.";

    // Clean up any markdown or extra formatting
    return valueProp.replace(/^["']|["']$/g, '').trim();
  } catch (error) {
    console.error("Value Prop Generation failure:", error);
    return "Failed to generate value proposition.";
  }
}

export const interceptPublicSignal = async (query: string, platform: 'INSTAGRAM' | 'LINKEDIN') => {
  const ai = getAI();
  const prompt = `ANALYZE_SIGNAL: "${query}" on ${platform} for sponsorship opportunities. JSON: {senderName, senderHandle, content, identityMatch, suggestedAction}.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
    });
    return extractJson(response.text || 'null');
  } catch (error) { return null; }
};

export const performDeepSignalSearch = async (companyName: string, website: string) => {
  const ai = getAI();
  const prompt = `Forensic search for ${companyName} (${website}) for sponsorship signals. Return a 1-sentence conversation starter about their community impact or growth.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { tools: [{ googleSearch: {} }] },
    });
    return response.text || "No sponsorship signal found.";
  } catch (error) { return "Intelligence gathering failed."; }
};

export const getSocialAngle = async (companyName: string, socialUrl: string) => {
  const ai = getAI();
  const prompt = `Analyze brand voice of ${companyName} at ${socialUrl} for partnership alignment. JSON: {contentThemes, recentCampaigns, brandVoice, outreachHook}.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json" }
    });
    return extractJson(response.text || '{}');
  } catch (error) { return {}; }
};

/**
 * PHASE 2: Deep Scan Discovery with Apollo.io Enrichment
 *
 * Performs a two-stage enrichment process:
 * 1. Uses Gemini to discover prospects based on DNA profile and location
 * 2. Enriches each lead with Apollo.io company data and decision maker contacts
 *
 * Falls back gracefully to Standard Scan if Apollo API key is not configured.
 */

/**
 * PHASE 2: Deep Scan Discovery with Apollo.io Enrichment (Simplified)
 */
export const discoverProspectsDeepScan = async (
  description: string,
  location: string,
  context: { whoWeAre: string, role: string, targetGoal: string },
  radius: string = '25',
  userCoords?: { latitude: number; longitude: number }
): Promise<DiscoveredLead[]> => {
  // Check Apollo configuration
  if (!isApolloConfigured()) {
    console.warn('Apollo API not configured. Using Standard Scan.');
    return discoverProspects(description, location, context, radius, 'STANDARD', userCoords);
  }

  // Step 1: Gemini Discovery
  const geminiLeads = await discoverProspects(description, location, context, radius, 'DEEP', userCoords);
  if (geminiLeads.length === 0) return [];

  // Step 2: Apollo Enrichment
  const enrichedLeads = await Promise.all(
    geminiLeads.map(lead => enrichLeadWithApollo(lead, fullEnrichment))
  );

  // Step 3: HTML Scraper Fallback
  const finalLeads = await Promise.all(
    enrichedLeads.map(async (lead) => {
      if (!lead.website) return lead;
      
      const scrapedLinks = await scrapeSocialLinks(lead.website);
      if (Object.keys(scrapedLinks).length === 0) return lead;

      const mergedLinks = mergeSocialLinks(lead.socialLinks || {}, scrapedLinks);
      return {
        ...lead,
        socialLinks: {
          instagram: mergedLinks.instagram,
          linkedIn: mergedLinks.linkedIn,
          linkedin: mergedLinks.linkedIn,
          facebook: mergedLinks.facebook,
          twitter: mergedLinks.twitter,
        },
        instagramField: mergedLinks.instagram ? {
          value: mergedLinks.instagram,
          evidence: { source: 'official_website' as DataSource, confidence: 0.85, sourceUrl: lead.website }
        } : lead.instagramField,
        linkedInField: mergedLinks.linkedIn ? {
          value: mergedLinks.linkedIn,
          evidence: { source: 'official_website' as DataSource, confidence: 0.85, sourceUrl: lead.website }
        } : lead.linkedInField,
        twitterField: mergedLinks.twitter ? {
          value: mergedLinks.twitter,
          evidence: { source: 'official_website' as DataSource, confidence: 0.85, sourceUrl: lead.website }
        } : lead.twitterField,
      };
    })
  );

  return finalLeads;
};
