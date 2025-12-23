
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
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not defined.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    // PHASE 2.1: Social Media Scraping Fallback
    // For leads with websites but missing social links, scrape the HTML as fallback
    console.log('\n🕷️ Running HTML scraper fallback for social media links...');

    const scrapingPromises = mappedLeads.map(async (lead) => {
      // Skip if no website
      if (!lead.website) return lead;

      // Check if social links are missing
      const hasSocialLinks = !!(
        lead.socialLinks?.instagram ||
        lead.socialLinks?.facebook ||
        lead.socialLinks?.twitter ||
        lead.socialLinks?.linkedIn
      );

      // If we already have social links, skip scraping
      if (hasSocialLinks) {
        console.log(`✓ ${lead.companyName}: Already has social links, skipping scrape`);
        return lead;
      }

      // Scrape the website for social links
      console.log(`🕷️ ${lead.companyName}: Scraping ${lead.website} for social links...`);
      const scrapedLinks = await scrapeSocialLinks(lead.website);

      // Merge scraped links with existing data
      if (Object.keys(scrapedLinks).length > 0) {
        const mergedLinks = mergeSocialLinks(lead.socialLinks || {}, scrapedLinks);

        return {
          ...lead,
          socialLinks: {
            instagram: mergedLinks.instagram,
            linkedIn: mergedLinks.linkedIn,
            linkedin: mergedLinks.linkedIn, // duplicate key for compatibility
            facebook: mergedLinks.facebook,
            twitter: mergedLinks.twitter,
          },
          // Add evidence for scraped links
          instagramField: mergedLinks.instagram ? {
            value: mergedLinks.instagram,
            evidence: {
              source: 'official_website' as DataSource,
              confidence: 0.85,
              sourceUrl: `${lead.website} (HTML Scraper)`
            }
          } : lead.instagramField,
          linkedInField: mergedLinks.linkedIn ? {
            value: mergedLinks.linkedIn,
            evidence: {
              source: 'official_website' as DataSource,
              confidence: 0.85,
              sourceUrl: `${lead.website} (HTML Scraper)`
            }
          } : lead.linkedInField,
          twitterField: mergedLinks.twitter ? {
            value: mergedLinks.twitter,
            evidence: {
              source: 'official_website' as DataSource,
              confidence: 0.85,
              sourceUrl: `${lead.website} (HTML Scraper)`
            }
          } : lead.twitterField,
        };
      }

      return lead;
    });

    // Wait for all scraping to complete (in parallel)
    const enrichedLeads = await Promise.all(scrapingPromises);

    console.log('✅ HTML scraping fallback complete');

    return enrichedLeads;
  } catch (error) {
    console.error("Forensic Discovery failure:", error);
    return [];
  }
};

/**
 * ESCALATION PROTOCOL: Forensic Audit using Gemini 3 Pro
 * Performs deep reasoning to disambiguate and verify lead data.
 */
export const verifyLeadForensically = async (lead: DiscoveredLead) => {
  const ai = getAI();
  const model = 'gemini-3-pro-preview';

  const prompt = `FORENSIC_AUDIT_PROTOCOL: Verify the following business entity for a high-value partnership.
  ENTITY: ${lead.companyName}
  WEBSITE: ${lead.website}
  LOCATION: ${lead.address || 'Unknown'}
  SOCIAL_HANDLES: ${JSON.stringify(lead.socialLinks)}

  TASKS:
  1. DISAMBIGUATION: Ensure this is not a collision with another company of similar name. Check if it's a specific franchise location vs corporate headquarters.
  2. DATA_INTEGRITY: Cross-reference the website footer and contact pages for verified emails and social handles.
  3. RISK_ASSESSMENT: Detect if the website is down, parked, or significantly outdated.
  4. ALIGNMENT: Does this entity truly match the sponsorship intent: "${lead.description}"?

  RETURN JSON:
  {
    "status": "VERIFIED | FAILED | COLLISION_DETECTED",
    "reasoning": "string (Forensic verdict on sponsorship potential)",
    "auditTrail": ["string (step by step verification notes)"],
    "correctedData": {
      "website": "string?",
      "email": "string?",
      "socialLinks": { "instagram": "string?", "linkedIn": "string?" }
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

    const result = extractJson(response.text || '{}');
    return result;
  } catch (error) {
    console.error("Forensic Audit failure:", error);
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
export const discoverProspectsDeepScan = async (
  description: string,
  location: string,
  context: { whoWeAre: string, role: string, targetGoal: string },
  radius: string = '25',
  userCoords?: { latitude: number; longitude: number }
): Promise<DiscoveredLead[]> => {
  console.log('\n🚀 DEEP SCAN MODE INITIATED');
  console.log(`📍 Location: ${location} (${radius} miles)`);
  console.log(`🎯 DNA Profile: ${description.substring(0, 100)}...`);

  // Check Apollo configuration
  if (!isApolloConfigured()) {
    console.warn('⚠️ Apollo API key not configured. Falling back to Standard Scan.');
    console.warn('💡 To enable Deep Scan, add APOLLO_API_KEY to your .env file');
    return discoverProspects(description, location, context, radius, 'STANDARD', userCoords);
  }

  console.log('✅ Apollo API configured - proceeding with Deep Scan');

  // Step 1: Run Gemini discovery (using DEEP mode for more results)
  console.log('\n🔍 Step 1: Running Gemini Discovery...');
  const geminiLeads = await discoverProspects(
    description,
    location,
    context,
    radius,
    'DEEP', // Use DEEP mode to get up to 20 leads
    userCoords
  );

  console.log(`✅ Gemini discovered ${geminiLeads.length} prospects`);

  if (geminiLeads.length === 0) {
    console.warn('⚠️ No leads found by Gemini. Returning empty array.');
    return [];
  }

  // Step 2: Enrich each lead with Apollo data
  console.log(`\n💎 Step 2: Enriching ${geminiLeads.length} leads with Apollo.io...`);

  const enrichedLeads = await Promise.all(
    geminiLeads.map(async (lead, index) => {
      // Skip enrichment if no website
      if (!lead.website || lead.website.trim() === '') {
        console.warn(`⚠️ Lead ${index + 1}/${geminiLeads.length}: ${lead.companyName} - No website, skipping Apollo enrichment`);
        return lead;
      }

      try {
        console.log(`🔍 Enriching ${index + 1}/${geminiLeads.length}: ${lead.companyName} (${lead.website})`);

        // Call Apollo full enrichment (company + contacts)
        const apolloResult = await fullEnrichment(lead.website);

        if (!apolloResult.success) {
          console.warn(`⚠️ Apollo enrichment failed for ${lead.companyName}: ${apolloResult.error}`);
          return lead; // Return original lead if enrichment fails
        }

        // Merge Apollo data into the lead
        const enrichedLead: DiscoveredLead = { ...lead };

        // Merge organization data
        if (apolloResult.organization) {
          const org = apolloResult.organization;

          // Update phone if Apollo has it and lead doesn't
          if (org.phone && !enrichedLead.phone) {
            enrichedLead.phone = org.phone;
            enrichedLead.phoneField = {
              value: org.phone,
              evidence: {
                source: 'directory' as DataSource,
                confidence: 0.9,
                sourceUrl: 'Apollo.io Organization Enrichment'
              }
            };
          }

          // Update address if Apollo has it
          if (org.street_address && !enrichedLead.address) {
            const fullAddress = [
              org.street_address,
              org.city,
              org.state,
              org.postal_code,
              org.country
            ].filter(Boolean).join(', ');

            enrichedLead.address = fullAddress;
            enrichedLead.addressField = {
              value: fullAddress,
              evidence: {
                source: 'directory' as DataSource,
                confidence: 0.9,
                sourceUrl: 'Apollo.io Organization Enrichment'
              }
            };
          }

          // Merge social links
          if (org.linkedin_url && !enrichedLead.socialLinks?.linkedIn) {
            enrichedLead.socialLinks = {
              ...enrichedLead.socialLinks,
              linkedIn: org.linkedin_url,
              linkedin: org.linkedin_url
            };
            enrichedLead.linkedInField = {
              value: org.linkedin_url,
              evidence: {
                source: 'directory' as DataSource,
                confidence: 0.9,
                sourceUrl: 'Apollo.io Organization Enrichment'
              }
            };
          }

          if (org.twitter_url && !enrichedLead.socialLinks?.twitter) {
            enrichedLead.socialLinks = {
              ...enrichedLead.socialLinks,
              twitter: org.twitter_url
            };
            enrichedLead.twitterField = {
              value: org.twitter_url,
              evidence: {
                source: 'directory' as DataSource,
                confidence: 0.9,
                sourceUrl: 'Apollo.io Organization Enrichment'
              }
            };
          }

          if (org.facebook_url && !enrichedLead.socialLinks?.facebook) {
            enrichedLead.socialLinks = {
              ...enrichedLead.socialLinks,
              facebook: org.facebook_url
            };
          }

          // Enhance description with Apollo data
          if (org.short_description) {
            enrichedLead.description = `${enrichedLead.description}\n\nCompany Info: ${org.short_description}`;
          }
        }

        // Merge decision maker contacts
        if (apolloResult.people && apolloResult.people.length > 0) {
          const enrichedContacts: ContactIntelligence[] = [];

          apolloResult.people.forEach((person, personIndex) => {
            // Add email contact
            if (person.email) {
              enrichedContacts.push({
                id: `apollo-email-${personIndex}`,
                type: 'EMAIL',
                value: person.email,
                confidence: person.email_status === 'verified' ? 0.95 : 0.75,
                source: `Apollo.io - ${person.title || 'Contact'}`,
                isPrimary: personIndex === 0,
                lastVerified: new Date().toISOString()
              });

              // Set primary email if lead doesn't have one
              if (personIndex === 0 && !enrichedLead.email) {
                enrichedLead.email = person.email;
                enrichedLead.emailField = {
                  value: person.email,
                  evidence: {
                    source: 'directory' as DataSource,
                    confidence: person.email_status === 'verified' ? 0.95 : 0.75,
                    sourceUrl: 'Apollo.io People Search'
                  }
                };
              }
            }

            // Add phone contacts
            if (person.phone_numbers && person.phone_numbers.length > 0) {
              person.phone_numbers.forEach((phoneObj, phoneIndex) => {
                if (phoneObj.sanitized_number) {
                  enrichedContacts.push({
                    id: `apollo-phone-${personIndex}-${phoneIndex}`,
                    type: 'PHONE',
                    value: phoneObj.sanitized_number,
                    confidence: 0.8,
                    source: `Apollo.io - ${person.title || 'Contact'}`,
                    isPrimary: personIndex === 0 && phoneIndex === 0
                  });
                }
              });
            }

            // Add LinkedIn contact
            if (person.linkedin_url) {
              enrichedContacts.push({
                id: `apollo-linkedin-${personIndex}`,
                type: 'LINKEDIN',
                value: person.linkedin_url,
                confidence: 0.9,
                source: `Apollo.io - ${person.title || 'Contact'}`,
                isPrimary: personIndex === 0
              });
            }
          });

          // Merge with existing enriched contacts
          enrichedLead.enrichedContacts = [
            ...(enrichedLead.enrichedContacts || []),
            ...enrichedContacts
          ];

          console.log(`✅ Added ${enrichedContacts.length} contact points for ${lead.companyName}`);
        }

        return enrichedLead;
      } catch (error) {
        console.error(`❌ Error enriching ${lead.companyName}:`, error);
        return lead; // Return original lead on error
      }
    })
  );

  console.log('\n✅ DEEP SCAN COMPLETED');
  console.log(`📊 Results: ${enrichedLeads.length} leads enriched with Apollo.io data`);

  return enrichedLeads;
};
