import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { mistral } from "@ai-sdk/mistral";

export const processChat = createServerFn({ method: "POST" })
  .validator((messages: any[]) => messages)
  .handler(async ({ data: messages }) => {
    try {
      const { text } = await generateText({
        model: mistral("mistral-small-latest"),
        system: `You are the Smart Library AI Assistant. 
You ONLY answer questions related to the library, its books, membership, and features.
If a user asks about anything unrelated to the library or books, politely decline to answer.
Be friendly, helpful, and concise. 
If the user speaks in Sinhala, you MUST reply in Sinhala. You fully support the Sinhala language.`,
        messages,
      });

      return text;
    } catch (e: any) {
      console.error("AI Error:", e);
      throw new Error("Failed to process chat");
    }
  });
