/**
 * Apollo.io API Client for Deep Scan Enrichment
 *
 * Provides functions to enrich company and contact data using Apollo.io's API.
 * Requires APOLLO_API_KEY environment variable to be set.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ApolloOrganization,
  ApolloPerson,
  ApolloEnrichmentResult,
  ApolloApiResponse
} from '../types';

const APOLLO_BASE_URL = 'https://api.apollo.io/api/v1';

/**
 * Get the Apollo API key from environment variables
 */
function getApolloApiKey(): string | undefined {
  return import.meta.env.VITE_APOLLO_API_KEY;
}

/**
 * Check if Apollo API is configured
 */
export function isApolloConfigured(): boolean {
  const apiKey = getApolloApiKey();
  return !!apiKey && apiKey.length > 0;
}

/**
 * Create axios instance with Apollo API configuration
 */
function createApolloClient(): AxiosInstance | null {
  const apiKey = getApolloApiKey();

  if (!apiKey) {
    console.warn('⚠️ Apollo API key not configured. Deep Scan will fall back to Standard Scan.');
    return null;
  }

  return axios.create({
    baseURL: APOLLO_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    timeout: 30000, // 30 second timeout
  });
}

/**
 * Extract domain from a URL or return as-is if already a domain
 */
function extractDomain(urlOrDomain: string): string {
  try {
    // Remove protocol if present
    let cleaned = urlOrDomain.replace(/^https?:\/\//, '');
    // Remove www. prefix
    cleaned = cleaned.replace(/^www\./, '');
    // Remove path and query parameters
    cleaned = cleaned.split('/')[0];
    cleaned = cleaned.split('?')[0];
    return cleaned.toLowerCase();
  } catch (error) {
    console.warn(`Failed to extract domain from: ${urlOrDomain}`, error);
    return urlOrDomain.toLowerCase();
  }
}

/**
 * Enrich a single company using Apollo Organization Enrichment API
 *
 * @param domain - Company domain (e.g., "example.com")
 * @returns Organization data or null if enrichment fails
 */
export async function enrichCompany(domain: string): Promise<ApolloOrganization | null> {
  const client = createApolloClient();
  if (!client) {
    return null;
  }

  const cleanDomain = extractDomain(domain);

  try {
    console.log(`🔍 Apollo: Enriching company ${cleanDomain}...`);

    const response = await client.post<ApolloApiResponse<ApolloOrganization>>(
      '/organizations/enrich',
      {
        domain: cleanDomain,
      }
    );

    if (response.data.organization) {
      console.log(`✅ Apollo: Successfully enriched ${cleanDomain}`);
      return response.data.organization;
    }

    console.warn(`⚠️ Apollo: No organization data found for ${cleanDomain}`);
    return null;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      console.warn(`⚠️ Apollo: Organization not found for ${cleanDomain}`);
    } else {
      console.error(`❌ Apollo: Failed to enrich ${cleanDomain}:`, axiosError.message);
    }
    return null;
  }
}

/**
 * Find decision makers at a company using Apollo People Search API
 *
 * @param domain - Company domain
 * @param jobTitles - Array of job titles to search for (e.g., ["CEO", "CMO", "Marketing Director"])
 * @param limit - Maximum number of contacts to return (default: 5)
 * @returns Array of people found at the company
 */
export async function findDecisionMakers(
  domain: string,
  jobTitles: string[] = ['CEO', 'CMO', 'VP Marketing', 'Marketing Director', 'Brand Manager'],
  limit: number = 5
): Promise<ApolloPerson[]> {
  const client = createApolloClient();
  if (!client) {
    return [];
  }

  const cleanDomain = extractDomain(domain);

  try {
    console.log(`🔍 Apollo: Finding decision makers at ${cleanDomain}...`);

    const response = await client.post<ApolloApiResponse<ApolloPerson>>(
      '/mixed_people/search',
      {
        organization_domains: [cleanDomain],
        person_titles: jobTitles,
        page: 1,
        per_page: limit,
      }
    );

    const people = response.data.people || [];
    console.log(`✅ Apollo: Found ${people.length} decision makers at ${cleanDomain}`);

    return people;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error(`❌ Apollo: Failed to find decision makers at ${cleanDomain}:`, axiosError.message);
    return [];
  }
}

/**
 * Bulk enrich multiple companies in a single request
 * More cost-efficient than individual requests
 *
 * @param domains - Array of company domains
 * @returns Array of organizations (nulls for failed enrichments)
 */
export async function bulkEnrichCompanies(domains: string[]): Promise<(ApolloOrganization | null)[]> {
  const client = createApolloClient();
  if (!client) {
    return domains.map(() => null);
  }

  const cleanDomains = domains.map(extractDomain);

  try {
    console.log(`🔍 Apollo: Bulk enriching ${cleanDomains.length} companies...`);

    const response = await client.post<ApolloApiResponse<ApolloOrganization>>(
      '/organizations/bulk_enrich',
      {
        domains: cleanDomains,
      }
    );

    const organizations = response.data.organizations || [];
    console.log(`✅ Apollo: Successfully enriched ${organizations.length}/${cleanDomains.length} companies`);

    return organizations;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error(`❌ Apollo: Bulk enrichment failed:`, axiosError.message);
    return domains.map(() => null);
  }
}

/**
 * Full enrichment: Get both company data and decision maker contacts
 * This is the main function used by Deep Scan
 *
 * @param domain - Company domain or website URL
 * @returns Combined enrichment result
 */
export async function fullEnrichment(domain: string): Promise<ApolloEnrichmentResult> {
  if (!domain || domain.trim() === '') {
    return {
      success: false,
      error: 'No domain provided',
    };
  }

  if (!isApolloConfigured()) {
    return {
      success: false,
      error: 'Apollo API key not configured',
    };
  }

  const cleanDomain = extractDomain(domain);
  console.log(`\n🚀 Apollo: Starting full enrichment for ${cleanDomain}...`);

  try {
    // Run company enrichment and decision maker search in parallel
    const [organization, people] = await Promise.all([
      enrichCompany(cleanDomain),
      findDecisionMakers(cleanDomain),
    ]);

    const success = !!(organization || people.length > 0);

    if (success) {
      console.log(`✅ Apollo: Full enrichment completed for ${cleanDomain}`);
      console.log(`   - Organization data: ${organization ? 'Yes' : 'No'}`);
      console.log(`   - Decision makers found: ${people.length}`);
    } else {
      console.warn(`⚠️ Apollo: No data found for ${cleanDomain}`);
    }

    return {
      organization: organization || undefined,
      people: people.length > 0 ? people : undefined,
      success,
      creditsUsed: (organization ? 1 : 0) + (people.length > 0 ? 1 : 0),
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error(`❌ Apollo: Full enrichment failed for ${cleanDomain}:`, axiosError.message);

    return {
      success: false,
      error: axiosError.message || 'Unknown error during Apollo enrichment',
    };
  }
}

/**
 * Test Apollo API connection
 * Useful for validating API key configuration
 */
export async function testApolloConnection(): Promise<boolean> {
  if (!isApolloConfigured()) {
    console.error('❌ Apollo API key not configured');
    return false;
  }

  try {
    // Test with a known domain
    const result = await enrichCompany('google.com');
    console.log('✅ Apollo API connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Apollo API connection test failed:', error);
    return false;
  }
}
