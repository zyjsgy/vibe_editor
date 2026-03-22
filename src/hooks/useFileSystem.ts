import { useState } from 'react';

export interface FileItem {
  handle: FileSystemFileHandle;
  name: string;
}

export function useFileSystem() {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);

  const openDirectory = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
        return;
      }
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setDirHandle(handle);
      await refreshFiles(handle);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshFiles = async (handle: FileSystemDirectoryHandle) => {
    const newFiles: FileItem[] = [];
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.txt')) {
        newFiles.push({ handle: entry, name: entry.name });
      }
    }
    setFiles(newFiles);
  };

  const readFile = async (fileItem: FileItem) => {
    const file = await fileItem.handle.getFile();
    const text = await file.text();
    setCurrentFile(fileItem);
    return text;
  };

  const saveFile = async (content: string, fileItem?: FileItem | null) => {
    const target = fileItem || currentFile;
    if (target) {
      try {
        const writable = await target.handle.createWritable();
        await writable.write(content);
        await writable.close();
      } catch (e) {
        console.error('Failed to save file', e);
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
    if (!dirHandle) return null;
    try {
      const fileName = name.endsWith('.txt') ? name : `${name}.txt`;
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      await refreshFiles(dirHandle);
      const newItem = { handle: fileHandle, name: fileHandle.name };
      setCurrentFile(newItem);
      return newItem;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  return { dirHandle, files, currentFile, openDirectory, readFile, saveFile, createFile, setCurrentFile };
}
