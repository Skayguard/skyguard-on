import React, { useState } from 'react';
import { Recording } from '../types';
import { XMarkIcon, FilmIcon, DownloadIcon, TrashIcon, SparklesIcon, SpinnerIcon } from './icons/Icons';
import { GoogleGenAI } from "@google/genai";

interface RecordingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  recordings: Recording[];
  onDelete: (id: string) => void;
}

const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 5) return "agora mesmo";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " anos";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " dias";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " horas";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutos";
    return Math.floor(seconds) + " segundos";
};

// Helper to extract a single frame from a video URL at a specific time
const extractFrame = (videoUrl: string, time: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true; // Necessary for autoplay in some browsers
    video.playsInline = true; // iOS fix
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onseeked = () => {
      if (!ctx) {
        reject(new Error("Não foi possível obter o contexto do canvas"));
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.src = ""; // Clean up
      resolve(canvas.toDataURL('image/jpeg'));
    };
    
    video.onloadeddata = () => {
        video.currentTime = time;
    };

    video.onerror = () => {
      reject(new Error("Falha ao carregar o vídeo para extração de quadro."));
    };

    video.src = videoUrl;
  });
};

const getVideoDuration = (videoUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            resolve(video.duration);
        };
        video.onerror = () => {
            reject(new Error("Não foi possível carregar os metadados do vídeo."));
        };
        video.src = videoUrl;
    });
}

const RecordingsSidebar: React.FC<RecordingsSidebarProps> = ({ isOpen, onClose, recordings, onDelete }) => {
  const [analysisResults, setAnalysisResults] = useState<{ [key: string]: string }>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<{ [key: string]: boolean }>({});
  const [errorAnalysis, setErrorAnalysis] = useState<{ [key: string]: string | null }>({});

  const handleAnalyzeRecording = async (rec: Recording) => {
    if (!process.env.API_KEY) {
        setErrorAnalysis(prev => ({ ...prev, [rec.id]: "A chave de API não está configurada." }));
        return;
    }
    
    setLoadingAnalysis(prev => ({ ...prev, [rec.id]: true }));
    setErrorAnalysis(prev => ({ ...prev, [rec.id]: null }));
    
    try {
        const duration = await getVideoDuration(rec.videoUrl);
        
        // Define times for frame extraction
        let frameTimes = [duration * 0.1, duration * 0.5, duration * 0.9];
        if (duration < 2) { // If video is too short, just take one frame
          frameTimes = [duration * 0.5];
        }

        const framePromises = frameTimes.map(time => extractFrame(rec.videoUrl, time));
        const frameDataUrls = await Promise.all(framePromises);

        const imageParts = frameDataUrls.map(dataUrl => ({
            inlineData: {
                mimeType: 'image/jpeg',
                data: dataUrl.split(',')[1],
            },
        }));

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const textPart = {
            text: 'Com base nestes quadros de uma gravação de câmera de segurança, descreva os principais eventos ou objetos de interesse no vídeo. Forneça um resumo conciso.'
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, ...imageParts] },
        });
        
        setAnalysisResults(prev => ({ ...prev, [rec.id]: response.text }));

    } catch (e: any) {
        console.error("Erro ao analisar o vídeo:", e);
        setErrorAnalysis(prev => ({ ...prev, [rec.id]: `Falha na análise: ${e.message}` }));
    } finally {
        setLoadingAnalysis(prev => ({ ...prev, [rec.id]: false }));
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-gray-800 shadow-2xl transform transition-transform z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-cyan-400">Minhas Gravações</h2>
                <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
                    aria-label="Fechar painel de gravações"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </header>

            <div className="flex-grow overflow-y-auto">
                {recordings.length > 0 ? (
                    <ul className="p-2 space-y-2">
                        {recordings.map(rec => (
                            <li key={rec.id} className="bg-gray-700/50 rounded-lg p-3">
                                <video src={rec.videoUrl} controls className="w-full rounded aspect-video mb-2 bg-black"></video>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-white">{rec.cameraName}</p>
                                        <p className="text-xs text-gray-400 mt-1">{timeAgo(rec.timestamp)} atrás</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <button
                                            onClick={() => handleAnalyzeRecording(rec)}
                                            disabled={loadingAnalysis[rec.id]}
                                            className="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-600 rounded-full disabled:opacity-50 disabled:cursor-wait transition-colors"
                                            title="Analisar gravação com IA"
                                        >
                                            {loadingAnalysis[rec.id] ? <SpinnerIcon className="w-5 h-5 animate-spin"/> : <SparklesIcon className="w-5 h-5"/>}
                                        </button>
                                        <a 
                                            href={rec.videoUrl} 
                                            download={rec.fileName}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full"
                                            title="Baixar gravação"
                                        >
                                            <DownloadIcon className="w-5 h-5"/>
                                        </a>
                                        <button 
                                            onClick={() => onDelete(rec.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-900/50 rounded-full"
                                            title="Excluir gravação"
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 text-sm text-gray-300 bg-gray-900/50 p-2 rounded-md">
                                    {loadingAnalysis[rec.id] && <p className="text-gray-400 italic">Analisando vídeo...</p>}
                                    {errorAnalysis[rec.id] && <p className="text-red-400">{errorAnalysis[rec.id]}</p>}
                                    {analysisResults[rec.id] && <p className="whitespace-pre-wrap">{analysisResults[rec.id]}</p>}
                                    {!analysisResults[rec.id] && !loadingAnalysis[rec.id] && !errorAnalysis[rec.id] &&
                                        <p className="text-gray-500 italic text-xs">Clique em ✨ para gerar um resumo do vídeo.</p>
                                    }
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center p-10 flex flex-col items-center justify-center h-full">
                        <FilmIcon className="w-16 h-16 text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-400">Nenhuma gravação salva</h3>
                        <p className="text-sm text-gray-500">Gravações manuais ou de eventos aparecerão aqui.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </>
  );
};

export default RecordingsSidebar;