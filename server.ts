import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { google } from 'googleapis';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as firestoreService from './services/firestoreService.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

const getDriveClient = async () => {
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
};

const extractInvoiceWithGeminiServer = async (base64Data: string, mimeType: string) => {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.0-flash" });

    const response = await model.generateContent({
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: "Extract detailed invoice and bank transfer information from this document." }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    vendorName: { type: SchemaType.STRING },
                    invoiceNumber: { type: SchemaType.STRING },
                    totalAmount: { type: SchemaType.NUMBER },
                    currency: { type: SchemaType.STRING },
                    dueDate: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
                    issueDate: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
                    category: { type: SchemaType.STRING },
                    bankAccount: {
                        type: SchemaType.OBJECT,
                        properties: {
                            bankName: { type: SchemaType.STRING },
                            branchName: { type: SchemaType.STRING },
                            accountType: { type: SchemaType.STRING },
                            accountNumber: { type: SchemaType.STRING },
                            accountName: { type: SchemaType.STRING }
                        }
                    }
                },
                required: ["vendorName", "totalAmount", "dueDate"]
            }
        }
    });

    const text = response.response.text();
    return JSON.parse(text);
};

app.post('/api/sync', async (req: Request, res: Response) => {
    try {
        const folders = await firestoreService.getDriveFolders();
        const enabledFolders = folders.filter(f => f.enabled);
        const drive = await getDriveClient();

        let processedCount = 0;

        for (const folder of enabledFolders) {
            console.log(`[Sync] Scanning folder: ${folder.name} (ID: ${folder.folderId})`);

            const q = `'${folder.folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`;
            const response = await drive.files.list({
                q,
                fields: 'files(id, name, mimeType, webViewLink)',
            });

            const files = response.data.files || [];
            console.log(`[Sync] Found ${files.length} potential files in folder ${folder.name}`);

            for (const file of files) {
                if (!file.id) continue;

                const alreadyProcessed = await firestoreService.isDriveFileProcessed(file.id);
                if (alreadyProcessed) {
                    console.log(`[Sync] Skipping already processed file: ${file.name} (${file.id})`);
                    continue;
                }


                console.log(`[Sync] Processing NEW file: ${file.name} (${file.id})`);
                const fileContent = await drive.files.get({
                    fileId: file.id,
                    alt: 'media',
                }, { responseType: 'arraybuffer' });

                const base64Data = Buffer.from(fileContent.data as ArrayBuffer).toString('base64');
                const result = await extractInvoiceWithGeminiServer(base64Data, file.mimeType || 'application/pdf');

                const newInvoice = {
                    vendorName: result.vendorName,
                    invoiceNumber: result.invoiceNumber || '',
                    amount: result.totalAmount,
                    currency: result.currency || 'JPY',
                    dueDate: result.dueDate,
                    issueDate: result.issueDate || new Date().toISOString().split('T')[0],
                    status: 'PENDING',
                    category: result.category || 'Other',
                    extractedAt: new Date().toISOString(),
                    fileName: file.name || 'unknown',
                    bankAccount: result.bankAccount,
                    driveFileId: file.id,
                    webViewLink: file.webViewLink || undefined
                };

                await firestoreService.saveInvoice(newInvoice as any);
                processedCount++;
            }
        }

        res.json({ success: true, processedCount });
    } catch (error: any) {
        console.error("[Sync] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/invoices/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log(`[API] Logical deleting invoice: ${id}`);
        await firestoreService.deleteInvoice(id);
        res.json({ success: true });
    } catch (error: any) {
        console.error("[API] Delete error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use(express.static(path.join(__dirname, '..', 'dist')));

app.use((req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
