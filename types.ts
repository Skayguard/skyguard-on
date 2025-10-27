import { GoogleGenAI, Type } from "@google/genai";

export interface DetectionZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DetectionScenario = 'general' | 'ufo' | 'birds' | 'planes' | 'meteors';

export interface Camera {
  id: string;
  name: string;
  type: 'ip' | 'usb';
  streamUrl?: string;
  deviceId?: string;
  motionDetectionEnabled?: boolean;
  motionDetectionSensitivity?: number;
  motionDetectionZones?: DetectionZone[];
  detectionScenario?: DetectionScenario;
}

export interface MotionEvent {
  id:string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  analysis?: string;
}

export interface Recording {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  videoUrl: string;
  fileName: string;
  analysis?: string;
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

// Esquema para a resposta de análise de movimento do Gemini
export const MotionAnalysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    isSignificant: {
      type: Type.BOOLEAN,
      description: "Indica se o movimento detectado é significativo (ex: pessoa, veículo) ou insignificante (ex: mudança de luz, chuva)."
    },
    reason: {
      type: Type.STRING,
      description: "Uma breve explicação do que foi detectado."
    },
  },
  required: ['isSignificant', 'reason'],
};
