import React, { useState, useEffect } from 'react';
import CameraGrid from './components/CameraGrid';
import CameraModal from './components/CameraModal';
import AlertsSidebar from './components/AlertsSidebar';
import RecordingsSidebar from './components/RecordingsSidebar';
import Toolbar from './components/Toolbar';
import PositioningTool from './components/PositioningTool';
import { Camera, MotionEvent, Recording } from './types';
import { addRecordingToDB, getRecordingsFromDB, deleteRecordingFromDB } from './db';

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

  useEffect(() => {
    // Carregar câmeras do localStorage
    try {
      const savedCameras = localStorage.getItem('cameras');
      if (savedCameras) {
        setCameras(JSON.parse(savedCameras));
      } else {
        setCameras([
            { id: '1', name: 'Sala de Estar', type: 'ip', streamUrl: 'https://via.placeholder.com/600x400/000000/FFFFFF?text=Cam+1', motionDetectionEnabled: true, motionDetectionSensitivity: 50, motionDetectionZones: [] },
            { id: '2', name: 'Garagem', type: 'ip', streamUrl: 'https://via.placeholder.com/600x400/000000/FFFFFF?text=Cam+2', motionDetectionEnabled: false, motionDetectionSensitivity: 50, motionDetectionZones: [] },
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
        // O navegador libera automaticamente as URLs de objeto quando o documento é descarregado.
        // A exclusão manual lida com a limpeza durante a vida útil do aplicativo.
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
  
  const handleTriggerMotion = (camera: Camera) => {
    const newEvent: MotionEvent = {
        id: Date.now().toString(),
        cameraId: camera.id,
        cameraName: camera.name,
        timestamp: new Date().toISOString(),
    };
    setMotionEvents(prevEvents => [newEvent, ...prevEvents]);
    if (!isAlertsSidebarOpen) {
        setUnseenAlertsCount(prev => prev + 1);
    }
    setLastEventCameraId(camera.id);
    setTimeout(() => setLastEventCameraId(null), 30000); // Brilho por 30s para corresponder à gravação

    // Lógica de gravação automática
    if (camera.motionDetectionEnabled && !activeAutoRecordings.has(camera.id)) {
        setActiveAutoRecordings(prev => {
            const newSet = new Set(prev);
            newSet.add(camera.id);
            return newSet;
        });

        // Parar a gravação após 30 segundos
        setTimeout(() => {
            setActiveAutoRecordings(prev => {
                const newSet = new Set(prev);
                newSet.delete(camera.id);
                return newSet;
            });
        }, 30000);
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
  
  const handleRecordingComplete = async (recordingData: Omit<Recording, 'id' | 'videoUrl'>, videoBlob: Blob) => {
      const newRecordingData = {
          ...recordingData,
          id: Date.now().toString(),
      };
      try {
          await addRecordingToDB(newRecordingData, videoBlob);
          const newRecording: Recording = {
              ...newRecordingData,
              videoUrl: URL.createObjectURL(videoBlob),
          };
          setRecordings(prev => [newRecording, ...prev]);
      } catch (error) {
          console.error("Falha ao salvar a gravação:", error);
          alert("Não foi possível salvar a gravação.");
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
