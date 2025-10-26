import React from 'react';
import { Recording } from '../types';
import { XMarkIcon, FilmIcon, DownloadIcon, TrashIcon } from './icons/Icons';

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

const RecordingsSidebar: React.FC<RecordingsSidebarProps> = ({ isOpen, onClose, recordings, onDelete }) => {
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
                                    <div className="flex gap-2">
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
