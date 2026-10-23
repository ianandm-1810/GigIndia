import { io } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

export function createSocketClient(token) {
  return io(socketUrl, {
    autoConnect: false,
    auth: token ? { token } : {},
  })
}
