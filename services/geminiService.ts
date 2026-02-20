import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getGenerationPrompt, getContentValidationPrompt, getFormatValidationPrompt, getRefinementPrompt } from '../constants';
import { SnapshotInputs, ValidationResult } from '../types';

// Helper to ensure API key is available
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to clean JSON string from Markdown fences
const cleanJson = (text: string): string => {
  if (!text) return "";
  // Remove ```json at start and ``` at end, and generic ``` fences
  return text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
};

// Helper to clean Markdown text (strip fences if model wraps output in ```markdown ... ```)
const cleanText = (text: string): string => {
  if (!text) return "";
  // Remove generic markdown fences
  return text.replace(/^```markdown\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
};

// Helper to construct parts from inputs
const constructFileParts = (inputs: SnapshotInputs): any[] => {
  const parts: any[] = [];
  
  if (inputs.files && inputs.files.length > 0) {
    inputs.files.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    });
  }

  if (inputs.transcriptFiles && inputs.transcriptFiles.length > 0) {
    inputs.transcriptFiles.forEach(file => {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    });
  }
  
  return parts;
};

export const generateSnapshot = async (inputs: SnapshotInputs): Promise<string> => {
  const ai = getClient();
  const prompt = getGenerationPrompt(inputs);

  // Construct parts: Documents first, then the prompt
  const parts = constructFileParts(inputs);
  parts.push({ text: prompt });

  // Use gemini-3.1-pro-preview with ThinkingLevel.HIGH for complex reasoning
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }], // Enable grounding to find the financial data
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  return cleanText(response.text || "Error: No text generated.");
};

export const refineSnapshot = async (inputs: SnapshotInputs, currentContent: string, feedback: string[]): Promise<string> => {
  const ai = getClient();
  const originalPrompt = getGenerationPrompt(inputs);
  const refinementPrompt = getRefinementPrompt(originalPrompt, currentContent, feedback);

  // Construct parts: Documents first, then the refinement prompt to ensure context is available
  const parts = constructFileParts(inputs);
  parts.push({ text: refinementPrompt });

  // Use gemini-3.1-pro-preview with ThinkingLevel.HIGH for refinement
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }], 
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  return cleanText(response.text || "Error: No text generated during refinement.");
};

export const validateSnapshot = async (inputs: SnapshotInputs, generatedText: string): Promise<ValidationResult> => {
  const ai = getClient();
  
  // PREPARE CONTENT VALIDATION
  let contentPrompt = getContentValidationPrompt(generatedText, inputs.quarter);
  
  if (inputs.metricsContext) {
      contentPrompt += `\n\n[OFFICIAL QUARTERLY METRICS DATA FOR SECTION E VERIFICATION]:\n${inputs.metricsContext}\n`;
  }
  
  if (inputs.consensusContext) {
      contentPrompt += `\n\n[OFFICIAL CONSENSUS DATA FOR SECTION E VERIFICATION]:\n${inputs.consensusContext}\n`;
  }

  const contentParts = constructFileParts(inputs);
  contentParts.push({ text: contentPrompt });

  const contentValidationPromise = ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: contentParts },
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isValid: { type: Type.BOOLEAN },
          score: { type: Type.NUMBER },
          feedback: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["isValid", "score", "feedback"]
      }
    }
  });

  // PREPARE FORMAT VALIDATION
  const formatPrompt = getFormatValidationPrompt(generatedText);
  
  const formatValidationPromise = ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ text: formatPrompt }] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isValid: { type: Type.BOOLEAN },
          score: { type: Type.NUMBER },
          wordCount: { type: Type.NUMBER },
          feedback: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["isValid", "score", "wordCount", "feedback"]
      }
    }
  });

  // EXECUTE IN PARALLEL
  const [contentResponse, formatResponse] = await Promise.all([
    contentValidationPromise,
    formatValidationPromise
  ]);

  // PROCESS CONTENT RESULT
  const contentResultRaw = cleanJson(contentResponse.text || "{}");
  let contentResult: any = { isValid: false, score: 0, feedback: ["Error parsing content validation"] };
  try {
    contentResult = JSON.parse(contentResultRaw);
  } catch (e) {
    console.error("Content validation parse error", e);
  }

  // PROCESS FORMAT RESULT
  const formatResultRaw = cleanJson(formatResponse.text || "{}");
  let formatResult: any = { isValid: false, score: 0, wordCount: 0, feedback: ["Error parsing format validation"] };
  try {
    formatResult = JSON.parse(formatResultRaw);
  } catch (e) {
    console.error("Format validation parse error", e);
  }

  // MERGE RESULTS
  const combinedFeedback = [
    ...(contentResult.feedback || []).map((f: string) => `[CONTENT] ${f}`),
    ...(formatResult.feedback || []).map((f: string) => `[FORMAT] ${f}`)
  ];

  return {
    isValid: contentResult.isValid && formatResult.isValid,
    score: Math.min(contentResult.score, formatResult.score),
    wordCount: formatResult.wordCount || 0,
    feedback: combinedFeedback
  };
};