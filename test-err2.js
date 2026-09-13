import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({ 
        model: "gemini-2.5-flash", 
        contents: [
            {
                inlineData: {
                    mimeType: "image/png",
                    data: "invalid_base64!!"
                }
            },
            "what is this image"
        ]
    });
    console.log("SUCCESS:", res.text);
  } catch (e) {
    console.log("ERROR:", e.message);
  }
}
run();
