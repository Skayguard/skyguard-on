import React, { useState, useEffect, useRef } from 'react';
import { Track, TrackPoint } from '../types';
import { XMarkIcon, SpinnerIcon } from './icons/Icons';

// --- Helper Functions ---
const degToRad = (deg: number) => deg * (Math.PI / 180);
const radToDeg = (rad: number) => rad * (180 / Math.PI);

// Calculates distance between two lat/lon points in meters (Haversine formula)
const haversineDistance = (p1: TrackPoint, p2: TrackPoint): number => {
    const R = 6371e3; // metres
    const φ1 = degToRad(p1.geo.lat);
    const φ2 = degToRad(p2.geo.lat);
    const Δφ = degToRad(p2.geo.lat - p1.geo.lat);
    const Δλ = degToRad(p2.geo.lon - p1.geo.lon);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

interface PositioningToolProps {
  onClose: () => void;
}

const PositioningTool: React.FC<PositioningToolProps> = ({ onClose }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [gpsData, setGpsData] = useState<GeolocationPosition | null>(null);
    const [orientationData, setOrientationData] = useState<DeviceOrientationEvent | null>(null);
    const [sensorStatus, setSensorStatus] = useState('Inativo');
    
    const [cameraSpecs, setCameraSpecs] = useState({
        focalLength: 2.8, // mm
        sensorWidth: 3.6, // mm
        resolutionX: 1920,
        resolutionY: 1080,
        cameraHeight: 2, // meters
    });

    const [simParams, setSimParams] = useState({
        pixelX: cameraSpecs.resolutionX / 2,
        pixelY: cameraSpecs.resolutionY / 2,
        objectRealSize: 2, // meters
    });
    
    const [autoTrackingInterval, setAutoTrackingInterval] = useState<number | null>(null);

    const isSensorsReady = gpsData && orientationData;
    
    // Request and setup sensors
    const startSensors = async () => {
        setSensorStatus('Iniciando...');
        // GPS
        const geoId = navigator.geolocation.watchPosition(
            (position) => setGpsData(position),
            (err) => setSensorStatus(`Erro de GPS: ${err.message}`)
        );

        // Orientation
        try {
            // @ts-ignore
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // @ts-ignore
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') {
                    setSensorStatus('Permissão de orientação negada.');
                    return;
                }
            }
            
            const handleOrientation = (event: DeviceOrientationEvent) => setOrientationData(event);
            window.addEventListener('deviceorientation', handleOrientation);
            setSensorStatus('Ativo');
            
            return () => {
                navigator.geolocation.clearWatch(geoId);
                window.removeEventListener('deviceorientation', handleOrientation);
            };
        } catch (error) {
            setSensorStatus('Sensores de orientação não suportados.');
        }
    };
    
    // Cleanup on unmount
    useEffect(() => {
        // This is a placeholder, actual cleanup is returned by startSensors
        return () => {
            if (autoTrackingInterval) clearInterval(autoTrackingInterval);
        };
    }, []);

    const handleDetectObject = () => {
        if (!isSensorsReady) {
            alert("Aguardando dados dos sensores. Verifique as permissões e aguarde um sinal de GPS estável.");
            return;
        }

        // 1. Pixel to Angle
        const fovX = 2 * Math.atan(cameraSpecs.sensorWidth / (2 * cameraSpecs.focalLength));
        const angularOffsetX = ((simParams.pixelX - cameraSpecs.resolutionX / 2) / cameraSpecs.resolutionX) * radToDeg(fovX);
        const angularOffsetY = ((simParams.pixelY - cameraSpecs.resolutionY / 2) / cameraSpecs.resolutionX) * radToDeg(fovX);

        // 2. Absolute Angles
        const objectAzimuth = ((orientationData.alpha || 0) + angularOffsetX + 360) % 360;
        const objectElevation = Math.max(-90, Math.min(90, (orientationData.beta || 0) + angularOffsetY));

        // 3. Estimate Distance
        const objectAngularSize = (simParams.objectRealSize / cameraSpecs.resolutionX) * radToDeg(fovX);
        const distance = simParams.objectRealSize / Math.tan(degToRad(objectAngularSize));

        // 4. Calculate Geographic Coords
        const earthRadius = 6371000; // meters
        const latRad = degToRad(gpsData.coords.latitude);
        
        const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(distance / earthRadius) + Math.cos(latRad) * Math.sin(distance / earthRadius) * Math.cos(degToRad(objectAzimuth)));
        const newLonRad = degToRad(gpsData.coords.longitude) + Math.atan2(Math.sin(degToRad(objectAzimuth)) * Math.sin(distance / earthRadius) * Math.cos(latRad), Math.cos(distance / earthRadius) - Math.sin(latRad) * Math.sin(newLatRad));
        
        const newLat = radToDeg(newLatRad);
        const newLon = radToDeg(newLonRad);
        const newAlt = (gpsData.coords.altitude || 0) + cameraSpecs.cameraHeight + distance * Math.sin(degToRad(objectElevation));
        
        const newPoint: TrackPoint = {
            id: Date.now(),
            timestamp: Date.now(),
            geo: { lat: newLat, lon: newLon, alt: newAlt },
            distance: distance,
            bearing: objectAzimuth,
        };

        // Add to tracks
        setTracks(prev => {
            if (prev.length === 0) {
                return [{ id: 'track-1', points: [newPoint] }];
            }
            const updatedTracks = [...prev];
            updatedTracks[0].points.push(newPoint);
            return updatedTracks;
        });
    };

    const handleToggleAutoTracking = () => {
        if (autoTrackingInterval) {
            clearInterval(autoTrackingInterval);
            setAutoTrackingInterval(null);
        } else {
            const intervalId = window.setInterval(() => {
                // Simulate object movement
                setSimParams(prev => ({
                    ...prev,
                    pixelX: prev.pixelX + (Math.random() - 0.5) * 10,
                    pixelY: prev.pixelY + (Math.random() - 0.5) * 10,
                }));
                handleDetectObject();
            }, 2000);
            setAutoTrackingInterval(intervalId);
        }
    };
    
    const handleExport = () => {
        const dataStr = JSON.stringify({ tracks, cameraSpecs }, null, 2);
        const dataBlob = new Blob([dataStr], {type : 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tracking_data_${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const renderResults = () => {
        const lastTrack = tracks[0];
        if (!lastTrack || lastTrack.points.length === 0) return <p className="text-gray-400">Nenhuma detecção registrada.</p>;
        
        const lastPoint = lastTrack.points[lastTrack.points.length - 1];
        let velocityData = { speedKmh: 0, speedMs: 0, direction: 0, acceleration: 0, verticalSpeed: 0 };
        let prediction = null;

        if (lastTrack.points.length > 1) {
            const prevPoint = lastTrack.points[lastTrack.points.length - 2];
            const dist = haversineDistance(prevPoint, lastPoint);
            const timeDiff = (lastPoint.timestamp - prevPoint.timestamp) / 1000; // seconds
            
            velocityData.speedMs = timeDiff > 0 ? dist / timeDiff : 0;
            velocityData.speedKmh = velocityData.speedMs * 3.6;
            velocityData.verticalSpeed = timeDiff > 0 ? (lastPoint.geo.alt - prevPoint.geo.alt) / timeDiff : 0;
            velocityData.direction = lastPoint.bearing;
            
            prediction = {
                lat: lastPoint.geo.lat + (velocityData.speedMs * 5 * Math.cos(degToRad(velocityData.direction))) / 111000,
                lon: lastPoint.geo.lon + (velocityData.speedMs * 5 * Math.sin(degToRad(velocityData.direction))) / (111000 * Math.cos(degToRad(lastPoint.geo.lat))),
            };
        }
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {/* Posição Atual */}
                <div className="bg-gray-700/50 p-3 rounded-md">
                    <h4 className="font-bold text-cyan-400 mb-2">Posição Atual</h4>
                    <p>Lat: <span className="font-mono">{lastPoint.geo.lat.toFixed(8)}</span></p>
                    <p>Lon: <span className="font-mono">{lastPoint.geo.lon.toFixed(8)}</span></p>
                    <p>Altitude: <span className="font-mono">{lastPoint.geo.alt.toFixed(2)} m</span></p>
                    <p>Distância: <span className="font-mono">{lastPoint.distance.toFixed(2)} m</span></p>
                    <p>Bearing: <span className="font-mono">{lastPoint.bearing.toFixed(2)}°</span></p>
                </div>
                {/* Dados de Velocidade */}
                <div className="bg-gray-700/50 p-3 rounded-md">
                    <h4 className="font-bold text-cyan-400 mb-2">Dados de Velocidade</h4>
                    <p>Velocidade: <span className="font-mono">{velocityData.speedKmh.toFixed(2)} km/h</span></p>
                    <p>Direção: <span className="font-mono">{velocityData.direction.toFixed(2)}°</span></p>
                    <p>Mov. Vertical: <span className="font-mono">{velocityData.verticalSpeed.toFixed(2)} m/s</span></p>
                </div>
                {/* Predição de Trajetória */}
                <div className="bg-gray-700/50 p-3 rounded-md">
                    <h4 className="font-bold text-cyan-400 mb-2">Predição (Próximos 5s)</h4>
                    {prediction ? (
                        <>
                        <p>Lat: <span className="font-mono">{prediction.lat.toFixed(8)}</span></p>
                        <p>Lon: <span className="font-mono">{prediction.lon.toFixed(8)}</span></p>
                        </>
                    ) : <p className="text-gray-400">Dados insuficientes.</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl p-4 md:p-6 m-4 relative max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between pb-4 border-b border-gray-700">
                    <h2 className="text-2xl font-bold text-cyan-400">Calculadora de Posição e Velocidade</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
                </header>

                <main className="flex-1 overflow-y-auto py-4 space-y-6">
                    {/* --- Sensores e Controles --- */}
                    <section>
                         <div className="flex flex-wrap gap-4 items-center p-3 bg-gray-900/50 rounded-lg">
                            {sensorStatus !== 'Ativo' ? (
                                <button onClick={startSensors} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md font-semibold">Ativar Sensores</button>
                            ) : null}
                            <div className="text-sm">
                                <p>Status: <span className={`font-semibold ${isSensorsReady ? 'text-green-400' : 'text-yellow-400'}`}>{isSensorsReady ? 'Pronto' : sensorStatus}</span></p>
                                {gpsData && <p>GPS: <span className="font-mono">{gpsData.coords.latitude.toFixed(4)}, {gpsData.coords.longitude.toFixed(4)} (±{gpsData.coords.accuracy.toFixed(1)}m)</span></p>}
                                {orientationData && <p>Orientação: <span className="font-mono">A:{orientationData.alpha?.toFixed(1)}° B:{orientationData.beta?.toFixed(1)}°</span></p>}
                            </div>
                        </div>
                    </section>
                
                    {/* --- Controles Operacionais e Configs --- */}
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4 p-4 bg-gray-700/30 rounded-lg">
                             <h3 className="font-bold text-lg text-cyan-400 border-b border-gray-600 pb-2">Controles Operacionais</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <label>Pixel X: <input type="number" value={simParams.pixelX} onChange={e => setSimParams(p => ({...p, pixelX: +e.target.value}))} className="w-full bg-gray-800 border-gray-600 rounded p-1" /></label>
                                <label>Pixel Y: <input type="number" value={simParams.pixelY} onChange={e => setSimParams(p => ({...p, pixelY: +e.target.value}))} className="w-full bg-gray-800 border-gray-600 rounded p-1" /></label>
                                <label className="col-span-2">Tam. Objeto (m): <input type="number" value={simParams.objectRealSize} onChange={e => setSimParams(p => ({...p, objectRealSize: +e.target.value}))} className="w-full bg-gray-800 border-gray-600 rounded p-1" /></label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={handleDetectObject} disabled={!isSensorsReady} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed">Detectar Objeto</button>
                                <button onClick={handleToggleAutoTracking} disabled={!isSensorsReady} className={`flex-1 px-3 py-2 rounded-md font-semibold disabled:bg-gray-600 ${autoTrackingInterval ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}>{autoTrackingInterval ? 'Parar Rastreio' : 'Rastreamento Auto'}</button>
                            </div>
                             <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700">
                                <button onClick={() => setTracks([])} className="flex-1 px-3 py-2 bg-red-700 hover:bg-red-800 rounded-md font-semibold">Limpar</button>
                                <button onClick={handleExport} className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md font-semibold">Exportar JSON</button>
                            </div>
                        </div>
                         <div className="space-y-4 p-4 bg-gray-700/30 rounded-lg">
                             <h3 className="font-bold text-lg text-cyan-400 border-b border-gray-600 pb-2">Especificações da Câmera</h3>
                             <div className="grid grid-cols-2 gap-2 text-sm">
                                <label>Dist. Focal (mm): <input type="number" value={cameraSpecs.focalLength} onChange={e => setCameraSpecs(p => ({...p, focalLength: +e.target.value}))} className="w-full bg-gray-800 border-gray-600 rounded p-1" /></label>
                                <label>Sensor (mm): <input type="number" value={cameraSpecs.sensorWidth} onChange={e => setCameraSpecs(p => ({...p, sensorWidth: +e.target.value}))} className="w-full bg-gray-800 border-gray-600 rounded p-1" /></label>
                                <label>Resolução X: <input type="number" value={cameraSpecs.resolutionX} onChange={e => setCameraSpecs(p => ({...p, resolutionX: +e.target.value}))} className="w-full bg-gray-800 border-gray-600 rounded p-1" /></label>
                                <label>Altura Câmera (m): <input type="number" value={cameraSpecs.cameraHeight} onChange={e => setCameraSpecs(p => ({...p, cameraHeight: +e.target.value}))} className="w-full bg-gray-800 border-gray-600 rounded p-1" /></label>
                            </div>
                        </div>
                    </section>
                    
                    {/* --- Resultados --- */}
                    <section className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
                        <h3 className="font-bold text-lg text-cyan-400 border-b border-gray-600 pb-2">Resultados</h3>
                        {renderResults()}
                    </section>
                </main>
            </div>
        </div>
    );
};

export default PositioningTool;
