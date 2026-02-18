
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from './types';
import { generateTextImage, generateTextVideo, generateStyleSuggestion, generateAdCaption } from './services/geminiService';
import { getRandomStyle, fileToBase64, TYPOGRAPHY_SUGGESTIONS } from './utils';
import { Loader2, Play, Type, Sparkles, Image as ImageIcon, X, Upload, Wand2, ArrowLeft, Key, Twitter, Instagram, Copy, Check, Paintbrush, Phone, User, Globe, Share2, Smartphone } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  videoUrl: string;
  description: string;
}

interface UserProfile {
  name: string;
  phone: string;
  instagram: string;
  twitter: string;
  tiktok: string;
}

const staticFilesUrl = 'https://www.gstatic.com/aistudio/starter-apps/type-motion/';

export const MOCK_VIDEOS: Video[] = [
  { id: '1', title: "Cloud Formations", videoUrl: staticFilesUrl + 'clouds_v2.mp4', description: "Text formed by clouds." },
  { id: '2', title: "Elemental Fire", videoUrl: staticFilesUrl + 'fire_v2.mp4', description: "Flames erupt into text." },
  { id: '3', title: "Mystic Smoke", videoUrl: staticFilesUrl + 'smoke_v2.mp4', description: "Smoke reveals the text." },
  { id: '4', title: "Water Blast", videoUrl: staticFilesUrl + 'water_v2.mp4', description: "A wall of water punching through." },
];

// Missing HeroCarousel component for background animation
const HeroCarousel: React.FC<{ forceMute?: boolean }> = ({ forceMute }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MOCK_VIDEOS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[2.5rem]">
      {MOCK_VIDEOS.map((video, idx) => (
        <div
          key={video.id}
          className={`absolute inset-0 transition-opacity duration-[2000ms] ${idx === currentIndex ? 'opacity-100' : 'opacity-0'}`}
        >
          <video
            src={video.videoUrl}
            autoPlay
            loop
            muted={forceMute || true}
            playsInline
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
        </div>
      ))}
    </div>
  );
};

// Missing ApiKeyDialog component for API key selection
const ApiKeyDialog: React.FC<{ isOpen: boolean; onClose: () => void; onSelect: () => void }> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 bg-white text-black rounded-xl flex items-center justify-center font-serif italic text-2xl">K</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">API Key Required</h3>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
          To generate cinematic videos with Veo, you need to use your own Google Cloud API key from a paid project with billing enabled.
        </p>
        <div className="space-y-4">
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-center py-4 border border-zinc-800 rounded-xl text-zinc-400 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
          >
            Billing Documentation
          </a>
          <button 
            onClick={onSelect}
            className="w-full py-4 bg-white text-black font-black rounded-xl hover:bg-zinc-200 transition-colors uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Key size={18} /> Select API Key
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [viewMode, setViewMode] = useState<'gallery' | 'create' | 'auth'>('gallery');
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [contentUrl, setContentUrl] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [inputStyle, setInputStyle] = useState<string>("");
  const [typographyPrompt, setTypographyPrompt] = useState<string>("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [adCaption, setAdCaption] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSuggestingStyle, setIsSuggestingStyle] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar perfil do localStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('typeMotion_profile');
    if (saved) {
      setUserProfile(JSON.parse(saved));
    }
  }, []);

  const handleMainCta = async () => {
    if (!userProfile) {
      setViewMode('auth');
      return;
    }
    // @ts-ignore - aistudio is injected by the environment
    const isKeySelected = await window.aistudio?.hasSelectedApiKey();
    if (!isKeySelected) setShowKeyDialog(true);
    else setViewMode('create');
  };

  const saveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const profile: UserProfile = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      instagram: formData.get('instagram') as string,
      twitter: formData.get('twitter') as string,
      tiktok: formData.get('tiktok') as string,
    };
    setUserProfile(profile);
    localStorage.setItem('typeMotion_profile', JSON.stringify(profile));
    setViewMode('gallery');
  };

  const startProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    // @ts-ignore - aistudio is injected by the environment
    const keySelected = await window.aistudio?.hasSelectedApiKey();
    if (!keySelected) { setShowKeyDialog(true); return; }

    setState(AppState.GENERATING_IMAGE);
    setVideoSrc(null);
    setImageSrc(null);
    setAdCaption("");
    
    const styleToUse = inputStyle.trim() || getRandomStyle();
    setStatusMessage("Analisando produto...");

    try {
      // Primeiro gera a propaganda para usá-la como legenda no vídeo
      const generatedCaption = await generateAdCaption(inputText, styleToUse, contentUrl);
      setAdCaption(generatedCaption);

      const { data: b64Image, mimeType } = await generateTextImage({
        text: inputText, 
        style: styleToUse,
        typographyPrompt: typographyPrompt,
        referenceImage: referenceImage || undefined
      });

      setImageSrc(`data:${mimeType};base64,${b64Image}`);
      setState(AppState.GENERATING_VIDEO);
      setStatusMessage("Criando vídeo com legenda estética...");
      
      const videoUrl = await generateTextVideo(inputText, b64Image, mimeType, styleToUse, generatedCaption);

      setVideoSrc(videoUrl);
      setState(AppState.PLAYING);
    } catch (err: any) {
      setStatusMessage(err.message || "Erro ao processar.");
      setState(AppState.ERROR);
    }
  };

  const handleCopyCaption = () => {
    const textToCopy = `${adCaption}\n\nCompre aqui: ${contentUrl}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(`${adCaption}\n\n${contentUrl}`);
    const twitterUrl = userProfile?.twitter || 'https://twitter.com/intent/tweet';
    const baseUrl = twitterUrl.includes('intent/tweet') ? twitterUrl : `https://twitter.com/intent/tweet`;
    window.open(`${baseUrl}?text=${text}`, '_blank');
  };

  const handleShareInstagram = () => {
    handleCopyCaption();
    alert("Texto e link copiados! Abrindo seu Instagram...");
    const instaLink = userProfile?.instagram || 'https://www.instagram.com/';
    window.open(instaLink, '_blank');
  };

  const AuthScreen = () => (
    <div className="h-full w-full bg-[#0d0d0d] flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="w-full max-w-xl bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-10 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white text-black rounded-2xl flex items-center justify-center font-serif italic text-3xl mx-auto mb-6 shadow-xl">T</div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic mb-2">Seu Perfil</h2>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Cadastre suas redes para compartilhar</p>
        </div>

        <form onSubmit={saveProfile} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
              <input name="name" defaultValue={userProfile?.name} required placeholder="Seu Nome Completo" className="w-full bg-[#151515] border border-zinc-800 rounded-xl pl-12 pr-5 py-4 text-white placeholder-zinc-700 focus:border-zinc-500 outline-none transition-all" />
            </div>
            
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
              <input name="phone" defaultValue={userProfile?.phone} required placeholder="WhatsApp (ex: 11999999999)" className="w-full bg-[#151515] border border-zinc-800 rounded-xl pl-12 pr-5 py-4 text-white placeholder-zinc-700 focus:border-zinc-500 outline-none transition-all" />
            </div>

            <div className="pt-4 space-y-4">
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] px-2">Suas Redes Sociais</label>
              
              <div className="relative">
                <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input name="instagram" defaultValue={userProfile?.instagram} placeholder="Link do seu Instagram" className="w-full bg-[#151515] border border-zinc-800 rounded-xl pl-12 pr-5 py-4 text-sm text-white placeholder-zinc-700 focus:border-zinc-500 outline-none transition-all" />
              </div>

              <div className="relative">
                <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input name="twitter" defaultValue={userProfile?.twitter} placeholder="Link do seu Twitter/X" className="w-full bg-[#151515] border border-zinc-800 rounded-xl pl-12 pr-5 py-4 text-sm text-white placeholder-zinc-700 focus:border-zinc-500 outline-none transition-all" />
              </div>

              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input name="tiktok" defaultValue={userProfile?.tiktok} placeholder="Link do seu TikTok" className="w-full bg-[#151515] border border-zinc-800 rounded-xl pl-12 pr-5 py-4 text-sm text-white placeholder-zinc-700 focus:border-zinc-500 outline-none transition-all" />
              </div>
            </div>
          </div>

          <button type="submit" className="w-full py-5 bg-white text-black font-black rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 text-lg tracking-widest uppercase mt-4">
            SALVAR E CONTINUAR
          </button>
          
          <button type="button" onClick={() => setViewMode('gallery')} className="w-full py-2 text-zinc-600 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );

  const renderAppContent = () => {
    if (viewMode === 'auth') return <AuthScreen />;

    if (state === AppState.GENERATING_IMAGE || state === AppState.GENERATING_VIDEO || state === AppState.PLAYING) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-start p-8 bg-[#0d0d0d] overflow-y-auto custom-scrollbar">
          {state !== AppState.PLAYING && (
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-zinc-900/50 border border-zinc-800 mb-8 animate-pulse">
               <Loader2 size={18} className="animate-spin text-white" />
               <span className="text-sm font-bold text-white uppercase tracking-widest">{statusMessage}</span>
            </div>
          )}
          
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-zinc-800">
            {state === AppState.GENERATING_IMAGE && !imageSrc && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-700" size={48} /></div>}
            {imageSrc && !videoSrc && <img src={imageSrc} className="w-full h-full object-cover" />}
            {videoSrc && <video src={videoSrc} autoPlay loop playsInline controls className="w-full h-full object-cover" />}
          </div>

          {state === AppState.PLAYING && (
            <div className="w-full max-w-4xl mt-10 space-y-6 animate-in slide-in-from-bottom-4 duration-1000">
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 backdrop-blur-md">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Propaganda Gerada</h4>
                  <button onClick={handleCopyCaption} className="text-xs flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar Texto'}
                  </button>
                </div>
                <p className="text-xl font-medium text-white italic leading-relaxed">"{adCaption}"</p>
                {contentUrl && <div className="mt-6 pt-6 border-t border-zinc-800/50 text-zinc-500 text-sm font-mono truncate">Link do Material: {contentUrl}</div>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={handleShareTwitter} className="py-4 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all flex items-center justify-center gap-3">
                  <Twitter size={20} fill="currentColor" /> TWITTER
                </button>
                <button onClick={handleShareInstagram} className="py-4 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white font-black rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-3">
                  <Instagram size={20} /> INSTAGRAM
                </button>
              </div>
              
              <div className="flex justify-center pt-4">
                <button onClick={() => setState(AppState.IDLE)} className="text-zinc-600 hover:text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-colors">
                  <ArrowLeft size={14} /> Criar Novo Material
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto p-8 lg:p-12 bg-[#0d0d0d] custom-scrollbar">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Create New</h2>
            {userProfile && (
              <button onClick={() => setViewMode('auth')} className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all">
                <Smartphone size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{userProfile.name.split(' ')[0]}</span>
              </button>
            )}
          </div>
          <button onClick={() => setViewMode('gallery')} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={startProcess} className="space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-12">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Type size={12} /> CONTENT URL
                </label>
                <input type="url" value={contentUrl} onChange={(e) => setContentUrl(e.target.value)} placeholder="https://mercadolivre.com/..." className="w-full bg-[#151515] border border-zinc-800 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-zinc-600 transition-all text-white placeholder-zinc-800 font-mono" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Wand2 size={12} /> ART DIRECTION
                  </label>
                  <button type="button" onClick={async () => {
                    if (!inputText) return;
                    setIsSuggestingStyle(true);
                    setInputStyle(await generateStyleSuggestion(inputText));
                    setIsSuggestingStyle(false);
                  }} disabled={!inputText.trim() || isSuggestingStyle} className="text-[10px] font-black text-zinc-500 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-20">
                      {isSuggestingStyle ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} SUGGEST
                  </button>
                </div>
                <div className="space-y-4">
                  <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Título ou Nome do Produto" className="w-full bg-[#151515] border border-zinc-800 rounded-xl px-5 py-4 text-lg font-bold text-white placeholder-zinc-800" required />
                  <textarea value={inputStyle} onChange={(e) => setInputStyle(e.target.value)} placeholder="Descrição visual para o vídeo..." className="w-full bg-[#151515] border border-zinc-800 rounded-xl p-5 text-sm h-40 text-white placeholder-zinc-800 resize-none leading-relaxed" />
                </div>
              </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Paintbrush size={12} /> TYPOGRAPHY
                </label>
                <textarea value={typographyPrompt} onChange={(e) => setTypographyPrompt(e.target.value)} placeholder="Refined, luxury editorial look..." className="w-full bg-[#151515] border border-zinc-800 rounded-xl p-5 text-sm h-32 text-white placeholder-zinc-800 resize-none" />
                <div className="flex flex-wrap gap-2 pt-2">
                  {TYPOGRAPHY_SUGGESTIONS.slice(0, 4).map((opt) => (
                    <button key={opt.id} type="button" onClick={() => setTypographyPrompt(opt.prompt)} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 text-[9px] font-black rounded-lg border border-zinc-800 transition-colors uppercase tracking-widest">{opt.label}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ImageIcon size={12} /> REF IMAGE
                </label>
                <div className="flex items-center gap-4">
                   <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl h-20 flex items-center justify-center gap-3 text-zinc-700 hover:border-zinc-500 hover:text-zinc-500 transition-all text-[10px] font-black uppercase tracking-widest">
                    <Upload size={18} /> Upload
                  </button>
                  <input type="file" ref={fileInputRef} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setReferenceImage(await fileToBase64(file));
                  }} accept="image/*" className="sr-only" />
                   {referenceImage && (
                    <div className="h-20 w-20 relative rounded-xl overflow-hidden border border-zinc-800 group">
                       <img src={referenceImage} className="w-full h-full object-cover" />
                       <button type="button" onClick={() => setReferenceImage(null)} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={20} className="text-white" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-zinc-900">
            <button type="submit" disabled={!inputText.trim() || state !== AppState.IDLE} className="w-full py-6 bg-white text-black font-black rounded-2xl hover:bg-zinc-200 transition-all disabled:opacity-20 flex items-center justify-center gap-4 text-xl tracking-[0.3em] shadow-2xl shadow-white/5 active:scale-[0.98]">
              <Play size={24} fill="currentColor" /> GENERATE
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-black text-white selection:bg-white selection:text-black font-sans overflow-x-hidden">
      <ApiKeyDialog isOpen={showKeyDialog} onClose={() => setShowKeyDialog(false)} onSelect={async () => { setShowKeyDialog(false); 
        // @ts-ignore
        await window.aistudio.openSelectKey(); setViewMode('create'); }} />
      <div className="h-screen flex items-center justify-center p-4 lg:p-10">
        <div className={`transition-all duration-1000 ease-[cubic-bezier(0.25,0.8,0.25,1)] w-full max-7xl h-full flex flex-col relative ${viewMode === 'create' || viewMode === 'auth' ? '' : 'lg:flex-row'}`}>
          <div className={`transition-all duration-1000 w-full h-full relative ${viewMode === 'create' || viewMode === 'auth' ? 'hidden' : 'block'}`}>
            <HeroCarousel forceMute={viewMode === 'create' || viewMode === 'auth'} />
            <div className="absolute top-12 left-12 flex items-center gap-3">
              <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center font-serif italic text-xl">T</div>
              <span className="font-black text-xl tracking-tighter uppercase italic">TypeMotion</span>
            </div>
            <div className="absolute top-1/2 left-12 -translate-y-1/2 space-y-8">
              <h1 className="text-7xl font-black tracking-tighter leading-[0.85] uppercase italic">Motion<br/>Design<br/><span className="text-zinc-500">for Ads</span></h1>
              <button onClick={handleMainCta} className="px-10 py-5 bg-white text-black text-lg font-black rounded-full hover:scale-105 transition-transform shadow-2xl shadow-white/10 flex items-center gap-3">
                {userProfile ? 'CRIAR AGORA' : 'CADASTRE-SE'}
              </button>
            </div>
          </div>

          <div className={`transition-all duration-1000 w-full h-full bg-[#0d0d0d] border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl ${viewMode === 'create' || viewMode === 'auth' ? 'block' : 'hidden'}`}>
             {renderAppContent()}
          </div>
        </div>
      </div>
      <footer className="fixed bottom-6 w-full text-center text-[10px] font-black text-zinc-800 tracking-widest uppercase pointer-events-none">Created by @GeokenAI</footer>
    </div>
  );
};

export default App;
