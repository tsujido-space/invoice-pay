import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { google } from 'googleapis';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { JobsClient } from '@google-cloud/run';
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
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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

const runSync = async () => {
    let processedCount = 0;
    try {
        const folders = await firestoreService.getDriveFolders();
        const enabledFolders = folders.filter(f => f.enabled);
        const drive = await getDriveClient();

        console.log(`[Sync] Starting sync for ${enabledFolders.length} folders`);

        for (const folder of enabledFolders) {
            console.log(`[Sync] Scanning folder: ${folder.name} (ID: ${folder.folderId})`);

            try {
                const q = `'${folder.folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
                const response = await drive.files.list({
                    q,
                    fields: 'files(id, name, mimeType, webViewLink)',
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true,
                });

                const files = response.data.files || [];
                console.log(`[Sync] API found ${files.length} items in folder ${folder.name}`);

                // バッチ並列処理（3ファイルずつ）
                const batchSize = 3;
                for (let i = 0; i < files.length; i += batchSize) {
                    const batch = files.slice(i, i + batchSize);
                    await Promise.all(batch.map(async (file) => {
                        if (!file.id) return;

                        const isCandidate = file.mimeType?.includes('image/') ||
                            file.mimeType === 'application/pdf' ||
                            file.name?.toLowerCase().endsWith('.pdf') ||
                            file.name?.toLowerCase().endsWith('.jpg') ||
                            file.name?.toLowerCase().endsWith('.jpeg') ||
                            file.name?.toLowerCase().endsWith('.png');

                        if (!isCandidate) return;

                        const alreadyProcessed = await firestoreService.isDriveFileProcessed(file.id);
                        if (alreadyProcessed) return;

                        console.log(`[Sync] Processing NEW file: ${file.name} (${file.id})`);
                        try {
                            const fileContent = await drive.files.get({
                                fileId: file.id,
                                alt: 'media',
                                supportsAllDrives: true,
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
                        } catch (err: any) {
                            console.error(`[Sync] Failed processing ${file.name}:`, err.message);
                        }
                    }));
                }
            } catch (folderError: any) {
                console.error(`[Sync] Error accessing folder ${folder.name}:`, folderError.message);
            }
        }
        return processedCount;
    } catch (error) {
        throw error;
    }
};

app.post('/api/sync', async (req: Request, res: Response) => {
    console.log('[API] Sync requested - Triggering Cloud Run Job');
    try {
        const client = new JobsClient();
        const projectId = process.env.PROJECT_ID || 'tsujido2024';
        const region = 'us-central1'; // 固定または環境変数
        const jobName = `gemini-invoice-pay-sync`;

        const name = `projects/${projectId}/locations/${region}/jobs/${jobName}`;

        console.log(`[Job] Running job: ${name}`);
        const [operation] = await client.runJob({ name });

        res.status(202).json({
            success: true,
            message: 'Sync job started',
            operationName: operation.name
        });
    } catch (error: any) {
        console.error("[Sync] Job trigger error:", error.message);
        // フォールバック: バックグラウンドでの同期（Jobs API が使えない場合など）
        console.log('[Sync] Falling back to background process sync');
        runSync().catch(err => console.error('[Sync] Background sync failed:', err));
        res.status(202).json({ success: true, message: 'Sync started in background (fallback)' });
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

// CLI Job サポート
if (process.argv.includes('--sync-job')) {
    console.log('[Job] Starting sync job...');
    runSync()
        .then(count => {
            console.log(`[Job] Sync completed. Processed ${count} items.`);
            process.exit(0);
        })
        .catch(err => {
            console.error('[Job] Sync failed:', err);
            process.exit(1);
        });
} else {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
