import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If there's a token in localStorage, fetch the current user
    if (token) {
      const fetchUser = async () => {
        try {
          const res = await axios.get('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          setCurrentUser(res.data.user);
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to authenticate');
          // Clear invalid token
          localStorage.removeItem('token');
          setToken(null);
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Register user
  const register = async (userData) => {
    try {
      const res = await axios.post('/api/auth/register', userData);
      setToken(res.data.token);
      setCurrentUser(res.data.user);
      localStorage.setItem('token', res.data.token);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    }
  };

  // Login user
  const login = async (userData) => {
    try {
      const res = await axios.post('/api/auth/login', userData);
      setToken(res.data.token);
      setCurrentUser(res.data.user);
      localStorage.setItem('token', res.data.token);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  return (
    
      {children}
    
  );
};

export default AuthContext;