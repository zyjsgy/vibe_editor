import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { getImages, saveImage, deleteImage } from '../utils/db';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

export type Mode = 'rain' | 'snow';
export type Font = 'font-sans' | 'font-serif' | 'font-mono' | 'font-fangsong';

export interface CustomImage {
  id: string;
  url: string;
}

interface VibeState {
  mode: Mode;
  setMode: (mode: Mode) => void;
  text: string;
  setText: (text: string) => void;
  font: Font;
  setFont: (font: Font) => void;
  intensity: number;
  setIntensity: (val: number) => void;
  speed: number;
  setSpeed: (val: number) => void;
  blur: number;
  setBlur: (val: number) => void;
  noiseVolume: number;
  setNoiseVolume: (val: number) => void;
  musicVolume: number;
  setMusicVolume: (val: number) => void;
  bgImage: string;
  setBgImage: (url: string) => void;
  bgDimness: number;
  setBgDimness: (val: number) => void;
  customImages: CustomImage[];
  addCustomImage: (file: File) => Promise<void>;
  removeCustomImage: (id: string) => Promise<void>;
  user: User | null;
}

const VibeContext = createContext<VibeState | undefined>(undefined);

export const VibeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>('rain');
  const [text, setText] = useState<string>('');
  const [font, setFont] = useState<Font>('font-serif');
  const [intensity, setIntensity] = useState<number>(0.4);
  const [speed, setSpeed] = useState<number>(0.3);
  const [blur, setBlur] = useState<number>(0.6);
  const [noiseVolume, setNoiseVolume] = useState<number>(0.5);
  const [musicVolume, setMusicVolume] = useState<number>(0.5);
  const [bgImage, setBgImage] = useState<string>('default1');
  const [bgDimness, setBgDimness] = useState<number>(0.4);
  const [customImages, setCustomImages] = useState<CustomImage[]>([]);
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isRemoteUpdate = useRef(false);
  const isInitialized = useRef(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Load from localStorage and IndexedDB on mount
  useEffect(() => {
    const saved = localStorage.getItem('cyber-zen-vibe');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.mode) setMode(data.mode);
        if (data.text !== undefined) setText(data.text);
        if (data.font) setFont(data.font);
        if (data.intensity !== undefined) setIntensity(data.intensity);
        if (data.speed !== undefined) setSpeed(data.speed);
        if (data.blur !== undefined) setBlur(data.blur);
        if (data.noiseVolume !== undefined) setNoiseVolume(data.noiseVolume);
        if (data.musicVolume !== undefined) setMusicVolume(data.musicVolume);
        if (data.bgImage) {
          setBgImage(data.bgImage === 'default' ? 'default2' : data.bgImage);
        }
        if (data.bgDimness !== undefined) setBgDimness(data.bgDimness);
      } catch (e) {
        console.error('Failed to parse saved vibe state', e);
      }
    }

    getImages().then(images => {
      const loaded = images.map(img => ({
        id: img.id,
        url: URL.createObjectURL(img.file)
      }));
      setCustomImages(loaded);
    }).catch(err => console.error("Failed to load custom images", err));
    
    isInitialized.current = true;
  }, []);

  // Sync from Firestore
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const docRef = doc(db, `users/${user.uid}/settings/vibe`);
    
    // First check if document exists, if not, create it with current local state
    getDoc(docRef).then((snapshot) => {
      if (!snapshot.exists()) {
        const data = { mode, text, font, intensity, speed, blur, noiseVolume, musicVolume, bgImage, bgDimness, uid: user.uid };
        setDoc(docRef, data).catch(err => console.error("Error creating initial settings:", err));
      }
    });

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        isRemoteUpdate.current = true;
        if (data.mode) setMode(data.mode);
        if (data.text !== undefined) setText(data.text);
        if (data.font) setFont(data.font);
        if (data.intensity !== undefined) setIntensity(data.intensity);
        if (data.speed !== undefined) setSpeed(data.speed);
        if (data.blur !== undefined) setBlur(data.blur);
        if (data.noiseVolume !== undefined) setNoiseVolume(data.noiseVolume);
        if (data.musicVolume !== undefined) setMusicVolume(data.musicVolume);
        if (data.bgImage) setBgImage(data.bgImage);
        if (data.bgDimness !== undefined) setBgDimness(data.bgDimness);
        
        // Reset the flag after a short delay to allow state updates to process
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 100);
      }
    }, (error) => {
      console.error("Firestore Error: ", JSON.stringify({
        error: error.message,
        operationType: 'get',
        path: `users/${user.uid}/settings/vibe`,
        authInfo: { userId: user.uid }
      }));
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Save to localStorage and Firestore on change
  useEffect(() => {
    if (!isInitialized.current) return;
    
    const data = { mode, text, font, intensity, speed, blur, noiseVolume, musicVolume, bgImage, bgDimness };
    localStorage.setItem('cyber-zen-vibe', JSON.stringify(data));
    
    if (user && isAuthReady && !isRemoteUpdate.current) {
      const docRef = doc(db, `users/${user.uid}/settings/vibe`);
      setDoc(docRef, { ...data, uid: user.uid }, { merge: true }).catch(error => {
        console.error("Firestore Error: ", JSON.stringify({
          error: error.message,
          operationType: 'write',
          path: `users/${user.uid}/settings/vibe`,
          authInfo: { userId: user.uid }
        }));
      });
    }
  }, [mode, text, font, intensity, speed, blur, noiseVolume, musicVolume, bgImage, bgDimness, user, isAuthReady]);

  const addCustomImage = async (file: File) => {
    if (customImages.length >= 3) return;
    const id = Date.now().toString();
    await saveImage(id, file);
    const url = URL.createObjectURL(file);
    setCustomImages(prev => [...prev, { id, url }]);
    setBgImage(id);
  };

  const removeCustomImage = async (id: string) => {
    await deleteImage(id);
    setCustomImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const imgToRemove = prev.find(img => img.id === id);
      if (imgToRemove) URL.revokeObjectURL(imgToRemove.url);
      return filtered;
    });
    if (bgImage === id) setBgImage('default1');
  };

  return (
    <VibeContext.Provider
      value={{
        mode, setMode,
        text, setText,
        font, setFont,
        intensity, setIntensity,
        speed, setSpeed,
        blur, setBlur,
        noiseVolume, setNoiseVolume,
        musicVolume, setMusicVolume,
        bgImage, setBgImage,
        bgDimness, setBgDimness,
        customImages, addCustomImage, removeCustomImage,
        user
      }}
    >
      {children}
    </VibeContext.Provider>
  );
};

export const useVibe = () => {
  const context = useContext(VibeContext);
  if (!context) throw new Error('useVibe must be used within a VibeProvider');
  return context;
};
