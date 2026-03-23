import { useState, useEffect } from 'react';
import { useVibe } from '../store/VibeContext';
import { db } from '../firebase';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

export interface FileItem {
  id: string;
  name: string;
  content: string;
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

    const q = query(collection(db, `users/${user.uid}/files`), orderBy('updatedAt', 'desc'));
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
    
    if (!user) {
      fallbackDownload(content);
      return;
    }

    if (target) {
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
        fallbackDownload(content);
      }
    } else {
      fallbackDownload(content);
    }
  };

  const fallbackDownload = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'untitled.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const createFile = async (name: string) => {
    if (!user) {
      console.warn('Please login to create cloud files.');
      return null;
    }
    
    try {
      const fileName = name.endsWith('.txt') ? name : `${name}.txt`;
      const newDocRef = doc(collection(db, `users/${user.uid}/files`));
      
      const newFile = {
        name: fileName,
        content: '',
        uid: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await setDoc(newDocRef, newFile);
      
      const newItem = { id: newDocRef.id, ...newFile };
      setCurrentFile(newItem);
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

  return { files, currentFile, readFile, saveFile, createFile, setCurrentFile };
}
