
// Note: Client-side Drive API access typically requires Google Identity Services (OAuth2).
// However, since this app is protected by IAP and running on Cloud Run, 
// a cleaner way is to use the Service Account's credentials if possible, 
// BUT client-side JS cannot easily use Service Account keys for security.
// For now, we'll implement a structure that expects a proxy or direct API call 
// if the environment allows, or a specialized backend endpoint.
// For this specific setup (Frontend-only React on Cloud Run), 
// the easiest robust way is to use a small backend proxy or Firebase Functions.
// Given the current architecture, we'll try to use the Drive API directly 
// from the client, assuming the browser carries the IAP/Google identity.

// IMPORTANT: Direct client-side Drive API access without a proper OAuth2 flow 
// is restricted. We will implement this as a service that can be called.

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
}

/**
 * Google Drive API 経由で指定フォルダのファイル一覧を取得します。
 * (注: 実行には適切な認証スコープが必要です)
 */
export const listFiles = async (folderId: string): Promise<DriveFile[]> => {
    try {
        // 実際の実装では gapi または fetch で Drive API を叩きます
        // IAP 経由でログインしているユーザーのトークンが利用できるか、
        // あるいはサービスアカウントのトークンをバックエンドから取得する必要があります。

        // ここではまず、API の口を定義します。
        // https://www.googleapis.com/drive/v3/files?q='folderId'+in+parents
        const query = encodeURIComponent(`'${folderId}' in parents and (mimeType contains 'image/' or mimeType = 'application/pdf') and trashed = false`);
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id, name, mimeType, webViewLink)`, {
            headers: {
                // トークンの供給については後述の認証フェーズで調整
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized: Google Drive へのアクセス権がありません。');
            }
            throw new Error(`Drive API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.files || [];
    } catch (error) {
        console.error('Failed to list files from Drive:', error);
        throw error;
    }
};

/**
 * ファイルのバイナリデータを取得します。
 */
export const downloadFile = async (fileId: string): Promise<{ blob: Blob, mimeType: string }> => {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
            // トークンが必要
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const mimeType = response.headers.get('Content-Type') || 'application/octet-stream';

    return { blob, mimeType };
};
