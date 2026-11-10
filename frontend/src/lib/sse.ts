/**
 * Minimal SSE reader over a fetch ReadableStream.
 *
 * The backend writes standard `event:` / `data:` frames separated by a blank
 * line. Comments (`: ping`) keep proxies from closing idle streams and are
 * skipped here.
 */
export interface SseFrame {
  event: string
  data: string
}

const BLOCK_SEPARATOR = /\r?\n\r?\n/

export async function* readSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame, void, void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let separator = BLOCK_SEPARATOR.exec(buffer)
      while (separator) {
        const block = buffer.slice(0, separator.index)
        buffer = buffer.slice(separator.index + separator[0].length)
        const frame = parseFrame(block)
        if (frame) yield frame
        separator = BLOCK_SEPARATOR.exec(buffer)
      }
    }

    buffer += decoder.decode()
    const tail = parseFrame(buffer)
    if (tail) yield tail
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(block: string): SseFrame | null {
  let event = 'message'
  const data: string[] = []

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }

  if (data.length === 0) return null
  return { event, data: data.join('\n') }
}
