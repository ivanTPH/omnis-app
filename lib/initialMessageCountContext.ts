import { createContext, useContext } from 'react'
export const InitialMessageCountContext = createContext(0)
export const useInitialMessageCount = () => useContext(InitialMessageCountContext)
