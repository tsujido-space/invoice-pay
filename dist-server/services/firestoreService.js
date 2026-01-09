import { collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
const COLLECTION_NAME = 'invoices';
const FOLDERS_COLLECTION = 'driveFolders';
export const getInvoices = async () => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('extractedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};
export const saveInvoice = async (invoice) => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...invoice,
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
    const invoiceRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(invoiceRef);
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
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
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
