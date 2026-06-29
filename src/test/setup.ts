import '@testing-library/jest-dom/vitest'

// jsdom's Blob lacks arrayBuffer() and text() — polyfill them via Node Buffer.
if (typeof Blob !== 'undefined') {
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = reject
        reader.readAsArrayBuffer(this)
      })
    }
  }
  if (!Blob.prototype.text) {
    Blob.prototype.text = function (this: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(this)
      })
    }
  }
}
