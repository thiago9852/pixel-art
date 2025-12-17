import { useEffect, useRef, useState } from 'react';

const PALETA = [
  "#ff0000ff", "#00ff00ff", "#0000ffff", "#ffff00ff",
  "#ff00ffff", "#00ffffff", "#000000ff", "#ffffffff"
];

function App() {
  const [ws, setWs] = useState(null);
  const canvasRef = useRef(null);
  
  const [selectedColor, setSelectedColor] = useState(PALETA[0]);

  const drawPixel = (ctx, x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 10, y * 10, 10, 10);
  };

  useEffect(() => {
    // Conecta no Gateway
    const socket = new WebSocket('ws://localhost:8000/ws');
    const ctx = canvasRef.current.getContext('2d');

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // Carga Inicial
      if (msg.type === "init") {
        msg.data.forEach((pixel) => {
          drawPixel(ctx, pixel.x, pixel.y, pixel.color);
        });
      } 
      // Alguém pintou
      else {
        drawPixel(ctx, msg.x, msg.y, msg.color);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 10);
    const y = Math.floor((e.clientY - rect.top) / 10);
    
    // Envia para o Gateway
    if (ws) {
      ws.send(JSON.stringify({ x, y, color: selectedColor }) );
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Pixel Art Distribuído</h1>
      
      {/* Barra de cores */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '10px', 
        marginBottom: '15px' 
      }}>
        {PALETA.map((color) => (
          <div
            key={color}
            onClick={() => setSelectedColor(color)}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: color,
              cursor: 'pointer',
              border: selectedColor === color ? '2px solid #b65e00ff' : '1px solid #ccc',
            }}
          />
        ))}
      </div>

      <canvas 
        ref={canvasRef} 
        width={500} 
        height={500} 
        style={{
          border: '1px solid black', 
          cursor: 'crosshair',
          backgroundColor: '#eee'
        }}
        onClick={handleClick}
      />
      
      <p>Cor Selecionada: <span style={{color: selectedColor, fontWeight: 'bold'}}>{selectedColor}</span></p>
    </div>
  );
}

export default App;