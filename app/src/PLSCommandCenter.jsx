import React, { useState, useEffect, useRef } from 'react';
import { extractTextFromDocument, getDocumentInfo } from './services/documentParser';
import { extractLegislationWithAI, extractLegislationFallback, checkServerHealth } from './services/aiService';

// PLS Command Center - Legislative Scrutiny Sandbox
// An interactive tool for parliamentary staff and MPs to conduct post-legislative scrutiny

const PLSCommandCenter = () => {
  // Main navigation: 'assistant' or 'tool'
  const [mainTab, setMainTab] = useState('assistant');
  // Sub-tabs for PLS Tool
  const [activeTab, setActiveTab] = useState('setup');
  const [context, setContext] = useState({
    country: '',
    jurisdiction: '',
    parliamentType: '',
    legislationTitle: '',
    legislationYear: '',
    legislationSummary: '',
    primaryObjectives: '',
    implementingAgencies: '',
  });
  const [stakeholders, setStakeholders] = useState([]);
  const [newStakeholder, setNewStakeholder] = useState({ name: '', type: '', influence: 'medium', interest: 'medium', notes: '' });
  const [consultation, setConsultation] = useState({
    methods: [],
    targetGroups: [],
    timeline: '',
    keyQuestions: '',
    accessibilityMeasures: '',
  });
  const [monitoring, setMonitoring] = useState({
    secondaryLegislation: [],
    implementationMilestones: [],
    dataIndicators: [],
    reviewClauses: '',
  });
  const [assessment, setAssessment] = useState({
    intendedOutcomes: '',
    unintendedConsequences: '',
    effectivenessRating: 3,
    recommendations: '',
    evidenceSources: [],
  });
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportReady, setExportReady] = useState(false);

  // Document upload and AI extraction state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [documentText, setDocumentText] = useState('');
  const [documentInfo, setDocumentInfo] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionComplete, setExtractionComplete] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [extractionMethod, setExtractionMethod] = useState(null); // 'ai' or 'fallback'
  const [dragActive, setDragActive] = useState(false);

  // Server status
  const [serverStatus, setServerStatus] = useState({ status: 'checking', aiConfigured: false });

  // Chatbot state
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: `Welcome! I'm the **PLS Assistant**, your Post-Legislative Scrutiny expert. I'm here to help you conduct rigorous PLS using WFD methodology.

I can assist you with:
- **Analyzing legislation** - Upload a bill or act for an "X-Ray Scan"
- **Selecting scrutiny lenses** - Gender, Climate, CSO Engagement, or General Effectiveness
- **Guided walkthroughs** - Step-by-step evaluation of your legislation
- **Drafting outputs** - Terms of Reference and PLS Plans

How can I help you today? You can ask me questions or upload a legislative text to begin.`
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatDocumentText, setChatDocumentText] = useState('');
  const chatContainerRef = useRef(null);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  // Check server status on mount
  useEffect(() => {
    checkServerHealth().then(setServerStatus);
  }, []);



  // Sub-tabs for PLS Tool (these appear when mainTab === 'tool')
  const toolTabs = [
    { id: 'setup', label: 'Context & Setup', icon: '⚙️' },
    { id: 'stakeholders', label: 'Stakeholder Mapping', icon: '👥' },
    { id: 'consultation', label: 'Consultation Design', icon: '💬' },
    { id: 'monitoring', label: 'Implementation Tracking', icon: '📊' },
    { id: 'assessment', label: 'Impact Assessment', icon: '🎯' },
    { id: 'export', label: 'Export Report', icon: '📄' },
  ];

  // Navigation helpers for PLS Tool sub-tabs
  const currentTabIndex = toolTabs.findIndex(t => t.id === activeTab);
  const canGoNext = currentTabIndex < toolTabs.length - 1;
  const canGoPrev = currentTabIndex > 0;

  const goToNextTab = () => {
    if (canGoNext) {
      setActiveTab(toolTabs[currentTabIndex + 1].id);
      window.scrollTo(0, 0);
    }
  };

  const goToPrevTab = () => {
    if (canGoPrev) {
      setActiveTab(toolTabs[currentTabIndex - 1].id);
      window.scrollTo(0, 0);
    }
  };

  // Navigation buttons component
  const renderNavButtons = () => (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
      <button
        onClick={goToPrevTab}
        disabled={!canGoPrev}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${canGoPrev
          ? 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
      >
        ← Previous
      </button>

      <div className="text-gray-500 text-sm">
        Step {currentTabIndex + 1} of {toolTabs.length}
      </div>

      <button
        onClick={goToNextTab}
        disabled={!canGoNext}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${canGoNext
          ? 'bg-[#5f259f] hover:bg-[#4c1d7f] text-white'
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
      >
        {currentTabIndex === toolTabs.length - 2 ? 'Go to Export' : 'Next Step'} →
      </button>
    </div>
  );

  const stakeholderTypes = [
    'Government Ministry/Agency',
    'Regulatory Body',
    'Civil Society Organization',
    'Academic/Research Institution',
    'Private Sector/Industry',
    'Professional Association',
    'Affected Community Group',
    'Local/Regional Authority',
    'International Organization',
    'Media/Journalists',
    'Legal Practitioners',
    'Other',
  ];

  const consultationMethods = [
    { id: 'written', label: 'Written Submissions', description: 'Formal written evidence from stakeholders' },
    { id: 'survey', label: 'Online Survey', description: 'Structured questionnaire for broader reach' },
    { id: 'hearing', label: 'Public Hearing', description: 'Live testimony from witnesses' },
    { id: 'forum', label: 'Discussion Forum', description: 'Interactive online discussion platform' },
    { id: 'focusgroup', label: 'Focus Groups', description: 'In-depth discussions with specific groups' },
    { id: 'fieldvisit', label: 'Field Visits', description: 'On-site visits to implementing agencies' },
    { id: 'townhall', label: 'Town Hall/Public Meeting', description: 'Open community engagement sessions' },
    { id: 'deliberative', label: 'Deliberative Panel', description: 'Representative citizen assembly' },
  ];

  // Simulated AI suggestion generator (in production, this would call the Anthropic API)
  const generateAISuggestions = async (section) => {
    setIsGenerating(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const suggestions = {
      stakeholders: {
        title: 'Suggested Stakeholders',
        content: `Based on ${context.legislationTitle || 'your legislation'} in ${context.country || 'your jurisdiction'}:

**Primary Stakeholders to Consider:**
• The ministry or department responsible for implementation
• Frontline staff who will apply the law daily
• Citizens/groups directly affected by the legislation
• Oversight bodies (ombudsman, audit office)

**Secondary Stakeholders:**
• Academic experts in this policy area
• Civil society organizations working on related issues
• Local government implementers
• Professional associations

**Don't Forget:**
• Opposition voices and critics of the legislation
• Groups who may be unintentionally affected
• International comparators or treaty bodies`,
        tips: [
          'Map stakeholders by both influence AND interest - high interest/low influence groups are often overlooked',
          'Consider who was consulted during the original lawmaking - were any voices missing?',
          'In ' + (context.country || 'your country') + ', check if there are statutory consultees for this type of legislation',
        ]
      },
      consultation: {
        title: 'Consultation Strategy Recommendations',
        content: `For effective PLS consultation on ${context.legislationTitle || 'this legislation'}:

**Method Mix Recommendation:**
1. **Written submissions** for formal evidence from organizations
2. **Online survey** (like Google Forms) for broader reach
3. **Targeted focus groups** for affected communities
4. **Public hearing** for accountability and visibility

**Key Questions to Ask:**
• Has the legislation achieved its stated objectives?
• What implementation challenges have emerged?
• Are there unintended consequences?
• What would you change if you could?
• How does this compare to expectations when passed?

**Accessibility Considerations:**
• Provide plain language summaries of technical provisions
• Offer multiple response formats (online, paper, oral)
• Allow adequate response time (minimum 4-6 weeks)
• Translate materials if relevant to your jurisdiction`,
        tips: [
          'Remember: passive posting generates few responses. Actively reach out through networks.',
          'Close the feedback loop - tell participants how their input was used',
          'Consider hybrid approaches for those with limited digital access',
        ]
      },
      monitoring: {
        title: 'Implementation Monitoring Framework',
        content: `Key monitoring dimensions for ${context.legislationTitle || 'this legislation'}:

**Legal Implementation Checklist:**
□ Has all required secondary legislation been enacted?
□ Were statutory deadlines met?
□ Have implementing agencies been established/resourced?
□ Are there legal challenges or judicial interpretations?

**Operational Indicators:**
• Number of beneficiaries/users of the law
• Processing times for applications/decisions
• Complaint rates and resolution times
• Budget allocated vs. spent
• Staff trained and deployed

**Data Sources to Track:**
• Agency annual reports and statistics
• Audit office findings
• Ombudsman complaints data
• Media coverage and investigative reports
• Academic studies and evaluations`,
        tips: [
          'Like France\'s barometer: track whether regulations were published and when',
          'Set up alerts for when implementing deadlines approach',
          'Create a simple tracking spreadsheet that can be updated regularly',
        ]
      },
      assessment: {
        title: 'Impact Assessment Framework',
        content: `Evaluating the impact of ${context.legislationTitle || 'this legislation'}:

**Outcome Evaluation Questions:**
1. Did the legislation solve the problem it was meant to address?
2. Who has benefited? Who has been disadvantaged?
3. Were the original cost estimates accurate?
4. What worked well? What didn't work?

**Evidence Quality Hierarchy:**
• Statistical data and official reports (strongest)
• Independent research and evaluations
• Stakeholder testimony and case studies
• Media reports and anecdotal evidence

**Common Pitfalls to Avoid:**
• Confusing outputs (activities done) with outcomes (changes achieved)
• Attribution error - assuming all changes are due to the legislation
• Confirmation bias - only seeking evidence that confirms expectations
• Recency bias - over-weighting recent events`,
        tips: [
          'Wait at least 3-5 years before assessing impact (as Sweden recommends)',
          'Compare outcomes to what was promised in the original impact assessment',
          'Look for unintended consequences - both positive and negative',
        ]
      }
    };

    setAiSuggestions(prev => ({ ...prev, [section]: suggestions[section] }));
    setIsGenerating(false);
  };

  // Handle file drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/msword'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      setExtractionError('Please upload a PDF, Word document (.doc/.docx), or text file (.txt)');
      return;
    }

    setUploadedFile(file);
    setExtractionError(null);
    setExtractionComplete(false);
    setDocumentText('');
    setDocumentInfo(null);
  };

  // Real document parsing and AI extraction
  const extractLegislationDetails = async () => {
    if (!uploadedFile) return;

    setIsExtracting(true);
    setExtractionError(null);
    setExtractionStatus('Reading document...');
    setExtractionMethod(null);

    try {
      // Step 1: Extract text from document
      setExtractionStatus('Extracting text from document...');
      const text = await extractTextFromDocument(uploadedFile);
      setDocumentText(text);

      // Get document metadata
      const info = await getDocumentInfo(uploadedFile);
      setDocumentInfo(info);

      if (!text || text.trim().length < 50) {
        throw new Error('Could not extract enough text from the document. Please try a different file format.');
      }

      let extractedData;

      // Step 2: Try backend AI extraction first, fall back to client-side pattern matching
      if (serverStatus.status === 'ok') {
        setExtractionStatus('Analyzing with AI (Claude 3.5)...');
        try {
          extractedData = await extractLegislationWithAI(text, uploadedFile.name);
          setExtractionMethod(extractedData._method || 'ai');
        } catch (apiError) {
          console.warn('Backend extraction failed, using client fallback:', apiError);
          setExtractionStatus('Server unavailable, using pattern matching...');
          extractedData = extractLegislationFallback(text, uploadedFile.name);
          setExtractionMethod('fallback');
        }
      } else {
        setExtractionStatus('Analyzing document structure...');
        // Use client-side pattern matching fallback
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
        extractedData = extractLegislationFallback(text, uploadedFile.name);
        setExtractionMethod('fallback');
      }

      // Step 3: Update context with extracted data
      setContext(prev => ({
        ...prev,
        legislationTitle: extractedData.legislationTitle || prev.legislationTitle,
        legislationYear: extractedData.legislationYear || prev.legislationYear,
        legislationSummary: extractedData.legislationSummary || prev.legislationSummary,
        primaryObjectives: extractedData.primaryObjectives || prev.primaryObjectives,
        implementingAgencies: extractedData.implementingAgencies || prev.implementingAgencies,
        country: prev.country || extractedData.suggestedCountry || '',
        jurisdiction: extractedData.jurisdictionLevel || prev.jurisdiction || 'national',
        parliamentType: extractedData.parliamentType || prev.parliamentType,
      }));

      // If we got review clauses, add them to monitoring
      if (extractedData.reviewClauses) {
        setMonitoring(prev => ({
          ...prev,
          reviewClauses: extractedData.reviewClauses,
        }));
      }

      setIsExtracting(false);
      setExtractionComplete(true);
      setExtractionStatus('');
    } catch (error) {
      console.error('Extraction error:', error);
      setIsExtracting(false);
      setExtractionError(error.message || 'Failed to extract legislation details');
      setExtractionStatus('');
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setExtractionComplete(false);
    setExtractionError(null);
    setDocumentText('');
    setDocumentInfo(null);
    setExtractionStatus('');
  };

  const addStakeholder = () => {
    if (newStakeholder.name.trim()) {
      setStakeholders([...stakeholders, { ...newStakeholder, id: Date.now() }]);
      setNewStakeholder({ name: '', type: '', influence: 'medium', interest: 'medium', notes: '' });
    }
  };

  const removeStakeholder = (id) => {
    setStakeholders(stakeholders.filter(s => s.id !== id));
  };

  const toggleConsultationMethod = (methodId) => {
    setConsultation(prev => ({
      ...prev,
      methods: prev.methods.includes(methodId)
        ? prev.methods.filter(m => m !== methodId)
        : [...prev.methods, methodId]
    }));
  };

  const addMonitoringItem = (type, value) => {
    if (value.trim()) {
      setMonitoring(prev => ({
        ...prev,
        [type]: [...prev[type], { id: Date.now(), text: value, status: 'pending' }]
      }));
    }
  };

  const updateMonitoringStatus = (type, id, status) => {
    setMonitoring(prev => ({
      ...prev,
      [type]: prev[type].map(item =>
        item.id === id ? { ...item, status } : item
      )
    }));
  };

  const generateReport = () => {
    setExportReady(true);
  };

  const getInfluenceInterestColor = (level) => {
    const colors = {
      high: '#dc2626',
      medium: '#f59e0b',
      low: '#22c55e'
    };
    return colors[level] || colors.medium;
  };

  const renderSetupTab = () => (
    <div className="space-y-6">
      {/* Document Upload Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-[#1e1b4b] flex items-center gap-2">
            <span>📄</span> Upload Legislation
            <span className="text-xs bg-[#5f259f] text-white px-2 py-0.5 rounded-full ml-2">AI-Powered</span>
          </h3>
          {/* Server status indicator */}
          <div className="flex items-center gap-2 text-sm">
            {serverStatus.status === 'checking' && (
              <span className="text-gray-500">⏳ Checking AI...</span>
            )}
            {serverStatus.status === 'ok' && serverStatus.aiConfigured && (
              <span className="text-emerald-600 font-medium">✓ Claude AI Ready</span>
            )}
            {serverStatus.status === 'ok' && !serverStatus.aiConfigured && (
              <span className="text-amber-600">⚠️ Pattern Matching Mode</span>
            )}
            {serverStatus.status === 'offline' && (
              <span className="text-amber-600">📴 Offline Mode</span>
            )}
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4">
          Upload your legislation document and let AI extract key details automatically, or fill in the form manually below.
        </p>

        {!uploadedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive
              ? 'border-[#5f259f] bg-purple-50'
              : 'border-gray-300 bg-gray-50 hover:border-[#5f259f] hover:bg-purple-50/50'
              }`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-3">
              <div className="text-4xl">📁</div>
              <div>
                <p className="text-gray-800 font-medium">
                  {dragActive ? 'Drop your file here...' : 'Drag & drop your legislation file here'}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  or <span className="text-[#5f259f] underline">browse files</span>
                </p>
              </div>
              <p className="text-gray-400 text-xs">
                Supported formats: PDF, Word (.doc/.docx), Text (.txt)
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">
                  {uploadedFile.name.endsWith('.pdf') ? '📕' :
                    uploadedFile.name.endsWith('.docx') || uploadedFile.name.endsWith('.doc') ? '📘' : '📄'}
                </div>
                <div>
                  <p className="text-gray-900 font-medium">{uploadedFile.name}</p>
                  <p className="text-gray-500 text-sm">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={clearUpload}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Remove file"
              >
                ✕
              </button>
            </div>

            {!extractionComplete && !isExtracting && (
              <button
                onClick={extractLegislationDetails}
                className="w-full bg-[#5f259f] hover:bg-[#4c1d7f] text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <span>✨</span>
                {serverStatus.status === 'ok' && serverStatus.aiConfigured
                  ? 'Extract Details with AI'
                  : 'Extract Details'}
              </button>
            )}

            {isExtracting && (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-3 text-[#5f259f]">
                  <div className="animate-spin text-2xl">⚙️</div>
                  <div className="text-left">
                    <p className="font-medium">Processing document...</p>
                    <p className="text-sm text-gray-500">{extractionStatus || 'Initializing...'}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#5f259f] rounded-full animate-pulse" style={{ width: '70%' }}></div>
                </div>
              </div>
            )}

            {extractionComplete && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl text-emerald-600">✓</span>
                  <div className="flex-1">
                    <p className="text-emerald-700 font-medium">Extraction Complete!</p>
                    <p className="text-gray-600 text-sm mt-1">
                      {extractionMethod === 'ai'
                        ? 'Claude AI has populated the form below with extracted details. Review and adjust as needed.'
                        : 'Pattern matching has extracted basic details. Review and enhance as needed.'}
                    </p>
                    {documentInfo && (
                      <p className="text-gray-500 text-xs mt-2">
                        📄 {documentInfo.pageCount ? `${documentInfo.pageCount} pages • ` : ''}{documentText.length.toLocaleString()} characters extracted
                        {extractionMethod === 'ai' && ' • Analyzed by Claude 3.5'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {extractionError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
            <span>⚠️</span>
            {extractionError}
          </div>
        )}

        {!uploadedFile && (
          <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
            <span className="h-px flex-1 bg-gray-200"></span>
            <span>or fill in manually below</span>
            <span className="h-px flex-1 bg-gray-200"></span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <h3 className="text-xl font-semibold text-[#1e1b4b] mb-4 flex items-center gap-2">
          <span>🌍</span> Jurisdictional Context
          {extractionComplete && <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded ml-2">AI-filled</span>}
        </h3>
        <p className="text-gray-600 text-sm mb-4">
          Tell us about your parliamentary context so we can tailor suggestions to your system.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country/Region</label>
            <input
              type="text"
              value={context.country}
              onChange={(e) => setContext({ ...context, country: e.target.value })}
              placeholder="e.g., United Kingdom, Kenya, Albania..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level of Government</label>
            <select
              value={context.jurisdiction}
              onChange={(e) => setContext({ ...context, jurisdiction: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
            >
              <option value="">Select level...</option>
              <option value="national">National/Federal Parliament</option>
              <option value="regional">Regional/State Legislature</option>
              <option value="local">Local/Municipal Council</option>
              <option value="supranational">Supranational Body (e.g., EU)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parliament Type</label>
            <select
              value={context.parliamentType}
              onChange={(e) => setContext({ ...context, parliamentType: e.target.value })}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
            >
              <option value="">Select type...</option>
              <option value="unicameral">Unicameral</option>
              <option value="bicameral">Bicameral</option>
              <option value="presidential">Presidential System Legislature</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
        <h3 className="text-xl font-semibold text-[#1e1b4b] mb-4 flex items-center gap-2">
          <span>📜</span> Legislation Details
          {extractionComplete && <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded ml-2">AI-filled</span>}
        </h3>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legislation Title/Name</label>
              <input
                type="text"
                value={context.legislationTitle}
                onChange={(e) => setContext({ ...context, legislationTitle: e.target.value })}
                placeholder="e.g., Community Empowerment Act 2015"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year Enacted</label>
              <input
                type="text"
                value={context.legislationYear}
                onChange={(e) => setContext({ ...context, legislationYear: e.target.value })}
                placeholder="e.g., 2015"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brief Summary</label>
            <textarea
              value={context.legislationSummary}
              onChange={(e) => setContext({ ...context, legislationSummary: e.target.value })}
              placeholder="What does this legislation do? What problem was it meant to solve?"
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Objectives (as stated when passed)</label>
            <textarea
              value={context.primaryObjectives}
              onChange={(e) => setContext({ ...context, primaryObjectives: e.target.value })}
              placeholder="List the main objectives or goals the legislation was meant to achieve..."
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Implementing Agencies</label>
            <input
              type="text"
              value={context.implementingAgencies}
              onChange={(e) => setContext({ ...context, implementingAgencies: e.target.value })}
              placeholder="e.g., Ministry of Health, Local Authorities, Regulatory Agency X..."
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {context.country && context.legislationTitle && (
        <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
          <h4 className="text-lg font-semibold text-emerald-700 mb-2">✓ Context Captured</h4>
          <p className="text-gray-700">
            You're conducting PLS on <strong className="text-gray-900">{context.legislationTitle}</strong>
            {context.legislationYear && <span> ({context.legislationYear})</span>} in <strong className="text-gray-900">{context.country}</strong>.
            {context.parliamentType && <span> Your {context.parliamentType} parliament will shape the approach we recommend.</span>}
          </p>
          <p className="text-emerald-600 mt-2 text-sm">
            → Continue to Stakeholder Mapping to identify who should be consulted.
          </p>
        </div>
      )
      }

      {renderNavButtons()}
    </div >
  );

  const renderStakeholdersTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
              <span>👥</span> Stakeholder Mapping
            </h3>
            <p className="text-slate-300 text-sm mt-1">
              Identify all groups affected by or involved in implementing {context.legislationTitle || 'the legislation'}.
            </p>
          </div>
          <button
            onClick={() => generateAISuggestions('stakeholders')}
            disabled={isGenerating}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⏳</span> Generating...
              </>
            ) : (
              <>
                <span>✨</span> Get AI Suggestions
              </>
            )}
          </button>
        </div>

        {aiSuggestions.stakeholders && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-6 border border-amber-600/30">
            <h4 className="text-amber-400 font-medium mb-2">{aiSuggestions.stakeholders.title}</h4>
            <div className="text-slate-300 text-sm whitespace-pre-line mb-4">
              {aiSuggestions.stakeholders.content}
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <h5 className="text-emerald-400 text-sm font-medium mb-2">💡 Tips for {context.country || 'your context'}:</h5>
              <ul className="text-slate-300 text-sm space-y-1">
                {aiSuggestions.stakeholders.tips.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Stakeholder Name/Group</label>
            <input
              type="text"
              value={newStakeholder.name}
              onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
              placeholder="e.g., Ministry of Health, Patient Advocacy Group..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select
              value={newStakeholder.type}
              onChange={(e) => setNewStakeholder({ ...newStakeholder, type: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            >
              <option value="">Select type...</option>
              {stakeholderTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Influence Level</label>
            <select
              value={newStakeholder.influence}
              onChange={(e) => setNewStakeholder({ ...newStakeholder, influence: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            >
              <option value="high">High - Can significantly shape outcomes</option>
              <option value="medium">Medium - Has moderate influence</option>
              <option value="low">Low - Limited formal influence</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Interest Level</label>
            <select
              value={newStakeholder.interest}
              onChange={(e) => setNewStakeholder({ ...newStakeholder, interest: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            >
              <option value="high">High - Directly affected or deeply invested</option>
              <option value="medium">Medium - Moderately affected or interested</option>
              <option value="low">Low - Peripheral interest</option>
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Notes (why include them?)</label>
          <input
            type="text"
            value={newStakeholder.notes}
            onChange={(e) => setNewStakeholder({ ...newStakeholder, notes: e.target.value })}
            placeholder="Brief note on why this stakeholder matters for PLS..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
          />
        </div>
        <button
          onClick={addStakeholder}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-all"
        >
          + Add Stakeholder
        </button>
      </div>

      {stakeholders.length > 0 && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
          <h4 className="text-lg font-semibold text-white mb-4">
            Stakeholder Map ({stakeholders.length} identified)
          </h4>

          {/* Influence/Interest Matrix Visualization */}
          <div className="mb-6 bg-slate-900 rounded-lg p-4">
            <h5 className="text-sm font-medium text-slate-400 mb-3">Influence/Interest Matrix</h5>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div></div>
              <div className="text-slate-400 font-medium">Low Interest</div>
              <div className="text-slate-400 font-medium">High Interest</div>
              <div className="text-slate-400 font-medium text-right pr-2">High Influence</div>
              <div className="bg-slate-800 rounded p-2 min-h-16">
                <span className="text-slate-500">Monitor</span>
                <div className="flex flex-wrap gap-1 mt-1 justify-center">
                  {stakeholders.filter(s => s.influence === 'high' && s.interest === 'low').map(s => (
                    <span key={s.id} className="bg-amber-600 text-white px-1 rounded text-xs">{s.name.substring(0, 10)}...</span>
                  ))}
                </div>
              </div>
              <div className="bg-red-900/30 rounded p-2 min-h-16 border border-red-600/30">
                <span className="text-red-400">Key Players</span>
                <div className="flex flex-wrap gap-1 mt-1 justify-center">
                  {stakeholders.filter(s => s.influence === 'high' && s.interest === 'high').map(s => (
                    <span key={s.id} className="bg-red-600 text-white px-1 rounded text-xs">{s.name.substring(0, 10)}...</span>
                  ))}
                </div>
              </div>
              <div className="text-slate-400 font-medium text-right pr-2">Low Influence</div>
              <div className="bg-slate-800 rounded p-2 min-h-16">
                <span className="text-slate-500">Inform</span>
                <div className="flex flex-wrap gap-1 mt-1 justify-center">
                  {stakeholders.filter(s => s.influence === 'low' && s.interest === 'low').map(s => (
                    <span key={s.id} className="bg-slate-600 text-white px-1 rounded text-xs">{s.name.substring(0, 10)}...</span>
                  ))}
                </div>
              </div>
              <div className="bg-emerald-900/30 rounded p-2 min-h-16 border border-emerald-600/30">
                <span className="text-emerald-400">Engage Closely</span>
                <div className="flex flex-wrap gap-1 mt-1 justify-center">
                  {stakeholders.filter(s => s.influence === 'low' && s.interest === 'high').map(s => (
                    <span key={s.id} className="bg-emerald-600 text-white px-1 rounded text-xs">{s.name.substring(0, 10)}...</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {stakeholders.map((s) => (
              <div key={s.id} className="bg-slate-900 rounded-lg p-4 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{s.name}</span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{s.type}</span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span style={{ color: getInfluenceInterestColor(s.influence) }}>
                      Influence: {s.influence}
                    </span>
                    <span style={{ color: getInfluenceInterestColor(s.interest) }}>
                      Interest: {s.interest}
                    </span>
                  </div>
                  {s.notes && <p className="text-slate-400 text-sm mt-1">{s.notes}</p>}
                </div>
                <button
                  onClick={() => removeStakeholder(s.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {renderNavButtons()}
    </div>
  );

  const renderConsultationTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
              <span>💬</span> Consultation Design
            </h3>
            <p className="text-slate-300 text-sm mt-1">
              Design your engagement strategy to gather evidence on {context.legislationTitle || 'the legislation'}.
            </p>
          </div>
          <button
            onClick={() => generateAISuggestions('consultation')}
            disabled={isGenerating}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⏳</span> Generating...
              </>
            ) : (
              <>
                <span>✨</span> Get AI Suggestions
              </>
            )}
          </button>
        </div>

        {aiSuggestions.consultation && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-6 border border-amber-600/30">
            <h4 className="text-amber-400 font-medium mb-2">{aiSuggestions.consultation.title}</h4>
            <div className="text-slate-300 text-sm whitespace-pre-line mb-4">
              {aiSuggestions.consultation.content}
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <h5 className="text-emerald-400 text-sm font-medium mb-2">💡 Key Reminders:</h5>
              <ul className="text-slate-300 text-sm space-y-1">
                {aiSuggestions.consultation.tips.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-white font-medium mb-3">Select Consultation Methods</h4>
          <div className="grid md:grid-cols-2 gap-3">
            {consultationMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => toggleConsultationMethod(method.id)}
                className={`text-left p-4 rounded-lg border transition-all ${consultation.methods.includes(method.id)
                  ? 'bg-amber-600/20 border-amber-500 text-white'
                  : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
              >
                <div className="font-medium flex items-center gap-2">
                  <span className={consultation.methods.includes(method.id) ? 'text-amber-400' : 'text-slate-400'}>
                    {consultation.methods.includes(method.id) ? '✓' : '○'}
                  </span>
                  {method.label}
                </div>
                <p className="text-sm text-slate-400 mt-1">{method.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Target Groups/Communities</label>
            <textarea
              value={consultation.targetGroups.join('\n')}
              onChange={(e) => setConsultation({ ...consultation, targetGroups: e.target.value.split('\n').filter(g => g.trim()) })}
              placeholder="List specific groups you want to hear from (one per line)&#10;e.g., Healthcare workers&#10;Rural communities&#10;Young people aged 18-25"
              rows={4}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Key Questions to Ask</label>
            <textarea
              value={consultation.keyQuestions}
              onChange={(e) => setConsultation({ ...consultation, keyQuestions: e.target.value })}
              placeholder="What are the most important questions you want answered?&#10;&#10;e.g., Has the legislation achieved its stated objectives?&#10;What implementation challenges have you encountered?&#10;What unintended consequences have emerged?"
              rows={5}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Proposed Timeline</label>
              <input
                type="text"
                value={consultation.timeline}
                onChange={(e) => setConsultation({ ...consultation, timeline: e.target.value })}
                placeholder="e.g., 6-week consultation period, April-May 2026"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Accessibility Measures</label>
              <input
                type="text"
                value={consultation.accessibilityMeasures}
                onChange={(e) => setConsultation({ ...consultation, accessibilityMeasures: e.target.value })}
                placeholder="e.g., Plain language summary, multiple formats, translation"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {consultation.methods.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 rounded-xl p-6 border border-emerald-700">
          <h4 className="text-lg font-semibold text-emerald-400 mb-3">📋 Your Consultation Plan</h4>
          <div className="space-y-2 text-slate-300">
            <p><strong className="text-white">Methods:</strong> {consultation.methods.map(m => consultationMethods.find(cm => cm.id === m)?.label).join(', ')}</p>
            {consultation.targetGroups.length > 0 && (
              <p><strong className="text-white">Target Groups:</strong> {consultation.targetGroups.join(', ')}</p>
            )}
            {consultation.timeline && <p><strong className="text-white">Timeline:</strong> {consultation.timeline}</p>}
          </div>
        </div>
      )}

      {renderNavButtons()}
    </div>
  );

  const renderMonitoringTab = () => {
    const [newSecondary, setNewSecondary] = useState('');
    const [newMilestone, setNewMilestone] = useState('');
    const [newIndicator, setNewIndicator] = useState('');

    return (
      <>
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
                  <span>📊</span> Implementation Tracking
                </h3>
                <p className="text-slate-300 text-sm mt-1">
                  Monitor how {context.legislationTitle || 'the legislation'} is being implemented.
                </p>
              </div>
              <button
                onClick={() => generateAISuggestions('monitoring')}
                disabled={isGenerating}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span> Generating...
                  </>
                ) : (
                  <>
                    <span>✨</span> Get AI Suggestions
                  </>
                )}
              </button>
            </div>

            {aiSuggestions.monitoring && (
              <div className="bg-slate-900/50 rounded-lg p-4 mb-6 border border-amber-600/30">
                <h4 className="text-amber-400 font-medium mb-2">{aiSuggestions.monitoring.title}</h4>
                <div className="text-slate-300 text-sm whitespace-pre-line mb-4">
                  {aiSuggestions.monitoring.content}
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <h5 className="text-emerald-400 text-sm font-medium mb-2">💡 Tips:</h5>
                  <ul className="text-slate-300 text-sm space-y-1">
                    {aiSuggestions.monitoring.tips.map((tip, i) => (
                      <li key={i}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Secondary Legislation Tracker */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <span>📑</span> Secondary Legislation / Regulations Required
            </h4>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newSecondary}
                onChange={(e) => setNewSecondary(e.target.value)}
                placeholder="e.g., Implementation Regulations 2026, Code of Practice..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addMonitoringItem('secondaryLegislation', newSecondary);
                    setNewSecondary('');
                  }
                }}
              />
              <button
                onClick={() => {
                  addMonitoringItem('secondaryLegislation', newSecondary);
                  setNewSecondary('');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-all"
              >
                Add
              </button>
            </div>
            {monitoring.secondaryLegislation.length > 0 && (
              <div className="space-y-2">
                {monitoring.secondaryLegislation.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-900 rounded-lg p-3">
                    <span className="text-white">{item.text}</span>
                    <select
                      value={item.status}
                      onChange={(e) => updateMonitoringStatus('secondaryLegislation', item.id, e.target.value)}
                      className={`rounded px-3 py-1 text-sm font-medium ${item.status === 'completed' ? 'bg-emerald-600 text-white' :
                        item.status === 'delayed' ? 'bg-red-600 text-white' :
                          item.status === 'inprogress' ? 'bg-amber-600 text-white' :
                            'bg-slate-700 text-slate-300'
                        }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="inprogress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="delayed">Delayed</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Implementation Milestones */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <span>🎯</span> Implementation Milestones
            </h4>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                placeholder="e.g., Agency established, Staff trained, System launched..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addMonitoringItem('implementationMilestones', newMilestone);
                    setNewMilestone('');
                  }
                }}
              />
              <button
                onClick={() => {
                  addMonitoringItem('implementationMilestones', newMilestone);
                  setNewMilestone('');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-all"
              >
                Add
              </button>
            </div>
            {monitoring.implementationMilestones.length > 0 && (
              <div className="space-y-2">
                {monitoring.implementationMilestones.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-900 rounded-lg p-3">
                    <span className="text-white">{item.text}</span>
                    <select
                      value={item.status}
                      onChange={(e) => updateMonitoringStatus('implementationMilestones', item.id, e.target.value)}
                      className={`rounded px-3 py-1 text-sm font-medium ${item.status === 'completed' ? 'bg-emerald-600 text-white' :
                        item.status === 'delayed' ? 'bg-red-600 text-white' :
                          item.status === 'inprogress' ? 'bg-amber-600 text-white' :
                            'bg-slate-700 text-slate-300'
                        }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="inprogress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="delayed">Delayed</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data Indicators */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <span>📈</span> Key Performance Indicators to Track
            </h4>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newIndicator}
                onChange={(e) => setNewIndicator(e.target.value)}
                placeholder="e.g., Number of applications processed, Compliance rate..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addMonitoringItem('dataIndicators', newIndicator);
                    setNewIndicator('');
                  }
                }}
              />
              <button
                onClick={() => {
                  addMonitoringItem('dataIndicators', newIndicator);
                  setNewIndicator('');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-all"
              >
                Add
              </button>
            </div>
            {monitoring.dataIndicators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {monitoring.dataIndicators.map((item) => (
                  <span key={item.id} className="bg-slate-900 text-slate-300 px-3 py-2 rounded-lg text-sm">
                    📊 {item.text}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Review Clauses */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <span>📅</span> Review Clauses / Sunset Provisions
            </h4>
            <textarea
              value={monitoring.reviewClauses}
              onChange={(e) => setMonitoring({ ...monitoring, reviewClauses: e.target.value })}
              placeholder="Does the legislation include any mandatory review dates, sunset clauses, or reporting requirements? List them here..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          {/* Summary Stats */}
          {(monitoring.secondaryLegislation.length > 0 || monitoring.implementationMilestones.length > 0) && (
            <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-xl p-6 border border-blue-700">
              <h4 className="text-lg font-semibold text-blue-400 mb-3">📊 Implementation Status Overview</h4>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="text-2xl font-bold text-slate-300">
                    {[...monitoring.secondaryLegislation, ...monitoring.implementationMilestones].filter(i => i.status === 'pending').length}
                  </div>
                  <div className="text-sm text-slate-400">Pending</div>
                </div>
                <div className="bg-amber-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-amber-400">
                    {[...monitoring.secondaryLegislation, ...monitoring.implementationMilestones].filter(i => i.status === 'inprogress').length}
                  </div>
                  <div className="text-sm text-slate-400">In Progress</div>
                </div>
                <div className="bg-emerald-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-emerald-400">
                    {[...monitoring.secondaryLegislation, ...monitoring.implementationMilestones].filter(i => i.status === 'completed').length}
                  </div>
                  <div className="text-sm text-slate-400">Completed</div>
                </div>
                <div className="bg-red-900/30 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-400">
                    {[...monitoring.secondaryLegislation, ...monitoring.implementationMilestones].filter(i => i.status === 'delayed').length}
                  </div>
                  <div className="text-sm text-slate-400">Delayed</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {renderNavButtons()}
      </>
    );
  };

  const renderAssessmentTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
              <span>🎯</span> Impact Assessment
            </h3>
            <p className="text-slate-300 text-sm mt-1">
              Evaluate whether {context.legislationTitle || 'the legislation'} achieved its intended objectives.
            </p>
          </div>
          <button
            onClick={() => generateAISuggestions('assessment')}
            disabled={isGenerating}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⏳</span> Generating...
              </>
            ) : (
              <>
                <span>✨</span> Get AI Suggestions
              </>
            )}
          </button>
        </div>

        {aiSuggestions.assessment && (
          <div className="bg-slate-900/50 rounded-lg p-4 mb-6 border border-amber-600/30">
            <h4 className="text-amber-400 font-medium mb-2">{aiSuggestions.assessment.title}</h4>
            <div className="text-slate-300 text-sm whitespace-pre-line mb-4">
              {aiSuggestions.assessment.content}
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <h5 className="text-emerald-400 text-sm font-medium mb-2">💡 Tips:</h5>
              <ul className="text-slate-300 text-sm space-y-1">
                {aiSuggestions.assessment.tips.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Intended Outcomes Assessment
            </label>
            <p className="text-slate-400 text-xs mb-2">
              Based on the objectives stated when the law was passed, what has actually happened?
            </p>
            <textarea
              value={assessment.intendedOutcomes}
              onChange={(e) => setAssessment({ ...assessment, intendedOutcomes: e.target.value })}
              placeholder="For each objective, assess:&#10;- Was it achieved? Partially? Not at all?&#10;- What evidence supports this assessment?&#10;- What factors contributed to success or failure?"
              rows={5}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Unintended Consequences
            </label>
            <p className="text-slate-400 text-xs mb-2">
              What effects (positive or negative) occurred that weren't anticipated?
            </p>
            <textarea
              value={assessment.unintendedConsequences}
              onChange={(e) => setAssessment({ ...assessment, unintendedConsequences: e.target.value })}
              placeholder="Document any:&#10;- Unexpected benefits&#10;- Unexpected harms or burdens&#10;- Loopholes or workarounds that emerged&#10;- Groups affected who weren't considered"
              rows={4}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Overall Effectiveness Rating
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="5"
                value={assessment.effectivenessRating}
                onChange={(e) => setAssessment({ ...assessment, effectivenessRating: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center min-w-24">
                <div className={`text-2xl font-bold ${assessment.effectivenessRating >= 4 ? 'text-emerald-400' :
                  assessment.effectivenessRating >= 3 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                  {assessment.effectivenessRating}/5
                </div>
                <div className="text-xs text-slate-400">
                  {assessment.effectivenessRating === 1 && 'Not Effective'}
                  {assessment.effectivenessRating === 2 && 'Marginally Effective'}
                  {assessment.effectivenessRating === 3 && 'Moderately Effective'}
                  {assessment.effectivenessRating === 4 && 'Largely Effective'}
                  {assessment.effectivenessRating === 5 && 'Highly Effective'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Recommendations
            </label>
            <p className="text-slate-400 text-xs mb-2">
              Based on your assessment, what changes would you recommend?
            </p>
            <textarea
              value={assessment.recommendations}
              onChange={(e) => setAssessment({ ...assessment, recommendations: e.target.value })}
              placeholder="Consider:&#10;- Amendments to the primary legislation&#10;- Changes to secondary legislation/regulations&#10;- Improved implementation guidance&#10;- Additional resources needed&#10;- Repeal or sunset provisions"
              rows={5}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Evidence Sources Used
            </label>
            <textarea
              value={assessment.evidenceSources.join('\n')}
              onChange={(e) => setAssessment({ ...assessment, evidenceSources: e.target.value.split('\n').filter(s => s.trim()) })}
              placeholder="List sources that informed this assessment (one per line):&#10;e.g., Agency annual report 2025&#10;Audit office review&#10;Stakeholder consultation responses&#10;Academic study by [Author]"
              rows={4}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>
      </div>

      {renderNavButtons()}
    </div>
  );

  // Send message to chatbot
  const sendChatMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message to chat
    const userMessage = { role: 'user', content: message };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const apiBase = import.meta.env.DEV ? 'http://localhost:3001' : '';
      const response = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          documentText: chatDocumentText,
          context: context // Pass legislation context
        }),
      });

      const data = await response.json();

      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Sorry, I encountered an error. Please try again.' }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Unable to connect to the assistant. Please check if the server is running.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle chat file upload
  const handleChatFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await extractTextFromDocument(file);
      setChatDocumentText(text);

      // Auto-send a message about the uploaded document
      const uploadMessage = `I've uploaded a legislative document: "${file.name}" (${text.length.toLocaleString()} characters). Please perform an X-Ray Scan of this legislation.`;
      sendChatMessage(uploadMessage);
    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error reading the file: ${error.message}. Please try a different format (PDF, DOCX, or TXT).`
      }]);
    }
  };

  const renderChatbotTab = () => (
    <div className="flex flex-col h-[calc(100vh-220px)] bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="bg-[#1e1b4b] text-white p-4 flex items-center gap-3">
        <div className="text-3xl">🤖</div>
        <div>
          <h3 className="font-semibold">PLS Assistant</h3>
          <p className="text-purple-200 text-sm">Expert guidance using WFD methodology</p>
        </div>
        {chatDocumentText && (
          <div className="ml-auto bg-purple-700/50 px-3 py-1 rounded-full text-sm">
            📄 Document loaded ({chatDocumentText.length.toLocaleString()} chars)
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-4 ${msg.role === 'user'
              ? 'bg-[#5f259f] text-white'
              : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
              }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 text-[#5f259f] font-medium text-sm">
                  <span>🤖</span> PLS Assistant
                </div>
              )}
              <div className="prose prose-sm max-w-none">
                {msg.content.split('\n').map((line, i) => {
                  // Simple markdown-like rendering
                  let rendered = line;
                  // Bold
                  rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                  // Italic
                  rendered = rendered.replace(/\*(.*?)\*/g, '<em>$1</em>');
                  return <p key={i} className={`${msg.role === 'user' ? 'text-white' : 'text-gray-700'} mb-1`} dangerouslySetInnerHTML={{ __html: rendered || '&nbsp;' }} />;
                })}
              </div>
            </div>
          </div>
        ))}

        {isChatLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#5f259f]">
                <div className="animate-spin">⚙️</div>
                <span className="text-sm">PLS Assistant is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-3">
          {/* Document Upload */}
          <label className="flex items-center justify-center w-12 h-12 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors" title="Upload legislation">
            <span className="text-xl">📎</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleChatFileUpload}
              className="hidden"
            />
          </label>

          {/* Message Input */}
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage(chatInput)}
            placeholder="Ask about PLS methodology, upload legislation, or request a guided analysis..."
            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#5f259f] focus:ring-2 focus:ring-[#5f259f]/20 transition-all"
            disabled={isChatLoading}
          />

          {/* Send Button */}
          <button
            onClick={() => sendChatMessage(chatInput)}
            disabled={isChatLoading || !chatInput.trim()}
            className="px-6 py-3 bg-[#5f259f] hover:bg-[#4c1d7f] disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
          >
            Send
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => sendChatMessage("What are the key steps of Post-Legislative Scrutiny?")}
            className="text-xs bg-purple-50 text-[#5f259f] px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
          >
            What is PLS?
          </button>
          <button
            onClick={() => sendChatMessage("Help me select the right scrutiny lens for my legislation.")}
            className="text-xs bg-purple-50 text-[#5f259f] px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
          >
            Select a Scrutiny Lens
          </button>
          <button
            onClick={() => sendChatMessage("How do I draft Terms of Reference for a PLS inquiry?")}
            className="text-xs bg-purple-50 text-[#5f259f] px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
          >
            Draft Terms of Reference
          </button>
          <button
            onClick={() => sendChatMessage("What questions should I ask witnesses during a PLS hearing?")}
            className="text-xs bg-purple-50 text-[#5f259f] px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
          >
            Hearing Questions
          </button>
        </div>
      </div>
    </div>
  );

  const renderExportTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
        <h3 className="text-xl font-semibold text-amber-400 mb-4 flex items-center gap-2">
          <span>📄</span> Generate PLS Report
        </h3>
        <p className="text-slate-300 mb-6">
          Compile your work into a structured Post-Legislative Scrutiny report that can be shared with your committee.
        </p>

        <button
          onClick={generateReport}
          className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-medium transition-all text-lg"
        >
          📋 Generate Report Preview
        </button>
      </div>

      {exportReady && (
        <div className="bg-white text-slate-900 rounded-xl p-8 shadow-xl">
          <div className="border-b-2 border-slate-200 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Post-Legislative Scrutiny Report</h1>
            <h2 className="text-xl text-slate-700 mt-1">{context.legislationTitle || '[Legislation Title]'}</h2>
            <p className="text-slate-500 mt-2">
              {context.country} • {context.jurisdiction === 'national' ? 'National Parliament' : context.jurisdiction} • {context.legislationYear && `Enacted ${context.legislationYear}`}
            </p>
          </div>

          <div className="space-y-6 text-sm">
            <section>
              <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">1. Background & Objectives</h3>
              <p className="text-slate-700 whitespace-pre-line">{context.legislationSummary || 'No summary provided.'}</p>
              {context.primaryObjectives && (
                <div className="mt-3">
                  <strong className="text-slate-800">Primary Objectives:</strong>
                  <p className="text-slate-700 whitespace-pre-line">{context.primaryObjectives}</p>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">2. Stakeholders Consulted</h3>
              {stakeholders.length > 0 ? (
                <ul className="list-disc list-inside text-slate-700 space-y-1">
                  {stakeholders.map(s => (
                    <li key={s.id}><strong>{s.name}</strong> ({s.type}) - {s.notes || 'No notes'}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 italic">No stakeholders identified.</p>
              )}
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">3. Consultation Approach</h3>
              {consultation.methods.length > 0 ? (
                <>
                  <p className="text-slate-700">
                    <strong>Methods used:</strong> {consultation.methods.map(m => consultationMethods.find(cm => cm.id === m)?.label).join(', ')}
                  </p>
                  {consultation.keyQuestions && (
                    <div className="mt-2">
                      <strong className="text-slate-800">Key Questions:</strong>
                      <p className="text-slate-700 whitespace-pre-line">{consultation.keyQuestions}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500 italic">No consultation methods specified.</p>
              )}
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">4. Implementation Status</h3>
              {monitoring.secondaryLegislation.length > 0 && (
                <div className="mb-3">
                  <strong className="text-slate-800">Secondary Legislation:</strong>
                  <ul className="list-disc list-inside text-slate-700">
                    {monitoring.secondaryLegislation.map(item => (
                      <li key={item.id}>{item.text} - <span className={
                        item.status === 'completed' ? 'text-emerald-600' :
                          item.status === 'delayed' ? 'text-red-600' :
                            item.status === 'inprogress' ? 'text-amber-600' :
                              'text-slate-500'
                      }>{item.status}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {monitoring.implementationMilestones.length > 0 && (
                <div className="mb-3">
                  <strong className="text-slate-800">Implementation Milestones:</strong>
                  <ul className="list-disc list-inside text-slate-700">
                    {monitoring.implementationMilestones.map(item => (
                      <li key={item.id}>{item.text} - <span className={
                        item.status === 'completed' ? 'text-emerald-600' :
                          item.status === 'delayed' ? 'text-red-600' :
                            item.status === 'inprogress' ? 'text-amber-600' :
                              'text-slate-500'
                      }>{item.status}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {monitoring.reviewClauses && (
                <div>
                  <strong className="text-slate-800">Review Clauses:</strong>
                  <p className="text-slate-700">{monitoring.reviewClauses}</p>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">5. Impact Assessment</h3>
              <div className="mb-3">
                <strong className="text-slate-800">Effectiveness Rating:</strong>
                <span className={`ml-2 font-bold ${assessment.effectivenessRating >= 4 ? 'text-emerald-600' :
                  assessment.effectivenessRating >= 3 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                  {assessment.effectivenessRating}/5
                </span>
              </div>
              {assessment.intendedOutcomes && (
                <div className="mb-3">
                  <strong className="text-slate-800">Intended Outcomes:</strong>
                  <p className="text-slate-700 whitespace-pre-line">{assessment.intendedOutcomes}</p>
                </div>
              )}
              {assessment.unintendedConsequences && (
                <div className="mb-3">
                  <strong className="text-slate-800">Unintended Consequences:</strong>
                  <p className="text-slate-700 whitespace-pre-line">{assessment.unintendedConsequences}</p>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">6. Recommendations</h3>
              {assessment.recommendations ? (
                <p className="text-slate-700 whitespace-pre-line">{assessment.recommendations}</p>
              ) : (
                <p className="text-slate-500 italic">No recommendations provided.</p>
              )}
            </section>

            {assessment.evidenceSources.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-1 mb-2">7. Evidence Sources</h3>
                <ul className="list-disc list-inside text-slate-700">
                  {assessment.evidenceSources.map((source, i) => (
                    <li key={i}>{source}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-slate-500 text-xs">
            Generated by PLS Command Center • {new Date().toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header - WFD Style Purple */}
      <header className="bg-[#1e1b4b] relative overflow-hidden">
        {/* Decorative dot pattern */}
        <div className="absolute right-0 top-0 w-64 h-full opacity-30">
          <div className="absolute right-0 top-0" style={{
            background: 'radial-gradient(circle, #f97316 2px, transparent 2px)',
            backgroundSize: '12px 12px',
            width: '200px',
            height: '200px',
            transform: 'translate(20%, -20%)'
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-3xl">🏛️</span>
                PLS Command Center
              </h1>
              <p className="text-purple-200 text-sm mt-1">
                Legislative Scrutiny Sandbox • Interactive Workshop Tool
              </p>
            </div>
            {context.legislationTitle && (
              <div className="text-right hidden md:block">
                <p className="text-white font-medium">{context.legislationTitle}</p>
                <p className="text-purple-200 text-sm">{context.country} {context.legislationYear && `• ${context.legislationYear}`}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Navigation - Five Main Tabs */}
      <nav className="bg-[#5f259f] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setMainTab('assistant')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all ${mainTab === 'assistant'
                ? 'bg-white text-[#5f259f]'
                : 'text-white hover:bg-[#4c1d7f]'
                }`}
            >
              <span>🤖</span> PLS Assistant
            </button>
            <button
              onClick={() => setMainTab('tool')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all ${mainTab === 'tool'
                ? 'bg-white text-[#5f259f]'
                : 'text-white hover:bg-[#4c1d7f]'
                }`}
            >
              <span>🛠️</span> PLS Tool
            </button>
            <button
              onClick={() => setMainTab('resources')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all ${mainTab === 'resources'
                ? 'bg-white text-[#5f259f]'
                : 'text-white hover:bg-[#4c1d7f]'
                }`}
            >
              <span>📚</span> Resources
            </button>
            <button
              onClick={() => setMainTab('about')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all ${mainTab === 'about'
                ? 'bg-white text-[#5f259f]'
                : 'text-white hover:bg-[#4c1d7f]'
                }`}
            >
              <span>ℹ️</span> About
            </button>
            <button
              onClick={() => setMainTab('data')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-all ${mainTab === 'data'
                ? 'bg-white text-[#5f259f]'
                : 'text-white hover:bg-[#4c1d7f]'
                }`}
            >
              <span>🔒</span> Data Use
            </button>
          </div>
        </div>
      </nav>

      {/* Sub-Navigation for PLS Tool */}
      {mainTab === 'tool' && (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex overflow-x-auto">
              {toolTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${activeTab === tab.id
                    ? 'border-[#5f259f] text-[#5f259f]'
                    : 'border-transparent text-gray-600 hover:text-[#5f259f] hover:border-gray-300'
                    }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {/* PLS Assistant */}
        {mainTab === 'assistant' && renderChatbotTab()}

        {/* PLS Tool Sub-tabs */}
        {mainTab === 'tool' && (
          <>
            {activeTab === 'setup' && renderSetupTab()}
            {activeTab === 'stakeholders' && renderStakeholdersTab()}
            {activeTab === 'consultation' && renderConsultationTab()}
            {activeTab === 'monitoring' && renderMonitoringTab()}
            {activeTab === 'assessment' && renderAssessmentTab()}
            {activeTab === 'export' && renderExportTab()}
          </>
        )}

        {/* Resources */}
        {mainTab === 'resources' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-2xl font-bold text-[#1e1b4b] mb-2">📚 WFD Post-Legislative Scrutiny Resources</h2>
              <p className="text-gray-600 mb-6">
                Access the core Westminster Foundation for Democracy documents that guide the PLS methodology used in this tool.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Core Manual */}
                <a href="https://www.wfd.org/what-we-do/resources/parliamentary-innovation-through-post-legislative-scrutiny"
                  target="_blank" rel="noopener noreferrer"
                  className="block p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📖</span>
                    <div>
                      <h3 className="font-semibold text-[#5f259f]">The 2023 PLS Manual</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        "Parliamentary innovation through post-legislative scrutiny: A new manual for parliaments" - The core methodology guide.
                      </p>
                      <span className="text-xs text-[#5f259f] mt-2 inline-block">→ View Resource</span>
                    </div>
                  </div>
                </a>

                {/* Gender Guide */}
                <a href="https://www.wfd.org/what-we-do/resources/gender-sensitive-post-legislative-scrutiny"
                  target="_blank" rel="noopener noreferrer"
                  className="block p-4 bg-pink-50 rounded-lg border border-pink-200 hover:bg-pink-100 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👩‍⚖️</span>
                    <div>
                      <h3 className="font-semibold text-pink-700">Gender-Sensitive PLS</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Policy paper on conducting gender-sensitive post-legislative scrutiny (2020).
                      </p>
                      <span className="text-xs text-pink-700 mt-2 inline-block">→ View Resource</span>
                    </div>
                  </div>
                </a>

                {/* Climate Guide */}
                <a href="https://www.wfd.org/what-we-do/resources/post-legislative-scrutiny-climate-and-environment-legislation"
                  target="_blank" rel="noopener noreferrer"
                  className="block p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🌍</span>
                    <div>
                      <h3 className="font-semibold text-green-700">Climate & Environment PLS</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Guide for parliamentary practice on climate and environment legislation (2021).
                      </p>
                      <span className="text-xs text-green-700 mt-2 inline-block">→ View Resource</span>
                    </div>
                  </div>
                </a>

                {/* CSO Guide */}
                <a href="https://www.wfd.org/what-we-do/resources/post-legislative-scrutiny-model-parliamentarians-cso-strategic-tool"
                  target="_blank" rel="noopener noreferrer"
                  className="block p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🤝</span>
                    <div>
                      <h3 className="font-semibold text-blue-700">CSO Strategic Tool</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        PLS as a strategic and operational tool for Civil Society Organizations (2021).
                      </p>
                      <span className="text-xs text-blue-700 mt-2 inline-block">→ View Resource</span>
                    </div>
                  </div>
                </a>

                {/* Principles */}
                <a href="https://www.wfd.org/what-we-do/resources/principles-post-legislative-scrutiny-parliaments"
                  target="_blank" rel="noopener noreferrer"
                  className="block p-4 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚖️</span>
                    <div>
                      <h3 className="font-semibold text-amber-700">Principles of PLS</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Core principles for parliaments undertaking post-legislative scrutiny.
                      </p>
                      <span className="text-xs text-amber-700 mt-2 inline-block">→ View Resource</span>
                    </div>
                  </div>
                </a>

                {/* All Resources */}
                <a href="https://www.wfd.org/what-we-do/resources?topic=349"
                  target="_blank" rel="noopener noreferrer"
                  className="block p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📚</span>
                    <div>
                      <h3 className="font-semibold text-gray-700">All WFD PLS Resources</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Browse the complete collection of WFD post-legislative scrutiny publications.
                      </p>
                      <span className="text-xs text-gray-700 mt-2 inline-block">→ View All Resources</span>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* About Page */}
        {mainTab === 'about' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-[#1e1b4b] mb-4">About This Sandbox</h2>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h3 className="font-semibold text-amber-800">Experimental Tool</h3>
                      <p className="text-amber-700 text-sm mt-1">
                        This is an experimental educational tool developed for training purposes.
                        It is <strong>not intended for official use</strong> in parliamentary proceedings or formal legislative scrutiny activities.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="prose prose-purple max-w-none">
                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">Course Context</h3>
                  <p className="text-gray-700 mb-4">
                    This PLS Command Center sandbox was developed for use in the
                    <a href="https://www.wfd.org/certified-course-legislative-scrutiny-and-technology"
                      target="_blank" rel="noopener noreferrer"
                      className="text-[#5f259f] hover:underline font-medium ml-1">
                      Certified Course on Legislative Scrutiny and Technology
                    </a>.
                  </p>

                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">Organised By</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <a href="https://www.wfd.org" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <img src="https://www.wfd.org/themes/custom/bbd_classy/logo.svg" alt="WFD Logo" className="h-12 w-auto" />
                      <div>
                        <h4 className="font-semibold text-gray-800">Westminster Foundation for Democracy</h4>
                        <p className="text-xs text-gray-500">wfd.org</p>
                      </div>
                    </a>
                    <a href="https://ials.sas.ac.uk" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <img src="https://www.wfd.org/sites/default/files/styles/square_crop_440_440/public/2025-07/ials_logo.png?h=8a7fc05e&itok=Orv1y1xY" alt="IALS Logo" className="h-12 w-auto" />
                      <div>
                        <h4 className="font-semibold text-gray-800">Institute of Advanced Legal Studies</h4>
                        <p className="text-xs text-gray-500">University of London</p>
                      </div>
                    </a>
                  </div>

                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">In Partnership With</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <a href="https://www.politicaltechsummit.com" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">🗳️</div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Political Tech Summit</h4>
                        <p className="text-xs text-gray-500">politicaltechsummit.com</p>
                      </div>
                    </a>
                    <a href="https://popvox.org" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <img src="https://www.wfd.org/sites/default/files/styles/square_crop_440_440/public/2025-11/popvox.png?h=8a7fc05e&itok=sKzVAoGu" alt="POPVOX Logo" className="h-12 w-auto" />
                      <div>
                        <h4 className="font-semibold text-gray-800">POPVOX Foundation</h4>
                        <p className="text-xs text-gray-500">popvox.org</p>
                      </div>
                    </a>
                  </div>

                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">Purpose</h3>
                  <p className="text-gray-700 mb-4">
                    This tool is designed to help course participants learn and practice the methodology
                    of Post-Legislative Scrutiny (PLS) as developed by the Westminster Foundation for Democracy.
                    It provides an interactive environment to:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                    <li>Explore the 11 steps of the PLS process</li>
                    <li>Practice stakeholder mapping and consultation design</li>
                    <li>Use AI assistance to analyze legislation</li>
                    <li>Generate draft PLS reports and Terms of Reference</li>
                  </ul>

                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">Methodology</h3>
                  <p className="text-gray-700">
                    The tool is grounded in the WFD's published guidance materials, particularly the
                    "Parliamentary innovation through post-legislative scrutiny: A new manual for parliaments" (2023).
                    Please refer to the Resources tab for access to all relevant WFD publications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Use Page */}
        {mainTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-[#1e1b4b] mb-4">🔒 Data Use & Privacy</h2>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                      <h3 className="font-semibold text-blue-800">Summary</h3>
                      <p className="text-blue-700 text-sm mt-1">
                        Your data is processed locally and through the Anthropic API.
                        <strong> Anthropic does not use data submitted through its API to train models</strong> when using our configuration.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="prose prose-purple max-w-none">
                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">How Data is Stored</h3>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">🖥️ Local Browser Storage</h4>
                    <p className="text-gray-700 text-sm">
                      All form data you enter (legislation details, stakeholder information, consultation plans, etc.)
                      is stored <strong>locally in your browser's session</strong>. This data is not sent to any server
                      except when you actively use the PLS Assistant chat feature.
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">💬 Chat Conversations</h4>
                    <p className="text-gray-700 text-sm">
                      When you use the PLS Assistant, your messages and any uploaded documents are sent to the
                      Anthropic API for processing. Conversation history is stored only in your browser session
                      and is cleared when you close the browser or refresh the page.
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">📄 Uploaded Documents</h4>
                    <p className="text-gray-700 text-sm">
                      Documents you upload are processed locally in your browser to extract text.
                      The extracted text may be sent to Anthropic when using AI-powered features
                      (extraction or chat). Documents are not stored on any server.
                    </p>
                  </div>

                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">Anthropic API Usage</h3>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-emerald-800 mb-2">✓ No Training on Your Data</h4>
                    <p className="text-emerald-700 text-sm">
                      We use Anthropic's API with settings that ensure <strong>your data is not used
                        to train Anthropic's models</strong>. According to Anthropic's
                      <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer"
                        className="underline">privacy policy</a>, API data is not used for model training
                      unless explicitly opted in.
                    </p>
                  </div>

                  <p className="text-gray-700 mb-4">When you interact with the PLS Assistant, the following data is sent to Anthropic:</p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                    <li>Your chat messages and conversation history</li>
                    <li>Uploaded document text (when relevant to the conversation)</li>
                    <li>Legislation context you've entered in the PLS Tool</li>
                  </ul>

                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">Data Retention</h3>
                  <table className="w-full text-sm border-collapse border border-gray-200 mb-4">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-200 px-4 py-2 text-left">Data Type</th>
                        <th className="border border-gray-200 px-4 py-2 text-left">Retention</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-200 px-4 py-2">Form data (PLS Tool)</td>
                        <td className="border border-gray-200 px-4 py-2">Browser session only</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-200 px-4 py-2">Chat history</td>
                        <td className="border border-gray-200 px-4 py-2">Browser session only</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-200 px-4 py-2">Uploaded documents</td>
                        <td className="border border-gray-200 px-4 py-2">Not stored (processed locally)</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-200 px-4 py-2">Anthropic API logs</td>
                        <td className="border border-gray-200 px-4 py-2">Per Anthropic's policy (30 days)</td>
                      </tr>
                    </tbody>
                  </table>

                  <h3 className="text-xl font-semibold text-[#5f259f] mt-6 mb-3">Recommendations</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <ul className="text-amber-800 text-sm space-y-2">
                      <li>⚠️ <strong>Do not upload sensitive or classified documents</strong></li>
                      <li>⚠️ This is an experimental tool - do not use for official parliamentary business</li>
                      <li>⚠️ Clear your browser data after use if working on a shared computer</li>
                      <li>⚠️ Avoid entering personally identifiable information (PII)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer - WFD Style */}
      <footer className="bg-[#1e1b4b] mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-purple-200 text-sm text-center">
            PLS Command Center • Built for WFD Legislative Scrutiny & Technology Course •
            <span className="text-white ml-1">Methodology based on WFD's 11 Steps to Post-Legislative Scrutiny</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PLSCommandCenter;
