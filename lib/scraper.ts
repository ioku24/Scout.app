/**
 * Direct HTML Scraper for Social Media Links
 *
 * This module provides fallback extraction when Gemini grounding doesn't find
 * social media links. It directly fetches and parses the HTML to find footer
 * social links that AI might miss.
 */

export interface ScrapedSocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedIn?: string;
  youtube?: string;
  tiktok?: string;
}

/**
 * Extract social media links from HTML content
 * Looks for common patterns in footer/contact sections
 */
function extractSocialLinksFromHTML(html: string, baseUrl: string): ScrapedSocialLinks {
  const links: ScrapedSocialLinks = {};

  // Normalize HTML to lowercase for case-insensitive matching
  const lowerHTML = html.toLowerCase();

  // Social media URL patterns
  const patterns = {
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_\.]+)/gi,
    facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9_\-\.]+)/gi,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi,
    linkedIn: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_\-]+)/gi,
    youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)?([a-zA-Z0-9_\-]+)/gi,
    tiktok: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_\.]+)/gi,
  };

  // Extract Instagram
  const instagramMatches = html.matchAll(patterns.instagram);
  for (const match of instagramMatches) {
    if (match[1] && !match[1].includes('/') && match[1].length > 2) {
      links.instagram = `https://instagram.com/${match[1]}`;
      break; // Take first valid match
    }
  }

  // Extract Facebook
  const facebookMatches = html.matchAll(patterns.facebook);
  for (const match of facebookMatches) {
    if (match[1] && !match[1].includes('/') && match[1].length > 2) {
      // Skip common false positives
      if (!['sharer', 'dialog', 'share', 'plugins'].includes(match[1].toLowerCase())) {
        links.facebook = `https://facebook.com/${match[1]}`;
        break;
      }
    }
  }

  // Extract Twitter/X
  const twitterMatches = html.matchAll(patterns.twitter);
  for (const match of twitterMatches) {
    if (match[1] && !match[1].includes('/') && match[1].length > 2) {
      // Skip common false positives
      if (!['intent', 'share', 'widgets'].includes(match[1].toLowerCase())) {
        links.twitter = `https://twitter.com/${match[1]}`;
        break;
      }
    }
  }

  // Extract LinkedIn
  const linkedInMatches = html.matchAll(patterns.linkedIn);
  for (const match of linkedInMatches) {
    if (match[1] && !match[1].includes('/') && match[1].length > 2) {
      links.linkedIn = `https://linkedin.com/company/${match[1]}`;
      break;
    }
  }

  // Extract YouTube
  const youtubeMatches = html.matchAll(patterns.youtube);
  for (const match of youtubeMatches) {
    if (match[1] && !match[1].includes('/') && match[1].length > 2) {
      links.youtube = `https://youtube.com/@${match[1]}`;
      break;
    }
  }

  // Extract TikTok
  const tiktokMatches = html.matchAll(patterns.tiktok);
  for (const match of tiktokMatches) {
    if (match[1] && !match[1].includes('/') && match[1].length > 2) {
      links.tiktok = `https://tiktok.com/@${match[1]}`;
      break;
    }
  }

  return links;
}

/**
 * Scrape social media links from a website
 * Uses CORS proxy to bypass browser restrictions
 *
 * @param websiteUrl - The website URL to scrape
 * @returns Promise with scraped social links
 */
export async function scrapeSocialLinks(websiteUrl: string): Promise<ScrapedSocialLinks> {
  if (!websiteUrl || websiteUrl.trim() === '') {
    console.warn('⚠️ Scraper: No website URL provided');
    return {};
  }

  try {
    // Normalize URL
    let url = websiteUrl.trim();
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    console.log(`🕷️ Scraper: Fetching ${url} for social media links...`);

    // Attempt direct fetch first (may fail due to CORS)
    let html: string;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ScoutBot/1.0)',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      html = await response.text();
    } catch (fetchError) {
      // CORS blocked or network error - try CORS proxy as fallback
      console.warn(`⚠️ Scraper: Direct fetch failed (${(fetchError as Error).message}), trying CORS proxy...`);

      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const proxyResponse = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(15000), // 15 second timeout for proxy
        });

        if (!proxyResponse.ok) {
          throw new Error(`Proxy HTTP ${proxyResponse.status}`);
        }

        html = await proxyResponse.text();
      } catch (proxyError) {
        console.error(`❌ Scraper: Both direct fetch and proxy failed for ${url}`);
        return {};
      }
    }

    // Extract social links from HTML
    const links = extractSocialLinksFromHTML(html, url);

    const foundCount = Object.keys(links).length;
    if (foundCount > 0) {
      console.log(`✅ Scraper: Found ${foundCount} social link(s) on ${url}`);
      console.log('   Links:', links);
    } else {
      console.warn(`⚠️ Scraper: No social links found on ${url}`);
    }

    return links;
  } catch (error) {
    console.error(`❌ Scraper: Failed to scrape ${websiteUrl}:`, error);
    return {};
  }
}

/**
 * Merge scraped social links with existing lead data
 * Only fills in missing fields, doesn't overwrite existing data
 */
export function mergeSocialLinks(
  existing: Partial<ScrapedSocialLinks>,
  scraped: ScrapedSocialLinks
): ScrapedSocialLinks {
  return {
    instagram: existing.instagram || scraped.instagram,
    facebook: existing.facebook || scraped.facebook,
    twitter: existing.twitter || scraped.twitter,
    linkedIn: existing.linkedIn || scraped.linkedIn,
    youtube: existing.youtube || scraped.youtube,
    tiktok: existing.tiktok || scraped.tiktok,
  };
}
