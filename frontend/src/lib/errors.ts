export function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '请求已取消'
  }

  // fetch() rejects with TypeError when the service is unreachable.
  if (error instanceof TypeError) {
    return '无法连接本地服务，请确认后端已在 127.0.0.1:8000 启动'
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return '发生未知错误，请重试'
}
