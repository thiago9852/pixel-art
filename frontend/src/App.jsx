import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Header from './components/Header';
import Footer from './components/Footer';

const PALETTE = [
  '#000000', 
  '#555555', 
  '#AAAAAA', 
  '#FFFFFF', 
  '#8B4513', 
  '#FF0000', 
  '#FFA500', 
  '#FFFF00', 
  '#00FF00', 
  '#008000', 
  '#00FFFF', 
  '#0000FF', 
  '#800080', 
  '#FF00FF', 
  '#FFC0CB', 
  '#FFE4C4', 
  'ERASE', // Borracha
];

const GRID_SCALE = 4000; 
const PIXEL_SIZE = 1 / GRID_SCALE;

function App() {
  const [ws, setWs] = useState(null);
  const [selectedColor, setSelectedColor] = useState(PALETTE[1]);
  const [onlineCount, setOnlineCount] = useState(1);
  const pixelsRef = useRef({});
  const [cursorPos, setCursorPos] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws');
    socket.onopen = () => console.log("WS Conectado!");
    
    socket.onmessage = (event) => { // Recebe mensagens do servidor via WebSocket
      const msg = JSON.parse(event.data);
      if (msg.type === "stats") {
        setOnlineCount(msg.online);
      } else if (msg.type === "init") {
        msg.data.forEach(p => pixelsRef.current[`${p.x}:${p.y}`] = p.color); // att ref
        window.dispatchEvent(new Event('pixels-updated')); // redesenha
      } else {
        pixelsRef.current[`${msg.x}:${msg.y}`] = msg.color;
        window.dispatchEvent(new Event('pixels-updated'));
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  const sendPixel = (lat, lng) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const x = Math.floor(lng * GRID_SCALE);
    const y = Math.floor(lat * GRID_SCALE);
    if (pixelsRef.current[`${x}:${y}`] === selectedColor) return;
    ws.send(JSON.stringify({ x, y, color: selectedColor })); {/* Send pixel data via WebSocket */}
    pixelsRef.current[`${x}:${y}`] = selectedColor;
    window.dispatchEvent(new Event('pixels-updated'));
  };

  useEffect(() => {
    const handleContext = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContext);
    return () => document.removeEventListener('contextmenu', handleContext);
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      
      <style>{`
        .leaflet-container { cursor: none !important; }
        .grabbing-cursor, .grabbing-cursor * { cursor: grabbing !important; }
      `}</style>

      <Header
        palette={PALETTE}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        onlineCount={onlineCount}
       />

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer 
          center={[-23.55052, -46.633309]} 
          zoom={15} 
          style={{ width: '100%', height: '100%' }}
          dragging={false} 
          zoomControl={false} 
          doubleClickZoom={false}
        >
          {/* Mapa Carto */}
          <TileLayer 
            attribution='&copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" 
          />
          
          <ZoomControl position="bottomright" />
          <RightClickDrag />
          
          <CanvasLayer 
            pixelsRef={pixelsRef} 
            onPaint={sendPixel} 
            setCursorPos={setCursorPos}
            selectedColor={selectedColor}
          />
        </MapContainer>
      </div>

      <Footer lat={cursorPos.lat} lng={cursorPos.lng} />
    </div>
  );
}

function CanvasLayer({ pixelsRef, onPaint, setCursorPos, selectedColor }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const isPaintingRef = useRef(false);
  const [ghostPixel, setGhostPixel] = useState(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bounds = map.getBounds();

    Object.entries(pixelsRef.current).forEach(([key, color]) => {

      if (color === 'ERASE') return; // adiciona suporte para borracha

      const [gridX, gridY] = key.split(':').map(Number);
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

  const updateGhostAndPaint = (e, shouldPaint) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const latLng = map.containerPointToLatLng([x, y]);
    setCursorPos(latLng);

    const gridX = Math.floor(latLng.lng * GRID_SCALE);
    const gridY = Math.floor(latLng.lat * GRID_SCALE);
    
    const snappedLng = gridX / GRID_SCALE;
    const snappedLat = (gridY / GRID_SCALE) + PIXEL_SIZE;

    const pointNW = map.latLngToContainerPoint([snappedLat, snappedLng]);
    const pointSE = map.latLngToContainerPoint([snappedLat - PIXEL_SIZE, snappedLng + PIXEL_SIZE]);
    
    const width = Math.ceil(pointSE.x - pointNW.x);
    const height = Math.ceil(pointSE.y - pointNW.y);

    setGhostPixel({
      x: pointNW.x,
      y: pointNW.y,
      width: width,
      height: height
    });

    if (shouldPaint) {
      onPaint(latLng.lat, latLng.lng);
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      isPaintingRef.current = true;
      updateGhostAndPaint(e, true);
    }
  };

  const handleMouseMove = (e) => {
    updateGhostAndPaint(e, isPaintingRef.current);
  };

  const stopPainting = () => isPaintingRef.current = false;

  const isEraser = selectedColor === 'ERASE';
  const ghostBgColor = isEraser ? 'rgba(255, 0, 0, 0.3)' : 'transparent';

  return (
    <>
      {ghostPixel && (
        <div style={{
          position: 'absolute',
          left: ghostPixel.x,
          top: ghostPixel.y,
          width: ghostPixel.width,
          height: ghostPixel.height,
          
          // cursor padrão
          backgroundColor: 'transparent', 
          
          backgroundImage: `
            linear-gradient(to right, #000 3px, transparent 3px),
            linear-gradient(to right, #000 3px, transparent 3px),
            linear-gradient(to left, #000 3px, transparent 3px),
            linear-gradient(to left, #000 3px, transparent 3px),
            linear-gradient(to bottom, #000 3px, transparent 3px),
            linear-gradient(to bottom, #000 3px, transparent 3px),
            linear-gradient(to top, #000 3px, transparent 3px),
            linear-gradient(to top, #000 3px, transparent 3px)
          `,

          border: isEraser ? '2px dashed red' : 'none',

          backgroundPosition: `
            left top, left bottom, right top, right bottom, 
            left top, right top, left bottom, right bottom
          `,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '25% 25%',
          boxShadow: '0 0 2px rgba(255,255,255,0.8)', 
          
          zIndex: 1000,
          pointerEvents: 'none',
        }}>
           {/* Ponto central */}
           <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px', height: '2px', background: 'black', borderRadius: '50%'
          }}/>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', top: 0, left: 0, zIndex: 999,
          pointerEvents: 'auto', cursor: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopPainting}
        onMouseLeave={() => { stopPainting(); setGhostPixel(null); }}
      />
    </>
  );
}

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
        document.body.classList.add('grabbing-cursor');
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
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.classList.remove('grabbing-cursor');
      }
    };
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.classList.remove('grabbing-cursor');
    };
  }, [map]);
  return null;
}

export default App;