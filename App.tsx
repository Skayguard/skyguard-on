import React, { useState, useEffect } from 'react';
import CameraGrid from './components/CameraGrid';
import CameraModal from './components/CameraModal';
import AlertsSidebar from './components/AlertsSidebar';
import RecordingsSidebar from './components/RecordingsSidebar';
import Toolbar from './components/Toolbar';
import PositioningTool from './components/PositioningTool';
import { Camera, MotionEvent, Recording, MotionAnalysisResponseSchema, DetectionScenario } from './types';
import { addRecordingToDB, getRecordingsFromDB, deleteRecordingFromDB } from './db';
import { GoogleGenAI } from "@google/genai";

// --- Funções Auxiliares de Análise de Vídeo ---

const extractFrame = (videoUrl: string, time: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onseeked = () => {
      if (!ctx) return reject(new Error("Não foi possível obter o contexto do canvas"));
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      video.src = "";
      resolve(canvas.toDataURL('image/jpeg'));
    };
    
    video.onloadeddata = () => { video.currentTime = time; };
    video.onerror = () => reject(new Error("Falha ao carregar o vídeo para extração de quadro."));
    video.src = videoUrl;
  });
};

const getVideoDuration = (videoUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => reject(new Error("Não foi possível carregar os metadados do vídeo."));
        video.src = videoUrl;
    });
};

const analyzeVideoWithAI = async (videoUrl: string): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("A chave de API não está configurada.");
  
  const duration = await getVideoDuration(videoUrl);
  let frameTimes = [duration * 0.1, duration * 0.5, duration * 0.9];
  if (duration < 2) frameTimes = [duration * 0.5];

  const framePromises = frameTimes.map(time => extractFrame(videoUrl, time));
  const frameDataUrls = await Promise.all(framePromises);

  const imageParts = frameDataUrls.map(dataUrl => ({
      inlineData: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] },
  }));

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const textPart = { text: 'Com base nestes quadros de uma gravação de câmera de segurança, descreva os principais eventos ou objetos de interesse no vídeo. Forneça um resumo conciso.' };

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart, ...imageParts] },
  });
  
  return response.text;
};


const getPromptForScenario = (scenario: DetectionScenario): string => {
    switch (scenario) {
        case 'ufo':
            return `Aja como um analista de anomalias aéreas (UFO/UAP). Analise esta imagem de uma câmera de segurança apontada para o céu. Ignore eventos comuns como aviões, pássaros, nuvens ou mudanças de luz. Foque em objetos com formas não convencionais, movimentos erráticos, aceleração instantânea ou que não possuam meios de propulsão visíveis. Determine se o evento é uma 'Anomalia Aérea Potencial' ou um 'Evento Comum'. Responda apenas com JSON.`;
        case 'birds':
            return `Aja como um ornitólogo usando uma câmera de monitoramento. Analise esta imagem. Identifique se o movimento é causado por um pássaro. Ignore outros movimentos como insetos, folhas ao vento ou mudanças de luz. Determine se o evento é 'Pássaro Detectado' ou 'Não é um Pássaro'. Responda apenas com JSON.`;
        case 'planes':
            return `Aja como um controlador de tráfego aéreo. Analise esta imagem de uma câmera de vigilância do céu. Identifique se o movimento é causado por uma aeronave convencional (avião, helicóptero, drone). Ignore pássaros, nuvens e outros fenômenos. Determine se o evento é 'Aeronave Detectada' ou 'Não é uma Aeronave'. Responda apenas com JSON.`;
        case 'meteors':
            return `Aja como um astrônomo monitorando o céu noturno. Analise esta imagem. Procure por rastros de luz rápidos e fugazes característicos de meteoros ou 'estrelas cadentes'. Ignore aviões (luzes piscantes e constantes), satélites (pontos de luz lentos e contínuos) e outros ruídos. Determine se o evento é um 'Meteoro Potencial' ou 'Não é um Meteoro'. Responda apenas com JSON.`;
        case 'general':
        default:
            return `Aja como um sistema avançado de detecção de movimento. Analise esta imagem de uma câmera de segurança. Determine se o movimento é significativo (ex: pessoa, veículo, animal grande) ou insignificante (ex: mudança de luz, sombras, chuva, folhas, pequeno animal). Responda apenas com JSON.`;
    }
}


// --- Componente App ---

const App: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cameraToEdit, setCameraToEdit] = useState<Camera | null>(null);
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isAlertsSidebarOpen, setIsAlertsSidebarOpen] = useState(false);
  const [isRecordingsSidebarOpen, setIsRecordingsSidebarOpen] = useState(false);
  const [isPositioningToolOpen, setIsPositioningToolOpen] = useState(false);
  const [unseenAlertsCount, setUnseenAlertsCount] = useState(0);
  const [lastEventCameraId, setLastEventCameraId] = useState<string | null>(null);
  const [activeAutoRecordings, setActiveAutoRecordings] = useState<Set<string>>(new Set());
  const [analyzingCameraId, setAnalyzingCameraId] = useState<string | null>(null);

  useEffect(() => {
    // Carregar câmeras do localStorage
    try {
      const savedCameras = localStorage.getItem('cameras');
      if (savedCameras) {
        setCameras(JSON.parse(savedCameras));
      } else {
        setCameras([
            { id: '1', name: 'Observatório do Céu', type: 'ip', streamUrl: 'https://via.placeholder.com/600x400/000000/FFFFFF?text=Céu', motionDetectionEnabled: true, motionDetectionSensitivity: 70, motionDetectionZones: [], detectionScenario: 'ufo' },
            { id: '2', name: 'Jardim dos Fundos', type: 'ip', streamUrl: 'https://via.placeholder.com/600x400/000000/FFFFFF?text=Jardim', motionDetectionEnabled: true, motionDetectionSensitivity: 50, motionDetectionZones: [], detectionScenario: 'birds' },
        ]);
      }
    } catch (error) {
        console.error("Falha ao analisar câmeras do localStorage", error);
        setCameras([]);
    }

    // Carregar eventos de movimento do localStorage
    try {
      const savedEvents = localStorage.getItem('motionEvents');
      if (savedEvents) {
        setMotionEvents(JSON.parse(savedEvents));
      }
    } catch (error) {
        console.error("Falha ao analisar eventos de movimento do localStorage", error);
        setMotionEvents([]);
    }

    // Carregar gravações do IndexedDB
    const loadRecordings = async () => {
        try {
            const dbRecordings = await getRecordingsFromDB();
            setRecordings(dbRecordings);
        } catch (error) {
            console.error("Falha ao carregar gravações do IndexedDB", error);
            setRecordings([]);
        }
    };
    loadRecordings();
    
    // Limpar URLs de objeto ao desmontar
    return () => {
        recordings.forEach(rec => URL.revokeObjectURL(rec.videoUrl));
    };
  }, []); // O array de dependências está intencionalmente vazio para executar apenas na montagem

  useEffect(() => {
    localStorage.setItem('cameras', JSON.stringify(cameras));
  }, [cameras]);

  useEffect(() => {
    localStorage.setItem('motionEvents', JSON.stringify(motionEvents));
  }, [motionEvents]);

  const handleAddCameraClick = () => {
    setCameraToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditCamera = (camera: Camera) => {
    setCameraToEdit(camera);
    setIsModalOpen(true);
  };

  const handleDeleteCamera = (id: string) => {
    if(window.confirm('Tem certeza que deseja remover esta câmera?')){
        setCameras(cameras.filter((camera) => camera.id !== id));
    }
  };

  const handleSaveCamera = (camera: Camera) => {
    if (cameraToEdit) {
      setCameras(cameras.map((c) => (c.id === camera.id ? camera : c)));
    } else {
      setCameras([...cameras, camera]);
    }
    setIsModalOpen(false);
    setCameraToEdit(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCameraToEdit(null);
  };
  
  const handleTriggerMotion = async (camera: Camera, imageDataUrl: string) => {
    if (!process.env.API_KEY) {
      alert("A chave de API não está configurada para análise de movimento.");
      return;
    }
    setAnalyzingCameraId(camera.id);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageDataUrl.split(',')[1],
        },
      };
      
      const prompt = getPromptForScenario(camera.detectionScenario || 'general');
      const textPart = { text: prompt };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: MotionAnalysisResponseSchema,
        },
      });

      const analysisResult = JSON.parse(response.text);
      
      if (analysisResult.isSignificant) {
          const newEvent: MotionEvent = {
              id: Date.now().toString(),
              cameraId: camera.id,
              cameraName: camera.name,
              timestamp: new Date().toISOString(),
              analysis: analysisResult.reason,
          };
          setMotionEvents(prevEvents => [newEvent, ...prevEvents]);
          if (!isAlertsSidebarOpen) {
              setUnseenAlertsCount(prev => prev + 1);
          }
          setLastEventCameraId(camera.id);
          setTimeout(() => setLastEventCameraId(null), 30000); // Brilho por 30s

          // Lógica de gravação automática
          if (camera.motionDetectionEnabled && !activeAutoRecordings.has(camera.id)) {
              setActiveAutoRecordings(prev => new Set(prev).add(camera.id));
              setTimeout(() => {
                  setActiveAutoRecordings(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(camera.id);
                      return newSet;
                  });
              }, 30000);
          }
      } else {
        alert(`Movimento insignificante ignorado na ${camera.name}: ${analysisResult.reason}`);
      }
    } catch (error) {
      console.error("Erro na análise de movimento com IA:", error);
      alert("Não foi possível analisar o evento de movimento.");
    } finally {
      setAnalyzingCameraId(null);
    }
  };

  const handleToggleAlertsSidebar = () => {
    setIsRecordingsSidebarOpen(false);
    setIsAlertsSidebarOpen(!isAlertsSidebarOpen);
    if (!isAlertsSidebarOpen) {
      setUnseenAlertsCount(0);
    }
  };

  const handleToggleRecordingsSidebar = () => {
    setIsAlertsSidebarOpen(false);
    setIsRecordingsSidebarOpen(!isRecordingsSidebarOpen);
  };
  
  const handleTogglePositioningTool = () => {
    setIsPositioningToolOpen(!isPositioningToolOpen);
  };

  const handleClearAllAlerts = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os alertas?')) {
        setMotionEvents([]);
        setUnseenAlertsCount(0);
    }
  };
  
  const handleRecordingComplete = async (recordingData: Omit<Recording, 'id' | 'videoUrl' | 'analysis'>, videoBlob: Blob, isAuto: boolean) => {
    const tempVideoUrl = URL.createObjectURL(videoBlob);
    let analysisResult: string | undefined = undefined;

    if (isAuto) {
        try {
            analysisResult = await analyzeVideoWithAI(tempVideoUrl);
        } catch (error) {
            console.error("Falha na análise automática de vídeo:", error);
            // Continua salvando a gravação mesmo se a análise falhar
        }
    }

    const newRecordingData = {
        ...recordingData,
        id: Date.now().toString(),
        analysis: analysisResult,
    };

    try {
        await addRecordingToDB(newRecordingData, videoBlob);
        const newRecording: Recording = {
            ...newRecordingData,
            videoUrl: tempVideoUrl,
        };
        setRecordings(prev => [newRecording, ...prev]);
    } catch (error) {
        console.error("Falha ao salvar a gravação:", error);
        alert("Não foi possível salvar a gravação.");
        URL.revokeObjectURL(tempVideoUrl); // Limpar se o salvamento falhar
    }
  };

  const handleDeleteRecording = async (id: string) => {
      if (!window.confirm("Tem certeza que deseja excluir esta gravação permanentemente?")) {
        return;
      }
      try {
          await deleteRecordingFromDB(id);
          setRecordings(prev => {
              const recToDelete = prev.find(r => r.id === id);
              if (recToDelete) {
                  URL.revokeObjectURL(recToDelete.videoUrl);
              }
              return prev.filter(r => r.id !== id);
          });
      } catch (error) {
          console.error("Falha ao excluir a gravação:", error);
          alert("Não foi possível excluir a gravação.");
      }
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white flex">
      <Toolbar 
        onAddCamera={handleAddCameraClick}
        onToggleAlerts={handleToggleAlertsSidebar}
        onToggleRecordings={handleToggleRecordingsSidebar}
        onTogglePositioningTool={handleTogglePositioningTool}
        unseenAlertsCount={unseenAlertsCount}
      />
      <div className="flex-1 flex flex-col pl-16">
        <header className="bg-gray-800/80 backdrop-blur-md shadow-lg sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                  <h1 className="text-2xl font-bold text-cyan-400">Vigilante</h1>
              </div>
          </div>
        </header>
        <main className="flex-1">
          {cameras.length > 0 ? (
              <CameraGrid 
                  cameras={cameras} 
                  onEditCamera={handleEditCamera} 
                  onDeleteCamera={handleDeleteCamera}
                  onTriggerMotion={handleTriggerMotion}
                  lastEventCameraId={lastEventCameraId}
                  onRecordingComplete={handleRecordingComplete}
                  activeAutoRecordings={activeAutoRecordings}
                  analyzingCameraId={analyzingCameraId}
              />
          ) : (
              <div className="text-center py-20">
                  <h2 className="text-2xl font-semibold text-gray-400">Nenhuma câmera adicionada</h2>
                  <p className="text-gray-500 mt-2">Clique no ícone '+' na barra de ferramentas para começar.</p>
              </div>
          )}
        </main>
      </div>
      {isModalOpen && (
        <CameraModal
          cameraToEdit={cameraToEdit}
          onClose={handleCloseModal}
          onSave={handleSaveCamera}
        />
      )}
       {isPositioningToolOpen && (
        <PositioningTool onClose={handleTogglePositioningTool} />
      )}
      <AlertsSidebar 
        isOpen={isAlertsSidebarOpen} 
        onClose={handleToggleAlertsSidebar}
        events={motionEvents}
        onClearAll={handleClearAllAlerts}
      />
      <RecordingsSidebar
        isOpen={isRecordingsSidebarOpen}
        onClose={handleToggleRecordingsSidebar}
        recordings={recordings}
        onDelete={handleDeleteRecording}
      />
    </div>
  );
};

export default App;
