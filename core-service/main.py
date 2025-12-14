import grpc
from concurrent import futures
import redis
import json
import os

from generated import canvas_pb2
from generated import canvas_pb2_grpc

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
PORT = "50051"

class canvasService(canvas_pb2_grpc.CanvasService):
    def __init__(self):
       
        # Conecta no Redis
        self.redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0)
        print(f"Core conectado ao Redis em {REDIS_HOST}")

    def paintPixel(self, request, context):
        key = f"canvas:{request.canvas_id}"

        # Conecta no DB
        self.redis.hset("canvas_state", key, request.color)

        # Avisa o Gateway sobre a atualização
        msg = json.dumps({"x": request.x, "y": request.y, "color": request.color})
        self.redis_client.publish("canvas_updates", msg)

        print(f"Pixel pintado na tela {request.canvas_id} na posição ({request.x}, {request.y}) com a cor {request.color}")
        return canvas_pb2.PaintPixelResponse(success=True)
    
    def GetCanvas(self, request, context):
        
        # Lê tudo do redis
        data = self.redis.hgetall("canvas_state")
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