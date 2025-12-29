
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    query,
    orderBy,
    Timestamp,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Invoice, DriveFolder } from '../types';

const COLLECTION_NAME = 'invoices';
const FOLDERS_COLLECTION = 'driveFolders';

export const getInvoices = async (): Promise<Invoice[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('extractedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Invoice));
};

export const saveInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...invoice,
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

// Drive Folder Settings
export const getDriveFolders = async (): Promise<DriveFolder[]> => {
    const q = query(collection(db, FOLDERS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as DriveFolder));
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
