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

    def UpdatePixel(self, request, context):
        key = f"{request.x}:{request.y}"

        # Persistência no Redis
        self.redis_client.hset("canvas_state", key, request.color)

        msg = json.dumps({"x": request.x, "y": request.y, "color": request.color})
        self.redis_client.publish("canvas_updates", msg) # Notificação (pub/sub)

        print(f"Pintou: {msg}")
        return canvas_pb2.UpdateResponse(success=True)
    
    def GetCanvas(self, request, context):
        
        # Lê tudo do redis
        data = self.redis_client.hgetall("canvas_state")
        
        pixel_list = []
        for key, color in data.items():
            if ":" in key:
                x, y = key.split(':')
                p = canvas_pb2.Pixel(x=int(x), y=int(y), color=color)
                pixel_list.append(p)
            
        return canvas_pb2.CanvasState(pixels=pixel_list)

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    canvas_pb2_grpc.add_CanvasServiceServicer_to_server(canvasService(), server)
    server.add_insecure_port(f"[::]:{PORT}")
    print(f"Core Service rodando na porta {PORT}")
    server.start()
    server.wait_for_termination()

if __name__ == "__main__":
    serve()