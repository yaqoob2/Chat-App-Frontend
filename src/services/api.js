import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const authService = {
    sendOtp: (phoneNumber) => api.post('/auth/send-otp', { phoneNumber }),
    verifyOtp: (phoneNumber, otp) => api.post('/auth/verify-otp', { phoneNumber, otp }),
    getMe: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
};

export const chatService = {
    getConversations: () => api.get('/chat/conversations'),
    startConversation: (phoneNumber) => api.post('/chat/conversations', { phoneNumber }),
    uploadFile: (formData) => api.post('/chat/upload', formData, {
        headers: {
            'Content-Type': undefined
        }
    }),
    getMessages: (conversationId, params) => api.get(`/chat/messages/${conversationId}`, { params }),
    sendMessage: (conversationId, content, type = 'text') =>
        api.post('/chat/messages', { conversationId, content, type }),
    deleteMessage: (messageId) => api.delete(`/chat/messages/${messageId}`),
    deleteConversation: (conversationId) => api.delete(`/chat/conversations/${conversationId}`),
    clearMessages: (conversationId) => api.delete(`/chat/conversations/${conversationId}/messages`),
};

export default api;
