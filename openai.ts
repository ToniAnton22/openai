import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

interface CaseAnalysis {
  summary: string;
  nextSteps: string[];
}

interface ProcessingOptions {
  maxTokensPerChunk: number;
  overlapTokens: number;
}

export class CaseProcessor {
  private openai: OpenAI;
  private options: ProcessingOptions;

  constructor(apiKey: string, options?: Partial<ProcessingOptions>) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    this.options = {
      maxTokensPerChunk: 2000,
      overlapTokens: 200,
      ...options,
    };
  }

  private async splitIntoChunks(text: string): Promise<string[]> {
    const chunkSize = Math.min(this.options.maxTokensPerChunk * 4, 8000);
    const overlap = Math.min(this.options.overlapTokens * 4, 1000);
    const chunks: string[] = [];

    let startIndex = 0;
    while (startIndex < text.length) {
      const chunk = text.slice(startIndex, startIndex + chunkSize);
      if (chunk.length === 0) break;

      const breakPoint = chunk.lastIndexOf(". ", chunk.length * 0.8) + 1 || chunk.length;
      chunks.push(chunk.slice(0, breakPoint));
      startIndex += breakPoint - overlap;
    }

    return chunks;
  }

  private async analyzeChunk(chunk: string): Promise<Partial<CaseAnalysis>> {
    const prompt = `
      Analyze this portion of a case and provide:
      1. A brief summary of what happened (2-3 sentences)
      2. Suggested next steps based on this information (if any)

      Focus on concrete facts and clear action items. Be concise and direct.

      Text to analyze:
      ${chunk}
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a precise case analyst. Provide clear, actionable summaries focusing only on verified facts."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      });

      const content = response.choices[0].message?.content || "";
      const [summary, nextStepsSection] = content.split(/next steps:/i);

      return {
        summary: summary.trim(),
        nextSteps: nextStepsSection 
          ? nextStepsSection.split('\n').filter(step => step.trim())
          : []
      };
    } catch (error) {
      console.error("Error analyzing chunk:", error);
      throw error;
    }
  }

  public async processCase(caseText: string): Promise<CaseAnalysis> {
    if (!caseText || typeof caseText !== "string") {
      throw new Error("Invalid input: caseText must be a non-empty string");
    }

    if (caseText.length > 1000000) { // 1MB limit
      throw new Error("Text size exceeds maximum limit of 1MB");
    }

    const chunks = await this.splitIntoChunks(caseText);
    const analyses = await Promise.all(chunks.map(this.analyzeChunk.bind(this)));

    // Combine all summaries for a final analysis
    const combinedSummaries = analyses.map(a => a.summary).join(" ");
    const finalResponse = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Create a concise final summary and clear next steps based on the analyzed information."
        },
        {
          role: "user",
          content: `Provide a final analysis with:\n1. A clear summary of what happened\n2. Prioritized next steps\n\nBased on these analyses:\n${combinedSummaries}`
        }
      ],
      temperature: 0.3
    });

    const content = finalResponse.choices[0].message?.content || "";
    const [summary, nextStepsSection] = content.split(/next steps:/i);

    return {
      summary: summary.trim(),
      nextSteps: nextStepsSection 
        ? nextStepsSection.split('\n').filter(step => step.trim()).map(step => step.trim())
        : []
    };
  }
}