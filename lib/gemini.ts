
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Initialize AI directly with the environment key
const getAI = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

/**
 * Performs a deep signal search for recent business activity using Google Search grounding.
 */
export const performDeepSignalSearch = async (companyName: string, website: string) => {
  const ai = getAI();
  const model = 'gemini-3-pro-preview';
  
  const prompt = `Research current news and recent public activity for "${companyName}" (${website}).
  Find any partnerships, community initiatives, or business expansions from the last 30 days.
  Provide a concise 2-sentence update for a professional partnership follow-up.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        tools: [{ googleSearch: {} }] 
      }
    });
    return response.text?.trim() || "No recent business signals found.";
  } catch (error) {
    console.error("Signal Search Error:", error);
    return "Could not retrieve signals at this time.";
  }
};

/**
 * Main discovery engine to find new prospects based on location and professional description.
 */
export const discoverProspects = async (
  description: string,
  location: string,
  context: { whoWeAre: string, role: string, targetGoal: string },
  radius: string = '25',
  depth: 'STANDARD' | 'DEEP' = 'STANDARD'
) => {
  const ai = getAI();
  const model = depth === 'DEEP' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
  const prompt = `Find business prospects in ${location} within ${radius} miles that match this profile: "${description}".
  User Context: ${context.role} looking for ${context.targetGoal}.
  
  Requirements:
  1. Locate official website, email, and phone contact data.
  2. Find verified social media handles.
  3. Score the match from 0-100 based on the provided profile.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING },
              address: { type: Type.STRING },
              website: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              dnaScore: { type: Type.INTEGER },
              matchReasoning: { type: Type.STRING },
              socialLinks: {
                type: Type.OBJECT,
                properties: {
                  instagram: { type: Type.STRING },
                  linkedIn: { type: Type.STRING },
                  twitter: { type: Type.STRING },
                  facebook: { type: Type.STRING }
                }
              }
            },
            required: ['companyName', 'address', 'website', 'matchReasoning', 'dnaScore']
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Discovery Error:", error);
    return [];
  }
};

/**
 * Generates personalized outreach drafts for specific platforms.
 */
export const generateOutreachDraft = async (
  platform: 'EMAIL' | 'IG' | 'LI' | 'X',
  companyName: string,
  contactName: string,
  tier: string,
  senderName: string,
  recentInsight?: string
) => {
  const ai = getAI();
  const prompt = `Write a professional ${platform} message to ${contactName} at ${companyName} regarding a ${tier} partnership. 
  ${recentInsight ? `Include this context: ${recentInsight}` : ''}
  Signed: ${senderName}. 
  Tone: Direct, collaborative, and professional. Max 3 sentences. Do not use hashtags.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || "Draft generation failed.";
  } catch (error) {
    console.error("Drafting Error:", error);
    return "Error generating content.";
  }
};

/**
 * Analyzes brand presence to find a strategic "hook" for outreach.
 */
export const getSocialAngle = async (companyName: string, handleOrUrl: string) => {
  const ai = getAI();
  const prompt = `Analyze the brand voice and recent digital presence of "${companyName}" (${handleOrUrl}).
  Return a strategic analysis in JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contentThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
            brandVoice: { type: Type.STRING },
            recentCampaigns: { type: Type.STRING },
            outreachHook: { type: Type.STRING }
          },
          required: ['contentThemes', 'brandVoice', 'outreachHook', 'recentCampaigns']
        }
      }
    });
    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text);
  } catch (error) {
    return { 
      contentThemes: ["Local Impact", "Community Growth"], 
      brandVoice: "Professional & Community-Focused", 
      recentCampaigns: "Focusing on local sustainability and service excellence.",
      outreachHook: `I've been following ${companyName}'s growth and noticed your commitment to the local community, which aligns perfectly with our mission.` 
    };
  }
};

/**
 * Intercepts public signals from a company's social presence using Google Search grounding.
 * This function handles the manual intercept logic in SocialInbox.tsx.
 */
export const interceptPublicSignal = async (query: string, platform: 'INSTAGRAM' | 'LINKEDIN') => {
  const ai = getAI();
  const model = 'gemini-3-pro-preview';
  
  const prompt = `Perform a signal interception for "${query}" on ${platform}.
  Find a recent public mention, review, or post about this entity.
  Return a JSON object with:
  - senderName: The person or entity mentioned.
  - senderHandle: Their handle or identifier.
  - content: The text of the mention/signal.
  - identityMatch: A score from 0-100 of how relevant this is to a potential business partnership.
  - suggestedAction: A one-sentence recommendation for an outreach hook.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            senderName: { type: Type.STRING },
            senderHandle: { type: Type.STRING },
            content: { type: Type.STRING },
            identityMatch: { type: Type.INTEGER },
            suggestedAction: { type: Type.STRING }
          },
          required: ['senderName', 'senderHandle', 'content', 'identityMatch', 'suggestedAction']
        }
      }
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Intercept Error:", error);
    return null;
  }
};
