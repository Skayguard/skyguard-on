import React, { useState, useEffect } from 'react';
import CameraGrid from './components/CameraGrid';
import CameraModal from './components/CameraModal';
import AlertsSidebar from './components/AlertsSidebar';
import RecordingsSidebar from './components/RecordingsSidebar';
import Toolbar from './components/Toolbar';
import { Camera, MotionEvent, Recording } from './types';

const App: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cameraToEdit, setCameraToEdit] = useState<Camera | null>(null);
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isAlertsSidebarOpen, setIsAlertsSidebarOpen] = useState(false);
  const [isRecordingsSidebarOpen, setIsRecordingsSidebarOpen] = useState(false);
  const [unseenAlertsCount, setUnseenAlertsCount] = useState(0);
  const [lastEventCameraId, setLastEventCameraId] = useState<string | null>(null);

  useEffect(() => {
    // Load cameras from localStorage
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

    // Load motion events from localStorage
    try {
      const savedEvents = localStorage.getItem('motionEvents');
      if (savedEvents) {
        setMotionEvents(JSON.parse(savedEvents));
      }
    } catch (error) {
        console.error("Falha ao analisar eventos de movimento do localStorage", error);
        setMotionEvents([]);
    }

    // Load recordings from localStorage
    try {
        const savedRecordings = localStorage.getItem('recordings');
        if (savedRecordings) {
            setRecordings(JSON.parse(savedRecordings));
        }
    } catch (error) {
        console.error("Falha ao analisar gravações do localStorage", error);
        setRecordings([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cameras', JSON.stringify(cameras));
  }, [cameras]);

  useEffect(() => {
    localStorage.setItem('motionEvents', JSON.stringify(motionEvents));
  }, [motionEvents]);

  useEffect(() => {
    localStorage.setItem('recordings', JSON.stringify(recordings));
  }, [recordings]);

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
    setTimeout(() => setLastEventCameraId(null), 30000); // Glow for 30s to match recording
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

  const handleClearAllAlerts = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os alertas?')) {
        setMotionEvents([]);
        setUnseenAlertsCount(0);
    }
  };
  
  const handleRecordingComplete = (recordingData: Omit<Recording, 'id' | 'videoUrl'>, videoBlob: Blob) => {
      const newRecording: Recording = {
          ...recordingData,
          id: Date.now().toString(),
          videoUrl: URL.createObjectURL(videoBlob),
      };
      setRecordings(prev => [newRecording, ...prev]);
  };

  const handleDeleteRecording = (id: string) => {
      setRecordings(prev => {
          const recToDelete = prev.find(r => r.id === id);
          if (recToDelete) {
              URL.revokeObjectURL(recToDelete.videoUrl);
          }
          return prev.filter(r => r.id !== id);
      });
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white flex">
      <Toolbar 
        onAddCamera={handleAddCameraClick}
        onToggleAlerts={handleToggleAlertsSidebar}
        onToggleRecordings={handleToggleRecordingsSidebar}
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