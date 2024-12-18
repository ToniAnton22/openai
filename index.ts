import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import { CaseProcessor } from "./openai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());
// Initialize CaseProcessor
const caseProcessor = new CaseProcessor(process.env.OPENAI_API_KEY || "", {
	maxTokensPerChunk: 2000,
	overlapTokens: 200,
});

// Type definitions
interface CaseAnalysisRequest {
	caseText: string;
}

interface ErrorResponse {
	error: string;
	details?: string;
}

// Middleware for basic request logging
app.use((req, res, next) => {
	console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
	next();
});

// Global error handler
app.use(
	(
		err: Error,
		req: Request,
		res: Response<ErrorResponse>,
		next: express.NextFunction,
	) => {
		console.error("Unhandled Error:", err);
		res.status(500).json({
			error: "Internal server error",
			details: err.message,
		});
	},
);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
	res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// POST endpoint for case analysis
app.post(
	"/api/analyze-case",
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async (req: Request<any>, res: any) => {
		try {
			const {caseText} = req.body

			// if (!caseText) {
			// 	return res.status(400).json({
			// 		error: "Case text is required",
			// 	});
			// }
			// Create a new processor instance if custom options are provided
		
			const processor = new CaseProcessor(process.env.OPENAI_API_KEY ?? "");
			console.log("I got hit")
			const analysis = await processor.processCase(caseText);

			res.json({
				message: "Case analysis completed successfully",
				analysis,
				metadata: {
					timestamp: new Date().toISOString(),
					textLength: caseText.length,
				},
			});
		} catch (error) {
			console.error("Case Analysis Error:", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";

			res.status(500).json({
				error: "Error processing case analysis",
				details: errorMessage,
			});
		}
	},
);

// POST endpoint for case analysis
app.post(
	"/api/next-steps",
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async (req: Request<any>, res: any) => {
		try {
			const {caseText} = req.body

			// if (!caseText) {
			// 	return res.status(400).json({
			// 		error: "Case text is required",
			// 	});
			// }
			// Create a new processor instance if custom options are provided
		
			const processor = new CaseProcessor(process.env.OPENAI_API_KEY ?? "");
			console.log("I got hit")
			const analysis = await processor.processNextSteps(caseText);

			res.json({
				message: "Next steps analysis succesful.",
				analysis,
				metadata: {
					timestamp: new Date().toISOString(),
					textLength: caseText.length,
				},
			});
		} catch (error) {
			console.error("Next steps analysis: ", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";

			res.status(500).json({
				error: "Error processing case analysis",
				details: errorMessage,
			});
		}
	},
);

app.post(
	"/api/answer",
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async (req: Request<any>, res: any) => {
		try {
			const {context} = req.body
			// if (!caseText) {
			// 	return res.status(400).json({
			// 		error: "Case text is required",
			// 	});
			// }
			// Create a new processor instance if custom options are provided
		
			const processor = new CaseProcessor(process.env.OPENAI_API_KEY ?? "");
			console.log("I got hit")
			const analysis = await processor.processAnswerQuestions(context);

			res.json({
				message: "Answer given.",
				analysis,
				metadata: {
					timestamp: new Date().toISOString(),
					textLength: context?.summary.length + context?.nextSteps.length,
				},
			});
		} catch (error) {
			console.error("Answer given with error: ", error);

			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";

			res.status(500).json({
				error: "Error processing case analysis",
				details: errorMessage,
			});
		}
	},
);



// Endpoint to get processing status (for future implementation of async processing)
app.get("/api/analysis-status/:id", (req: Request, res: Response) => {
	// Placeholder for future implementation of async processing
	res.status(501).json({
		error: "Not implemented",
		message: "Status checking will be implemented in future versions",
	});
});

// Start the server
app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
	console.log(`Health check available at http://localhost:${port}/health`);
});

// Export for testing purposes
export default app;
