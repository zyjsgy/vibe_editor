/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { VibeProvider } from './store/VibeContext';
import { Background } from './components/Background';
import { Editor } from './components/Editor';
import { VibeMixer } from './components/VibeMixer';
import { ZenTimer } from './components/ZenTimer';
import { AudioPlayer } from './components/AudioPlayer';
import { useFileSystem } from './hooks/useFileSystem';
import { FolderOpen, FileText, Plus, X } from 'lucide-react';

function AppContent() {
  const [uiVisible, setUiVisible] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialContent, setInitialContent] = useState<string | undefined>(undefined);
  
  const { 
    files, 
    currentFile, 
    openDirectory, 
    readFile, 
    saveFile, 
    createFile 
  } = useFileSystem();

  useEffect(() => {
    let timeout: number;
    
    const handleActivity = () => {
      setUiVisible(true);
      clearTimeout(timeout);
      timeout = window.setTimeout(() => setUiVisible(false), 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    timeout = window.setTimeout(() => setUiVisible(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearTimeout(timeout);
    };
  }, []);

  const handleOpenFile = async (fileItem: any) => {
    const text = await readFile(fileItem);
    setInitialContent(text);
    setSidebarOpen(false);
  };

  const handleCreateFile = async () => {
    const name = prompt('Enter file name:');
    if (name) {
      const newItem = await createFile(name);
      if (newItem) {
        setInitialContent('');
        setSidebarOpen(false);
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black selection:bg-white/30 selection:text-white">
      <Background />
      <AudioPlayer />
      <ZenTimer isVisible={uiVisible} />
      
      {/* Top Left Folder Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className={`absolute top-6 left-6 z-40 p-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all duration-500 ${uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <FolderOpen size={20} />
      </button>

      {/* Sidebar */}
      <div className={`absolute top-0 left-0 h-full w-64 bg-black/60 backdrop-blur-xl border-r border-white/10 z-50 transform transition-transform duration-500 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-white font-serif text-[clamp(16px,2.5vw,20px)]">Files</h2>
            <button onClick={() => setSidebarOpen(false)} className="text-white/50 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button 
              onClick={openDirectory}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[clamp(12px,2vw,14px)] transition-colors"
            >
              <FolderOpen size={14} /> Open Folder
            </button>
            <button 
              onClick={handleCreateFile}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              title="New File"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {files.map((file, i) => (
              <button
                key={i}
                onClick={() => handleOpenFile(file)}
                className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${currentFile?.name === file.name ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
              >
                <FileText size={16} />
                <span className="truncate text-[clamp(12px,2vw,14px)]">{file.name}</span>
              </button>
            ))}
            {files.length === 0 && (
              <p className="text-white/30 text-[clamp(12px,2vw,14px)] text-center mt-4">No .txt files found</p>
            )}
          </div>
        </div>
      </div>

      <Editor 
        isVisible={uiVisible} 
        initialContent={initialContent}
        onSave={(content) => saveFile(content)}
      />
      <VibeMixer isVisible={uiVisible} />
    </div>
  );
}

export default function App() {
  return (
    <VibeProvider>
      <AppContent />
    </VibeProvider>
  );
}
