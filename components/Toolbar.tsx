import React from 'react';
import { PlusIcon, BellIcon, FilmIcon, PositioningIcon } from './icons/Icons';

interface ToolbarProps {
  onAddCamera: () => void;
  onToggleAlerts: () => void;
  onToggleRecordings: () => void;
  onTogglePositioningTool: () => void;
  unseenAlertsCount: number;
}

const ToolbarButton: React.FC<{
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  hasNotification?: boolean;
}> = ({ onClick, label, children, hasNotification }) => (
  <div className="relative group">
    <button
      onClick={onClick}
      className="flex items-center justify-center w-12 h-12 text-gray-400 hover:bg-cyan-600/20 hover:text-cyan-400 rounded-lg transition-all"
      aria-label={label}
    >
      {children}
      {hasNotification && (
         <span className="absolute top-2 right-2 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-gray-900" />
      )}
    </button>
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1 bg-gray-700 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
      {label}
    </div>
  </div>
);


const Toolbar: React.FC<ToolbarProps> = ({ onAddCamera, onToggleAlerts, onToggleRecordings, onTogglePositioningTool, unseenAlertsCount }) => {
  return (
    <div className="fixed top-0 left-0 h-screen w-16 bg-gray-800/50 backdrop-blur-lg flex flex-col items-center py-4 space-y-4 z-40 border-r border-gray-700/50">
        <ToolbarButton onClick={onAddCamera} label="Adicionar Câmera">
            <PlusIcon className="w-6 h-6" />
        </ToolbarButton>
        <ToolbarButton onClick={onToggleAlerts} label="Ver Alertas" hasNotification={unseenAlertsCount > 0}>
            <BellIcon className="w-6 h-6" />
        </ToolbarButton>
        <ToolbarButton onClick={onToggleRecordings} label="Minhas Gravações">
            <FilmIcon className="w-6 h-6" />
        </ToolbarButton>
        <ToolbarButton onClick={onTogglePositioningTool} label="Calculadora de Posição">
            <PositioningIcon className="w-6 h-6" />
        </ToolbarButton>
    </div>
  );
};

export default Toolbar;
