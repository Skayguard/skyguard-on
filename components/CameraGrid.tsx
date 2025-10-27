import React from 'react';
import { Camera, Recording } from '../types';
import CameraView from './CameraView';

interface CameraGridProps {
  cameras: Camera[];
  onEditCamera: (camera: Camera) => void;
  onDeleteCamera: (id: string) => void;
  onTriggerMotion: (camera: Camera) => void;
  lastEventCameraId: string | null;
  onRecordingComplete: (recordingData: Omit<Recording, 'id' | 'videoUrl'>, videoBlob: Blob) => void;
  activeAutoRecordings: Set<string>;
}

const CameraGrid: React.FC<CameraGridProps> = ({ 
  cameras, 
  onEditCamera, 
  onDeleteCamera, 
  onTriggerMotion, 
  lastEventCameraId,
  onRecordingComplete,
  activeAutoRecordings
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
        />
      ))}
    </div>
  );
};

export default CameraGrid;