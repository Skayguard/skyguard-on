import React from 'react';
import { MotionEvent } from '../types';
import { XMarkIcon, BellIcon } from './icons/Icons';

interface AlertsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  events: MotionEvent[];
  onClearAll: () => void;
}

// Função para formatar o tempo relativo
const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 5) return "agora mesmo";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " anos atrás";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses atrás";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " dias atrás";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " horas atrás";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutos atrás";
    return Math.floor(seconds) + " segundos atrás";
};


const AlertsSidebar: React.FC<AlertsSidebarProps> = ({ isOpen, onClose, events, onClearAll }) => {
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-gray-800 shadow-2xl transform transition-transform z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-cyan-400">Histórico de Alertas</h2>
                <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"
                    aria-label="Fechar painel de alertas"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </header>

            <div className="flex-grow overflow-y-auto">
                {events.length > 0 ? (
                    <ul>
                        {events.map(event => (
                            <li key={event.id} className="border-b border-gray-700/50 p-4 hover:bg-gray-700/50">
                                <p className="font-semibold text-white">Movimento detectado</p>
                                <p className="text-sm text-gray-300">Câmera: <span className="font-medium text-cyan-400">{event.cameraName}</span></p>
                                <p className="text-xs text-gray-400 mt-1">{timeAgo(event.timestamp)}</p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center p-10 flex flex-col items-center justify-center h-full">
                        <BellIcon className="w-16 h-16 text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-400">Nenhum evento registrado</h3>
                        <p className="text-sm text-gray-500">Eventos de movimento aparecerão aqui.</p>
                    </div>
                )}
            </div>
            {events.length > 0 && (
                <footer className="p-4 border-t border-gray-700">
                    <button
                        onClick={onClearAll}
                        className="w-full px-4 py-2 bg-red-600/80 text-white rounded-md hover:bg-red-600 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
                    >
                        Limpar Tudo
                    </button>
                </footer>
            )}
        </div>
      </div>
    </>
  );
};

export default AlertsSidebar;
