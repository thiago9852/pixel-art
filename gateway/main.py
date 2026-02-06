import os
import json
import asyncio
import logging
import grpc
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Importações do gRPC
from generated import canvas_pb2
from generated import canvas_pb2_grpc

# Configuração de Logs
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Pixel Art Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex="https?://.*",
)

CORE_HOST = os.getenv("CORE_SERVICE_HOST", "core-service")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")

# Garante a porta do gRPC do Core
CORE_TARGET = f"{CORE_HOST}:50051" if ":" not in CORE_HOST else CORE_HOST

# Variáveis Globais
redis_client = None
stub = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Cliente conectado. Total: {len(self.active_connections)}")

        await self.broadcast_stats() # Avisar todos que entrar

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections[:]:
            try:
                await connection.send_text(message)
            except Exception:
                if connection in self.active_connections:
                    self.active_connections.remove(connection)
    
    async def broadcast_stats(self):
        count = len(self.active_connections)
        message = json.dumps({"type": "stats", "online": count})
        await self.broadcast(message)

manager = ConnectionManager()


async def redis_listener():
    try:
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("canvas_updates")
        logger.info("Escutando canal 'canvas_updates' no Redis...")
        
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg['type'] == 'message':
                await manager.broadcast(msg['data']) # Envia para todos WS
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        logger.info("Redis listener desligado.")
    except Exception as e:
        logger.error(f"Erro no listener do Redis: {e}")

@app.on_event("startup")
async def startup():
    global redis_client, stub
    logger.info("Iniciando Gateway...")
    
    # Conecta Redis
    try:
        redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)
        await redis_client.ping()
        logger.info(f"Conectado ao Redis em {REDIS_HOST}")
        asyncio.create_task(redis_listener())
    except Exception as e:
        logger.critical(f"Falha ao conectar no Redis: {e}")

    # Conecta gRPC
    logger.info(f"Conectando gRPC em: {CORE_TARGET}")
    channel = grpc.aio.insecure_channel(CORE_TARGET)
    stub = canvas_pb2_grpc.CanvasServiceStub(channel)

@app.on_event("shutdown")
async def shutdown():
    if redis_client:
        await redis_client.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        # Carga Inicial
        if stub:
            req = canvas_pb2.ViewportRequest(min_x=0, min_y=0, max_x=1000, max_y=1000)
            response = await stub.GetCanvas(req)
            
            lista_pixels = [{"x": p.x, "y": p.y, "color": p.color} for p in response.pixels]
            await websocket.send_json({"type": "init", "data": lista_pixels})

        while True:
            data = await websocket.receive_json() # Recebe dados do cliente
            if stub:
                await stub.UpdatePixel(canvas_pb2.PixelUpdate(
                    x=data['x'], y=data['y'], color=data['color']
                )) # Chamada gRPC para atualizar pixel

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_stats()
    except Exception as e:
        logger.error(f"Erro no WebSocket: {e}")
        manager.disconnect(websocket)
        await manager.broadcast_stats()