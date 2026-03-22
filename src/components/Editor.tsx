import React, { useRef, useState, useEffect } from 'react';
import { useVibe } from '../store/VibeContext';
import { CloudRain, Snowflake } from 'lucide-react';

export const Editor: React.FC<{ 
  isVisible: boolean; 
  onSave?: (content: string) => void;
  initialContent?: string;
}> = ({ isVisible, onSave, initialContent }) => {
  const { text, setText, font, mode, setMode } = useVibe();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [wordCount, setWordCount] = useState(0);

  const parseContent = (content: string) => {
    if (content.includes('<') && content.includes('>')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const h1 = tempDiv.querySelector('h1');
      if (h1 && tempDiv.firstChild === h1) {
        const parsedTitle = h1.innerText;
        h1.remove();
        return { parsedTitle, parsedBody: tempDiv.innerHTML };
      }
      return { parsedTitle: '', parsedBody: content };
    } else {
      const match = content.match(/^([^\n]+)\n\n([\s\S]*)$/);
      let parsedTitle = '';
      let rawBody = content;
      
      if (match) {
        parsedTitle = match[1];
        rawBody = match[2];
      }
      
      // Convert plain text to divs so paragraph spacing applies
      const parsedBody = rawBody.replace(/\r/g, '').split('\n').map(line => `<div>${line || '<br>'}</div>`).join('');
      
      return { parsedTitle, parsedBody };
    }
  };

  const updateCounts = () => {
    if (editorRef.current) {
      const textContent = editorRef.current.innerText || '';
      const cjk = (textContent.match(/[\u4e00-\u9fa5]/g) || []).length;
      const eng = textContent.replace(/[\u4e00-\u9fa5]/g, ' ').trim().split(/\s+/).filter(w => w.length > 0).length;
      setWordCount(cjk + eng);
    }
  };

  // Sync initial content if provided (from file system)
  useEffect(() => {
    if (initialContent !== undefined && editorRef.current && editorRef.current.innerHTML !== initialContent) {
      const { parsedTitle, parsedBody } = parseContent(initialContent);
      setTitle(parsedTitle);
      editorRef.current.innerHTML = parsedBody;
      setText(initialContent);
      updateCounts();
    } else if (initialContent === undefined && editorRef.current && !editorRef.current.innerHTML && text) {
      // Load from local storage initially
      const { parsedTitle, parsedBody } = parseContent(text);
      setTitle(parsedTitle);
      editorRef.current.innerHTML = parsedBody;
      updateCounts();
    } else {
      updateCounts();
    }
  }, [initialContent]);

  const handleInput = () => {
    if (editorRef.current) {
      const body = editorRef.current.innerHTML;
      const fullContent = title ? `<h1>${title}</h1>${body}` : body;
      setText(fullContent);
      updateCounts();
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (editorRef.current) {
      const body = editorRef.current.innerHTML;
      const fullContent = newTitle ? `<h1>${newTitle}</h1>${body}` : body;
      setText(fullContent);
    }
  };

  const handleSave = () => {
    if (editorRef.current) {
      const bodyText = editorRef.current.innerText;
      const content = title ? `${title}\n\n${bodyText}` : bodyText;
      if (onSave) {
        onSave(content);
      } else {
        // Fallback download if no file system hooked up
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (title || 'zen-notes') + '.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        setTitle('');
        setText('');
        updateCounts();
      }
      setIsDeleting(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      const selection = window.getSelection();
      if (!selection || !selection.isCollapsed) return;

      const node = selection.anchorNode;
      if (!node) return;

      const textContent = node.textContent || '';
      const offset = selection.anchorOffset;
      const textBeforeCaret = textContent.slice(0, offset);

      if (textBeforeCaret === '-' || textBeforeCaret === '*') {
        e.preventDefault();
        selection.modify('extend', 'backward', 'character');
        document.execCommand('delete', false, undefined);
        document.execCommand('insertUnorderedList', false, undefined);
      } else if (textBeforeCaret.match(/^1\.$/)) {
        e.preventDefault();
        selection.modify('extend', 'backward', 'character');
        selection.modify('extend', 'backward', 'character');
        document.execCommand('delete', false, undefined);
        document.execCommand('insertOrderedList', false, undefined);
      }
    }
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setToolbarPos({
        top: rect.top - 40,
        left: rect.left + rect.width / 2 - 40
      });
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  };

  const changeFontSize = (delta: number) => {
    const currentSize = document.queryCommandValue('fontSize') || '3';
    let newSize = parseInt(currentSize) + delta;
    newSize = Math.max(1, Math.min(7, newSize));
    document.execCommand('fontSize', false, newSize.toString());
    handleSelection();
    handleInput();
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8 pointer-events-none">
      <div className={`flex gap-3 mb-4 sm:mb-6 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => setMode('rain')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md border transition-all duration-500 pointer-events-auto ${
            mode === 'rain' 
              ? 'bg-white/20 border-white/30 text-white shadow-lg' 
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          <CloudRain size={16} />
          <span className="text-[clamp(12px,2vw,14px)] font-medium">Rain</span>
        </button>
        <button
          onClick={() => setMode('snow')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-md border transition-all duration-500 pointer-events-auto ${
            mode === 'snow' 
              ? 'bg-white/20 border-white/30 text-white shadow-lg' 
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          <Snowflake size={16} />
          <span className="text-[clamp(12px,2vw,14px)] font-medium">Snow</span>
        </button>
      </div>

      <div className={`relative flex flex-col w-[95%] sm:w-[90%] md:w-[85%] lg:w-[80%] max-w-5xl h-[75vh] max-h-[calc(100vh-12rem)] p-6 sm:p-8 rounded-2xl pointer-events-auto transition-all duration-1000 ${
          isVisible 
            ? 'bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl' 
            : 'bg-transparent border-transparent shadow-none'
        }`}>
        
        {showToolbar && (
          <div 
            className="fixed z-50 flex gap-1 bg-black/60 backdrop-blur-md rounded-lg p-1 border border-white/10 shadow-xl"
            style={{ top: toolbarPos.top, left: toolbarPos.left }}
          >
            <button onMouseDown={(e) => { e.preventDefault(); changeFontSize(1); }} className="px-2 py-1 text-xs font-bold text-white hover:bg-white/20 rounded">A+</button>
            <button onMouseDown={(e) => { e.preventDefault(); changeFontSize(-1); }} className="px-2 py-1 text-xs font-bold text-white hover:bg-white/20 rounded">A-</button>
          </div>
        )}

        <div className="relative flex-1 min-h-0 w-full flex flex-col">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                editorRef.current?.focus();
              }
            }}
            placeholder="Title"
            className={`w-full bg-transparent outline-none mb-4 font-bold ${font} text-[clamp(12px,2vw,16px)] transition-all duration-300 ${
              isVisible ? 'text-white/90' : 'text-white/20'
            } ${isDeleting ? 'animate-fog-fade' : ''}`}
          />
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onMouseUp={handleSelection}
            onKeyDown={handleKeyDown}
            onKeyUp={handleSelection}
            data-placeholder="Enter your flow state..."
            className={`editor-content flex-1 overflow-y-auto custom-scrollbar outline-none resize-none break-words whitespace-pre-wrap ${font} text-[clamp(10px,1.5vw,14px)] leading-relaxed transition-all duration-300 ${
              isVisible ? 'text-white/90 scrollbar-visible' : 'text-white/20 scrollbar-hidden'
            } ${isDeleting ? 'animate-fog-fade' : ''}`}
          />
        </div>

        <div className={`absolute bottom-2 left-6 sm:bottom-3 sm:left-8 text-white/20 text-[clamp(8px,1.5vw,12px)] font-sans tracking-widest pointer-events-none transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'} ${isDeleting ? 'animate-fog-fade' : ''}`}>
          {wordCount} WORDS
        </div>
      </div>

      <div className="w-[95%] sm:w-[90%] md:w-[85%] lg:w-[80%] max-w-5xl px-2 sm:px-4 mt-3 sm:mt-4 flex justify-start pointer-events-none">
        <div className={`flex gap-6 text-[clamp(10px,1.5vw,14px)] font-sans tracking-widest font-medium pointer-events-auto transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={handleSave} className="text-white/50 hover:text-white transition-colors uppercase">SAVE</button>
          <button onClick={handleDelete} className="text-white/50 hover:text-white transition-colors uppercase">DELETE</button>
        </div>
      </div>
    </div>
  );
};
