import React, { useState, useEffect, useRef } from 'react';
import { Camera, DetectionZone, DetectionScenario } from '../types';
import { SpinnerIcon } from './icons/Icons';

interface CameraModalProps {
  cameraToEdit: Camera | null;
  onClose: () => void;
  onSave: (camera: Camera) => void;
}

const scenarioOptions: { value: DetectionScenario, label: string }[] = [
    { value: 'general', label: 'Geral (Pessoas, Veículos)' },
    { value: 'ufo', label: 'UFOs / UAPs' },
    { value: 'birds', label: 'Pássaros' },
    { value: 'planes', label: 'Aviões' },
    { value: 'meteors', label: 'Meteoros' },
];

const CameraModal: React.FC<CameraModalProps> = ({ cameraToEdit, onClose, onSave }) => {
  const [camera, setCamera] = useState<Camera>({
    id: cameraToEdit?.id || Date.now().toString(),
    name: cameraToEdit?.name || '',
    type: cameraToEdit?.type || 'ip',
    streamUrl: cameraToEdit?.streamUrl || '',
    deviceId: cameraToEdit?.deviceId || '',
    motionDetectionEnabled: cameraToEdit?.motionDetectionEnabled || false,
    motionDetectionSensitivity: cameraToEdit?.motionDetectionSensitivity || 50,
    motionDetectionZones: cameraToEdit?.motionDetectionZones || [],
    detectionScenario: cameraToEdit?.detectionScenario || 'general',
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagePreviewRef = useRef<HTMLImageElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  
  const [isVerifyingUrl, setIsVerifyingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionError, setPermissionError] = useState<string|null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // State for network scanner
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [foundDevices, setFoundDevices] = useState<{name: string, url: string}[] | null>(null);

  useEffect(() => {
    // Cleanup stream on component unmount
    return () => {
        if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(track => track.stop());
        }
    };
  }, []);

  const getUsbDevices = async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
        if(videoDevices.length > 0 && !camera.deviceId) {
            handleUsbDeviceChange(videoDevices[0].deviceId);
        }
    } catch (err) {
        console.error("Erro ao acessar a câmera: ", err);
        setPermissionError("Permissão para câmera negada. Por favor, habilite o acesso à câmera nas configurações do seu navegador.");
    }
  };

  useEffect(() => {
    if (camera.type === 'usb') {
        getUsbDevices();
    }
  }, [camera.type]);
  
  const handleUsbDeviceChange = async (deviceId: string) => {
    setCamera(prev => ({ ...prev, deviceId }));
    if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(track => track.stop());
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
        previewStreamRef.current = stream;
        if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
        }
    } catch (err) {
        console.error("Erro ao trocar de dispositivo:", err);
    }
  };


  const drawZones = () => {
    const canvas = canvasRef.current;
    const previewElement = camera.type === 'ip' ? imagePreviewRef.current : videoPreviewRef.current;
    if (!canvas || !previewElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = previewElement.clientWidth;
    canvas.height = previewElement.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
    ctx.strokeStyle = 'rgba(0, 150, 255, 1)';
    ctx.lineWidth = 2;

    camera.motionDetectionZones?.forEach(zone => {
        const rectX = zone.x * canvas.width;
        const rectY = zone.y * canvas.height;
        const rectWidth = zone.width * canvas.width;
        const rectHeight = zone.height * canvas.height;
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    });
  };

  useEffect(() => {
    const previewElement = camera.type === 'ip' ? imagePreviewRef.current : videoPreviewRef.current;
    if (previewElement) {
        const eventName = camera.type === 'ip' ? 'load' : 'loadedmetadata';
        const addListeners = () => {
            previewElement.addEventListener(eventName, drawZones);
            window.addEventListener('resize', drawZones);
        };
        addListeners();
        drawZones();
        return () => {
            window.removeEventListener('resize', drawZones);
        };
    }
  }, [camera.motionDetectionZones, camera.type]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDrawing(true);
    setStartPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    drawZones();
    
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    
    ctx.fillStyle = 'rgba(0, 150, 255, 0.5)';
    ctx.strokeStyle = 'rgba(0, 150, 255, 1)';
    ctx.lineWidth = 2;

    const width = currentX - startPoint.x;
    const height = currentY - startPoint.y;
    ctx.fillRect(startPoint.x, startPoint.y, width, height);
    ctx.strokeRect(startPoint.x, startPoint.y, width, height);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const x = Math.min(startPoint.x, endX);
    const y = Math.min(startPoint.y, endY);
    const width = Math.abs(endX - startPoint.x);
    const height = Math.abs(endY - startPoint.y);

    setIsDrawing(false);
    setStartPoint(null);
    
    if (width > 5 && height > 5) {
        const newZone: DetectionZone = {
            x: x / canvas.width,
            y: y / canvas.height,
            width: width / canvas.width,
            height: height / canvas.height,
        };
        setCamera(prev => ({
            ...prev,
            motionDetectionZones: [...(prev.motionDetectionZones || []), newZone]
        }));
    }
  };
  
  const handleClearZones = () => {
    setCamera(prev => ({ ...prev, motionDetectionZones: [] }));
  };

  const verifyUrl = async (url: string) => {
    if (!url) {
      setUrlError(null);
      return true;
    }
    
    setIsVerifyingUrl(true);
    setUrlError(null);
    
    return new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => {
        setIsVerifyingUrl(false);
        resolve(true);
      };
      img.onerror = () => {
        setIsVerifyingUrl(false);
        setUrlError('A URL do stream é inválida ou inacessível.');
        resolve(false);
      };
      img.src = url;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === 'streamUrl') {
        setUrlError(null);
    }
    
    // FIX: Add type guard to safely access 'checked' property on checkbox inputs.
    if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
        setCamera(prev => ({
          ...prev,
          [name]: e.target.checked,
        }));
    } else {
        setCamera(prev => ({
          ...prev,
          [name]: value,
        }));
    }
  };
  
  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCamera(prev => ({
      ...prev,
      motionDetectionSensitivity: parseInt(e.target.value, 10),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (camera.type === 'ip') {
        if (!camera.name || !camera.streamUrl) {
          alert('Por favor, preencha o nome e a URL da stream.');
          return;
        }
        const isUrlValid = await verifyUrl(camera.streamUrl);
        if (isUrlValid) onSave(camera);
    } else { // USB
        if (!camera.name || !camera.deviceId) {
            alert('Por favor, preencha o nome e selecione um dispositivo.');
            return;
        }
        onSave(camera);
    }
  };

  const handleScanNetwork = () => {
    setIsScanning(true);
    setFoundDevices(null);
    setScanProgress(0);

    const interval = setInterval(() => {
        setScanProgress(prev => {
            const next = prev + Math.random() * 15;
            if (next >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    setFoundDevices([
                        { name: 'Câmera do Portão', url: 'https://via.placeholder.com/600x400/333/FFF?text=Portão' },
                        { name: 'Câmera da Cozinha', url: 'https://via.placeholder.com/600x400/444/FFF?text=Cozinha' },
                        { name: 'Babá Eletrônica', url: 'https://via.placeholder.com/600x400/555/FFF?text=Quarto' },
                    ]);
                    setIsScanning(false);
                }, 500);
                return 100;
            }
            return next;
        });
    }, 250);
  };

  const handleSelectDevice = (device: {name: string, url: string}) => {
      setCamera(prev => ({...prev, name: device.name, streamUrl: device.url}));
      setFoundDevices(null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl p-6 md:p-8 m-4 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-6 text-cyan-400">
          {cameraToEdit ? 'Editar Câmera' : 'Adicionar Nova Câmera'}
        </h2>
        <form onSubmit={handleSubmit}>
          {/* Camera Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Fonte</label>
            <div className="flex rounded-md shadow-sm">
                <button type="button" onClick={() => setCamera(p => ({...p, type: 'ip'}))} className={`px-4 py-2 w-1/2 rounded-l-md border border-gray-600 ${camera.type === 'ip' ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Stream de IP</button>
                <button type="button" onClick={() => setCamera(p => ({...p, type: 'usb'}))} className={`px-4 py-2 w-1/2 rounded-r-md border border-gray-600 border-l-0 ${camera.type === 'usb' ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Webcam / Câmera USB</button>
            </div>
          </div>
        
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Nome da Câmera
            </label>
            <input
              type="text" id="name" name="name" value={camera.name} onChange={handleInputChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          
          {camera.type === 'ip' ? (
            <div className="mb-6">
              <label htmlFor="streamUrl" className="block text-sm font-medium text-gray-300 mb-1">URL da Stream</label>
              <div className="flex items-end gap-2">
                <div className="relative flex-grow">
                    <input
                      type="text" id="streamUrl" name="streamUrl" value={camera.streamUrl} onChange={handleInputChange} onBlur={(e) => verifyUrl(e.target.value)}
                      className={`w-full bg-gray-700 border rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${urlError ? 'border-red-500' : 'border-gray-600'}`}
                      required />
                    {isVerifyingUrl && <SpinnerIcon className="animate-spin w-5 h-5 text-cyan-400 absolute top-1/2 right-3 -translate-y-1/2"/>}
                </div>
                <button type="button" onClick={handleScanNetwork} disabled={isScanning} className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-wait">
                  {isScanning ? 'Procurando...' : 'Procurar na Rede'}
                </button>
              </div>
              {urlError && <p className="text-red-500 text-sm mt-2">{urlError}</p>}
              
              {isScanning && (
                <div className="mt-3">
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-cyan-600 h-2.5 rounded-full" style={{width: `${scanProgress}%`}}></div>
                    </div>
                </div>
              )}
              {foundDevices && (
                  <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Dispositivos Encontrados:</h4>
                      <ul className="bg-gray-700 rounded-md border border-gray-600 max-h-32 overflow-y-auto">
                          {foundDevices.length > 0 ? foundDevices.map(device => (
                              <li key={device.url} onClick={() => handleSelectDevice(device)} className="p-2 hover:bg-cyan-600 cursor-pointer border-b border-gray-600 last:border-b-0">
                                  <p className="font-semibold text-white">{device.name}</p>
                                  <p className="text-xs text-gray-400 truncate">{device.url}</p>
                              </li>
                          )) : <li className="p-2 text-sm text-gray-400">Nenhum dispositivo encontrado.</li>}
                      </ul>
                  </div>
              )}
            </div>
          ) : (
            <div className="mb-6">
                <label htmlFor="deviceId" className="block text-sm font-medium text-gray-300 mb-1">Dispositivo da Câmera</label>
                {permissionError ? <p className="text-red-500 text-sm">{permissionError}</p> :
                 devices.length > 0 ? (
                    <select id="deviceId" name="deviceId" value={camera.deviceId} onChange={(e) => handleUsbDeviceChange(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                        {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                    </select>
                 ) : <p className="text-gray-400 text-sm">Nenhum dispositivo de vídeo encontrado.</p>
                }
            </div>
          )}

          <div className="border-t border-gray-700 pt-6">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" name="motionDetectionEnabled" checked={camera.motionDetectionEnabled} onChange={handleInputChange} className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-cyan-600 focus:ring-cyan-500"/>
              <span className="ml-3 text-gray-300">Ativar Detecção de Movimento</span>
            </label>
            
            {camera.motionDetectionEnabled && (
                <div className="mt-4 pl-8 space-y-6">
                    <div>
                        <label htmlFor="detectionScenario" className="block text-sm font-medium text-gray-300 mb-2">Cenário de Detecção</label>
                        <select id="detectionScenario" name="detectionScenario" value={camera.detectionScenario} onChange={handleInputChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            {scenarioOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="motionDetectionSensitivity" className="block text-sm font-medium text-gray-300 mb-2">Sensibilidade ({camera.motionDetectionSensitivity})</label>
                        <input type="range" id="motionDetectionSensitivity" name="motionDetectionSensitivity" min="0" max="100" value={camera.motionDetectionSensitivity} onChange={handleRangeChange} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"/>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-300">Zonas de Detecção</label>
                            <button type="button" onClick={handleClearZones} className="text-xs text-cyan-400 hover:text-cyan-300">Limpar Zonas</button>
                        </div>
                        <div className="relative aspect-video bg-black rounded-md overflow-hidden border border-gray-600">
                          {camera.type === 'ip' ? (
                            camera.streamUrl && !urlError ? <img ref={imagePreviewRef} src={camera.streamUrl} crossOrigin="anonymous" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-500">Preview indisponível</div>
                          ) : (
                            <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
                          )}
                          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => setIsDrawing(false)} />
                        </div>
                    </div>
                </div>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500">
              Cancelar
            </button>
            <button type="submit" disabled={isVerifyingUrl || isScanning} className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed">
              {isVerifyingUrl ? 'Verificando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CameraModal;
