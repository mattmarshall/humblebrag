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

# InstantID custom nodes. Pinned: this pack's node names are the contract that
# workflows/scene.json is written against.
ARG INSTANTID_REF=main
RUN git clone https://github.com/cubiq/ComfyUI_InstantID.git ${COMFY_DIR}/custom_nodes/ComfyUI_InstantID \
 && cd ${COMFY_DIR}/custom_nodes/ComfyUI_InstantID \
 && git checkout ${INSTANTID_REF} \
 && pip install --no-cache-dir -r requirements.txt

# insightface + onnxruntime power InstantID's face analysis.
RUN pip install --no-cache-dir insightface==0.7.3 onnxruntime-gpu

# Weights are baked into the image rather than pulled at cold start: a flex
# worker that downloads 2GB before its first render defeats the point.
RUN apt-get update && apt-get install -y --no-install-recommends wget unzip \
 && rm -rf /var/lib/apt/lists/*

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

COPY handler.py /handler.py
COPY workflows /workflows

CMD ["python", "-u", "/handler.py"]
