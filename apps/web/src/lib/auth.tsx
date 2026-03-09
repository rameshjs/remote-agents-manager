import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

interface AuthContextType {
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token")
  )

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || "Login failed")
    }

    const { token } = await res.json()
    localStorage.setItem("token", token)
    setToken(token)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("token")
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ token, login, logout, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
