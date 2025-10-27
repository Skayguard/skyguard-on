import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { XMarkIcon, SpinnerIcon, SparklesIcon } from './icons/Icons';

interface GeminiAnalysisProps {
  imageDataUrl: string;
  onClose: () => void;
}

const GeminiAnalysis: React.FC<GeminiAnalysisProps> = ({ imageDataUrl, onClose }) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const analyzeImage = async () => {
            if (!imageDataUrl || !process.env.API_KEY) {
                setError("A chave de API não está configurada.");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);
            setAnalysis('');

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                const base64Data = imageDataUrl.split(',')[1];
                if (!base64Data) {
                    throw new Error("Formato de URL de dados de imagem inválido.");
                }

                const imagePart = {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64Data,
                    },
                };

                const textPart = {
                    text: 'Descreva esta imagem em detalhes. Identifique quaisquer objetos, pessoas ou atividades notáveis. Seja conciso, mas informativo.'
                };
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [imagePart, textPart] },
                });
                
                setAnalysis(response.text);

            } catch (e: any) {
                console.error("Erro na análise do Gemini:", e);
                setError(`Não foi possível analisar a imagem. ${e.message || ''}`);
            } finally {
                setIsLoading(false);
            }
        };

        analyzeImage();
    }, [imageDataUrl]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            onClose();
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
          window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl p-4 md:p-6 m-4 relative max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between pb-4 border-b border-gray-700">
                    <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6" />
                        Análise de Imagem com IA
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
                </header>

                <main className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col items-center">
                        <h3 className="text-lg font-semibold text-gray-300 mb-2">Imagem Capturada</h3>
                        <img src={imageDataUrl} alt="Imagem capturada para análise" className="rounded-lg shadow-md w-full object-contain" />
                    </div>
                    <div className="flex flex-col">
                         <h3 className="text-lg font-semibold text-gray-300 mb-2">Resultado da Análise</h3>
                        <div className="bg-gray-900/50 rounded-lg p-4 flex-1">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <SpinnerIcon className="w-8 h-8 animate-spin mb-2" />
                                    <p>Analisando com Gemini...</p>
                                </div>
                            )}
                            {error && (
                                <div className="flex flex-col items-center justify-center h-full text-red-400">
                                    <p className="font-semibold">Ocorreu um erro</p>
                                    <p className="text-sm text-center">{error}</p>
                                </div>
                            )}
                            {!isLoading && !error && (
                                <p className="text-gray-200 whitespace-pre-wrap">{analysis}</p>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default GeminiAnalysis;