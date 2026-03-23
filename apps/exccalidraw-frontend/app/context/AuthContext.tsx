"use client";

import React, { createContext, useContext, useState } from "react";
import axios from "axios";
import { HTTP_BACKEND } from "@/config";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authState, setAuthState] = useState<{
    user: User | null;
    token: string | null;
    loading: boolean;
  }>(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      const validToken =
        storedToken && storedToken !== "undefined" ? storedToken : null;

      return {
        token: validToken,
        user:
          storedUser && storedUser !== "undefined"
            ? JSON.parse(storedUser)
            : null,
        loading: false,
      };
    }
    return {
      user: null,
      token: null,
      loading: false,
    };
  });
  const router = useRouter();

  const login = async (email: string, password: string) => {
    try {
      const res = await axios.post(`${HTTP_BACKEND}/signin`, {
        username: email,
        password,
      });
      const { token: newToken } = res.data;
      const mockUser = { id: "temp-id", email, name: email.split("@")[0] };

      if (typeof window !== "undefined") {
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(mockUser));
      }
      setAuthState({
        token: newToken,
        user: mockUser,
        loading: false,
      });
      router.push("/dashboard");
    } catch (error) {
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      await axios.post(`${HTTP_BACKEND}/signup`, {
        username: email,
        password,
        name,
      });
      await login(email, password);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    setAuthState({
      token: null,
      user: null,
      loading: false,
    });
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        token: authState.token,
        loading: authState.loading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
