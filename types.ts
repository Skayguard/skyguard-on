export interface DetectionZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  id: string;
  name: string;
  type: 'ip' | 'usb';
  streamUrl?: string;
  deviceId?: string;
  motionDetectionEnabled?: boolean;
  motionDetectionSensitivity?: number;
  motionDetectionZones?: DetectionZone[];
}

export interface MotionEvent {
  id:string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
}

export interface Recording {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  videoUrl: string;
  fileName: string;
}

// Tipos para a Ferramenta de Posicionamento
export interface TrackPoint {
  id: number;
  timestamp: number;
  geo: {
    lat: number;
    lon: number;
    alt: number;
  };
  distance: number;
  bearing: number;
}

export interface Track {
  id: string;
  points: TrackPoint[];
}
