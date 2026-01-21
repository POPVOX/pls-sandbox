// AI Service for legislation analysis
// Calls the backend server which securely holds the API key

const API_BASE_URL = 'http://localhost:3001';

/**
 * Check if the backend server is available and configured
 */
export async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
            return await response.json();
        }
        return { status: 'error', aiConfigured: false };
    } catch (error) {
        return { status: 'offline', aiConfigured: false, error: error.message };
    }
}

/**
 * Extract legislation details using the backend API
 * The backend securely holds the Anthropic API key
 */
export async function extractLegislationWithAI(text, filename) {
    const response = await fetch(`${API_BASE_URL}/api/extract`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, filename }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extract legislation details');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
    }

    return {
        ...result.data,
        _method: result.method, // 'ai' or 'fallback'
        _warning: result.warning,
    };
}

/**
 * Fallback extraction using simple pattern matching (client-side)
 * Used when backend is not available
 */
export function extractLegislationFallback(text, filename) {
    // Extract title from filename or first line
    let legislationTitle = filename.replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    // Try to find title in text
    const titleMatch = text.match(/(?:^|\n)(?:AN? (?:ACT|BILL|LAW)|TITLE)[:\s]+([^\n]+)/i);
    if (titleMatch) {
        legislationTitle = titleMatch[1].trim();
    }

    // Extract year
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    const legislationYear = yearMatch ? yearMatch[0] : '';

    // Try to find summary/purpose section
    let legislationSummary = '';
    const summaryMatch = text.match(/(?:purpose|summary|overview|objects?)[:\s]*\n?([\s\S]{100,500}?)(?:\n\n|\n[A-Z])/i);
    if (summaryMatch) {
        legislationSummary = summaryMatch[1].trim().replace(/\s+/g, ' ').substring(0, 300);
    } else {
        const firstPara = text.substring(0, 500).split(/\n\n/)[0];
        legislationSummary = firstPara.replace(/\s+/g, ' ').trim();
    }

    // Find objectives
    let primaryObjectives = '';
    const objectivesMatch = text.match(/(?:objectives?|aims?|purposes?)[:\s]*\n?((?:[•\-\d\(][^\n]+\n?)+)/i);
    if (objectivesMatch) {
        primaryObjectives = objectivesMatch[1].trim();
    }

    // Find agencies/authorities
    let implementingAgencies = '';
    const agencyMatches = text.match(/(?:minister|ministry|department|agency|authority|commission|board|office)[^,\n]{0,50}/gi);
    if (agencyMatches) {
        const uniqueAgencies = [...new Set(agencyMatches.map(a => a.trim()))].slice(0, 5);
        implementingAgencies = uniqueAgencies.join(', ');
    }

    return {
        legislationTitle,
        legislationYear,
        legislationSummary: legislationSummary || 'This legislation establishes a framework for governance in its designated policy area.',
        primaryObjectives: primaryObjectives || '• To be extracted from the document\n• Review the full text for specific objectives',
        implementingAgencies: implementingAgencies || 'Relevant government ministries and agencies',
        suggestedCountry: '',
        jurisdictionLevel: 'national',
        parliamentType: '',
        keyProvisions: '',
        reviewClauses: '',
        _method: 'fallback',
    };
}
