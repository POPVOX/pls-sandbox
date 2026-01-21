import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large document texts

// Anthropic API configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// System prompt for legislation extraction
const EXTRACTION_SYSTEM_PROMPT = `You are an expert legislative analyst specializing in post-legislative scrutiny. Analyze the provided legislation and extract key information for parliamentary review.

IMPORTANT INSTRUCTIONS:
- DO NOT copy raw text directly from the document
- SYNTHESIZE and SUMMARIZE information in clear, professional language
- If information is not clearly stated, make reasonable inferences or leave blank
- Write objectives and summaries in your own words, not quoted text

Extract and return a JSON object with these fields:

{
  "legislationTitle": "The full official title of the Act/Bill",
  "legislationYear": "Year enacted (e.g., '2023')",
  "legislationSummary": "Write a clear 2-3 sentence summary explaining: (1) what problem this legislation addresses, (2) what it does to solve it, and (3) who it affects. Do NOT copy definitions or preamble text.",
  "primaryObjectives": "• First main policy objective\\n• Second main policy objective\\n• Third main policy objective (list 3-5 key goals the legislation aims to achieve, written as clear statements)",
  "implementingAgencies": "Ministry/Department Name, Agency Name (list the government bodies responsible for implementation)",
  "suggestedCountry": "Country name if identifiable",
  "jurisdictionLevel": "national/regional/local/supranational",
  "parliamentType": "unicameral/bicameral/presidential/other or empty string",
  "keyProvisions": "• Key provision 1\\n• Key provision 2 (summarize 3-5 most important sections/articles)",
  "reviewClauses": "Any sunset/review clauses, mandatory reporting requirements, or evaluation timelines"
}

Return ONLY valid JSON. No markdown code blocks, no explanations.`;


// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        aiConfigured: !!ANTHROPIC_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// Extract legislation details using Anthropic Claude
app.post('/api/extract', async (req, res) => {
    try {
        const { text, filename } = req.body;

        if (!text || text.trim().length < 50) {
            return res.status(400).json({
                error: 'Document text is too short for analysis'
            });
        }

        // Check if API key is configured
        if (!ANTHROPIC_API_KEY) {
            console.warn('ANTHROPIC_API_KEY not configured, using fallback extraction');
            return res.json({
                success: true,
                method: 'fallback',
                data: extractFallback(text, filename)
            });
        }

        // Call Anthropic API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 4096,
                system: EXTRACTION_SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: `Please analyze the following legislation and extract key information:\n\n---\n${text.substring(0, 15000)}${text.length > 15000 ? '\n\n[Document truncated due to length...]' : ''}\n---\n\nReturn the extracted information as a JSON object.`
                    },
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Anthropic API error:', error);

            // Fall back to pattern matching if API fails
            return res.json({
                success: true,
                method: 'fallback',
                data: extractFallback(text, filename),
                warning: 'AI extraction failed, used pattern matching'
            });
        }

        const data = await response.json();
        const content = data.content[0].text;

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const extractedData = JSON.parse(jsonMatch[0]);
            return res.json({
                success: true,
                method: 'ai',
                data: extractedData
            });
        }

        throw new Error('Could not parse AI response as JSON');
    } catch (error) {
        console.error('Extraction error:', error);

        // Fall back to pattern matching on any error
        return res.json({
            success: true,
            method: 'fallback',
            data: extractFallback(req.body.text, req.body.filename),
            warning: error.message
        });
    }
});

// Fallback extraction using pattern matching
function extractFallback(text, filename = 'document.txt') {
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
    };
}

// PLSGPT System Prompt
const PLSGPT_SYSTEM_PROMPT = `**Role & Persona**
You are "PLSGPT," a Senior Parliamentary Clerk and legislative scrutiny expert. You are designed to assist Members of Parliament (MPs), legislative staff, and researchers in conducting rigorous Post-Legislative Scrutiny (PLS).

**Tone:** Professional, procedural, impartial, encouraging, and rigorous. Avoid political opinions; focus entirely on process, evidence, and institutional strengthening.
**Language:** You are fully bilingual. Automatically detect the user's language (English or Spanish) and respond in that same language.

**Knowledge Base & Source Hierarchy**
You are strictly grounded in the Westminster Foundation for Democracy (WFD) materials. Prioritize them as follows:

1. **Core Methodology:** "Parliamentary innovation through post-legislative scrutiny: A new manual for parliaments (2023)" (The 2023 Manual). Use this for the overall process (Initiation -> Consultation -> Reporting).

2. **Thematic Lenses:**
   - **Gender:** "Policy Paper: Gender-sensitive Post-Legislative Scrutiny (2020)" (The Gender Guide). Use for gender-neutral language, disaggregated data, or "unintended consequences" on specific groups.
   - **Climate/Environment:** "Post-Legislative Scrutiny of climate and environment legislation (2021)" (The Climate Guide). Use for the "Triangle of Scrutiny" (Regulator, Auditor, Parliament) and alignment with international treaties.
   - **Civil Society:** "Post-Legislative Scrutiny: From a Model for Parliamentarians to a CSO Strategic Tool (2021)" (The CSO Guide). Use for public hearings, shadow reports, or citizen evidence.

**Operational Protocol: The Scrutiny Lifecycle**

**Phase 1: Triage & "The Hook" (Upon File Upload)**
When legislation text is provided, perform an immediate "X-Ray Scan" using the 2023 Manual:
- Identify key elements: Purpose, actors, enforcement mechanisms, oversight clauses, and timelines.
- **Triggers:** Flag any Review or Sunset Clauses (Reference Box 3 of the 2023 Manual).
- **Delegated Powers:** Flag broad powers granted to Ministers for secondary legislation (Reference Step 4 and Figure 5).
- **Gaps:** Note if the law lacks a specified implementing agency or budget (Reference Box 9).

**Phase 2: Lens Selection**
After initial scan, ask: "Which scrutiny lens would you like to apply?"
- **General Effectiveness:** Focus on Impact vs. Implementation (2023 Manual).
- **Gender & Inclusion:** Focus on disaggregated data and differential impacts (Gender Guide).
- **Climate & Environment:** Focus on long-term targets and international commitments (Climate Guide).
- **Public/CSO Engagement:** Focus on stakeholder mapping (CSO Guide).

**Phase 3: Guided Walkthrough (Co-Pilot Mode)**
Walk the user step-by-step through evaluating the text based on the selected lens.
- **Probing Questions:** Ask questions to provoke thought.
  Example: "The Climate Guide suggests checking for 'Regulatory Overlap.' Does this law conflict with existing mandates of the Ministry of Environment?"
- **"Show Your Work":** ALWAYS explicitly cite where you are getting your advice.
  Bad: "You should check the budget."
  Good: "According to **Section 2.2 of the Climate Guide**, we should check if the implementing agency is underfunded, which is a common cause of failure. Shall we draft a question for the Minister on this?"

**Phase 4: Output (Terms of Reference)**
Offer to draft a **Terms of Reference (ToR)** or **PLS Plan** using:
- Box 7 (Potential Questions) from the 2023 Manual
- Box 12 (SMART Recommendations) from the 2023 Manual
- Figure 4 (Six Tests for Stakeholder Identification) for the witness list

**Visual Aid Integration**
Refer to visual models from the manuals where relevant (e.g., "We can use the 'Triangle of Scrutiny' model from the Climate Guide to identify who oversees this regulator...").

**Safety & Integrity**
- If the answer is not in the WFD documents, state clearly: "The WFD guidance does not explicitly cover this specific scenario, but based on general parliamentary best practice, I would suggest..."
- Avoid speculation. Base comparative examples on structured, sourced insights.

You are helpful, thorough, and always cite your sources.`;

// PLSGPT Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, documentText, context } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                success: false,
                error: 'Messages array is required'
            });
        }

        // Check if API key is configured
        if (!ANTHROPIC_API_KEY) {
            return res.json({
                success: false,
                error: 'AI not configured. Please set ANTHROPIC_API_KEY in your .env file.'
            });
        }

        // Build context for the assistant
        let systemContext = PLSGPT_SYSTEM_PROMPT;

        if (documentText) {
            systemContext += `\n\n**CURRENT DOCUMENT UNDER ANALYSIS:**\n\`\`\`\n${documentText.substring(0, 20000)}\n\`\`\``;
        }

        if (context && context.legislationTitle) {
            systemContext += `\n\n**USER'S CURRENT LEGISLATION CONTEXT:**
- Legislation: ${context.legislationTitle || 'Not specified'}
- Country: ${context.country || 'Not specified'}
- Year: ${context.legislationYear || 'Not specified'}
- Jurisdiction: ${context.jurisdiction || 'Not specified'}
- Parliament Type: ${context.parliamentType || 'Not specified'}`;
        }

        // Format messages for Anthropic
        const anthropicMessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }));

        // Call Anthropic API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 4096,
                system: systemContext,
                messages: anthropicMessages,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Anthropic API error:', error);
            return res.json({
                success: false,
                error: 'AI service error. Please try again.'
            });
        }

        const data = await response.json();
        const assistantMessage = data.content[0].text;

        return res.json({
            success: true,
            message: assistantMessage
        });

    } catch (error) {
        console.error('Chat error:', error);
        return res.json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 PLS Command Center API Server`);
    console.log(`   Running on: http://localhost:${PORT}`);
    console.log(`   AI Status: ${ANTHROPIC_API_KEY ? '✓ Anthropic API configured' : '⚠️ No API key - using pattern matching'}`);
    console.log(`\n   Endpoints:`);
    console.log(`   GET  /api/health  - Server status`);
    console.log(`   POST /api/extract - Extract legislation details`);
    console.log(`   POST /api/chat    - PLSGPT chatbot\n`);
});
