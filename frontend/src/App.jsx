import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Header from './components/Header';
import Footer from './components/Footer';

// CORES
const PALETTE = [
  'rgba(0, 0, 0, 0.9)',     // Preto
  'rgba(255, 0, 0, 0.8)',   // Vermelho
  'rgba(0, 255, 0, 0.8)',   // Verde
  'rgba(0, 0, 255, 0.8)',   // Azul
  'rgba(255, 255, 0, 0.8)', // Amarelo
  'rgba(255, 255, 255, 0.9)' // Branco
];

const GRID_SCALE = 10000; 
const PIXEL_SIZE = 1 / GRID_SCALE;

function App() {
  const [ws, setWs] = useState(null);
  const [selectedColor, setSelectedColor] = useState(PALETTE[1]);
  const pixelsRef = useRef({});
  const canvasRef = useRef(null);
  const [cursorPos, setCursorPos] = useState({ lat: 0, lng: 0 });
  
  // Conexão WebSocket
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws');
    
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "init") {
        msg.data.forEach(p => {
          pixelsRef.current[`${p.x}:${p.y}`] = p.color;
        });
      } else {
        pixelsRef.current[`${msg.x}:${msg.y}`] = msg.color;
      }
      window.dispatchEvent(new Event('pixels-updated'));
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  const sendPixel = (lat, lng) => {
    if (!ws) return;
    const x = Math.floor(lng * GRID_SCALE);
    const y = Math.floor(lat * GRID_SCALE);
    
    if (pixelsRef.current[`${x}:${y}`] === selectedColor) return;

    ws.send(JSON.stringify({ x, y, color: selectedColor }));
    pixelsRef.current[`${x}:${y}`] = selectedColor;
    window.dispatchEvent(new Event('pixels-updated'));
  };

  // Bloqueia menu de contexto globalmente para permitir arrastar com botão direito
  useEffect(() => {
    const handleContext = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContext);
    return () => document.removeEventListener('contextmenu', handleContext);
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <Header
        palette={PALETTE}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
       />


      {/* MAPA */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer 
          center={[-23.525505, -46.667358]}
          zoom={16} 
          style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
          dragging={false}
          zoomControl={false}
          doubleClickZoom={false}
        >
          <TileLayer 
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
          />
          
          <ZoomControl position="bottomright" />
          <RightClickDrag />
          <CanvasLayer pixelsRef={pixelsRef} onPaint={sendPixel} />

          <CursorTracker setCursorPos={setCursorPos} />
        </MapContainer>
      </div>

      {/* FOOTER */}
      <Footer lat={cursorPos.lat} lng={cursorPos.lng} />

    </div>
  );
}

// Rastreamento da posição do cursor
function CursorTracker({ setCursorPos }) {
  useMapEvents({
    mousemove: (e) => {
      setCursorPos(e.latlng);
    },
  });
  return null;
}

// Lógica de arrastar com botão direito
function RightClickDrag() {
  const map = useMap();
  const draggingRef = useRef(false);
  const lastPosRef = useRef(null);

  useEffect(() => {
    const container = map.getContainer();

    const onMouseDown = (e) => {
      if (e.button === 2) {
        draggingRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (e) => {
      if (draggingRef.current && lastPosRef.current) {
        const deltaX = e.clientX - lastPosRef.current.x;
        const deltaY = e.clientY - lastPosRef.current.y;
        
        map.panBy([-deltaX, -deltaY], { animate: false });
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      container.style.cursor = 'crosshair';
    };

    // Listeners
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [map]);

  return null;
}

// Camada de Pintura e Renderização
function CanvasLayer({ pixelsRef, onPaint }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const isPaintingRef = useRef(false); 

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ajusta tamanho do canvas ao mapa
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bounds = map.getBounds();

    Object.entries(pixelsRef.current).forEach(([key, color]) => {
      const [gridX, gridY] = key.split(':').map(Number);
      
      // CÁLCULO DE COORDENADAS
      const lng = gridX / GRID_SCALE;
      const lat = (gridY / GRID_SCALE) + PIXEL_SIZE;

      const margin = 0.002;
      if (lat >= bounds.getSouth() - margin && lat <= bounds.getNorth() + margin &&
          lng >= bounds.getWest() - margin && lng <= bounds.getEast() + margin) {

        const pointNW = map.latLngToContainerPoint([lat, lng]);
        
        const pointSE = map.latLngToContainerPoint([lat - PIXEL_SIZE, lng + PIXEL_SIZE]);
        
        const width = Math.ceil(pointSE.x - pointNW.x);
        const height = Math.ceil(pointSE.y - pointNW.y);

        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(pointNW.x), Math.floor(pointNW.y), width, height);
      }
    });
  }, [map, pixelsRef]);

  // Listeners de redesenho
  useEffect(() => {
    map.on('move', redraw);
    map.on('zoom', redraw);
    map.on('moveend', redraw);
    window.addEventListener('pixels-updated', redraw);
    return () => {
      map.off('move', redraw);
      map.off('zoom', redraw);
      map.off('moveend', redraw);
      window.removeEventListener('pixels-updated', redraw);
    }
  }, [map, redraw]);

  // Lógica de Pintura com Mouse
  const paintAt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Pega a coordenada exata do mouse
    const latLng = map.containerPointToLatLng([x, y]);
    onPaint(latLng.lat, latLng.lng);
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      isPaintingRef.current = true;
      paintAt(e); 
    }
  };

  const handleMouseMove = (e) => {
    if (isPaintingRef.current) {
      paintAt(e);
    }
  };

  const stopPainting = () => {
    isPaintingRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        zIndex: 999,
        pointerEvents: 'auto',
        cursor: 'crosshair'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPainting}
      onMouseLeave={stopPainting}
    />
  );
}

export default App;