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
# Every download is checksum-pinned. antelopev2 in particular comes from a
# community mirror because insightface publishes no stable URL for it, so an
# unpinned fetch would be a supply-chain hole. Hashes are the HuggingFace LFS
# SHA256 (x-linked-etag) as of 2026-08-22.
RUN mkdir -p ${COMFY_DIR}/models/instantid \
             ${COMFY_DIR}/models/controlnet/instantid \
             ${COMFY_DIR}/models/insightface/models \
 && wget -q -O ${COMFY_DIR}/models/instantid/ip-adapter.bin \
      https://huggingface.co/InstantX/InstantID/resolve/main/ip-adapter.bin \
 && wget -q -O ${COMFY_DIR}/models/controlnet/instantid/diffusion_pytorch_model.safetensors \
      https://huggingface.co/InstantX/InstantID/resolve/main/ControlNetModel/diffusion_pytorch_model.safetensors \
 && wget -q -O /tmp/antelopev2.zip \
      https://huggingface.co/MonsterMMORPG/tools/resolve/main/antelopev2.zip \
 && echo "02b3618e36d803784166660520098089a81388e61a93ef8002aa79a5b1c546e1  ${COMFY_DIR}/models/instantid/ip-adapter.bin" > /tmp/models.sha256 \
 && echo "c8127be9f174101ebdafee9964d856b49b634435cf6daa396d3f593cf0bbbb05  ${COMFY_DIR}/models/controlnet/instantid/diffusion_pytorch_model.safetensors" >> /tmp/models.sha256 \
 && echo "8e182f14fc6e80b3bfa375b33eb6cff7ee05d8ef7633e738d1c89021dcf0c5c5  /tmp/antelopev2.zip" >> /tmp/models.sha256 \
 && sha256sum -c /tmp/models.sha256 \
 && unzip -q /tmp/antelopev2.zip -d ${COMFY_DIR}/models/insightface/models/ \
 && rm /tmp/antelopev2.zip /tmp/models.sha256

# start.sh (the base image's CMD) launches ComfyUI in the background and then
# runs /handler.py, so overwriting that path swaps in our handler while keeping
# ComfyUI's startup. Do NOT set CMD here — overriding it skips start.sh, ComfyUI
# never launches, and the handler times out polling 127.0.0.1:8188.
# NSFW classifier (Falconsai/nsfw_image_detection, ViT binary 0=normal/1=nsfw).
# Baked and checksum-pinned like the other weights: RunPod applies no managed
# content filter, and generated images are published to a public CloudFront URL.
RUN mkdir -p /models/nsfw \
 && wget -q -O /models/nsfw/config.json \
      https://huggingface.co/Falconsai/nsfw_image_detection/resolve/main/config.json \
 && wget -q -O /models/nsfw/preprocessor_config.json \
      https://huggingface.co/Falconsai/nsfw_image_detection/resolve/main/preprocessor_config.json \
 && wget -q -O /models/nsfw/model.safetensors \
      https://huggingface.co/Falconsai/nsfw_image_detection/resolve/main/model.safetensors \
 && echo "cd8c0a19566f199b5c64da402f1d6a9daf80d094fe6536befb060a2cc59449c2  /models/nsfw/config.json" > /tmp/nsfw.sha256 \
 && echo "a34861a24e781942424ad790b82bc99348404a2e64ea882de88c40905851698d  /models/nsfw/preprocessor_config.json" >> /tmp/nsfw.sha256 \
 && echo "97b2ce64ec146884b37f98ee7944ca4891aa72f6827dc0cb10684a1cbecd5830  /models/nsfw/model.safetensors" >> /tmp/nsfw.sha256 \
 && sha256sum -c /tmp/nsfw.sha256 \
 && rm /tmp/nsfw.sha256

COPY handler.py /handler.py
COPY safety.py /safety.py
COPY workflows /workflows
