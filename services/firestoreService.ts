
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    Timestamp,
    deleteDoc,
    getDoc
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { Invoice, DriveFolder } from '../types.js';

const COLLECTION_NAME = 'invoices';
const FOLDERS_COLLECTION = 'driveFolders';

export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('extractedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id
        } as Invoice;
    });
};

export const saveInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<string> => {
    const { id, ...dataToSave } = invoice as any; // Ensure id is not saved inside document
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...dataToSave,
        extractedAt: invoice.extractedAt || new Date().toISOString()
    });
    return docRef.id;
};

export const updateInvoiceStatus = async (id: string, status: string, paymentDate?: string) => {
    const invoiceRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(invoiceRef, {
        status,
        paymentDate: paymentDate || null
    });
};

export const deleteInvoice = async (id: string) => {
    console.log(`[FirestoreService] Attempting to delete invoice: ${id}`);
    const invoiceRef = doc(db, COLLECTION_NAME, id);

    // Check if exists first to provide better error
    const snap = await getDoc(invoiceRef);
    if (!snap.exists()) {
        console.error(`[FirestoreService] Document not found for deletion: ${id} at path databases/invoice/documents/${COLLECTION_NAME}/${id}`);
        throw new Error(`Document not found: ${id}`);
    }

    await updateDoc(invoiceRef, {
        status: 'DELETED'
    });
    console.log(`[FirestoreService] Successfully logic-deleted invoice: ${id}`);
};

export const isDriveFileProcessed = async (driveFileId: string): Promise<boolean> => {
    const q = query(collection(db, COLLECTION_NAME), where('driveFileId', '==', driveFileId));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
};

// Drive Folder Settings
export const getDriveFolders = async (): Promise<DriveFolder[]> => {
    const q = query(collection(db, FOLDERS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id
        } as DriveFolder;
    });
};

export const saveDriveFolder = async (folder: Omit<DriveFolder, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, FOLDERS_COLLECTION), {
        ...folder,
        createdAt: new Date().toISOString()
    });
    return docRef.id;
};

export const deleteDriveFolder = async (id: string) => {
    const folderRef = doc(db, FOLDERS_COLLECTION, id);
    await deleteDoc(folderRef);
};

export const updateDriveFolderStatus = async (id: string, enabled: boolean) => {
    const folderRef = doc(db, FOLDERS_COLLECTION, id);
    await updateDoc(folderRef, { enabled });
};
