/* Local audio only: transfer small mono PCM frames; output remains silent. */
class HizirPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.buffer = new Float32Array(2048); this.offset = 0;
    this.port.onmessage = event => {
      if (event.data?.type !== 'flush') return;
      if (this.offset) {const tail = this.buffer.slice(0, this.offset); this.port.postMessage(tail, [tail.buffer]); this.offset = 0;}
      this.port.postMessage({type: 'flushed'});
    };
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i];
      if (this.offset === this.buffer.length) {this.port.postMessage(this.buffer, [this.buffer.buffer]); this.buffer = new Float32Array(2048); this.offset = 0;}
    }
    return true;
  }
}
registerProcessor('hizir-pcm', HizirPcmProcessor);
