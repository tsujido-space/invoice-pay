
import React, { useState } from 'react';
import { Folder, Plus, Trash2, ExternalLink, AlertCircle, Clock, Copy, Check, Info } from 'lucide-react';
import { DriveFolder } from '../types';

interface FolderSettingsProps {
    folders: DriveFolder[];
    onAddFolder: (name: string, folderId: string) => void;
    onDeleteFolder: (id: string) => void;
    onToggleFolder: (id: string, enabled: boolean) => void;
}

const FolderSettings: React.FC<FolderSettingsProps> = ({
    folders,
    onAddFolder,
    onDeleteFolder,
    onToggleFolder
}) => {
    const [newName, setNewName] = useState('');
    const [newFolderId, setNewFolderId] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    const serviceAccount = "732967026525-compute@developer.gserviceaccount.com";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(serviceAccount);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => { // Made async
        e.preventDefault();
        if (newName && newFolderId) {
            setIsSaving(true); // Set saving state to true
            try {
                // Assuming onAddFolder might be an async operation or we want to simulate waiting
                await onAddFolder(newName, newFolderId);
                setNewName('');
                setNewFolderId('');
                setIsAdding(false);
            } finally {
                setIsSaving(false); // Reset saving state regardless of success or failure
            }
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Google Drive Settings</h2>
                    <p className="text-slate-500">監視対象のフォルダを設定します。</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    <span>フォルダを追加</span>
                </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-8">
                <div className="flex items-start space-x-4">
                    <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-200">
                        <Info size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">同期を有効にするための重要設定</h3>
                        <p className="text-slate-600 mb-4 leading-relaxed">
                            Google Drive の対象フォルダを以下のシステム用メールアドレスに直接「共有（閲覧権限）」設定していただく必要があります。
                        </p>
                        <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-white border border-blue-200 rounded-lg px-4 py-2.5 font-mono text-sm text-blue-700 break-all">
                                {serviceAccount}
                            </div>
                            <button
                                onClick={copyToClipboard}
                                className="flex-shrink-0 p-2.5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition text-blue-600 shadow-sm"
                                title="コピー"
                            >
                                {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                            </button>
                        </div>
                        <p className="mt-4 text-xs text-slate-500 flex items-center">
                            <AlertCircle size={14} className="mr-1" />
                            権限設定なしでは、このフォルダ内のファイルは一切読み取れません。
                        </p>
                    </div>
                </div>
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700">表示名</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="例: 管理部 請求書"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700">Google Drive フォルダID</label>
                                <input
                                    type="text"
                                    value={newFolderId}
                                    onChange={(e) => setNewFolderId(e.target.value)}
                                    placeholder="URLの末尾の文字列"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setIsAdding(false)}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg"
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition flex items-center space-x-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSaving && <Clock className="animate-spin" size={18} />}
                                <span>{isSaving ? '保存中...' : '保存する'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {folders.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                    <div className="inline-flex p-4 bg-slate-100 rounded-full mb-4">
                        <Folder className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">監視対象のフォルダがありません。</p>
                    <p className="text-sm text-slate-400 mt-1">「フォルダを追加」から登録してください。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {folders.map(folder => (
                        <div key={folder.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between hover:shadow-md transition">
                            <div className="flex items-center space-x-4">
                                <div className={`p-3 rounded-lg ${folder.enabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Folder size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{folder.name}</h3>
                                    <p className="text-xs font-mono text-slate-400 mt-0.5">{folder.folderId}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <span className={`text-xs font-bold ${folder.enabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                                        {folder.enabled ? '有効' : '停止中'}
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={folder.enabled}
                                            onChange={(e) => onToggleFolder(folder.id, e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="h-8 w-px bg-slate-100"></div>

                                <button
                                    onClick={() => onDeleteFolder(folder.id)}
                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                    title="削除"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-amber-50 rounded-xl p-5 flex items-start space-x-3 border border-amber-100 mt-10">
                <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
                <div className="text-sm text-amber-800 leading-relaxed">
                    <p className="font-bold mb-1">フォルダIDの取得方法</p>
                    <p>
                        ブラウザで Google Drive のフォルダを開いた際の URL 末尾の部分
                        (例: <code>drive.google.com/drive/folders/<strong>1a2b3c...</strong></code>)
                        をコピーして指定してください。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FolderSettings;
