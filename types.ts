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