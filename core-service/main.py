import grpc
from concurrent import futures
import redis
import json
import os

from generated import canvas_pb2
from generated import canvas_pb2_grpc

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
PORT = "50051"

class canvasService(canvas_pb2_grpc.CanvasServiceServicer):
    def __init__(self):
       
        # Conecta no Redis
        self.redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0,  decode_responses=True)
        print(f"Core conectado ao Redis em {REDIS_HOST}")

    def PaintPixel(self, request, context):
        key = f"{request.x}:{request.y}"

        # Conecta no DB
        self.redis_client.hset("canvas_state", key, request.color)

        # Avisa o Gateway sobre a atualização
        msg = json.dumps({"x": request.x, "y": request.y, "color": request.color})
        self.redis_client.publish("canvas_updates", msg)

        print(f"Pintou: {msg}")
        return canvas_pb2.PaintPixelResponse(success=True)
    
    def GetCanvas(self, request, context):
        
        # Lê tudo do redis
        data = self.redis_client.hgetall("canvas_state")
        return canvas_pb2.CanvasData(pixels=data)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    canvas_pb2_grpc.add_CanvasServiceServicer_to_server(canvasService(), server)
    server.add_insecure_port(f"[::]:{PORT}")
    print(f"Core Service rodando na porta {PORT}")
    server.start()
    server.wait_for_termination()

if __name__ == "__main__":
    serve()