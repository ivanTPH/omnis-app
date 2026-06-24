import { createContext, useContext } from 'react'

export const InitialNotificationCountContext = createContext(0)
export const useInitialNotificationCount = () => useContext(InitialNotificationCountContext)
