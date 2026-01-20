"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  }>({
    user: null,
    token: null,
    loading: true,
  });
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthState({
      token: storedToken,
      user: storedUser ? JSON.parse(storedUser) : null,
      loading: false,
    });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await axios.post(`${HTTP_BACKEND}/signin`, {
        username: email,
        password,
      });
      const { token: newToken } = res.data;
      // For now, we don't get user info back from signin in the current backend implementation
      // We might need to update the backend to return user info or fetch it separately
      const mockUser = { id: "temp-id", email, name: email.split("@")[0] };

      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(mockUser));
      setAuthState({
        token: newToken,
        user: mockUser,
        loading: false,
      });
      router.push("/dashboard");
    } catch (error) {
      console.error("Login failed", error);
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
      router.push("/signin");
    } catch (error) {
      console.error("Signup failed", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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
