
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { InvoiceExtractionResult } from "../types.js";

const API_KEY = process.env.API_KEY;

export const extractInvoiceData = async (
  base64Data: string,
  mimeType: string
): Promise<InvoiceExtractionResult> => {
  const genAI = new GoogleGenerativeAI(API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-3.0-flash" });

  const response = await model.generateContent({
    contents: [
      {
        role: "user",
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
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          vendorName: { type: SchemaType.STRING },
          invoiceNumber: { type: SchemaType.STRING },
          totalAmount: { type: SchemaType.NUMBER },
          currency: { type: SchemaType.STRING },
          dueDate: { type: SchemaType.STRING, description: "YYYY-MM-DD format" },
          issueDate: { type: SchemaType.STRING, description: "YYYY-MM-DD format" },
          category: { type: SchemaType.STRING, description: "e.g., Software, Utility, Marketing, Rent" },
          notes: { type: SchemaType.STRING },
          bankAccount: {
            type: SchemaType.OBJECT,
            properties: {
              bankName: { type: SchemaType.STRING },
              branchName: { type: SchemaType.STRING },
              accountType: { type: SchemaType.STRING, description: "e.g. 普通, 当座" },
              accountNumber: { type: SchemaType.STRING },
              accountName: { type: SchemaType.STRING }
            }
          }
        },
        required: ["vendorName", "totalAmount", "dueDate"],
      },
    },
  });

  try {
    const text = response.response.text().trim();
    const data = JSON.parse(text);
    return data as InvoiceExtractionResult;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Could not parse invoice data");
  }
};
