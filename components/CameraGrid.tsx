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
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4 md:p-6">
      {cameras.map((camera) => (
        <CameraView
          key={camera.id}
          camera={camera}
          onEdit={onEditCamera}
          onDelete={onDeleteCamera}
          onTriggerMotion={onTriggerMotion}
          isGlowing={camera.id === lastEventCameraId}
          onRecordingComplete={onRecordingComplete}
          isAutoRecordingActive={activeAutoRecordings.has(camera.id)}
          isAnalyzing={analyzingCameraId === camera.id}
        />
      ))}
    </div>
  );
};

export default CameraGrid;