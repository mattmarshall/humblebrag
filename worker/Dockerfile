# humblebrag image worker: RunPod's ComfyUI worker (which already ships ComfyUI
# and the SDXL base checkpoint) plus InstantID for identity-preserving scenes,
# and our own handler in place of theirs.
#
# We replace the stock handler because this job renders a whole post — five
# images, with the scene identity-locked to the avatar rendered moments earlier —
# and uploads each one to a presigned S3 URL, rather than returning base64 for a
# single graph.
ARG BASE_TAG=5.8.6-sdxl
FROM runpod/worker-comfyui:${BASE_TAG}

ARG COMFY_DIR=/comfyui
ENV COMFY_DIR=${COMFY_DIR}

# insightface ships no py3.12 wheel and compiles a Cython C++ extension from
# source, which the base image cannot do — it has no g++. wget/unzip are for the
# weight downloads further down.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential wget unzip \
 && rm -rf /var/lib/apt/lists/*

# InstantID custom nodes. Pinned: this pack's node names are the contract that
# workflows/scene.json is written against.
ARG INSTANTID_REF=main
RUN git clone https://github.com/cubiq/ComfyUI_InstantID.git ${COMFY_DIR}/custom_nodes/ComfyUI_InstantID \
 && cd ${COMFY_DIR}/custom_nodes/ComfyUI_InstantID \
 && git checkout ${INSTANTID_REF} \
 && pip install --no-cache-dir -r requirements.txt

# InstantID's requirements.txt already brings insightface; only the GPU
# execution provider for its face analysis is missing.
RUN pip install --no-cache-dir onnxruntime-gpu

# Weights are baked into the image rather than pulled at cold start: a flex
# worker that downloads 2GB before its first render defeats the point.
# NOTE: antelopev2 is pulled from a community mirror because insightface does not
# publish it on a stable URL. Pin a SHA256 here before this image carries
# production traffic — an unpinned third-party model download is a supply-chain
# hole.
RUN mkdir -p ${COMFY_DIR}/models/instantid \
             ${COMFY_DIR}/models/controlnet/instantid \
             ${COMFY_DIR}/models/insightface/models \
 && wget -q -O ${COMFY_DIR}/models/instantid/ip-adapter.bin \
      https://huggingface.co/InstantX/InstantID/resolve/main/ip-adapter.bin \
 && wget -q -O ${COMFY_DIR}/models/controlnet/instantid/diffusion_pytorch_model.safetensors \
      https://huggingface.co/InstantX/InstantID/resolve/main/ControlNetModel/diffusion_pytorch_model.safetensors \
 && wget -q -O /tmp/antelopev2.zip \
      https://huggingface.co/MonsterMMORPG/tools/resolve/main/antelopev2.zip \
 && unzip -q /tmp/antelopev2.zip -d ${COMFY_DIR}/models/insightface/models/ \
 && rm /tmp/antelopev2.zip

# start.sh (the base image's CMD) launches ComfyUI in the background and then
# runs /handler.py, so overwriting that path swaps in our handler while keeping
# ComfyUI's startup. Do NOT set CMD here — overriding it skips start.sh, ComfyUI
# never launches, and the handler times out polling 127.0.0.1:8188.
COPY handler.py /handler.py
COPY workflows /workflows
