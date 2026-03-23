import { useState, useEffect } from 'react';
import { useVibe } from '../store/VibeContext';
import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

export interface FileItem {
  id: string;
  name: string;
  content: string;
  type?: 'file' | 'folder';
  parentId?: string | null;
  uid: string;
  createdAt: number;
  updatedAt: number;
}

export function useFileSystem() {
  const { user } = useVibe();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);

  useEffect(() => {
    if (!user) {
      setFiles([]);
      setCurrentFile(null);
      return;
    }

    const q = query(collection(db, `users/${user.uid}/files`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newFiles: FileItem[] = [];
      snapshot.forEach((doc) => {
        newFiles.push({ id: doc.id, ...doc.data() } as FileItem);
      });
      setFiles(newFiles);
      
      // Update current file if it was modified remotely
      setCurrentFile(prev => {
        if (!prev) return null;
        const updated = newFiles.find(f => f.id === prev.id);
        return updated || prev;
      });
    }, (error) => {
      console.error("Firestore Error: ", JSON.stringify({
        error: error.message,
        operationType: 'list',
        path: `users/${user.uid}/files`,
        authInfo: { userId: user.uid }
      }));
    });

    return () => unsubscribe();
  }, [user]);

  const readFile = async (fileItem: FileItem) => {
    setCurrentFile(fileItem);
    return fileItem.content;
  };

  const saveFile = async (content: string, fileItem?: FileItem | null) => {
    const target = fileItem || currentFile;
    
    if (!user || !target) {
      return;
    }

    try {
      const docRef = doc(db, `users/${user.uid}/files/${target.id}`);
      await setDoc(docRef, {
        content,
        updatedAt: Date.now()
      }, { merge: true });
      
      // Update local state immediately for snappy UI
      setCurrentFile(prev => prev ? { ...prev, content, updatedAt: Date.now() } : null);
    } catch (e: any) {
      console.error("Firestore Error: ", JSON.stringify({
        error: e.message,
        operationType: 'update',
        path: `users/${user.uid}/files/${target.id}`,
        authInfo: { userId: user.uid }
      }));
    }
  };

  const createItem = async (name: string, type: 'file' | 'folder' = 'file', parentId: string | null = null, initialContent: string = '') => {
    if (!user) {
      console.warn('Please login to create cloud files.');
      return null;
    }
    
    try {
      const newDocRef = doc(collection(db, `users/${user.uid}/files`));
      
      const newItemData = {
        name: name,
        content: initialContent,
        type,
        parentId,
        uid: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await setDoc(newDocRef, newItemData);
      
      const newItem = { id: newDocRef.id, ...newItemData };
      if (type === 'file') {
        setCurrentFile(newItem);
      }
      return newItem;
    } catch (e: any) {
      console.error("Firestore Error: ", JSON.stringify({
        error: e.message,
        operationType: 'create',
        path: `users/${user.uid}/files`,
        authInfo: { userId: user.uid }
      }));
      return null;
    }
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    try {
      const getDescendants = (parentId: string): string[] => {
        const children = files.filter(f => f.parentId === parentId).map(f => f.id);
        let allDescendants = [...children];
        for (const child of children) {
          allDescendants = [...allDescendants, ...getDescendants(child)];
        }
        return allDescendants;
      };

      const idsToDelete = [id, ...getDescendants(id)];

      for (const deleteId of idsToDelete) {
        await deleteDoc(doc(db, `users/${user.uid}/files/${deleteId}`));
        if (currentFile?.id === deleteId) {
          setCurrentFile(null);
        }
      }
    } catch (e: any) {
      console.error("Firestore Error: ", JSON.stringify({
        error: e.message,
        operationType: 'delete',
        path: `users/${user.uid}/files/${id}`,
        authInfo: { userId: user.uid }
      }));
    }
  };

  const moveItem = async (itemId: string, newParentId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/files/${itemId}`), {
        parentId: newParentId,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e: any) {
      console.error("Firestore Error: ", JSON.stringify({
        error: e.message,
        operationType: 'update',
        path: `users/${user.uid}/files/${itemId}`,
        authInfo: { userId: user.uid }
      }));
    }
  };

  return { files, currentFile, readFile, saveFile, createItem, deleteItem, moveItem, setCurrentFile };
}
