import { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthContext from './contexts/AuthContext';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForumView from './pages/ForumView';
import ThreadView from './pages/ThreadView';
import CreateThread from './pages/CreateThread';
import UserProfile from './pages/UserProfile';
import EditProfile from './pages/EditProfile';
import Messages from './pages/Messages';
import MessageView from './pages/MessageView';
import ComposeMessage from './pages/ComposeMessage';
import AdminPanel from './pages/AdminPanel';
import NotFound from './pages/NotFound';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useContext(AuthContext);

  if (loading) {
    return Loading...;
  }

  if (!currentUser) {
    return ;
  }

  return children;
};

// Admin only route
const AdminRoute = ({ children }) => {
  const { currentUser, loading } = useContext(AuthContext);

  if (loading) {
    return Loading...;
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return ;
  }

  return children;
};

const AppRoutes = () => {
  return (
    
      }>
        {/* Public routes */}
        } />
        } />
        } />
        } />
        } />
        } />

        {/* Protected routes */}
        
            
          
        } />
        
            
          
        } />
        
            
          
        } />
        
            
          
        } />
        
            
          
        } />

        {/* Admin routes */}
        
            
          
        } />

        {/* Not found */}
        } />
      
    
  );
};

export default AppRoutes;