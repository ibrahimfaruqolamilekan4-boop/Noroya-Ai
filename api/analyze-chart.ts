import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  res.status(200).json({ message: "Hello from Vercel!" });
}
