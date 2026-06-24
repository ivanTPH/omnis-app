import { createContext, useContext } from 'react'

export const AvatarContext = createContext<string | null>(null)
export const useAvatarUrl = () => useContext(AvatarContext)
