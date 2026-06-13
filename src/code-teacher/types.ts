/** Request to explain a piece of code */
export interface ExplanationRequest {
  /** The highlighted/selected code to explain */
  selectedCode: string;
  /** ±20 lines of surrounding code for context */
  surroundingContext: string;
  /** VS Code language ID (e.g. 'typescript', 'python') */
  language: string;
  /** File name for display */
  fileName: string;
}

/** Structured response from Gemini */
export interface ExplanationResult {
  /** One-sentence plain English summary */
  summary: string;
  /** Multi-paragraph detailed explanation */
  detail: string;
  /** Potential gotchas or side effects */
  gotchas: string;
  /** Big-O complexity, if applicable */
  complexity?: string;
  /** Raw markdown (entire response for streaming) */
  raw: string;
}
