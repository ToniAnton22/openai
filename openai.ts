import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

interface CaseAnalysis {
	summary: string;
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

			const breakPoint =
				chunk.lastIndexOf(". ", chunk.length * 0.8) + 1 || chunk.length;
			chunks.push(chunk.slice(0, breakPoint));
			startIndex += breakPoint - overlap;
		}

		return chunks;
	}

	private async analyzeChunk(chunk: string): Promise<string> {
		const prompt = `
            Analyze this portion of a case and provide:
            A brief summary of all the events happening in the case 

            Focus on concrete facts. Be concise and direct.

            Text to analyze:
            ${chunk}
        `;

		try {
			const response = await this.openai.chat.completions.create({
				model: "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content:
							"You are a precise case analyst. Provide clear summaries focusing only on verified facts.",
					},
					{ role: "user", content: prompt },
				],
				temperature: 0.3,
			});

			return response.choices[0].message?.content?.trim() || "";
		} catch (error) {
			console.error("Error analyzing chunk:", error);
			throw error;
		}
	}

	public async processCase(caseText: string): Promise<CaseAnalysis> {
		if (!caseText || typeof caseText !== "string") {
			throw new Error("Invalid input: caseText must be a non-empty string");
		}

		if (caseText.length > 1000000) {
			// 1MB limit
			throw new Error("Text size exceeds maximum limit of 1MB");
		}

		const chunks = await this.splitIntoChunks(caseText);
		const chunkSummaries = await Promise.all(
			chunks.map(this.analyzeChunk.bind(this)),
		);

		// Combine all summaries for a final analysis
		const combinedSummaries = chunkSummaries.join(" ");
		const finalResponse = await this.openai.chat.completions.create({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"Create a concise final summary based on the analyzed information. This MUST be less than 200 characters.",
				},
				{
					role: "user",
					content: `Provide a clear, concise summary of what happened based on these analyses:\n${combinedSummaries} This MUST be less than 200 characters.`,
				},
			],
			temperature: 0.3,
		});

		return {
			summary: finalResponse.choices[0].message?.content?.trim() || "",
		};
	}
}
