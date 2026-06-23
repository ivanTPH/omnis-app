import { createContext, useContext } from 'react'

export const NotificationCountContext = createContext(0)
export const useNotificationCount = () => useContext(NotificationCountContext)
