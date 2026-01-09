import { collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
const COLLECTION_NAME = 'invoices';
const FOLDERS_COLLECTION = 'driveFolders';
export const getInvoices = async () => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('extractedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id
        };
    });
};
export const saveInvoice = async (invoice) => {
    const { id, ...dataToSave } = invoice; // Ensure id is not saved inside document
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...dataToSave,
        extractedAt: invoice.extractedAt || new Date().toISOString()
    });
    return docRef.id;
};
export const updateInvoiceStatus = async (id, status, paymentDate) => {
    const invoiceRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(invoiceRef, {
        status,
        paymentDate: paymentDate || null
    });
};
export const deleteInvoice = async (id) => {
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
export const isDriveFileProcessed = async (driveFileId) => {
    const q = query(collection(db, COLLECTION_NAME), where('driveFileId', '==', driveFileId));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
};
// Drive Folder Settings
export const getDriveFolders = async () => {
    const q = query(collection(db, FOLDERS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            id: doc.id
        };
    });
};
export const saveDriveFolder = async (folder) => {
    const docRef = await addDoc(collection(db, FOLDERS_COLLECTION), {
        ...folder,
        createdAt: new Date().toISOString()
    });
    return docRef.id;
};
export const deleteDriveFolder = async (id) => {
    const folderRef = doc(db, FOLDERS_COLLECTION, id);
    await deleteDoc(folderRef);
};
export const updateDriveFolderStatus = async (id, enabled) => {
    const folderRef = doc(db, FOLDERS_COLLECTION, id);
    await updateDoc(folderRef, { enabled });
};
