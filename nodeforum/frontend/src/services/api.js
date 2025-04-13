import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      // Remove token
      localStorage.removeItem('token');
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Forum API calls
export const forumAPI = {
  getForums: () => api.get('/forums'),
  getForum: (id) => api.get(`/forums/${id}`),
  createForum: (data) => api.post('/forums', data),
  updateForum: (id, data) => api.put(`/forums/${id}`, data),
  deleteForum: (id) => api.delete(`/forums/${id}`)
};

// Thread API calls
export const threadAPI = {
  getThreads: (forumId) => api.get(`/threads?forumId=${forumId}`),
  getThread: (id) => api.get(`/threads/${id}`),
  createThread: (data) => api.post('/threads', data),
  updateThread: (id, data) => api.put(`/threads/${id}`, data),
  deleteThread: (id) => api.delete(`/threads/${id}`),
  lockThread: (id) => api.put(`/threads/${id}/lock`),
  unlockThread: (id) => api.put(`/threads/${id}/unlock`),
  stickyThread: (id) => api.put(`/threads/${id}/sticky`),
  unstickyThread: (id) => api.put(`/threads/${id}/unsticky`)
};

// Post API calls
export const postAPI = {
  getPosts: (threadId) => api.get(`/posts?threadId=${threadId}`),
  getPost: (id) => api.get(`/posts/${id}`),
  createPost: (data) => api.post('/posts', data),
  updatePost: (id, data) => api.put(`/posts/${id}`, data),
  deletePost: (id) => api.delete(`/posts/${id}`)
};

// User API calls
export const userAPI = {
  getUsers: () => api.get('/users'),
  getUser: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data),
  updateAvatar: (data) => api.put('/users/avatar', data)
};

// Message API calls
export const messageAPI = {
  getInbox: () => api.get('/messages/inbox'),
  getSent: () => api.get('/messages/sent'),
  getMessage: (id) => api.get(`/messages/${id}`),
  sendMessage: (data) => api.post('/messages', data),
  deleteMessage: (id) => api.delete(`/messages/${id}`),
  markAsRead: (id) => api.put(`/messages/${id}/read`),
  getUnreadCount: () => api.get('/messages/unread/count')
};

export default api;