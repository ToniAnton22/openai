import OpenAI from "openai";
import Configuration from "openai";
import dotenv from "dotenv";

export const getOpenAIRes = async (caseText: string, apiKey: string) => {
	const ai = new OpenAI({ apiKey });

	try {
		const response = await ai.chat.completions.create({
			model: "gpt-4",
			messages: [
				{
					role: "system",
					content:
						"You are a precise case analysis assistant. Only make statements backed by the text. Maintain high accuracy over completeness.",
				},
				{
					role: "user",
					content: `analyse this history of interactions on a client's account. You should provide your response as a numbered list of key events, and provide a potential next steps section: ${caseText}`,
				},
			],
			temperature: 0.3,
		});
		const content = response.choices[0].message?.content || "";
		console.log(content);

		return content;
	} catch (error) {
		console.error("Error in gpt return:", error);
		throw error;
	}
};
