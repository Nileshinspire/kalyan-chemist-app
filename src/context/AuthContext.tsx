import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth as useConvexAuth } from "@/hooks/use-auth";

/** Convex user document shape (matches the users table in schema.ts) */
interface User {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: "customer" | "admin" | "pharmacist";
  isActive?: boolean;
  createdAt?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    isLoading: convexLoading,
    isAuthenticated,
    user: convexUser,
    signOut,
  } = useConvexAuth();

  const user = convexUser as User | null;
  const isLoading = convexLoading;

  const login = async (_email: string, _password: string) => {
    // Password-based login is not supported in Convex Auth.
    // Users should sign in via the /auth page using email OTP.
    throw new Error(
      "Please use the sign-in page to authenticate with email verification."
    );
  };

  const register = async (_data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    // Registration is handled via email OTP on the /auth page.
    throw new Error(
      "Please use the sign-in page to create an account with email verification."
    );
  };

  const logout = async () => {
    await signOut();
  };

  const refreshUser = async () => {
    // Convex handles this reactively — nothing to do here.
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isAdmin: user?.role === "admin",
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
