import React from 'react';
import { Camera, Recording } from '../types';
import CameraView from './CameraView';

interface CameraGridProps {
  cameras: Camera[];
  onEditCamera: (camera: Camera) => void;
  onDeleteCamera: (id: string) => void;
  onTriggerMotion: (camera: Camera, imageDataUrl: string) => void;
  lastEventCameraId: string | null;
  onRecordingComplete: (recordingData: Omit<Recording, 'id' | 'videoUrl' | 'analysis'>, videoBlob: Blob, isAuto: boolean) => void;
  activeAutoRecordings: Set<string>;
  analyzingCameraId: string | null;
  selectedCameraId: string | null;
  onSelectCamera: (id: string) => void;
}

const CameraGrid: React.FC<CameraGridProps> = ({ 
  cameras, 
  onEditCamera, 
  onDeleteCamera, 
  onTriggerMotion, 
  lastEventCameraId,
  onRecordingComplete,
  activeAutoRecordings,
  analyzingCameraId,
  selectedCameraId,
  onSelectCamera,
}) => {

  const selectedCamera = cameras.find(c => c.id === selectedCameraId);
  const thumbnailCameras = cameras.filter(c => c.id !== selectedCameraId);

  if (!selectedCamera) {
    return null; // ou um estado de carregamento/vazio
  }

  return (
    <div className="flex flex-row h-full max-h-[calc(100vh-4rem)]">
      {/* Main Camera View */}
      <div className="flex-grow flex items-center justify-center min-h-0 p-4 md:p-6">
        <div className="w-full h-full max-w-7xl max-h-full rounded-lg border-2 border-solid border-[#FF0000]">
            <CameraView
              key={selectedCamera.id}
              camera={selectedCamera}
              onEdit={onEditCamera}
              onDelete={onDeleteCamera}
              onTriggerMotion={onTriggerMotion}
              isGlowing={selectedCamera.id === lastEventCameraId}
              onRecordingComplete={onRecordingComplete}
              isAutoRecordingActive={activeAutoRecordings.has(selectedCamera.id)}
              isAnalyzing={analyzingCameraId === selectedCamera.id}
            />
        </div>
      </div>

      {/* Thumbnail Sidebar */}
      {thumbnailCameras.length > 0 && (
        <div className="flex-shrink-0 w-1/4 max-w-xs bg-gray-900/30 p-4 flex flex-col border-l border-gray-700/50">
          <h3 className="text-lg font-semibold text-gray-400 mb-4 flex-shrink-0">Outras Câmeras</h3>
          <div className="flex-grow overflow-y-auto space-y-4 -mr-2 pr-2">
            {thumbnailCameras.map((camera) => (
              <div key={camera.id} className="w-full aspect-video">
                 <CameraView
                    camera={camera}
                    isThumbnail={true}
                    onClick={() => onSelectCamera(camera.id)}
                    // Props não utilizadas no modo miniatura, mas necessárias pela interface
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onTriggerMotion={() => {}}
                    isGlowing={false}
                    onRecordingComplete={() => {}}
                    isAutoRecordingActive={false}
                    isAnalyzing={false}
                  />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraGrid;