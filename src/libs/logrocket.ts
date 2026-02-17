import LogRocket from 'logrocket'

const isProduction = process.env.NODE_ENV === 'production'

export const initLogRocket = () => {
  if (typeof window !== 'undefined' && isProduction) {
    LogRocket.init('tcpjsc/monero')
  }
}

// Identificar usuario después del login
export const identifyUser = (userId: string, userData?: { name?: string; email?: string; role?: string }) => {
  if (typeof window !== 'undefined' && isProduction) {
    LogRocket.identify(userId, userData || {})
  }
}

export default LogRocket
