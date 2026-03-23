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
import { FolderOpen, FileText, Plus, X, Maximize, Minimize, LogIn, LogOut, FolderPlus, Folder, ChevronRight, ChevronDown, Book, ArrowLeft, Trash2 } from 'lucide-react';
import { signUpWithEmail, loginWithEmail, loginWithGoogle, logout } from './firebase';

function AppContent() {
  const [uiVisible, setUiVisible] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialContent, setInitialContent] = useState<string | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [currentNovelId, setCurrentNovelId] = useState<string | null>(null);
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean; message: string } | null>(null);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const { user } = useVibe();
  
  const { 
    files, 
    currentFile, 
    readFile, 
    saveFile, 
    createItem,
    deleteItem,
    moveItem
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
      setAlertDialog({ isOpen: true, message: "请先登录以创建云端文件。" });
      return;
    }
    if (!currentNovelId) {
      setAlertDialog({ isOpen: true, message: "请先选择一本小说。" });
      return;
    }
    if (newFileName.trim()) {
      const parent = activeParentId || currentNovelId;
      const initialHtml = `<h1>${newFileName.trim()}</h1>`;
      const newItem = await createItem(newFileName.trim(), 'file', parent, initialHtml);
      if (newItem) {
        // Set initial content to the chapter name
        setInitialContent(initialHtml);
        setSidebarOpen(false);
        setIsCreatingFile(false);
        setNewFileName('');
        setActiveParentId(null);
      }
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAlertDialog({ isOpen: true, message: "请先登录以创建云端文件夹。" });
      return;
    }
    if (newFolderName.trim()) {
      const parent = currentNovelId ? (activeParentId || currentNovelId) : null;
      const newItem = await createItem(newFolderName.trim(), 'folder', parent);
      if (newItem) {
        setIsCreatingFolder(false);
        setNewFolderName('');
        if (parent) {
          setExpandedFolders(prev => new Set(prev).add(parent));
        }
        setActiveParentId(null);
      }
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, chapterId: string) => {
    e.dataTransfer.setData('chapterId', chapterId);
  };

  const handleDrop = async (e: React.DragEvent, targetParentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const chapterId = e.dataTransfer.getData('chapterId');
    if (chapterId && chapterId !== targetParentId) {
      await moveItem(chapterId, targetParentId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      if (isLoginMode) {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('该邮箱已被注册');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError('邮箱或密码错误');
      } else if (error.code === 'auth/user-not-found') {
        setAuthError('找不到该用户');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('密码太弱，至少需要6位');
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('邮箱登录未开启，请在Firebase控制台启用');
      } else {
        setAuthError(error.message || '认证失败，请重试');
      }
    } finally {
      setIsAuthenticating(false);
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

      {/* Hover trigger for sidebar */}
      {!sidebarOpen && (
        <div 
          className="fixed top-0 left-0 w-6 h-full z-30 cursor-pointer"
          onMouseEnter={() => setSidebarOpen(true)}
        />
      )}

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`absolute top-0 left-0 h-full w-64 bg-black/40 backdrop-blur-xl border-r border-white/10 z-50 transform transition-transform duration-500 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        onMouseLeave={() => setSidebarOpen(false)}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white font-serif text-[clamp(14px,2vw,16px)]">
              {currentNovelId ? '章节列表' : '我的作品'}
            </h2>
            <button onClick={() => setSidebarOpen(false)} className="text-white/50 hover:text-white">
              <X size={18} />
            </button>
          </div>
          
          <div className="flex gap-2 mb-4">
            {!currentNovelId ? (
              <button 
                onClick={() => {
                  if (!user) {
                    setAlertDialog({ isOpen: true, message: "请先登录以创建小说。" });
                    return;
                  }
                  setIsCreatingFolder(true);
                }}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="新建小说"
              >
                <Book size={16} />
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setCurrentNovelId(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title="返回小说列表"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="flex-1"></div>
                <button 
                  onClick={() => {
                    if (!user) {
                      setAlertDialog({ isOpen: true, message: "请先登录以创建章节。" });
                      return;
                    }
                    setActiveParentId(currentNovelId);
                    setIsCreatingFile(true);
                    setIsCreatingFolder(false);
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title="新建章节"
                >
                  <Plus size={16} />
                </button>
                <button 
                  onClick={() => {
                    if (!user) {
                      setAlertDialog({ isOpen: true, message: "请先登录以创建分卷。" });
                      return;
                    }
                    setActiveParentId(currentNovelId);
                    setIsCreatingFolder(true);
                    setIsCreatingFile(false);
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title="新建分卷"
                >
                  <FolderPlus size={16} />
                </button>
              </>
            )}
          </div>
          
          <div className="flex flex-col gap-2 mb-4">
            {isCreatingFile && currentNovelId && activeParentId === currentNovelId && (
              <form onSubmit={handleCreateFileSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="章节名称 (回车保存)..."
                  className="flex-1 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-white/50"
                  autoFocus
                />
                <button type="button" onClick={() => setIsCreatingFile(false)} className="px-1 py-1 text-white/50 hover:text-white"><X size={12} /></button>
              </form>
            )}
            {isCreatingFolder && (!currentNovelId || activeParentId === currentNovelId) && (
              <form onSubmit={handleCreateFolderSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={currentNovelId ? "分卷名称 (回车保存)..." : "小说名称 (回车保存)..."}
                  className="flex-1 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-white/50"
                  autoFocus
                />
                <button type="button" onClick={() => setIsCreatingFolder(false)} className="px-1 py-1 text-white/50 hover:text-white"><X size={12} /></button>
              </form>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
            {!currentNovelId ? (
              // List Novels (Folders)
              <>
                {files.filter(f => f.type === 'folder' && !f.parentId).map(novel => (
                  <div key={novel.id} className="flex items-center group">
                    <button
                      onClick={() => setCurrentNovelId(novel.id)}
                      className="flex-1 flex items-center gap-2 p-2 rounded-lg text-left text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <Book size={14} className="text-white/40" />
                      <span className="truncate text-xs">{novel.name}</span>
                    </button>
                    <button 
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          message: `确定要删除小说 "${novel.name}" 吗？`,
                          onConfirm: () => deleteItem(novel.id)
                        });
                      }}
                      className="p-2 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all"
                      title="删除小说"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {files.filter(f => f.type === 'folder' && !f.parentId).length === 0 && (
                  <p className="text-white/30 text-xs text-center mt-4">暂无小说，请新建</p>
                )}
              </>
            ) : (
              // List Chapters and Volumes
              <div 
                className="flex-1 flex flex-col min-h-[100px]"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, currentNovelId)}
              >
                {/* Root Chapters */}
                {files.filter(f => f.parentId === currentNovelId && f.type === 'file').map(chapter => (
                  <ChapterItem 
                    key={chapter.id} 
                    chapter={chapter} 
                    isCurrent={currentFile?.id === chapter.id}
                    onClick={handleOpenFile}
                    onDelete={(id: string, name: string) => { 
                      setConfirmDialog({
                        isOpen: true,
                        message: `确定要删除章节 "${name}" 吗？`,
                        onConfirm: () => deleteItem(id)
                      });
                    }}
                    onDragStart={handleDragStart}
                  />
                ))}

                {/* Volumes */}
                {files.filter(f => f.parentId === currentNovelId && f.type === 'folder').map(volume => {
                  const isExpanded = expandedFolders.has(volume.id);
                  const volChapters = files.filter(f => f.parentId === volume.id && f.type === 'file');
                  
                  return (
                    <div 
                      key={volume.id} 
                      className="mt-2 mb-1"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, volume.id)}
                    >
                      <div 
                        className="flex items-center group bg-white/5 p-1.5 rounded-md cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => toggleFolder(volume.id)}
                      >
                        <span className="text-white/40 mr-1">{isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>
                        <span className="text-white/80 text-xs font-bold flex-1 truncate">{volume.name}</span>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveParentId(volume.id); setIsCreatingFile(true); setIsCreatingFolder(false); if(!isExpanded) toggleFolder(volume.id); }} 
                            className="p-1 text-white/40 hover:text-white"
                            title="在此分卷新建章节"
                          >
                            <Plus size={12}/>
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setConfirmDialog({
                                isOpen: true,
                                message: `确定要删除分卷 "${volume.name}" 及其下所有章节吗？`,
                                onConfirm: () => deleteItem(volume.id)
                              });
                            }} 
                            className="p-1 text-white/40 hover:text-red-400"
                            title="删除分卷"
                          >
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="flex flex-col gap-1 mt-1 pl-2 border-l border-white/10 ml-2 min-h-[20px]">
                          {isCreatingFile && activeParentId === volume.id && (
                            <form onSubmit={handleCreateFileSubmit} className="flex gap-2 mb-1">
                              <input 
                                type="text" 
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                placeholder="章节名称 (回车保存)..."
                                className="flex-1 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-white/50"
                                autoFocus
                              />
                              <button type="button" onClick={() => setIsCreatingFile(false)} className="px-1 py-1 text-white/50 hover:text-white"><X size={12} /></button>
                            </form>
                          )}
                          {volChapters.map(chapter => (
                            <ChapterItem 
                              key={chapter.id} 
                              chapter={chapter} 
                              isCurrent={currentFile?.id === chapter.id}
                              onClick={handleOpenFile}
                              onDelete={(id: string, name: string) => { 
                                setConfirmDialog({
                                  isOpen: true,
                                  message: `确定要删除章节 "${name}" 吗？`,
                                  onConfirm: () => deleteItem(id)
                                });
                              }}
                              onDragStart={handleDragStart}
                            />
                          ))}
                          {volChapters.length === 0 && (
                            <div className="text-white/20 text-[10px] italic py-1">拖拽章节到此分卷</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {files.filter(f => f.parentId === currentNovelId).length === 0 && (
                  <p className="text-white/30 text-xs text-center mt-4 pointer-events-none">暂无内容，请新建分卷或章节</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 opacity-40 hover:opacity-100 transition-opacity duration-300">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-[10px]">
                    {user.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white/60 text-[10px] truncate max-w-[80px]">{user.email?.split('@')[0]}</span>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="p-1 text-white/30 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
                  title="退出登录"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="flex flex-col gap-2">
                <h3 className="text-white/60 text-xs font-medium">{isLoginMode ? '登录' : '注册'}</h3>
                {authError && <p className="text-red-400 text-[10px]">{authError}</p>}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  required
                  className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white/80 text-xs focus:outline-none focus:border-white/30"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码 (至少6位)"
                  required
                  minLength={6}
                  className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white/80 text-xs focus:outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full flex items-center justify-center gap-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 rounded text-xs transition-colors disabled:opacity-50"
                >
                  {isAuthenticating ? '处理中...' : (isLoginMode ? '登录' : '注册')}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }}
                  className="text-white/40 hover:text-white/80 text-[10px] text-center mt-1"
                >
                  {isLoginMode ? '没有账号？点击注册' : '已有账号？点击登录'}
                </button>
                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink-0 mx-2 text-white/20 text-[10px]">或</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await loginWithGoogle();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 rounded text-xs transition-colors"
                >
                  <LogIn size={12} /> Google 账号登录
                </button>
              </form>
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

      {/* Alert Dialog */}
      {alertDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-white font-medium mb-4">提示</h3>
            <p className="text-white/70 text-sm mb-6">{alertDialog.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setAlertDialog(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-white font-medium mb-4">确认操作</h3>
            <p className="text-white/70 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 hover:bg-white/5 text-white/70 hover:text-white rounded-lg text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function ChapterItem({ chapter, isCurrent, onClick, onDelete, onDragStart }: any) {
  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart(e, chapter.id)}
      className={`flex items-center group p-1.5 rounded-lg text-left transition-colors cursor-grab active:cursor-grabbing ${isCurrent ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
    >
      <button onClick={() => onClick(chapter)} className="flex-1 flex items-center gap-2 overflow-hidden">
        <FileText size={14} className="text-white/40 flex-shrink-0" />
        <span className="truncate text-xs">{chapter.name.replace(/\.txt$/, '')}</span>
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(chapter.id, chapter.name); }}
        className="p-1 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all"
        title="删除章节"
      >
        <Trash2 size={12} />
      </button>
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
