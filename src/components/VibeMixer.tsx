import React, { useState } from 'react';
import { useVibe, Font } from '../store/VibeContext';
import { Settings, Download, Plus, X } from 'lucide-react';

export const VibeMixer: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const {
    intensity, setIntensity,
    speed, setSpeed,
    blur, setBlur,
    noiseVolume, setNoiseVolume,
    musicVolume, setMusicVolume,
    font, setFont,
    text,
    bgImage, setBgImage,
    bgDimness, setBgDimness,
    customImages, addCustomImage, removeCustomImage
  } = useVibe();

  const [isOpen, setIsOpen] = useState(false);

  const handleExport = () => {
    let exportText = text;
    if (text.includes('<') && text.includes('>')) {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.innerHTML = text;
      document.body.appendChild(tempDiv);
      
      const h1 = tempDiv.querySelector('h1');
      if (h1 && tempDiv.firstChild === h1) {
        const titleText = h1.innerText;
        h1.remove();
        exportText = `${titleText}\n\n${tempDiv.innerText}`;
      } else {
        exportText = tempDiv.innerText;
      }
      document.body.removeChild(tempDiv);
    }

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow-state.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (customImages.length >= 3) {
      alert('最多只能上传3张自定义背景图片。');
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      await addCustomImage(file);
    }
  };

  const defaultBg1Url = 'https://raw.githubusercontent.com/zyjsgy/image_store/main/1.png';
  const defaultBg2Url = 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1920&q=80';

  return (
    <div
      className={`absolute bottom-5 sm:bottom-6 right-5 sm:right-6 transition-opacity duration-1000 z-50 ${
        isVisible || isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {isOpen && (
        <div className="mb-4 p-6 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 w-80 text-white/90 shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar font-serif">
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="block text-[clamp(10px,1.5vw,12px)] uppercase tracking-wider text-white/50 mb-3">背景</label>
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 custom-scrollbar">
                <button 
                  onClick={() => setBgImage('default1')} 
                  className={`relative flex-shrink-0 w-16 h-10 rounded-lg bg-cover bg-center border-2 transition-colors ${bgImage === 'default1' ? 'border-white' : 'border-transparent hover:border-white/30'}`} 
                  style={{backgroundImage: `url(${defaultBg1Url})`}} 
                />
                <button 
                  onClick={() => setBgImage('default2')} 
                  className={`relative flex-shrink-0 w-16 h-10 rounded-lg bg-cover bg-center border-2 transition-colors ${bgImage === 'default2' ? 'border-white' : 'border-transparent hover:border-white/30'}`} 
                  style={{backgroundImage: `url(${defaultBg2Url})`}} 
                />
                {customImages.map(img => (
                  <div key={img.id} className="relative flex-shrink-0 w-16 h-10 group">
                    <button 
                      onClick={() => setBgImage(img.id)} 
                      className={`w-full h-full rounded-lg bg-cover bg-center border-2 transition-colors ${bgImage === img.id ? 'border-white' : 'border-transparent hover:border-white/30'}`} 
                      style={{backgroundImage: `url(${img.url})`}} 
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeCustomImage(img.id); }} 
                      className="absolute -top-2 -right-2 bg-red-500/80 hover:bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
                {customImages.length < 3 && (
                  <label className="flex-shrink-0 w-16 h-10 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/50 hover:bg-white/5 transition-all">
                    <Plus size={20} className="text-white/50" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-4">
              <Slider label="密度" value={intensity} onChange={setIntensity} />
              <Slider label="速度" value={speed} onChange={setSpeed} min={0.1} max={3} step={0.1} formatValue={(v) => `${v.toFixed(1)}x`} />
              <Slider label="模糊" value={blur} onChange={setBlur} />
              <Slider label="暗度" value={bgDimness} onChange={setBgDimness} />
            </div>
            
            <div className="pt-4 border-t border-white/10">
              <label className="block text-[clamp(10px,1.5vw,12px)] uppercase tracking-wider text-white/50 mb-3">字体</label>
              <div className="flex flex-nowrap gap-1">
                {(['font-sans', 'font-serif', 'font-mono', 'font-fangsong'] as Font[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFont(f)}
                    className={`flex-1 py-1.5 text-[clamp(10px,1.5vw,14px)] rounded-lg border transition-colors ${
                      font === f 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-transparent border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {f === 'font-fangsong' ? 'FangSong' : f.split('-')[1].charAt(0).toUpperCase() + f.split('-')[1].slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-3 mt-4 bg-white/10 hover:bg-white/20 transition-colors rounded-xl text-[clamp(12px,2vw,16px)] font-medium border border-white/5"
            >
              <Download size={16} />
              Export .txt
            </button>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 sm:p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all shadow-lg ml-auto block"
      >
        <Settings size={18} />
      </button>
    </div>
  );
};

const Slider = ({ 
  label, 
  value, 
  onChange, 
  min = 0, 
  max = 1, 
  step = 0.01,
  formatValue = (v: number) => `${Math.round(v * 100)}%`
}: { 
  label: string, 
  value: number, 
  onChange: (v: number) => void,
  min?: number,
  max?: number,
  step?: number,
  formatValue?: (v: number) => string
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[clamp(10px,1.5vw,12px)] text-white/60">
      <span>{label}</span>
      <span>{formatValue(value)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
    />
  </div>
);
