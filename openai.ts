import OpenAI from 'openai';
import Configuration from "openai"
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Types for our case processing
interface CaseReference {
    lineNumber: number;
    content: string;
    context: string;
}

interface CaseAnalysis {
    summary: string;
    keyPoints: string[];
    references: CaseReference[];
    nextSteps: string[];
    confidence: number;
}

interface ProcessingOptions {
    maxTokensPerChunk: number;
    overlapTokens: number;
    minConfidence: number;
}

export class CaseProcessor {
    private openai: OpenAI;
    private options: ProcessingOptions;

    constructor(apiKey: string, options?: Partial<ProcessingOptions>) {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
        
        // Default options with reasonable values
        this.options = {
            maxTokensPerChunk: 2000,
            overlapTokens: 200,
            minConfidence: 0.7,
            ...options
        };
    }

    private async splitIntoChunks(text: string): Promise<string[]> {
        // Simple approximation: 1 token ≈ 4 characters
        const chunkSize = this.options.maxTokensPerChunk * 4;
        const overlap = this.options.overlapTokens * 4;
        const chunks: string[] = [];
        
        let startIndex = 0;
        while (startIndex < text.length) {
            let chunk = text.slice(startIndex, startIndex + chunkSize);
            
            // Try to break at paragraph or sentence
            if (startIndex + chunkSize < text.length) {
                const lastParagraph = chunk.lastIndexOf('\n\n');
                const lastSentence = chunk.lastIndexOf('. ');
                const breakPoint = lastParagraph > chunk.length / 2 ? lastParagraph : 
                                 lastSentence > chunk.length / 2 ? lastSentence + 1 : 
                                 chunk.length;
                chunk = chunk.slice(0, breakPoint);
            }
            
            chunks.push(chunk);
            startIndex += chunk.length - overlap;
        }
        
        return chunks;
    }

    private async analyzeChunk(chunk: string, chunkIndex: number): Promise<Partial<CaseAnalysis>> {
        const prompt = `
            Analyze this portion of a client case. Provide:
            1. A brief summary of key points
            2. Important references with line numbers
            3. Any potential next steps based on this information
            4. A confidence score (0-1) about the completeness of your analysis

            Remember:
            - Only include factual information present in the text
            - Mark any uncertain conclusions clearly
            - Include specific line references for all key points
            
            Text to analyze:
            ${chunk}
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a precise case analysis assistant. Only make statements backed by the text. Maintain high accuracy over completeness." 
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3  // Lower temperature for more consistent outputs
            });

            // Parse the response and extract structured information
            const content = response.choices[0].message?.content || '';
            
            // You would need to implement proper parsing of the GPT response here
            // This is a simplified version
            return this.parseGPTResponse(content, chunkIndex * this.options.maxTokensPerChunk);
        } catch (error) {
            console.error(`Error analyzing chunk ${chunkIndex}:`, error);
            throw error;
        }
    }

    private parseGPTResponse(content: string, baseLineNumber: number): Partial<CaseAnalysis> {
        // Implement proper parsing logic here
        // This is a simplified version
        const sections = content.split('\n\n');
        
        return {
            keyPoints: sections.find(s => s.includes('key points'))?.split('\n').slice(1) || [],
            references: sections.find(s => s.includes('references'))
                ?.split('\n')
                .slice(1)
                .map(ref => ({
                    lineNumber: baseLineNumber + Number.parseInt(ref.match(/line (\d+)/)?.[1] || '0'),
                    content: ref,
                    context: ref
                })) || [],
            nextSteps: sections.find(s => s.includes('next steps'))?.split('\n').slice(1) || [],
            confidence: Number.parseFloat(content.match(/confidence: (0\.\d+)/)?.[1] || '0')
        };
    }

    public async processCase(caseText: string): Promise<CaseAnalysis> {
        const chunks = await this.splitIntoChunks(caseText);
        const chunkAnalyses = await Promise.all(
            chunks.map((chunk, index) => this.analyzeChunk(chunk, index))
        );

        // Merge analyses from all chunks
        const mergedAnalysis: CaseAnalysis = {
            summary: '',
            keyPoints: [],
            references: [],
            nextSteps: [],
            confidence: 1
        };

        let totalConfidence = 0;
        // biome-ignore lint/complexity/noForEach: <explanation>
        chunkAnalyses.forEach(analysis => {
            mergedAnalysis.keyPoints.push(...(analysis.keyPoints || []));
            mergedAnalysis.references.push(...(analysis.references || []));
            mergedAnalysis.nextSteps.push(...(analysis.nextSteps || []));
            totalConfidence += analysis.confidence || 0;
        });

        // Calculate overall confidence
        mergedAnalysis.confidence = totalConfidence / chunkAnalyses.length;

        // Generate final summary
        const summaryPrompt = `
            Create a concise summary of this case based on these key points:
            ${mergedAnalysis.keyPoints.join('\n')}
        `;

        const summaryResponse = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: "Create a brief, factual summary based on the provided key points." },
                { role: "user", content: summaryPrompt }
            ],
            temperature: 0.3
        });

        mergedAnalysis.summary = summaryResponse.choices[0].message?.content || '';

        // Filter out duplicate points and sort references
        mergedAnalysis.keyPoints = [...new Set(mergedAnalysis.keyPoints)];
        mergedAnalysis.references.sort((a, b) => a.lineNumber - b.lineNumber);
        mergedAnalysis.nextSteps = [...new Set(mergedAnalysis.nextSteps)];

        return mergedAnalysis;
    }
}