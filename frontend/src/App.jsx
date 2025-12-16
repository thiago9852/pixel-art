import { useEffect, useRef, useState } from 'react';

function App() {
  const [ws, setWs] = useState(null);
  const canvasRef = useRef(null);
  
  const grid = useRef({}); 

  const drawPixel = (ctx, x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * 10, y * 10, 10, 10);
    grid.current[`${x}:${y}`] = color;
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
      ws.send(JSON.stringify({ x, y, color: "#ff0000ff" }));
    }
  };

  return (
    <div>
      <h1>Pixel Art Distribuído</h1>
      <canvas 
        ref={canvasRef} 
        width={500} 
        height={500} 
        style={{border: '1px solid black'}}
        onClick={handleClick}
      />
    </div>
  );
}

export default App;