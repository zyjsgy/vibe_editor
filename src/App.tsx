/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { VibeProvider, useVibe } from './store/VibeContext';
import { Background } from './components/Background';
import { Editor } from './components/Editor';
import { VibeMixer } from './components/VibeMixer';
import { ZenTimer } from './components/ZenTimer';
import { AudioPlayer } from './components/AudioPlayer';
import { useFileSystem } from './hooks/useFileSystem';
import { FolderOpen, FileText, Plus, X, Maximize, Minimize, LogIn, LogOut } from 'lucide-react';
import { loginWithGoogle, logout } from './firebase';

function AppContent() {
  const [uiVisible, setUiVisible] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialContent, setInitialContent] = useState<string | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  
  const { user } = useVibe();
  
  const { 
    files, 
    currentFile, 
    readFile, 
    saveFile, 
    createFile 
  } = useFileSystem();

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
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
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearTimeout(timeout);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error("Error attempting to enable fullscreen:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  const handleOpenFile = async (fileItem: any) => {
    const text = await readFile(fileItem);
    setInitialContent(text);
    setSidebarOpen(false);
  };

  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please login with Google to create cloud files.");
      return;
    }
    if (newFileName.trim()) {
      const newItem = await createFile(newFileName.trim());
      if (newItem) {
        setInitialContent('');
        setSidebarOpen(false);
        setIsCreatingFile(false);
        setNewFileName('');
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

      {/* Top Right Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        className={`absolute top-6 right-6 z-40 p-3 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all duration-500 ${uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
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
          
          <div className="flex flex-col gap-2 mb-6">
            <button 
              onClick={() => {
                if (!user) {
                  alert("Please login with Google to create cloud files.");
                  return;
                }
                setIsCreatingFile(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[clamp(12px,2vw,14px)] transition-colors"
            >
              <Plus size={14} /> New File
            </button>
            
            {isCreatingFile && (
              <form onSubmit={handleCreateFileSubmit} className="flex gap-2 mt-2">
                <input 
                  type="text" 
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="File name..."
                  className="flex-1 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-white/50"
                  autoFocus
                />
                <button type="submit" className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-sm">
                  Save
                </button>
                <button type="button" onClick={() => setIsCreatingFile(false)} className="px-2 py-1 text-white/50 hover:text-white">
                  <X size={14} />
                </button>
              </form>
            )}
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

          <div className="mt-6 pt-6 border-t border-white/10">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-white text-sm truncate max-w-[100px]">{user.displayName || 'User'}</span>
                    <span className="text-white/50 text-xs truncate max-w-[100px]">{user.email}</span>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
              >
                <LogIn size={16} /> Login with Google
              </button>
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
