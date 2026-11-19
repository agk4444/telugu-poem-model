# Telugu poem model — llama-server image
#
# Prebuilt llama.cpp release (no source build) + the fine-tuned GGUF from
# the public Hugging Face model repo. Runs the raw /completion endpoint;
# this is a base-style model, so the chat endpoint and llama-cli must NOT
# be used (llama-cli wraps the prompt in a chat template and the model
# degenerates, spamming <|im_start|>).

FROM ubuntu:22.04

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ARG LLAMA_VERSION=b12547
ARG LLAMA_URL=https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/llama-${LLAMA_VERSION}-bin-ubuntu-x64.tar.gz
ARG GGUF_URL=https://huggingface.co/agk4444/telugu-poem-model/resolve/main/telugu-poem-model-q8_0.gguf
# sha256 of telugu-poem-model-q8_0.gguf (Q8_0, 298,616,384 bytes)
ARG GGUF_SHA256=8a4c1c7c54d6ef14cf471103cae759ac1ae2d6a0be79234d7bfa79a625742e4d

RUN mkdir -p /opt/llama /models \
    && curl -fsSL -o /tmp/llama.tar.gz "${LLAMA_URL}" \
    && tar -xzf /tmp/llama.tar.gz -C /opt/llama --strip-components=1 \
    && rm /tmp/llama.tar.gz \
    && curl -fsSL -o /models/telugu-poem-model-q8_0.gguf "${GGUF_URL}" \
    && echo "${GGUF_SHA256}  /models/telugu-poem-model-q8_0.gguf" | sha256sum -c - \
    && /opt/llama/llama-server --version

EXPOSE 8798

# NOTE: 0.0.0.0 inside the container is deliberate. Docker forwards
# published ports to the container's IP, not its loopback, so binding
# 127.0.0.1 here would refuse every connection. Loopback-only exposure
# is enforced by docker-compose.yml, which publishes 127.0.0.1:8798.
CMD ["/opt/llama/llama-server", "-m", "/models/telugu-poem-model-q8_0.gguf", \
     "-c", "1024", "-t", "4", "--host", "0.0.0.0", "--port", "8798"]
