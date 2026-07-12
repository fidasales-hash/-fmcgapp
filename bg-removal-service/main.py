import asyncio
import os

import onnxruntime as ort
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from rembg import new_session, remove
from starlette.concurrency import run_in_threadpool

API_KEY = os.environ.get("API_KEY", "")

# Default onnxruntime memory arena pre-allocates aggressively during inference
# (can go from ~200MB to several GB) — disabling it keeps peak memory sane,
# which matters a lot on a 512MB instance.
sess_opts = ort.SessionOptions()
sess_opts.enable_cpu_mem_arena = False
sess_opts.enable_mem_pattern = False
sess_opts.intra_op_num_threads = 1
sess_opts.inter_op_num_threads = 1

session = new_session("u2netp", sess_opts=sess_opts)
inference_lock = asyncio.Semaphore(1)

app = FastAPI()


@app.get("/")
async def root():
    return {"status": "ok"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/remove")
async def remove_background(file: UploadFile = File(...), x_api_key: str = Header(default="")):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    input_bytes = await file.read()
    async with inference_lock:
        output_bytes = await run_in_threadpool(remove, input_bytes, session=session)
    return Response(content=output_bytes, media_type="image/png")
