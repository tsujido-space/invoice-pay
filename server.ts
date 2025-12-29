
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { google } from 'googleapis';
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// API Key for Gemini
const GEMINI_API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

/**
 * Google Drive API Auth (Service Account via Default Credentials)
 */
const getDriveClient = async () => {
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
};

/**
 * Gemini Extraction Logic (Server-side)
 */
const extractInvoiceWithGemini = async (base64Data: string, mimeType: string) => {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

    const ai = new GoogleGenAI(GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const response = await model.generateContent({
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: "Extract detailed invoice and bank transfer information from this document. Return JSON format with vendorName, invoiceNumber, totalAmount, currency, dueDate (YYYY-MM-DD), category, and bankAccount (bankName, branchName, accountType, accountNumber, accountName)." }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    const text = response.response.text();
    return JSON.parse(text);
};

/**
 * Sync Drive API Endpoint
 */
app.post('/api/sync', async (req, res) => {
    try {
        const folders = await firestoreService.getDriveFolders();
        const enabledFolders = folders.filter(f => f.enabled);
        const drive = await getDriveClient();

        let processedCount = 0;

        for (const folder of enabledFolders) {
            console.log(`Scanning folder: ${folder.name} (${folder.folderId})`);

            const response = await drive.files.list({
                q: `'${folder.folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`,
                fields: 'files(id, name, mimeType)',
            });

            const files = response.data.files || [];

            for (const file of files) {
                if (!file.id) continue;

                // Check if already processed
                const exists = await firestoreService.isDriveFileProcessed(file.id);
                if (exists) continue;

                console.log(`Processing file: ${file.name}`);

                // Download file content
                const fileContent = await drive.files.get({
                    fileId: file.id,
                    alt: 'media',
                }, { responseType: 'arraybuffer' });

                const base64Data = Buffer.from(fileContent.data as ArrayBuffer).toString('base64');
                const mimeType = file.mimeType || 'application/pdf';

                // Extract with Gemini
                const result = await extractInvoiceWithGemini(base64Data, mimeType);

                // Save to Firestore
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
                    driveFileId: file.id
                };

                await firestoreService.saveInvoice(newInvoice as any);
                processedCount++;
            }
        }

        res.json({ success: true, processedCount });
    } catch (error: any) {
        console.error("Sync error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve Static Files (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
