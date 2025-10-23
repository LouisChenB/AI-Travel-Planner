class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel) {
      // 将每帧的 float32 发送到主线程
      this.port.postMessage(channel);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);