import { GoogleGenAI } from "@google/genai";
try {
  const ai = new GoogleGenAI({ apiKey: undefined });
  console.log("SDK initialized without key.");
} catch (e) {
  console.error("SDK init failed:", e.message);
}
