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
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] p-4 md:p-6 gap-4">
      {/* Main Camera View */}
      <div className="flex-grow flex items-center justify-center min-h-0">
        <div className="w-full h-full max-w-6xl max-h-full">
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

      {/* Thumbnail Strip */}
      {thumbnailCameras.length > 0 && (
        <div className="flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-400 mb-3 px-2">Outras Câmeras</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
            {thumbnailCameras.map((camera) => (
              <div key={camera.id} className="w-48 xl:w-56 flex-shrink-0" >
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