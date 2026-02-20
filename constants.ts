import { SnapshotInputs } from './types';

export const COMPANY_LIST = [
  "Nutrien Ltd",
  "The Mosaic Company",
  "CF Industries Holdings",
  "Yara International ASA",
  "K+S Aktiengesellschaft",
  "ICL Group Ltd",
  "Dyno Nobel",
  "Corteva",
  "FMC Corporation",
  "Archer-Daniels-Midland Company",
  "Bunge Global SA",
  "Ingredion Incorporated",
  "Deere & Company",
  "AGCO Corporation"
];

export const QUARTER_OPTIONS = ["Q1", "Q2", "Q3", "Q4"];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth(); // 0-11
const currentQ = Math.floor(currentMonth / 3) + 1; // 1-4

// Generate a range: 10 years back to Current Year (No future years)
export const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => (currentYear - 10 + i).toString()).reverse();

export const INITIAL_INPUTS: SnapshotInputs = {
  quarter: `Q${currentQ} ${currentYear}`,
  company: COMPANY_LIST[0],
  preparedDate: today.toLocaleDateString('en-GB'), // Default to DD/MM/YYYY formatish
  files: [],
  transcriptFiles: []
};

export const getGenerationPrompt = (inputs: SnapshotInputs): string => {
  // Calculate the Next Quarter for Forward Guidance logic
  const [qStr, yStr] = inputs.quarter.split(' ');
  const yearInt = parseInt(yStr) || currentYear;
  let nextQ = '';
  let nextY = yearInt;

  if (qStr === 'Q1') nextQ = 'Q2';
  else if (qStr === 'Q2') nextQ = 'Q3';
  else if (qStr === 'Q3') nextQ = 'Q4';
  else { nextQ = 'Q1'; nextY = yearInt + 1; }
  
  const forwardQuarter = `${nextQ} ${nextY}`;

  const hasMetrics = !!inputs.metricsContext;
  const hasConsensus = !!inputs.consensusContext;

  const consensusInstruction = hasConsensus
    ? `
**CONSENSUS ESTIMATES TABLE**
Immediately following the Section D narrative, include a subsection titled "### Consensus Estimates".

**CONSENSUS DATA (Source: Capital IQ):**
${inputs.consensusContext}

**INSTRUCTIONS:**
- Create a Markdown table reproducing the provided consensus data EXACTLY.
- **Columns**: Use the column headers exactly as found in the first row of the data.
- **Rows**: Include ALL rows found in the data. Do NOT filter, rename, or reorder any rows.
- **Values**: Copy every number and text value exactly as provided. Do NOT round.
- **Citation**: Include "**Source: Capital IQ**" immediately below the table.
`
    : '';

  const metricsInstruction = hasMetrics
    ? `
5.7 SECTION E: HISTORICAL RESULTS & KEY METRICS
Include a section titled "## Section E: Historical Results & Key Metrics".

**QUARTERLY METRICS DATA (Source: Capital IQ):**
${inputs.metricsContext}

**INSTRUCTIONS:**
- Create a Markdown table reproducing the provided Quarterly Metrics data EXACTLY.
- **Columns**: Use the column headers exactly as found in the first row of the data.
- **Rows**: Include ALL rows found in the data. Do NOT filter, rename, or reorder any rows.
- **Values**: Copy every number and text value exactly as provided. Do NOT round.
- **Formatting**:
  - If a cell in the first column (Category) is blank or identical to the row above, you may leave it blank in the Markdown table to reduce visual clutter, but do NOT omit the row.
- **Citation**: Include "**Source: Capital IQ**" immediately below the table.
` 
    : `
5.7 SECTION E: HISTORICAL RESULTS & KEY METRICS
(Omit this section as no Quarterly Metrics File was provided).
`;

  return `
MASTER INSTRUCTION: EXECUTIVE QUARTERLY SNAPSHOT
Word Limit: Target 750 words (±15 words) (Sections A–D combined; sources excluded).
________________________________________
1. ROLE & OBJECTIVE
Produce an executive-ready Quarterly Snapshot for a designated public company, strictly following:
• The Word Document Structure below (header, Sections A–D, sources).
• A STRICT word count target: 735–765 words for Sections A–D combined. Use the full budget to provide maximum depth.
• Zero synthetic data: every numeric figure must be traceable to a disclosed source or clearly labeled consensus.
Tone must be executive, neutral, fact-based, with no speculation or financial advice.
________________________________________
2. USER INPUTS (REQUIRED FIELDS)
The user will provide at minimum:
• Designated Quarter: [${inputs.quarter}]
• Designated Company: [${inputs.company}]
• Prepared Date: [${inputs.preparedDate}]
• Earnings Release Date: [RESEARCH REQUIRED] - You MUST research the official earnings release date and conference call date for ${inputs.quarter} ${inputs.company}.
• Next Quarter (Target for Forward View): [${forwardQuarter}]

Use these inputs to populate the header, footer, and relevant narrative.
________________________________________
3. SCOPE & DATA HIERARCHY & SEARCH PROTOCOL
**CRITICAL INSTRUCTION:**
1. **METRICS DATA (SECTION E)**: The Metrics Files (sourced from Capital IQ) are the **PRIMARY SOURCE OF TRUTH** for any financial figure (Revenue, EBITDA, Volumes, Share Price, etc.) mentioned anywhere in the snapshot.
2. **COMMENTARY SYNTHESIS (TRANSCRIPT + ANALYST REPORTS)**: 
   - You MUST utilize BOTH the **Earnings Transcript** and the provided **Analyst Reports** to generate commentary, drivers, and forward views.
   - **DOUBLE CHECK FOR CONTRADICTIONS**: 
     - Compare Management's view (Transcript) with Analyst views (Reports).
     - If they align, synthesize them (e.g., "Management and analysts alike highlight robust demand...").
     - If they **contradict**, you MUST highlight the divergence (e.g., "While management expects recovery[C1], analysts warn of continued margin pressure[C2].").
   - Do not rely solely on the transcript.

3. **MANDATORY SEARCH EXTENSION**: You **MUST** use Google Search to retrieve:
   - The official Earnings Press Release, 8-K, and Investor Presentation from the company website.
   - Financial data if the attached docs are qualitative.
   - **DO NOT** rely solely on the attached documents if they are insufficient. Combine the attached insights with fresh search data.

Source Priority (Use in this order)
1. **Metrics Files** (Quarterly & Consensus Data) - PRIMARY for all numeric data.
2. **Earnings Transcript** AND **Analyst Reports** - Combined source for commentary and qualitative insights.
3. Company Website/Press Release/Form 8-K (Verified backup for numbers).
4. Earnings call transcript (Online if not attached)
5. 10-Q / 10-K (audited supersedes preliminary)
________________________________________
4. ACCURACY STANDARDS & VARIANCE HANDLING
Variance between sources Action
<1% Accept
1–2.5% Accept; cite best source (Metrics File takes precedence).
2.5–5% Flag; cite both sources + variance %
>5% Investigate discrepancy (revisions, basis changes)
• YoY/QoQ %: If the model’s calculation differs from the company’s by >1%, use the company’s stated percentage and cite it.
• Missing Data: Write "Not disclosed" instead of inferring.
• No synthetic data: No invented numbers, no back-of-envelope estimates.
• Currency: Default to USD; when foreign is material, show both:
EUR 2.1B [USD 2.3B, 1.10 rate].
• Dates: Always DD, MM, YYYY (e.g., 24, 02, 2026).
• **TEMPORAL LABELING (MANDATORY)**:
  - **Absolute Numbers**: You MUST specify the period AND 2-digit year for every single metric.
    - BAD: "Revenue of $500M", "Q3 Revenue", "YTD EBITDA"
    - GOOD: "Q3 '24 Revenue of $500M", "YTD '24 Revenue of $1.5B", "LTM '24 Free Cash Flow".
    - **Format Rule**: Use the format [Period] '[YY] (e.g., Q3 '24, Q4 '23, YTD '24, FY '24). Note the space and apostrophe.
  - **Comparisons**: You MUST specify the comparison basis.
    - BAD: "Volumes increased 5%"
    - GOOD: "Volumes increased 5% YoY" or "Volumes increased 5% vs Q2 '24".
• **ENTITY TAGGING (MANDATORY)**:
  - **Consolidated / Total Company**: You MUST use the prefix **"Cons."** for any metric referring to the total entity.
    - Example: "Cons. Adj. EBITDA", "Cons. Revenue".
  - **Business Unit / Segment**: You MUST use a **3-letter uppercase abbreviation** for any segment-specific metric.
    - **Mandatory List**: Potash -> **POT**, Phosphate -> **PHO**, Nitrogen -> **NIT**, Retail -> **RET**.
    - **Other Segments**: Use your insight to create a logical 3-letter abbreviation for any segment not listed above (e.g., Ag Services -> AGS).
    - Format: "[TAG] [Metric]" (e.g. "POT Volumes", "NIT Gross Margin", "Cons. EPS").
• **DELTA CONTEXT (MANDATORY)**:
  - When stating a numeric difference (e.g. "up $10M", "down 5Mt"), you MUST explicitly state the prior period's absolute value.
    - BAD: "Adj. EBITDA increased $50M YoY."
    - GOOD: "Adj. EBITDA increased $50M YoY (vs Q3 '24 of $450M)."
• **VARIANCE INVESTIGATION (MANDATORY)**:
  - If a variance is >$25M or >10%, you MUST provide a specific reason/driver (e.g., "driven by higher volumes", "offset by FX headwinds").
  - Do NOT just state the variance without explanation.
________________________________________
5. DOCUMENT LAYOUT (EXACT OUTPUT STRUCTURE)
Format output so it can be pasted directly into Microsoft Word.

5.1 HEADER (Centered, Heading 1 Style)
Use Markdown Heading 1 (#) for the main title:
text
# [COMPANY NAME] – Quarterly Snapshot, [QUARTER] [YEAR]

Prepared [DD, MM, YYYY] | Earnings Released [RESEARCHED DATE DD, MM, YYYY] |
Conference Call [RESEARCHED DATE DD, MM, YYYY]
________________________________________
5.2 SECTION A: TOP TAKEAWAYS (MARKDOWN TABLE — EXACTLY 4 ROWS)
text
## Section A: Top Takeaways
Strictly use Markdown Table syntax:
| Category | Key Takeaway & Impact |
| :--- | :--- |
| Financial & Operational Performance | Revenue, volumes, prices, margins, costs, free cash flow. Include YoY/QoQ %. Citations [V#]. ~40–50 words. |
| Strategic Action & Capital Allocation | M&A, divestiture, capacity change, restructuring, capex deployment. Include size/value if disclosed. Citations [V#]. ~40–50 words. |
| Guidance & Outlook | Distill key guidance (Revenue, EBITDA, Volumes) and forward outlook. Must align with Section D. Citations [V#]. ~40–50 words. |
| Safety, Financial, & Forward Risks | Safety incidents or regulatory findings; financial risks (commodity, FX, credit); forward outlook and assumptions attributed to management. Citations [V#]. ~40–50 words. |

Requirements:
• Exactly 4 rows in the body (plus header).
• Each row must contain ≥1 numeric figure with a [V#] citation.
• **Every number must include its temporal label with year (e.g., Q3 '24, YTD '24, FY '23)**.
• **Every number must include its entity tag (Cons. or 3-letter Code)**.
• **CITATIONS**: See Section 5.9 for strictly split citation rules (Values vs Commentary). Use **[V#]** for values and **[C#]** for commentary.
________________________________________
5.3 SECTION B: OPERATIONS HIGHLIGHTS (PROSE — 3 SUBSECTIONS)
text
## Section B: Operations Highlights
Choose the top 3 business lines or geographies (e.g., Potash, Phosphate, Nitrogen).
For each subsection (~75 words, total Section B ~230 words):
• Subsection heading format:
### [Business Line – e.g., Potash Segment]
• Include:
o YoY & QoQ changes for volumes, realized prices, and margins with citations.
o Clear drivers (input costs, FX, inventory, demand, outages, mix) - **Integrate Analyst Views here**.
o Unit economics where possible (e.g., margin per tonne, bps change).
o **Strictly label every number** with its period and year (e.g. Q3 '24, YTD '24), comparison (YoY, QoQ), AND Entity Tag (e.g. POT, Cons.).
o Short forward view attributed to management OR analysts:
 e.g., "Management expects stability[C10], though Analysts cite potential downside risk[C11]."
Tone: concise, executive, no filler.
________________________________________
5.4 SECTION C: MATERIAL NEWS & EVENTS (220–250 WORDS)
text
## Section C: Material News & Events
Include 4–7 events (range 1–8 acceptable), each in this format:
text
**Event:** [Headline] (DD, MM, YYYY)
**Description:** [1–2 sentences: What happened (high-level) AND WHY (strategic rationale/driver).]
**Implication:** [One concise sentence (operational, financial, or safety).]
**Impact:** [Geography/asset/safety/financial; size/value if disclosed (else "Not disclosed").]

CRITICAL FORMATTING FOR SECTION C:
- Use the exact bold labels: "**Event:**", "**Description:**", "**Implication:**", "**Impact:**".
- Each label must start on a new line.
- Do NOT combine lines.

Include only if:
• M&A / divestitures (≥50% of segment revenue or strategic significance)
• Production/capacity changes (≥10% impact to segment)
• Regulatory/compliance actions, material safety incidents, environmental fines
• Major long-term contracts/offtakes (≥3 years and ≥10% revenue impact)
• Restructuring, workforce reductions ≥10% of a segment
• Major shareholder actions (ONLY extraordinary buybacks or special dividends; EXCLUDE regular quarterly dividends)
• Material one-time financial items (impairments, restatements, major charges)
Exclude: **ALL QUARTERLY DIVIDEND DECLARATIONS**, routine dividends, awards, minor announcements, analyst ratings, competitor actions, stock price moves.
________________________________________
5.5 SECTION D: FORWARD VIEW (NARRATIVE ONLY)
text
## Section D: Forward View

(100–130 words)
• Focus on outlook for **${forwardQuarter}**.
• What changed vs. prior guidance (and why, if disclosed).
• Management expectations for the next quarter (${forwardQuarter}) and near-term outlook, explicitly attributed (e.g., "Management guides…", "Management expects…")
• Key assumptions (pricing, volumes, costs, FX, regulatory/safety) underpinning guidance.
• Key risks, explicitly attributed to management or sourced (e.g., "Management cites soft phosphate demand as a risk[C20].")
• **Label all guidance figures** with the period they apply to (e.g., "Q4 '24 Cons. EBITDA guidance") and Entity Tag.
• Label any analyst consensus figures as [Consensus: X] or [Analyst Range: X–Y] and cite separately.

${consensusInstruction}
________________________________________
${metricsInstruction}
________________________________________
5.8 SECTION F: FULL LIST OF MATERIAL NEWS EVENTS (${yStr})
Include a section titled "## Section F: Full List of Material News Events (${yStr})".

**Objective**: A **fulsome and comprehensive** year-long log of material activity.
**Scope**: All material events from **Jan 1, ${yStr}** to the Prepared Date.
**Content**: Full synopsis of material events over the year.
**Requirement**:
- **EXTENSIVE SEARCH**: You MUST perform additional online research to ensure NO material event is missed. 
- **ALIGNMENT CHECK**: Ensure that **EVERY** event listed in Section C is also present in this list. Section C must be a strict subset of Section F.
- **DOUBLE CHECK**: Before finalizing, scan the entire year timeline (${yStr}) again. Have you missed any major M&A, shutdowns, regulatory fines, or strategic pivots? If so, add them.
**Format**:
**Event:** [Headline] ([DD, MM, YYYY])
(Repeat for each event on a new line)

**Selection Criteria (Identical to Section C)**:
Include ONLY:
• M&A / divestitures (≥50% of segment revenue or strategic significance)
• Production/capacity changes (≥10% impact to segment)
• Regulatory/compliance actions, material safety incidents, environmental fines
• Major long-term contracts/offtakes (≥3 years and ≥10% revenue impact)
• Restructuring, workforce reductions ≥10% of a segment
• Major shareholder actions (extraordinary buybacks/special dividends only)
• Material one-time financial items

**Strictly EXCLUDE**:
• Routine quarterly dividends (CRITICAL: Do not list these).
• Routine earnings call announcements or set-up dates.
• Analyst ratings or price target changes.
• Minor awards or CSR fluff.
________________________________________
5.9 SOURCES (MASTER LIST)

After Sections A–F, you must create a single, consolidated master list of all sources used.

### Master Source List
List all sources used for both numeric data (values) and qualitative statements (commentary).
Format:
1. [Source Title] – [DD, MM, YYYY] – [Location/URL] [Optional: Pg. X]
2. [Source Title] – [DD, MM, YYYY] – [Location/URL] [Optional: Pg. X]
...

**CITATION RULES (CRITICAL)**:
- **VALUES**: In the text (Sections A-D), cite numeric data using **[V#]** (e.g., "Revenue $5B[V1]").
- **COMMENTARY**: In the text, cite qualitative statements using **[C#]** (e.g., "Management sees headwinds[C1]").
- **INLINE SOURCE CITATION**: Wherever a value or commentary is sourced, place the superscripted source (E.g. [C1]) next to the commentary or value.
- **SEPARATE COUNTERS**: Maintain two separate counters (V1..VN and C1..CN) that refer to the single Master Source List.
- **DOUBLE CHECK**: Ensure every quote or risk has a [C#] citation, and every number has a [V#] citation.
- **Transcripts**: If citing a specific page from a transcript, include **[Pg. X]** at the end of the source entry in the Master Source List.
- **Sequential**: The Master Source List must be sequentially numbered (1, 2, 3...). The in-text citations [V#] and [C#] should also be sequential within their respective categories.

Do NOT add any metadata footer (e.g., Snapshot Date, Verification) after this section. This is the end of the document.
________________________________________
6. FORMATTING SPECIFICATIONS (FOR WORD)
• Font: Arial, 11pt regular.
• Headers: Bold; Heading 1 for main header, Heading 2 (14pt) for section titles.
• Tables: Use standard Markdown table syntax.
• Spacing: Single-spaced; ~0.5 line spacing between sections.
• Margins: 1-inch all sides.
• Citations: Use [V#] or [C#] inline.
• Dates: Always DD, MM, YYYY.
• No personal pronouns: Use "Company disclosed…", "Management noted…", never "I", "we", "our".
________________________________________
7. WORD COUNT BUDGET & COMPUTATIONAL VERIFICATION (MANDATORY)
Total Target: 750 words (±15) for Sections A–D only.
7.1 Budget Guidelines (Expand to fill budget)
• Section A: ~180 words total (4 rows × ~45 words).
• Section B: ~230 words total (3 subsections × ~75-80 words).
• Section C: ~240 words total (4–7 events, detailed impact and strategic rationale).
• Section D: ~100 words total.
Adjust section lengths to ensure the total falls between 735 and 765 words.
7.2 Word Count Method
1. Extract Sections A–D as plain text only.
2. Compute word count.
3. Gate:
o If word_count is between 735 and 765: proceed.
o If < 735: Expand analysis in Section C with more strategic rationale ("Why").
o If > 765: Condense slightly.
________________________________________
8. PRE-DELIVERY CHECKLIST (ALL MUST PASS)
• Word count is between 735 and 765 words.
• Every numeric figure has a [V#] citation.
• Every qualitative claim has a [C#] citation.
• All dates in DD, MM, YYYY format.
• All URLs are live or labeled "Not disclosed".
• YoY/QoQ % figures match management’s reported numbers (within 0.1%); otherwise use company figures.
• Section A: exactly 3 rows (Markdown table); safety and financial risks addressed.
• Section D: includes narrative outlook.
• Analyst consensus labeled as [Consensus: X] or [Analyst Range: X–Y] if used.
• No synthetic or invented data; all numbers traceable to a source.
• Currency presentation consistent (USD default; FX conversion shown if material).
• Section C includes 4–7 material events, prioritizing safety and financial items.
• Section F contains ALL events from Section C plus other material events (Alignment Checked).
• Commentary utilizes BOTH Transcript and Analyst Reports, checking for contradictions.
• No forward projections unless explicitly from management or clearly labeled as consensus.
• Narrative explains divergences (e.g., volumes up but EBITDA down) with drivers.
• Tone is executive, neutral, and compliant with all formatting and structure rules.
________________________________________
9. EDGE CASE HANDLING (APPLY AS RELEVANT)
• No earnings released yet: Mark as "Preliminary"; use available guidance; note "Full results forthcoming [DATE]" if disclosed.
• No formal guidance: Omit table in Section D and use the prescribed qualitative-only statement.
• Mid-quarter M&A/divestiture: Clarify pro forma vs. statutory; footnote key dates and comparability.
• FX/commodity volatility >15%: Separate volumes, prices, and margin commentary; reference FX rates and note impacts.
• Restructuring/Chapter 11: Add risk caveat in Section D (e.g., "Assumes restructuring plan execution; see SEC filings for details.").
• One-time impairments/asset sales: Highlight in Section B; distinguish GAAP vs. adjusted.
• Extraordinary dividends/buybacks: Include only if non-recurring or policy-changing.
• Safety incidents/regulatory fines: Always include in Section C if material; cross-reference in Section A.
________________________________________
10. OUTPUT DELIVERY & FILE NAMING
• Output text must be ready to paste into Microsoft Word with minimal cleanup.
• File naming convention (for the user to apply in Word export):
text
Snapshot_[TICKER]_Q[QUARTER]_[YEAR]_[YYYY-MM-DD].docx
Example: Snapshot_MOS_Q4_2025_2026-02-02.docx
Ensure the final document is suitable for immediate board distribution and PDF export. Do not include metadata footer.
`;
};

export const getRefinementPrompt = (originalPrompt: string, currentContent: string, feedback: string[]): string => `
You are an expert financial editor. Your goal is to refine the following "Executive Quarterly Snapshot" to strictly meet the original master instructions and address the specific feedback provided by the QA Auditor.

ORIGINAL MASTER INSTRUCTIONS:
${originalPrompt}

CURRENT DRAFT (TO BE FIXED):
<SNAPSHOT_DRAFT>
${currentContent}
</SNAPSHOT_DRAFT>

QA AUDITOR FEEDBACK (CRITICAL FIXES REQUIRED):
${feedback.map(f => `- ${f}`).join('\n')}

INSTRUCTIONS:
1. **Mandatory Corrections**: Rewrite the draft to fix EVERY issue listed in the "QA AUDITOR FEEDBACK".
2. **General Quality Sweep**: While rewriting, proactively fix any other issues you spot (e.g., word count violations, formatting glitches, or missing superscripts) even if not explicitly listed in the feedback.
3. **Data Accuracy**: If the feedback provides a specific corrected figure (marked [CONTENT ERROR]), you MUST use that figure.
4. **Clean Copy ONLY**: Return the final, polished document text. 
   - **NO MARKDOWN DIFFS**: Do NOT use ~~strikethrough~~ or **bold** to show changes.
   - **NO CONVERSATION**: Do NOT write "Here is the fixed version" or "I have updated the section".
   - **NO METADATA**: Do NOT include headers like "Refined Draft".
   - The output must look exactly like the desired final report, ready for copy-pasting.
5. **Table Formatting**: Ensure Section A, Section D, and Section E (if present) are formatted as proper Markdown tables.
6. **Strict Compliance**: Ensure the final output adheres perfectly to the "ORIGINAL MASTER INSTRUCTIONS".
7. Return ONLY the final document text.
`;

export const getContentValidationPrompt = (generatedText: string, quarterContext: string): string => `
You are a Lead Forensic Financial Auditor.
Your task is to perform a **DEEP DIVE CONTENT AUDIT** of the following "Executive Quarterly Snapshot".
You must verify every single claim and number against the source material.

You have access to:
1. **Uploaded Documents** (The "Official Record" / Primary Source) including **Analyst Reports** and **Earnings Transcripts**.
2. **Metrics Data** (Source for Section E).
3. **Google Search** (External Verification / Secondary Source).

DOCUMENT TO AUDIT:
<SNAPSHOT_DRAFT>
${generatedText}
</SNAPSHOT_DRAFT>

CONTEXT:
**Designated Reporting Period**: ${quarterContext}

AUDIT PROTOCOL (EXECUTE RIGOROUSLY):
1. **Fact-Check Every Number**: 
   - Extract every financial figure (Revenue, EBITDA, Volumes, Guidance, etc.) from the draft.
   - SEARCH for this exact figure in the provided docs or via Google Search.
   - If a number is off by even 0.1%, flag it.
   
2. **Source Verification & Attribution (CRITICAL)**:
   - Check the "Master Source List" section at the bottom.
   - **Existence Check**: Do the URLs actually exist? (Use search to verify the title/date combo).
   - **ATTRIBUTION CHECK**: Verify that claims cited to a specific source (e.g., [V1] or [C1]) actually exist in that source.
     - If a claim cites [V#] or [C#] but the info is not in the corresponding source, flag as "**[ATTRIBUTION ERROR]**: Mis-cited source."

3. **Content Integrity (CRITICAL)**: 
   - **HIERARCHY**: Priority = Uploaded Docs > Company Website > Major Financial News.
   - If a figure matches the Uploaded Document: Start feedback with "**[VERIFIED (DOC)]**: [Metric] matches uploaded file."
   - If a figure is missing from docs but matches Google Search: Start feedback with "**[VERIFIED (WEB)]**: [Metric] verified via external search."
   - If a figure contradicts the Uploaded Document: Start feedback with "**[CONTENT ERROR]**: [Metric] stated as X, found Y in uploaded file."
   - If a figure contradicts External Data (and is not in doc): Start feedback with "**[CONTENT ERROR]**: [Metric] stated as X, found Y online."
   - If a URL in the sources is broken or hallucinated: Start feedback with "**[SOURCE ERROR]**: [Citation #] appears invalid."

4. **Section C Date Verification (NEW CRITICAL CHECK)**:
   - Review all events in "Section C: Material News & Events".
   - **RULE**: Events MUST fall within the **Designated Reporting Period** (${quarterContext}) or be **Material Subsequent Events** (occurred after the quarter end but before the report generation).
   - Flag any event from a *previous* quarter as an error.
     - E.g., If Report is Q3 (Jul-Sep), an event from January is INVALID.
     - **Feedback format**: "**[DATE ERROR]**: Event '[Headline]' occurred on [Date], which is outside the designated quarter."
   
5. **Data Table Integrity (Section E & Consensus)**:
   - Verify that the "Historical Results & Key Metrics" table matches the Quarterly Metrics Data.
   - Verify that the "Consensus Estimates" table matches the Consensus Data.
   - **DO NOT** check Section E values against Google Search. The Metrics File is the definitive source of truth for numbers in this section.
   - If any number in Section E differs from the provided metrics data (Context), flag it as a **[CONTENT ERROR]**.

6. **Section F Verification**:
   - Verify that all events in Section F fall within the target year (Jan 1 to present).
   - Verify that the list appears **fulsome** (more than just 1 or 2 events for a major company).
   - **ALIGNMENT CHECK**: Verify that EVERY event in Section C is also present in Section F. If an event is in C but missing from F, flag as "**[ALIGNMENT ERROR]**: Event '[Headline]' in Section C is missing from Section F."
   - Verify that excluded items (regular dividends/earnings calls) do not appear in Section F.

7. **Variance Explanation Rule**:
   - Any variance >$25M or >10% MUST have an accompanying explanation/driver (e.g., "due to lower prices"). Flag as "**[CONTEXT ERROR]**: Large variance ($X or Y%) lacks explanation."

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "isValid": boolean, // true ONLY if ZERO Content/Date/Attribution/Alignment Errors and score > 85.
  "score": number, // 0 to 100. Deduct 20 points for each ERROR.
  "feedback": string[] // List all findings. Be extremely detailed.
}
Do not return markdown formatting for the JSON. Just the raw JSON string.
`;

export const getFormatValidationPrompt = (generatedText: string): string => `
You are a Lead Financial Editor.
Your task is to perform a **STRICT FORMATTING AUDIT** of the following "Executive Quarterly Snapshot".
You do NOT need to verify the accuracy of the numbers, only the **FORMATTING, STYLE, AND STRUCTURE**.

DOCUMENT TO AUDIT:
<SNAPSHOT_DRAFT>
${generatedText}
</SNAPSHOT_DRAFT>

AUDIT PROTOCOL (EXECUTE RIGOROUSLY):
1. **Specificity Check (Temporal & Entity) (CRITICAL)**:
   - Scan the text for financial numbers in Sections A, B, and D.
   - **TEMPORAL RULE**: Every number must have a nearby temporal qualifier WITH YEAR (e.g., Q3 '24, YTD '24, LTM '24, FY '24).
   - **ENTITY RULE**: Every number must have an Entity Tag (e.g. "Cons." for total, or 3-letter CAPs like "POT", "PHO", "NIT", "RET" for segments).
   - **COMPARISON RULE**: Every percentage change must have a comparison qualifier (e.g., YoY, QoQ).
   - **DELTA CONTEXT RULE**: When a numeric difference is stated (e.g., "up $10M"), the prior period's absolute value MUST be provided (e.g., "vs Q3 '24 of $450M").
   - If a number is ambiguous (e.g. "Revenue was $100M" or just "Q3 Revenue"), flag as "**[AMBIGUITY ERROR]**: Metric $X lacks specific year label (e.g., needs Q3 '24) or Entity Tag (e.g. Cons.)."
   - If a percentage is ambiguous (e.g. "Up 5%" without "YoY"), flag as "**[AMBIGUITY ERROR]**: Percentage X% lacks comparison basis (YoY/QoQ)."
   - If a delta is stated without context, flag as "**[AMBIGUITY ERROR]**: Delta $X lacks prior period absolute value context."

2. **Formatting & Structure Check**:
   - **Word Count**: Estimate if Sections A–D combined are between 735 and 765 words. (Target 750).
   - **Section A**: Must be a Markdown table with exactly 4 body rows.
   - **Section A Guidance Check**: Verify that the "Guidance & Outlook" row in Section A aligns with the narrative in Section D. If they contradict, flag as "**[ALIGNMENT ERROR]**: Section A Guidance contradicts Section D."
   - **Section C**: Headlines must be bold. Descriptions must start on a NEW LINE.
   - **Section D**: Must contain narrative text.
   - **Citations**: Ensure citations use [V#] or [C#] format, and refer to the single Master Source List.
   - **Metadata**: Ensure NO footer metadata (like "Snapshot Date") exists.
   - **Sequential Check**: Ensure [V#] citations start at V1 and increment, and [C#] start at C1 and increment, both referring to the Master Source List.

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "isValid": boolean, // true ONLY if ZERO Formatting/Ambiguity Errors and score > 85.
  "score": number, // 0 to 100. Deduct 20 points for each ERROR.
  "wordCount": number, // The count you estimated
  "feedback": string[] // List all findings. Be extremely detailed.
}
Do not return markdown formatting for the JSON. Just the raw JSON string.
`;