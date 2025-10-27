import React, { useState, useRef, useEffect } from 'react';
import { Camera, Recording, DetectionZone } from '../types';
import { EditIcon, TrashIcon, MotionIcon, RecordIcon, StopIcon, ArrowsPointingInIcon, CameraIcon, SparklesIcon, SpinnerIcon, AdjustmentsIcon, UfoIcon, BirdIcon, PlaneIcon, MeteorIcon, EyeIcon, CropIcon } from './icons/Icons';
import GeminiAnalysis from './GeminiAnalysis';

interface CameraViewProps {
  camera: Camera;
  onEdit: (camera: Camera) => void;
  onDelete: (id: string) => void;
  onTriggerMotion: (camera: Camera, imageDataUrl: string) => void;
  isGlowing: boolean;
  onRecordingComplete: (recordingData: Omit<Recording, 'id' | 'videoUrl' | 'analysis'>, videoBlob: Blob, isAuto: boolean) => void;
  isAutoRecordingActive: boolean;
  isAnalyzing: boolean;
  isThumbnail?: boolean;
  onClick?: () => void;
}

const ScenarioIndicator: React.FC<{ scenario: Camera['detectionScenario'] }> = ({ scenario }) => {
    const scenarioMap = {
        general: { Icon: EyeIcon, label: 'Detecção Geral' },
        ufo: { Icon: UfoIcon, label: 'Cenário: UFOs / UAPs' },
        birds: { Icon: BirdIcon, label: 'Cenário: Pássaros' },
        planes: { Icon: PlaneIcon, label: 'Cenário: Aviões' },
        meteors: { Icon: MeteorIcon, label: 'Cenário: Meteoros' },
    };
    const current = scenarioMap[scenario || 'general'];

    return (
        <div className="absolute bottom-4 left-4 z-10 group">
            <div className="p-2 bg-gray-900/60 rounded-full text-white">
                <current.Icon className="w-5 h-5" />
            </div>
            <div className="absolute bottom-0 left-full ml-2 mb-1 px-2 py-1 bg-gray-700 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {current.label}
            </div>
        </div>
    );
};

const CameraView: React.FC<CameraViewProps> = ({
  camera,
  onEdit,
  onDelete,
  onTriggerMotion,
  isGlowing,
  onRecordingComplete,
  isAutoRecordingActive,
  isAnalyzing,
  isThumbnail = false,
  onClick
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

  // State for image adjustments
  const [adjustments, setAdjustments] = useState({ brightness: 100, contrast: 100, saturation: 100 });
  const [showAdjustments, setShowAdjustments] = useState(false);

  // State for drawing selection rectangle
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectionRect, setSelectionRect] = useState<DetectionZone | null>(null);
  const [currentDrawingRect, setCurrentDrawingRect] = useState<DetectionZone | null>(null);
  const startDrawPoint = useRef<{x: number, y: number} | null>(null);


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
      const isAuto = !isManual;

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
      }
      
      const recordingData: Omit<Recording, 'id' | 'videoUrl' | 'analysis'> = {
        cameraId: camera.id,
        cameraName: camera.name,
        timestamp: new Date().toISOString(),
        fileName: `recording_${camera.name.replace(/\s+/g, '_')}_${new Date().toISOString()}.webm`
      };
      onRecordingComplete(recordingData, videoBlob, isAuto);
      
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

  const handleTriggerMotionClick = () => {
    if (!canvasRef.current) return;
    const imageDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
    onTriggerMotion(camera, imageDataUrl);
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
    
    const aspectRatio = 16 / 9;
    canvas.width = 640;
    canvas.height = canvas.width / aspectRatio;

    
    const applyFiltersAndDraw = (source: CanvasImageSource) => {
      ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none'; // Reset filter
    };

    const drawSelection = (rect: DetectionZone, isPixelCoords: boolean) => {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        
        let x, y, width, height;
        if (isPixelCoords) {
            ({ x, y, width, height } = rect);
        } else {
            // Convert from relative to pixels
            x = rect.x * canvas.width;
            y = rect.y * canvas.height;
            width = rect.width * canvas.width;
            height = rect.height * canvas.height;
        }

        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
    };

    const drawLoop = (source: CanvasImageSource) => {
        applyFiltersAndDraw(source);
        
        if (selectionRect) {
            drawSelection(selectionRect, false);
        }
        if (currentDrawingRect) {
            drawSelection(currentDrawingRect, true);
        }

        animationFrameId.current = requestAnimationFrame(() => drawLoop(source));
    };

    const cleanup = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if(animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
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
                    setIsLoading(false);
                    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                    drawLoop(video);
                };
            }
        }).catch(drawError);

    } else if (camera.type === 'ip' && camera.streamUrl) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            setIsLoading(false);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            drawLoop(image);
        };
        image.onerror = drawError;
        image.src = camera.streamUrl;
    } else {
        drawError();
    }

    return cleanup;
  }, [camera.streamUrl, camera.deviceId, camera.type, adjustments, selectionRect, currentDrawingRect]);

  const handleWheel = (e: React.WheelEvent) => {
    if (isThumbnail || isDrawingMode) return;
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

  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (transform.scale > 1) {
        e.preventDefault();
        setIsPanning(true);
        startPanPoint.current = {
            x: e.clientX - transform.x,
            y: e.clientY - transform.y,
        };
    }
  };

  const handlePanMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
        e.preventDefault();
        const newX = e.clientX - startPanPoint.current.x;
        const newY = e.clientY - startPanPoint.current.y;
        setTransform(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handlePanMouseUpOrLeave = () => {
    setIsPanning(false);
  };
  
  const handleViewMouseDown = (e: React.MouseEvent) => {
    if (isDrawingMode && transform.scale === 1 && !isThumbnail) {
        e.preventDefault();
        const canvas = canvasRef.current;
        const view = viewRef.current;
        if (!canvas || !view) return;

        const rect = view.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / view.clientWidth);
        const y = (e.clientY - rect.top) * (canvas.height / view.clientHeight);
        
        startDrawPoint.current = { x, y };
        setSelectionRect(null);
        return;
    }
    handlePanMouseDown(e);
  };

  const handleViewMouseMove = (e: React.MouseEvent) => {
    if (isDrawingMode && startDrawPoint.current) {
        e.preventDefault();
        const canvas = canvasRef.current;
        const view = viewRef.current;
        if (!canvas || !view) return;

        const rect = view.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) * (canvas.width / view.clientWidth);
        const currentY = (e.clientY - rect.top) * (canvas.height / view.clientHeight);
        const startX = startDrawPoint.current.x;
        const startY = startDrawPoint.current.y;

        setCurrentDrawingRect({
            x: Math.min(startX, currentX),
            y: Math.min(startY, currentY),
            width: Math.abs(currentX - startX),
            height: Math.abs(currentY - startY),
        });
        return;
    }
    handlePanMouseMove(e);
  };
  
  const handleViewMouseUpOrLeave = () => {
    if (isDrawingMode && startDrawPoint.current && currentDrawingRect) {
        const canvas = canvasRef.current;
        if (canvas && currentDrawingRect.width > 5 && currentDrawingRect.height > 5) {
            setSelectionRect({
                x: currentDrawingRect.x / canvas.width,
                y: currentDrawingRect.y / canvas.height,
                width: currentDrawingRect.width / canvas.width,
                height: currentDrawingRect.height / canvas.height,
            });
        }
        startDrawPoint.current = null;
        setCurrentDrawingRect(null);
        setIsDrawingMode(false);
        return;
    }
    handlePanMouseUpOrLeave();
  };

  const resetTransform = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };
  
  const handleAdjustmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdjustments(prev => ({ ...prev, [name]: parseInt(value, 10) }));
  };

  const toggleDrawingMode = () => {
    const newMode = !isDrawingMode;
    setIsDrawingMode(newMode);
    if (!newMode) {
        setSelectionRect(null);
        setCurrentDrawingRect(null);
        startDrawPoint.current = null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative bg-gray-800 rounded-lg shadow-lg overflow-hidden group transition-all duration-300 w-full h-full flex flex-col ${
        isGlowing && !isThumbnail ? 'ring-4 ring-cyan-500 shadow-cyan-500/50' : 'ring-2 ring-transparent'
      } ${isThumbnail ? 'cursor-pointer' : ''}`}
    >
      <div 
        ref={viewRef}
        className="relative bg-black overflow-hidden flex-grow"
        onWheel={handleWheel}
        onMouseDown={handleViewMouseDown}
        onMouseMove={handleViewMouseMove}
        onMouseUp={handleViewMouseUpOrLeave}
        onMouseLeave={handleViewMouseUpOrLeave}
        onDoubleClick={resetTransform}
      >
        <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 object-contain" 
            style={{
                width: '100%',
                height: '100%',
                transformOrigin: '0 0',
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                cursor: isDrawingMode ? 'crosshair' : (!isThumbnail && transform.scale > 1 ? (isPanning ? 'grabbing' : 'grab') : (isThumbnail ? 'pointer' : 'default')),
            }}
        />
        <video ref={videoRef} className="hidden" playsInline />
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                <p className="text-gray-400">Carregando...</p>
            </div>
        )}
        {!isThumbnail && transform.scale > 1 && (
            <button
                onClick={resetTransform}
                className="absolute bottom-2 right-2 p-2 bg-gray-900/60 rounded-full text-white hover:bg-gray-700/80 transition-colors z-10"
                title="Resetar Zoom"
            >
                <ArrowsPointingInIcon className="w-5 h-5" />
            </button>
        )}
      </div>

      <div className={isThumbnail ? 'p-2 flex-shrink-0' : 'p-4 flex-shrink-0'}>
        <h3 className={`font-bold text-white truncate ${isThumbnail ? 'text-xs' : 'text-lg'}`}>{camera.name}</h3>
        {!isThumbnail && (
            <p className={`text-sm ${camera.motionDetectionEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                {camera.motionDetectionEnabled ? 'Detecção de movimento ativa' : 'Detecção de movimento inativa'}
            </p>
        )}
      </div>

      {!isThumbnail && (
          <>
            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={() => onEdit(camera)} className="p-2 bg-gray-700/80 hover:bg-cyan-600 rounded-full text-white transition-colors" title="Editar Câmera">
                    <EditIcon className="w-5 h-5" />
                </button>
                <button onClick={() => onDelete(camera.id)} className="p-2 bg-gray-700/80 hover:bg-red-600 rounded-full text-white transition-colors" title="Excluir Câmera">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
            
            {showAdjustments && (
                <div className="absolute bottom-16 right-4 bg-gray-900/80 backdrop-blur-sm rounded-lg p-3 z-20 w-52 space-y-2 shadow-lg">
                    <div className="text-xs text-gray-300">
                        <label htmlFor={`brilho-${camera.id}`} className="flex justify-between">Brilho <span>{adjustments.brightness}%</span></label>
                        <input id={`brilho-${camera.id}`} type="range" name="brightness" min="0" max="200" value={adjustments.brightness} onChange={handleAdjustmentChange} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                    <div className="text-xs text-gray-300">
                        <label htmlFor={`contraste-${camera.id}`} className="flex justify-between">Contraste <span>{adjustments.contrast}%</span></label>
                        <input id={`contraste-${camera.id}`} type="range" name="contrast" min="0" max="200" value={adjustments.contrast} onChange={handleAdjustmentChange} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                    <div className="text-xs text-gray-300">
                        <label htmlFor={`saturacao-${camera.id}`} className="flex justify-between">Saturação <span>{adjustments.saturation}%</span></label>
                        <input id={`saturacao-${camera.id}`} type="range" name="saturation" min="0" max="200" value={adjustments.saturation} onChange={handleAdjustmentChange} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                </div>
            )}

            <ScenarioIndicator scenario={camera.detectionScenario} />

            <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                <button onClick={toggleDrawingMode} className={`p-2 rounded-full text-white transition-colors ${isDrawingMode ? 'bg-cyan-600' : 'bg-gray-700/80 hover:bg-gray-600'}`} title="Selecionar Objeto">
                    <CropIcon className="w-5 h-5" />
                </button>
                <button onClick={() => setShowAdjustments(prev => !prev)} className={`p-2 rounded-full text-white transition-colors ${showAdjustments ? 'bg-cyan-600' : 'bg-gray-700/80 hover:bg-gray-600'}`} title="Ajustes de Imagem">
                    <AdjustmentsIcon className="w-5 h-5" />
                </button>
                <button onClick={handleAnalyzeFrame} className="p-2 bg-gray-700/80 hover:bg-purple-600 rounded-full text-white transition-colors" title="Analisar com IA">
                    <SparklesIcon className="w-5 h-5" />
                </button>
                <button onClick={handleSnapshotAndParams} className="p-2 bg-gray-700/80 hover:bg-blue-600 rounded-full text-white transition-colors" title="Salvar Snapshot e Parâmetros">
                    <CameraIcon className="w-5 h-5" />
                </button>
                <button onClick={handleToggleRecording} className={`p-2 rounded-full text-white transition-colors ${isRecording ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-gray-700/80 hover:bg-gray-600'} ${isRecording && isAutoRecording.current ? 'opacity-50 cursor-not-allowed' : ''}`} title={isRecording ? (isAutoRecording.current ? 'Gravação automática em andamento' : 'Parar Gravação') : 'Iniciar Gravação Manual'} disabled={isRecording && isAutoRecording.current}>
                    {isRecording ? <StopIcon className="w-5 h-5"/> : <RecordIcon className="w-5 h-5" />}
                </button>
                <button onClick={handleTriggerMotionClick} disabled={!camera.motionDetectionEnabled || isAnalyzing} className="p-2 w-[36px] h-[36px] flex items-center justify-center bg-gray-700/80 hover:bg-yellow-500 rounded-full text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title={isAnalyzing ? "Analisando movimento..." : "Simular Detecção de Movimento"}>
                    {isAnalyzing ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <MotionIcon className="w-5 h-5" />}
                </button>
            </div>
          </>
      )}

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