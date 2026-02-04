import { GoogleGenAI } from "@google/genai";
import { CartItem } from "../types";

// NOTE: In a real app, this key should be in process.env.API_KEY
// For this demo, we assume the user might provide it or it's injected.
// We will fail gracefully if not present.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;


export const generateRecipe = async (cartItems: CartItem[]): Promise<string> => {
  if (!apiKey) {
    return "API Key missing. Please check your environment configuration.";
  }
  
  if (cartItems.length === 0) {
    return "Your cart is empty! Add some ingredients to get a recipe suggestion.";
  }

  const ingredients = cartItems.map(item => item.name).join(', ');

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `I have the following ingredients: ${ingredients}. Suggest one simple, delicious recipe I can make. 
      Please format the response nicely with Markdown:
      - Use a bold title.
      - Use a bulleted list for extra ingredients needed.
      - Use numbered steps for instructions.
      Keep it under 300 words.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Flash doesn't need high thinking budget for this
      }
    });

    return response.text || "Could not generate recipe.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sorry, our AI chef is currently on break (Error connecting to Gemini).";
  }
};