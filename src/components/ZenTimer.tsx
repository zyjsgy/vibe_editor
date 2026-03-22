import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export const ZenTimer: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isActive, setIsActive] = useState(false);
  const [duration, setDuration] = useState(25 * 60);

  useEffect(() => {
    let interval: number | undefined;
    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(duration);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = 1 - timeLeft / duration;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className={`absolute bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 transition-opacity duration-1000 z-50 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/10">
        <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r={radius}
              className="stroke-white/10"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="24"
              cy="24"
              r={radius}
              className="stroke-white/80 transition-all duration-1000 ease-linear"
              strokeWidth="3"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute text-[clamp(8px,1.5vw,12px)] font-mono text-white/90">
            {formatTime(timeLeft)}
          </div>
        </div>
        
        <div className="flex gap-1 sm:gap-1.5">
          <button onClick={toggleTimer} className="p-1 sm:p-1.5 text-white/60 hover:text-white transition-colors">
            {isActive ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button onClick={resetTimer} className="p-1 sm:p-1.5 text-white/60 hover:text-white transition-colors">
            <RotateCcw size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
