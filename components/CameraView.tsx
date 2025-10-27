import React, { useState, useRef, useEffect } from 'react';
import { Camera, Recording } from '../types';
import { EditIcon, TrashIcon, MotionIcon, RecordIcon, StopIcon, ArrowsPointingInIcon, CameraIcon, SparklesIcon } from './icons/Icons';
import GeminiAnalysis from './GeminiAnalysis';

interface CameraViewProps {
  camera: Camera;
  onEdit: (camera: Camera) => void;
  onDelete: (id: string) => void;
  onTriggerMotion: (camera: Camera) => void;
  isGlowing: boolean;
  onRecordingComplete: (recordingData: Omit<Recording, 'id' | 'videoUrl'>, videoBlob: Blob) => void;
  isAutoRecordingActive: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({
  camera,
  onEdit,
  onDelete,
  onTriggerMotion,
  isGlowing,
  onRecordingComplete,
  isAutoRecordingActive,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // For USB cam stream
  const animationFrameId = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isAutoRecording = useRef(false);
  
  // State for zoom and pan
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanPoint = useRef({ x: 0, y: 0 });
  const viewRef = useRef<HTMLDivElement>(null);

  // State for AI Analysis
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [imageForAnalysis, setImageForAnalysis] = useState<string | null>(null);

  const startRecording = (isManual: boolean) => {
    if (!canvasRef.current || isRecording) return;
    
    isAutoRecording.current = !isManual;
    const stream = canvasRef.current.captureStream(25);
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      
      if (isManual) {
        // For manual recordings, trigger a download prompt
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `REC-${camera.name.replace(/\s+/g, '_')}-${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // For automatic (motion) recordings, save to the sidebar
        const recordingData: Omit<Recording, 'id' | 'videoUrl'> = {
          cameraId: camera.id,
          cameraName: camera.name,
          timestamp: new Date().toISOString(),
          fileName: `recording_${camera.name.replace(/\s+/g, '_')}_${new Date().toISOString()}.webm`
        };
        onRecordingComplete(recordingData, videoBlob);
      }
      
      recordedChunksRef.current = [];
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      isAutoRecording.current = false;
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      if (!isAutoRecording.current) {
          stopRecording();
      }
    } else {
      startRecording(true); // true for manual recording
    }
  };
  
  const handleAnalyzeFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setImageForAnalysis(dataUrl);
    setIsAnalysisOpen(true);
  };

  const handleSnapshotAndParams = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Generate and download snapshot
    canvas.toBlob((blob) => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `SNAP-${camera.name.replace(/\s+/g, '_')}-${new Date().toISOString()}.jpg`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    }, 'image/jpeg', 0.95);

    // 2. Get Geolocation and generate parameters file
    const getParams = (position: GeolocationPosition | null, error?: GeolocationPositionError) => {
        let locationString = "Não foi possível obter a localização.";
        if (error) {
            locationString = `Erro de geolocalização: ${error.message}`;
        }
        if (position) {
            locationString = `Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}, Precisão: ${position.coords.accuracy}m`;
        }

        const params = [
            `Parâmetros de Captura de Snapshot`,
            `---------------------------------`,
            `Câmera: ${camera.name}`,
            `Timestamp: ${new Date().toISOString()}`,
            `Posição Geográfica (Estimada): ${locationString}`,
            `Velocidade do Objeto: N/A (Cálculo não disponível)`,
            `Detecção de Movimento: ${camera.motionDetectionEnabled ? `Ativa (Sensibilidade: ${camera.motionDetectionSensitivity})` : 'Inativa'}`,
        ].join('\r\n');

        const paramsBlob = new Blob([params], { type: 'text/plain' });
        const url = URL.createObjectURL(paramsBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `PARAMS-${camera.name.replace(/\s+/g, '_')}-${new Date().toISOString()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => getParams(position),
            (error) => getParams(null, error)
        );
    } else {
        getParams(null);
    }
  };
  
  useEffect(() => {
    // If we get a signal to start auto-recording, and we're not already recording anything
    if (isAutoRecordingActive && !isRecording) {
      startRecording(false); // false for automatic
    }
    
    // If the signal to auto-record stops, and we are in an auto-recording session
    if (!isAutoRecordingActive && isRecording && isAutoRecording.current) {
      stopRecording();
    }
  }, [isAutoRecordingActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stream: MediaStream | null = null;
    
    canvas.width = 600;
    canvas.height = 400;

    const cleanup = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if(animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
    };

    const drawError = () => {
        setIsLoading(false);
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillText('Erro ao carregar o stream', canvas.width / 2, canvas.height / 2);
    }

    setIsLoading(true);

    if (camera.type === 'usb' && camera.deviceId) {
        navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: camera.deviceId } }
        }).then(s => {
            stream = s;
            const video = videoRef.current;
            if (video) {
                video.srcObject = stream;
                video.play();
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    setIsLoading(false);

                    const drawToCanvas = () => {
                        if (video.readyState >= 2) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        }
                        animationFrameId.current = requestAnimationFrame(drawToCanvas);
                    };
                    drawToCanvas();
                };
            }
        }).catch(drawError);

    } else if (camera.type === 'ip' && camera.streamUrl) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            setIsLoading(false);
        };
        image.onerror = drawError;
        image.src = camera.streamUrl;
    } else {
        drawError();
    }

    return cleanup;
  }, [camera.streamUrl, camera.deviceId, camera.type]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const view = viewRef.current;
    if (!view) return;

    const scaleAmount = -e.deltaY * 0.005;
    
    setTransform(prev => {
        const newScale = Math.min(Math.max(prev.scale + scaleAmount, 1), 10);
        
        if (newScale === 1) {
            return { scale: 1, x: 0, y: 0 };
        }

        const rect = view.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const pointX = (mouseX - prev.x) / prev.scale;
        const pointY = (mouseY - prev.y) / prev.scale;

        const newX = mouseX - pointX * newScale;
        const newY = mouseY - pointY * newScale;
      
        return { scale: newScale, x: newX, y: newY };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (transform.scale > 1) {
        e.preventDefault();
        setIsPanning(true);
        startPanPoint.current = {
            x: e.clientX - transform.x,
            y: e.clientY - transform.y,
        };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
        e.preventDefault();
        const newX = e.clientX - startPanPoint.current.x;
        const newY = e.clientY - startPanPoint.current.y;
        setTransform(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  const resetTransform = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };

  return (
    <div
      className={`relative bg-gray-800 rounded-lg shadow-lg overflow-hidden group transition-all duration-300 ${
        isGlowing ? 'ring-4 ring-cyan-500 shadow-cyan-500/50' : 'ring-2 ring-transparent'
      }`}
    >
      <div 
        ref={viewRef}
        className="relative aspect-video bg-black overflow-hidden cursor-default"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onDoubleClick={resetTransform}
      >
        <canvas 
            ref={canvasRef} 
            className="w-full h-full object-cover" 
            style={{
                transformOrigin: '0 0',
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                cursor: transform.scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
            }}
        />
        <video ref={videoRef} className="hidden" playsInline />
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                <p className="text-gray-400">Carregando...</p>
            </div>
        )}
        {transform.scale > 1 && (
            <button
                onClick={resetTransform}
                className="absolute bottom-2 right-2 p-2 bg-gray-900/60 rounded-full text-white hover:bg-gray-700/80 transition-colors z-10"
                title="Resetar Zoom"
            >
                <ArrowsPointingInIcon className="w-5 h-5" />
            </button>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-bold text-lg text-white truncate">{camera.name}</h3>
        <p className={`text-sm ${camera.motionDetectionEnabled ? 'text-green-400' : 'text-gray-400'}`}>
          {camera.motionDetectionEnabled ? 'Detecção de movimento ativa' : 'Detecção de movimento inativa'}
        </p>
      </div>

      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={() => onEdit(camera)}
          className="p-2 bg-gray-700/80 hover:bg-cyan-600 rounded-full text-white transition-colors"
          title="Editar Câmera"
        >
          <EditIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => onDelete(camera.id)}
          className="p-2 bg-gray-700/80 hover:bg-red-600 rounded-full text-white transition-colors"
          title="Excluir Câmera"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2 z-10">
        <button
            onClick={handleAnalyzeFrame}
            className="p-2 bg-gray-700/80 hover:bg-purple-600 rounded-full text-white transition-colors"
            title="Analisar com IA"
        >
            <SparklesIcon className="w-5 h-5" />
        </button>
        <button
            onClick={handleSnapshotAndParams}
            className="p-2 bg-gray-700/80 hover:bg-blue-600 rounded-full text-white transition-colors"
            title="Salvar Snapshot e Parâmetros"
        >
            <CameraIcon className="w-5 h-5" />
        </button>
        <button
            onClick={handleToggleRecording}
            className={`p-2 rounded-full text-white transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-gray-700/80 hover:bg-gray-600'} ${isRecording && isAutoRecording.current ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isRecording ? (isAutoRecording.current ? 'Gravação automática em andamento' : 'Parar Gravação') : 'Iniciar Gravação Manual'}
            disabled={isRecording && isAutoRecording.current}
          >
            {isRecording ? <StopIcon className="w-5 h-5"/> : <RecordIcon className="w-5 h-5" />}
        </button>
        <button
          onClick={() => onTriggerMotion(camera)}
          disabled={!camera.motionDetectionEnabled}
          className="p-2 bg-gray-700/80 hover:bg-yellow-500 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Simular Detecção de Movimento"
        >
          <MotionIcon className="w-5 h-5" />
        </button>
      </div>

      {isAnalysisOpen && imageForAnalysis && (
        <GeminiAnalysis
          imageDataUrl={imageForAnalysis}
          onClose={() => setIsAnalysisOpen(false)}
        />
      )}
    </div>
  );
};

export default CameraView;