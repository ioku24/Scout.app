import { DiscoveredLead, ContactIntelligence, DataSource } from '../types';
import { ApolloEnrichmentResult } from '../types';

/**
 * Merge Apollo organization data into a lead
 */
export function mergeApolloOrgData(lead: DiscoveredLead, org: any): DiscoveredLead {
  const enriched = { ...lead };

  if (org.phone && !enriched.phone) {
    enriched.phone = org.phone;
    enriched.phoneField = {
      value: org.phone,
      evidence: { source: 'directory' as DataSource, confidence: 0.9, sourceUrl: 'Apollo.io' }
    };
  }

  if (org.street_address && !enriched.address) {
    enriched.address = [org.street_address, org.city, org.state, org.postal_code, org.country]
      .filter(Boolean).join(', ');
    enriched.addressField = {
      value: enriched.address,
      evidence: { source: 'directory' as DataSource, confidence: 0.9, sourceUrl: 'Apollo.io' }
    };
  }

  if (org.linkedin_url && !enriched.socialLinks?.linkedIn) {
    enriched.socialLinks = { ...enriched.socialLinks, linkedIn: org.linkedin_url, linkedin: org.linkedin_url };
    enriched.linkedInField = {
      value: org.linkedin_url,
      evidence: { source: 'directory' as DataSource, confidence: 0.9, sourceUrl: 'Apollo.io' }
    };
  }

  if (org.twitter_url && !enriched.socialLinks?.twitter) {
    enriched.socialLinks = { ...enriched.socialLinks, twitter: org.twitter_url };
    enriched.twitterField = {
      value: org.twitter_url,
      evidence: { source: 'directory' as DataSource, confidence: 0.9, sourceUrl: 'Apollo.io' }
    };
  }

  if (org.facebook_url && !enriched.socialLinks?.facebook) {
    enriched.socialLinks = { ...enriched.socialLinks, facebook: org.facebook_url };
  }

  if (org.short_description) {
    enriched.description = `${enriched.description}\n\nCompany Info: ${org.short_description}`;
  }

  return enriched;
}

/**
 * Convert Apollo people data to enriched contacts
 */
export function convertApolloContacts(people: any[], lead: DiscoveredLead): { lead: DiscoveredLead, contacts: ContactIntelligence[] } {
  const enrichedLead = { ...lead };
  const enrichedContacts: ContactIntelligence[] = [];

  people.forEach((person, personIndex) => {
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

      if (personIndex === 0 && !enrichedLead.email) {
        enrichedLead.email = person.email;
        enrichedLead.emailField = {
          value: person.email,
          evidence: {
            source: 'directory' as DataSource,
            confidence: person.email_status === 'verified' ? 0.95 : 0.75,
            sourceUrl: 'Apollo.io'
          }
        };
      }
    }

    if (person.phone_numbers) {
      person.phone_numbers.forEach((phoneObj: any, phoneIndex: number) => {
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

  return { lead: enrichedLead, contacts: enrichedContacts };
}

/**
 * Enrich a single lead with Apollo data
 */
export async function enrichLeadWithApollo(
  lead: DiscoveredLead,
  fullEnrichment: (website: string) => Promise<ApolloEnrichmentResult>
): Promise<DiscoveredLead> {
  if (!lead.website) return lead;

  try {
    const apolloResult = await fullEnrichment(lead.website);
    if (!apolloResult.success) return lead;

    let enriched = lead;

    if (apolloResult.organization) {
      enriched = mergeApolloOrgData(enriched, apolloResult.organization);
    }

    if (apolloResult.people && apolloResult.people.length > 0) {
      const { lead: updatedLead, contacts } = convertApolloContacts(apolloResult.people, enriched);
      enriched = updatedLead;
      enriched.enrichedContacts = [...(enriched.enrichedContacts || []), ...contacts];
    }

    return enriched;
  } catch (error) {
    return lead;
  }
}
