from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import grpc
import redis.asyncio as redis
import json
import asyncio
import os

from generated import canvas_pb2
from generated import canvas_pb2_grpc

app = FastAPI()

# Configuração CORS (Para React Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex="https?://.*",
)

CORE_SERVICE_HOST = os.getenv("CORE_SERVICE_HOST", "localhost:50051")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
       
        for connection in self.active_connections[:]:
            try:
                await connection.send_text(message)
            except Exception:
                
                self.disconnect(connection)

manager = ConnectionManager()

# Variáveis Globais
redis_client = None
grpc_channel = None
stub = None

async def redis_listener():
    global redis_client
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("canvas_updates")

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message and message['type'] == 'message':
                await manager.broadcast(message['data'])
            
            await asyncio.sleep(0.01)
    except asyncio.CancelledError:
        print("Redis Listener desligado.")
    except Exception as e:
        print(f"Erro no Redis Listener: {e}")


@app.on_event("startup")
async def startup_event():
    global redis_client, grpc_channel, stub

    redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)

    asyncio.create_task(redis_listener())

    grpc_channel = grpc.aio.insecure_channel(CORE_SERVICE_HOST)
    stub = canvas_pb2_grpc.CanvasServiceStub(grpc_channel)
    print(f"Gateway iniciado e conectado aos serviços.")

@app.on_event("shutdown")
async def shutdown_event():
    # Fecha conexões ao desligar
    if redis_client:
        await redis_client.close()
    if grpc_channel:
        await grpc_channel.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        # Pede estado inicial usando o STUB global
        if stub:
            response = await stub.GetCanvas(canvas_pb2.Empty())
            await websocket.send_json({"type": "init", "data": dict(response.pixels)})

        while True:
            data = await websocket.receive_json()
            
            # Envia comando de pintura
            if stub:
                await stub.PaintPixel(canvas_pb2.PixelRequest(
                    x=data['x'], y=data['y'], color=data['color']
                ))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Cliente desconectou")
    except Exception as e:
        manager.disconnect(websocket)
        print(f"Erro no WebSocket: {e}")