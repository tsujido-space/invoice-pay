
import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceExtractionResult } from "../types";

const API_KEY = process.env.API_KEY;

export const extractInvoiceData = async (
  base64Data: string,
  mimeType: string
): Promise<InvoiceExtractionResult> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY! });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        {
          text: "Extract detailed invoice and bank transfer information (振込先情報) from this document. Especially focus on Japanese bank details like 銀行名, 支店名, 口座番号, 口座名義.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendorName: { type: Type.STRING },
          invoiceNumber: { type: Type.STRING },
          totalAmount: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          dueDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
          issueDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
          category: { type: Type.STRING, description: "e.g., Software, Utility, Marketing, Rent" },
          notes: { type: Type.STRING },
          bankAccount: {
            type: Type.OBJECT,
            properties: {
              bankName: { type: Type.STRING },
              branchName: { type: Type.STRING },
              accountType: { type: Type.STRING, description: "e.g. 普通, 当座" },
              accountNumber: { type: Type.STRING },
              accountName: { type: Type.STRING }
            }
          }
        },
        required: ["vendorName", "totalAmount", "dueDate"],
      },
    },
  });

  try {
    const text = response.text.trim();
    const data = JSON.parse(text);
    return data as InvoiceExtractionResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Could not parse invoice data");
  }
};
