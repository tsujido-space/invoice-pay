
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    query,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Invoice } from '../types';

const COLLECTION_NAME = 'invoices';

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
