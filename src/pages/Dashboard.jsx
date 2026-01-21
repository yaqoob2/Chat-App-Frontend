import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MessageSquare, Search, Phone, Video, Settings, LogOut,
    MoreVertical, Paperclip, Send, User, ChevronLeft, Menu,
    Check, CheckCheck, Clock, ShieldCheck, X, Plus, Smile, Camera,
    Moon, Sun, Trash2, Home, Mic, Square
} from 'lucide-react';
import MediaCapture from '../components/MediaCapture';
import EmojiPicker from 'emoji-picker-react';
import { chatService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import io from 'socket.io-client';
import VideoCall from '../components/VideoCall';



const formatDateForSeparator = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
        return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [messages, setMessages] = useState([]);

    // File Upload
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    // Audio Recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const isCancelledRef = useRef(false);

    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            isCancelledRef.current = false;

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                if (isCancelledRef.current) {
                    console.log('Recording cancelled');
                    return;
                }

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });

                // Upload and send
                await handleAudioUpload(audioFile);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please ensure permissions are granted.');
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const handleCancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            isCancelledRef.current = true;
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const handleAudioUpload = async (file) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await chatService.uploadFile(formData);
            await chatService.sendMessage(selectedChat.id, data.url, 'audio');
        } catch (err) {
            console.error('Audio upload failed', err);
            alert('Failed to send voice message');
        } finally {
            setIsUploading(false);
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await chatService.uploadFile(formData);
            const type = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'file');

            // Send message with file URL
            const { data: message } = await chatService.sendMessage(selectedChat.id, data.url, type);

            // Optimistic update handled by socket, or we can add here
            // But we rely on socket usually. 
        } catch (err) {
            console.error('File upload failed', err);
            const errorMessage = err.response?.data?.error || err.message;
            alert(`Failed to upload file: ${errorMessage}`);
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const [showCamera, setShowCamera] = useState(false);

    const handleCameraCapture = async (file) => {
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await chatService.uploadFile(formData);
            const type = file.type.startsWith('image/') ? 'image' : 'video'; // video support
            const { data: message } = await chatService.sendMessage(selectedChat.id, data.url, type);
        } catch (err) {
            console.error('Camera upload failed', err);
            const errorMessage = err.response?.data?.error || err.message;
            alert(`Failed to upload media: ${errorMessage}`);
        } finally {
            setIsUploading(false);
            setShowCamera(false);
        }
    };
    const [newMessage, setNewMessage] = useState('');
    const [socket, setSocket] = useState(null);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const messagesEndRef = useRef(null);

    // Call State
    const [incomingCall, setIncomingCall] = useState(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [callSignal, setCallSignal] = useState(null);

    const [isInitiator, setIsInitiator] = useState(false);
    const [callType, setCallType] = useState('video');
    const { theme, toggleTheme } = useTheme();
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const chatContainerRef = useRef(null);

    const selectedChatRef = useRef(selectedChat);

    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);

    // Connect to Socket.IO
    useEffect(() => {
        let socketUrl = 'http://localhost:5000';
        if (import.meta.env.VITE_SOCKET_URL) {
            socketUrl = import.meta.env.VITE_SOCKET_URL;
        } else if (import.meta.env.VITE_API_BASE_URL) {
            try {
                const url = new URL(import.meta.env.VITE_API_BASE_URL);
                socketUrl = url.origin;
            } catch (e) {
                console.warn('Invalid VITE_API_BASE_URL, falling back to localhost', e);
            }
        }

        const newSocket = io(socketUrl, {
            auth: { token: localStorage.getItem('token') }
        });

        newSocket.on('connect', () => console.log('Socket connected'));

        // Listen for online users list
        newSocket.on('online_users', (users) => {
            setOnlineUsers(new Set(users));
        });

        // Listen for user status changes
        newSocket.on('user_status', ({ userId, status }) => {
            setOnlineUsers(prev => {
                const updated = new Set(prev);
                if (status === 'online') {
                    updated.add(userId);
                } else {
                    updated.delete(userId);
                }
                return updated;
            });
        });

        newSocket.on('new_message', (message) => {
            console.log('Received new_message:', message);
            if (selectedChatRef.current && message.conversation_id === selectedChatRef.current.id) {
                setMessages((prev) => [...prev, message]);

                // Emit delivered receipt immediately if chat is open
                newSocket.emit('msg:delivered', {
                    messageId: message.id,
                    conversationId: message.conversation_id,
                    senderId: message.sender_id
                });

                // If chat is active and focused, mark as seen
                if (document.hasFocus()) {
                    newSocket.emit('msg:seen', {
                        conversationId: message.conversation_id,
                        lastSeenMessageId: message.id
                    });
                }
            }
            fetchConversations();
        });

        // Listen for message acknowledgement (sent)
        newSocket.on('msg:sent', ({ tempId, messageId, message, status }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === tempId ? { ...message, status } : msg
            ));
        });

        // Listen for status updates (delivered)
        newSocket.on('msg:status_update', ({ messageId, status }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, status } : msg
            ));
        });

        // Listen for seen updates (read)
        newSocket.on('msg:seen_update', ({ conversationId }) => {
            if (selectedChatRef.current?.id === conversationId) {
                setMessages(prev => prev.map(msg =>
                    msg.sender_id === user.id ? { ...msg, status: 'read' } : msg
                ));
            }
        });

        // Listen for message deletion
        newSocket.on('message_deleted', ({ messageId }) => {
            setMessages(prev => prev.filter(m => m.id !== messageId));
            fetchConversations();
        });

        // Listen for conversation cleared
        newSocket.on('conversation_cleared', () => {
            setMessages([]);
            fetchConversations();
        });

        newSocket.on('call_incoming', (data) => {
            console.log('Incoming Call:', data);
            setIncomingCall(data.from);
            setCallSignal(data.signal);
            setCallType(data.callType || 'video');
            setIsCallActive(true);
            setIsInitiator(false);
        });

        newSocket.on('typing:start', ({ conversationId, userId }) => {
            if (selectedChatRef.current?.id === conversationId && userId !== user?.id) {
                setIsTyping(true);
            }
        });

        newSocket.on('typing:stop', ({ conversationId, userId }) => {
            if (selectedChatRef.current?.id === conversationId && userId !== user?.id) {
                setIsTyping(false);
            }
        });

        newSocket.on('connect', () => console.log('✅ Socket connected:', newSocket.id));
        newSocket.on('connect_error', (err) => console.error('❌ Socket connection error:', err));
        newSocket.on('disconnect', () => console.log('⚠️ Socket disconnected'));

        // Listen for new message notifications (for unread counts on closed chats)
        newSocket.on('new_message_notification', (message) => {
            // Small delay to ensure DB commit is visible to read query
            setTimeout(() => {
                fetchConversations();
            }, 500);
        });




        newSocket.on('conversation_removed', ({ conversationId }) => {
            setConversations(prev => prev.filter(c => c.id !== parseInt(conversationId)));
            if (selectedChatRef.current?.id === parseInt(conversationId)) {
                setSelectedChat(null);
            }
        });


        newSocket.on('conversation_cleared', () => {

            setMessages([]);
        });

        setSocket(newSocket);
        return () => newSocket.close();
    }, []);

    const fetchConversations = async () => {
        try {
            const { data } = await chatService.getConversations();
            setConversations(data);
        } catch (err) {
            console.error(err);
        }
    };

    // Theme is now handled in ThemeContext

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (!selectedChat) return;
        socket?.emit('join_conversation', selectedChat.id);

        // Clear unread count immediately when opening chat
        setConversations(prev =>
            prev.map(conv =>
                conv.id === selectedChat.id
                    ? { ...conv, unread_count: 0 }
                    : conv
            )
        );

        // Emit seen event for the chat
        if (socket) {
            socket.emit('msg:seen', {
                conversationId: selectedChat.id,
                lastSeenMessageId: null // Server will mark all pending as read
            });
        }

        const loadMessages = async () => {
            try {
                const { data } = await chatService.getMessages(selectedChat.id);
                setMessages(Array.isArray(data) ? data : []);
                setHasMore(Array.isArray(data) && data.length >= 30);
                scrollToBottom();
            } catch (err) {
                console.error(err);
                setMessages([]);
            }
        };
        loadMessages();
        setIsTyping(false);

        return () => {
            socket?.emit('leave_conversation', selectedChat.id);
        };
    }, [selectedChat, socket]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleScroll = async (e) => {
        const { scrollTop, scrollHeight } = e.target;
        if (scrollTop === 0 && hasMore && !isLoadingMore) {
            setIsLoadingMore(true);
            const currentHeight = scrollHeight;

            try {
                const oldestMessageId = messages[0]?.id;
                if (!oldestMessageId) return;

                const { data } = await chatService.getMessages(selectedChat.id, {
                    cursor: oldestMessageId,
                    limit: 30
                });

                if (Array.isArray(data) && data.length > 0) {
                    setMessages(prev => [...data, ...prev]);
                    requestAnimationFrame(() => {
                        if (chatContainerRef.current) {
                            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight - currentHeight;
                        }
                    });
                } else {
                    setHasMore(false);
                }
            } catch (err) {
                console.error("Failed to load more messages", err);
            } finally {
                setIsLoadingMore(false);
            }
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        console.log('handleSendMessage called', { newMessage, selectedChat, socketConnected: socket?.connected });

        if (!newMessage.trim() || !selectedChat) return;
        if (!socket) {
            console.error('Socket not available');
            return;
        }

        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const content = newMessage;

        console.log('Sending message:', { tempId, content, conversationId: selectedChat.id });

        // Optimistic UI update
        const tempMessage = {
            id: tempId,
            conversation_id: selectedChat.id,
            sender_id: user.id,
            content: content,
            created_at: new Date().toISOString(),
            status: 'pending'
        };

        setMessages(prev => [...prev, tempMessage]);
        setNewMessage('');

        socket.emit('typing:stop', { conversationId: selectedChat.id });
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        try {
            socket.emit('msg:send', {
                conversationId: selectedChat.id,
                tempId,
                content
            });
            console.log('Emitted msg:send');
        } catch (err) {
            console.error(err);

        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm('Delete this message?')) return;
        try {
            await chatService.deleteMessage(messageId);
            // Optimistic update
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            console.error('Failed to delete message', err);
        }
    };

    const handleDeleteChat = async () => {
        if (!window.confirm('Delete this conversation permanently?')) return;
        try {
            await chatService.deleteConversation(selectedChat.id);
            setConversations(prev => prev.filter(c => c.id !== selectedChat.id));
            setSelectedChat(null);
            setShowOptionsMenu(false);
        } catch (err) {
            console.error('Failed to delete chat', err);
        }
    };

    const handleClearChat = async () => {
        if (!window.confirm('Clear all messages in this chat?')) return;
        try {
            await chatService.clearMessages(selectedChat.id);
            setMessages([]);
            // Update conversation preview in list
            setConversations(prev => prev.map(c =>
                c.id === selectedChat.id ? { ...c, last_message: null, last_message_type: null, last_message_time: null } : c
            ));
            setShowOptionsMenu(false);
        } catch (err) {
            console.error('Failed to clear chat', err);
        }
    };

    const handleStartNewChat = async (e) => {
        e.preventDefault();
        try {
            const { data } = await chatService.startConversation(newChatPhone);
            setIsNewChatModalOpen(false);
            setNewChatPhone('');
            await fetchConversations();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to start chat');
        }
    };

    const startCall = (type) => {
        if (!selectedChat) return;
        setCallType(type);
        setIsInitiator(true);
        setIsCallActive(true);
    };

    const endCall = () => {
        setIsCallActive(false);
        setIncomingCall(null);
        setCallSignal(null);
        setIsInitiator(false);
    };

    const activeCallChat = isInitiator ? selectedChat : (incomingCall ? {
        other_user_id: incomingCall.id,
        other_username: incomingCall.username,
        other_phone: incomingCall.phone_number
    } : null);

    return (
        <div className="w-full h-[100dvh] bg-bg-default flex flex-col sm:items-center sm:justify-center sm:p-6 overflow-hidden">
            <div className="w-full h-full sm:max-w-[1600px] sm:h-[92vh] flex relative bg-bg-paper sm:rounded-2xl overflow-hidden shadow-none sm:shadow-2xl border-0 sm:border border-border-default">
                {/* Sidebar - Mobile Drawer */}
                <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-bg-paper/95 backdrop-blur-xl border-r border-border-default flex flex-col shadow-2xl transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:w-96 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    {/* Mobile Close Button */}
                    {/* Mobile Close Button Removed - now in header */}

                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-border-default bg-bg-default shadow-sm z-10 relative">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="relative group cursor-pointer" onClick={() => navigate('/profile')}>
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-all duration-300">
                                        {user?.username?.[0]?.toUpperCase() || '#'}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-[3px] border-bg-paper"></div>
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-sm text-text-secondary leading-tight">
                                        {user?.username || user?.phone_number}
                                    </h3>
                                    <span className="text-[10px] text-green-500 font-medium bg-green-500/10 px-1.5 py-0.5 rounded-full inline-flex self-start mt-0.5">
                                        Online
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 bg-bg-default/80 p-1 rounded-lg border border-border-default shadow-sm">
                                <button
                                    onClick={toggleTheme}
                                    className="p-1.5 text-text-primary hover:text-primary-500 hover:bg-bg-paper rounded-md transition-all"
                                    title="Toggle Theme"
                                >
                                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                </button>
                                {/* Mobile Close Button */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="lg:hidden p-1.5 text-text-primary hover:text-red-500 hover:bg-bg-paper rounded-md transition-all"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Compact Search */}
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Search messages..."
                                className="w-full bg-bg-paper text-text-primary pl-9 pr-3 py-2.5 rounded-xl text-sm font-medium
                                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 
                                         placeholder:text-text-secondary transition-all border border-border-default shadow-sm group-hover:shadow-md"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary-500 transition-colors" size={16} />
                        </div>
                    </div>

                    {/* New Chat Button */}
                    {/* New Chat Button */}
                    <div className="px-6 pb-2 pt-4">
                        <button
                            onClick={() => { setIsNewChatModalOpen(true); setIsMobileMenuOpen(true); }}
                            className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-indigo-600 text-white rounded-2xl text-sm font-bold tracking-wide
                     hover:from-primary-600 hover:to-indigo-700 transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 
                     hover:-translate-y-0.5 duration-200 border border-white/10 flex items-center justify-center gap-2"
                        >
                            <MessageSquare size={18} fill="currentColor" className="opacity-80" />
                            Start New Chat
                        </button>
                    </div>

                    {/* New Chat Modal */}
                    {isNewChatModalOpen && (
                        <div className="px-6 pb-2 origin-top">
                            <div className="p-5 bg-bg-paper border border-primary-500/20 rounded-2xl shadow-xl shadow-primary-500/5">
                                <h4 className="text-sm font-bold mb-4 text-text-primary flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-primary-500 rounded-full"></span>
                                    New Conversation
                                </h4>
                                <form onSubmit={handleStartNewChat} className="space-y-4">
                                    <div className="relative group">
                                        <input
                                            placeholder="Enter phone number"
                                            value={newChatPhone}
                                            onChange={(e) => setNewChatPhone(e.target.value)}
                                            className="w-full bg-bg-default text-text-primary pl-10 pr-4 py-3 rounded-xl text-sm
                                                     focus:outline-none focus:ring-2 focus:ring-primary-500/50 
                                                     border border-border-default placeholder:text-text-secondary/70 transition-all"
                                            autoFocus
                                        />
                                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary-500 transition-colors" />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button type="button" onClick={() => setIsNewChatModalOpen(false)}
                                            className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-default rounded-lg transition-colors">
                                            Cancel
                                        </button>
                                        <button type="submit" className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all transform hover:-translate-y-0.5">
                                            Start Chat
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-2">
                        {conversations.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className={`group p-3.5 mx-1 flex items-center gap-4 cursor-pointer transition-all duration-200 rounded-2xl border
                         ${selectedChat?.id === chat.id
                                        ? 'bg-primary-500/10 border-primary-500/20 shadow-md transform scale-[1.01]'
                                        : 'bg-bg-paper border-transparent hover:border-border-default hover:shadow-md hover:-translate-y-0.5'}`}
                            >
                                <div className="relative flex-shrink-0">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform duration-300 ${selectedChat?.id === chat.id ? 'scale-110 shadow-primary-500/30' : 'shadow-black/5 group-hover:scale-105'} ${selectedChat?.id === chat.id ? 'bg-gradient-to-tr from-primary-500 to-indigo-600' : 'bg-gradient-to-tr from-slate-400 to-slate-500'}`}>
                                        {chat.other_username?.[0]?.toUpperCase() || chat.other_phone?.[0] || 'U'}
                                    </div>
                                    {onlineUsers.has(chat.other_user_id) && (
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-[3px] border-bg-paper shadow-sm"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className={`font-bold text-sm truncate transition-colors ${selectedChat?.id === chat.id ? 'text-primary-600' : 'text-text-primary'}`}>
                                            {chat.other_username || chat.other_phone}
                                        </h4>
                                        {chat.last_message_time && (
                                            <span className={`text-[11px] font-medium flex-shrink-0 ${selectedChat?.id === chat.id ? 'text-primary-500' : 'text-text-secondary/60'}`}>
                                                {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <p className={`text-xs truncate flex-1 ${selectedChat?.id === chat.id ? 'text-primary-500/80 font-medium' : 'text-text-secondary font-medium'}`}>
                                            {chat.last_message || 'Start a conversation'}
                                        </p>
                                        {chat.unread_count > 0 && (
                                            <div className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full shadow-lg shadow-primary-500/30 animate-pulse">
                                                {chat.unread_count}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Logout */}
                    <div className="p-4 border-t border-border-default bg-bg-default">
                        <button
                            onClick={logout}
                            className="w-full py-3.5 px-4 bg-bg-paper text-text-secondary hover:text-white hover:bg-red-500 rounded-2xl 
                     flex items-center justify-center gap-2.5 transition-all duration-300 font-semibold text-sm
                     shadow-sm hover:shadow-red-500/25 border border-border-default hover:border-red-500 group"
                        >
                            <LogOut size={18} className="group-hover:stroke-current" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black/50 z-40"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Main Chat Area */}
                {selectedChat ? (
                    <div className="flex-1 w-full flex flex-col bg-bg-default/50 relative overflow-hidden">
                        {/* Chat Header */}
                        <div className="h-16 sm:h-20 px-3 sm:px-6 border-b border-border-default flex items-center justify-between bg-bg-paper/90 backdrop-blur-xl shadow-sm z-10 relative">
                            <div className="flex items-center gap-2 sm:gap-4">
                                <button
                                    onClick={() => setSelectedChat(null)}
                                    className="p-2 text-text-secondary hover:text-primary-500 hover:bg-primary-500/10 rounded-lg transition-all mr-1"
                                    title="Back to Home"
                                >
                                    <Home size={22} />
                                </button>
                                {/* Mobile Menu Button */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    className="lg:hidden p-2 text-dark-300 hover:text-dark-50 rounded-lg hover:bg-dark-700 transition-colors"
                                >
                                    <Menu size={24} />
                                </button>
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-lg">
                                        {selectedChat.other_username?.[0] || selectedChat.other_phone?.[0]}
                                    </div>
                                    <div className={`absolute bottom-0 right-0 w-3 h-3 ${onlineUsers.has(selectedChat.other_user_id) ? 'bg-green-500' : 'bg-gray-400'} rounded-full border-2 border-bg-paper`}></div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-text-primary text-base truncate pr-2">
                                        {selectedChat.other_username || selectedChat.other_phone}
                                    </h3>
                                    {isTyping ? (
                                        <span className="text-xs text-primary-400 font-medium animate-pulse flex items-center gap-1">
                                            Typing...
                                        </span>
                                    ) : onlineUsers.has(selectedChat.other_user_id) ? (
                                        <span className="text-xs text-green-500 font-medium flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                            Online
                                        </span>
                                    ) : (
                                        <span className="text-xs text-text-secondary font-medium">
                                            Offline
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => startCall('video')}
                                    className="p-3 text-text-secondary hover:text-primary-400 hover:bg-primary-400/10 rounded-xl transition-all"
                                    title="Start Video Call"
                                >
                                    <Video size={20} />
                                </button>
                                <button
                                    onClick={() => startCall('audio')}
                                    className="p-3 text-text-secondary hover:text-primary-400 hover:bg-primary-400/10 rounded-xl transition-all"
                                    title="Start Voice Call"
                                >
                                    <Phone size={20} />
                                </button>

                                {/* Options Menu */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                                        className="p-3 text-text-secondary hover:text-primary-400 hover:bg-primary-400/10 rounded-xl transition-all"
                                    >
                                        <MoreVertical size={20} />
                                    </button>

                                    {showOptionsMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setShowOptionsMenu(false)}
                                            />
                                            <div className="absolute right-0 top-12 w-48 bg-bg-paper border border-border-default rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                                                <button
                                                    onClick={handleClearChat}
                                                    className="w-full px-4 py-3 text-left flex items-center gap-3 text-text-secondary hover:text-text-primary hover:bg-bg-default transition-colors"
                                                >
                                                    <MessageSquareX size={16} />
                                                    <span className="font-medium text-sm">Clear Chat</span>
                                                </button>
                                                <button
                                                    onClick={handleDeleteChat}
                                                    className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-500 hover:bg-red-500/10 transition-colors border-t border-border-default"
                                                >
                                                    <Trash2 size={16} />
                                                    <span className="font-medium text-sm">Delete Chat</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4"
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                        >
                            {isLoadingMore && (
                                <div className="flex justify-center py-2">
                                    <span className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
                                </div>
                            )}
                            {messages.map((msg, index) => {
                                const isMe = msg.sender_id === user?.id;
                                const showAvatar = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);
                                const date = new Date(msg.created_at).toLocaleDateString();
                                const prevDate = index > 0 ? new Date(messages[index - 1].created_at).toLocaleDateString() : null;
                                const showDate = date !== prevDate;

                                return (
                                    <div key={index}>
                                        {showDate && (
                                            <div className="flex justify-center mb-6 mt-2">
                                                <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm">
                                                    {formatDateForSeparator(msg.created_at)}
                                                </span>
                                            </div>
                                        )}

                                        <div className={`flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start items-end'} animate-slide-up relative group`}>
                                            {/* Avatar */}
                                            {!isMe && (
                                                <div className="flex-shrink-0 mr-3 mb-6 w-8">
                                                    {showAvatar ? (
                                                        msg.sender_avatar ? (
                                                            <img src={msg.sender_avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                                {msg.sender_name?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                        )
                                                    ) : <div className="w-8" />}
                                                </div>
                                            )}

                                            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[60%]`}>
                                                <div className="relative group">
                                                    {/* Delete Button */}
                                                    {isMe && (
                                                        <button
                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1.5 absolute -left-8 top-1/2 -translate-y-1/2 text-text-secondary hover:text-red-500 transition-all hidden sm:block"
                                                            title="Delete message"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}

                                                    <div className={`
                                                        px-4 sm:px-5 py-2.5 sm:py-3 shadow-sm text-[14px] sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap w-fit rounded-2xl
                                                        ${isMe
                                                            ? 'bg-[#FEF3C7] dark:bg-yellow-900/40 text-gray-900 dark:text-gray-100 rounded-br-none'
                                                            : 'bg-[#F3E8FF] dark:bg-purple-900/40 text-gray-900 dark:text-gray-100 rounded-tl-none'
                                                        }
                                                    `}>
                                                        {(() => {
                                                            // For static files, use server root without /api
                                                            const serverBase = 'http://localhost:5000';

                                                            // For file-based messages, use file_url if available, otherwise fall back to content
                                                            const rawUrl = msg.file_url || msg.content;
                                                            const fileUrl = rawUrl?.startsWith('http') ? rawUrl : `${serverBase}${rawUrl}`;

                                                            const isImage = (url) => /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|heic)$/i.test(url);
                                                            const isVideo = (url) => /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(url);
                                                            const isAudio = (url) => /\.(mp3|wav|ogg|webm|m4a)$/i.test(url);

                                                            if (msg.type === 'image' || (msg.type === 'text' && isImage(rawUrl))) {
                                                                return (
                                                                    <div className="relative group">
                                                                        <img
                                                                            src={fileUrl}
                                                                            alt="attachment"
                                                                            className="max-w-full sm:max-w-sm rounded-lg cursor-pointer hover:opacity-95 transition-opacity mb-1 object-cover shadow-sm"
                                                                            style={{ maxHeight: '300px' }}
                                                                            onClick={() => window.open(fileUrl, '_blank')}
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                                e.target.nextSibling.style.display = 'flex';
                                                                            }}
                                                                        />
                                                                        <div className="hidden items-center gap-2 p-3 bg-red-50 text-red-500 rounded-lg border border-red-100">
                                                                            <span className="text-sm font-medium">Failed to load image</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            } else if (msg.type === 'video' || (msg.type === 'text' && isVideo(rawUrl))) {
                                                                return (
                                                                    <video
                                                                        src={fileUrl}
                                                                        controls
                                                                        className="max-w-full rounded-lg mb-1"
                                                                    />
                                                                );
                                                            } else if (msg.type === 'audio' || (msg.type === 'text' && isAudio(rawUrl))) {
                                                                return (
                                                                    <audio
                                                                        src={fileUrl}
                                                                        controls
                                                                        className="max-w-full mb-1"
                                                                    />
                                                                );
                                                            } else if (msg.type === 'file') {
                                                                return (
                                                                    <a
                                                                        href={fileUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`flex items-center gap-2 p-2 rounded-lg transition-colors bg-black/5 hover:bg-black/10`}
                                                                    >
                                                                        <Paperclip size={20} />
                                                                        <span className="underline truncate max-w-[150px]">Attachment</span>
                                                                    </a>
                                                                );
                                                            } else {
                                                                return <p>{msg.content}</p>;
                                                            }
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* Meta Info */}
                                                <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                    {!isMe && showAvatar && (
                                                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                            {msg.sender_name || 'User'}
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] text-gray-400 font-medium">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isMe && (
                                                        <span className="flex items-center">
                                                            {msg.is_read || msg.status === 'read' ? (
                                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm ml-1"></div>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 ml-1 capitalize">{msg.status || 'sent'}</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Typing Indicator */}
                            {isTyping && (
                                <div className="flex w-full mb-2 justify-start items-end animate-slide-up relative group">
                                    <div className="flex-shrink-0 mr-3 mb-6 w-8">
                                        <div className="w-8" />
                                    </div>
                                    <div className="flex flex-col items-start max-w-[75%] sm:max-w-[60%]">
                                        <div className="px-5 py-3 shadow-sm text-[15px] leading-relaxed break-words whitespace-pre-wrap w-fit rounded-2xl bg-[#F3E8FF] dark:bg-purple-900/40 text-gray-900 dark:text-gray-100 rounded-tl-none">
                                            <div className="flex items-center space-x-1">
                                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="w-full flex-shrink-0 p-3 sm:p-6 bg-transparent relative z-20">
                            <form
                                onSubmit={handleSendMessage}
                                className="flex items-center gap-2 sm:gap-3 bg-bg-paper p-1.5 sm:p-2 rounded-[2rem] shadow-xl border border-border-default/50 w-full max-w-4xl mx-auto"
                            >
                                <button
                                    type="button"
                                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors ml-1"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading || isRecording}
                                >
                                    <Plus size={20} className="sm:w-6 sm:h-6" />
                                </button>

                                <button
                                    type="button"
                                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                    onClick={() => setShowCamera(true)}
                                    disabled={isUploading || isRecording}
                                >
                                    <Camera size={20} className="sm:w-6 sm:h-6" />
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />

                                {isRecording ? (
                                    <div className="flex-1 flex items-center justify-between bg-red-50 px-4 py-3 rounded-full animate-pulse">
                                        <div className="flex items-center gap-2 text-red-500 font-medium">
                                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                            <span>Recording {formatDuration(recordingDuration)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleCancelRecording}
                                                className="p-1.5 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                                                title="Cancel"
                                            >
                                                <X size={20} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleStopRecording}
                                                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                                title="Send"
                                            >
                                                <Square size={16} fill="currentColor" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            placeholder={`Message...`}
                                            className="flex-1 bg-transparent text-text-primary px-2 py-3 focus:outline-none placeholder:text-gray-400 font-medium min-w-0"
                                            value={newMessage}
                                            onChange={(e) => {
                                                setNewMessage(e.target.value);
                                                if (socket && selectedChat) {
                                                    socket.emit('typing:start', { conversationId: selectedChat.id });
                                                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                                    typingTimeoutRef.current = setTimeout(() => {
                                                        socket.emit('typing:stop', { conversationId: selectedChat.id });
                                                    }, 2000);
                                                }
                                            }}
                                        />

                                        <button type="button"
                                            className={`p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors hidden sm:block ${showEmojiPicker ? 'text-yellow-500' : ''}`}
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        >
                                            <Smile size={24} />
                                        </button>

                                        {newMessage.trim() ? (
                                            <button type="submit"
                                                className="bg-black hover:bg-gray-800 text-white px-4 sm:px-6 py-2.5 rounded-full font-semibold text-sm transition-all shadow-md active:scale-95 flex-shrink-0"
                                            >
                                                Send
                                            </button>
                                        ) : (
                                            <button type="button"
                                                onClick={handleStartRecording}
                                                className="bg-black hover:bg-gray-800 text-white p-3 rounded-full transition-all shadow-md active:scale-95 flex-shrink-0"
                                            >
                                                <Mic size={20} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </form>

                            {showEmojiPicker && (
                                <div className="absolute bottom-24 right-10 z-50 shadow-2xl rounded-2xl border border-border-default">
                                    <EmojiPicker
                                        onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)}
                                        theme={theme}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-bg-default relative overflow-hidden">
                        {/* Background Decor */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none">
                            <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
                            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-200"></div>
                            <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-400"></div>
                        </div>

                        {/* Mobile Menu Button - Empty State */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden absolute top-4 left-4 p-3 text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-paper transition-colors z-10"
                        >
                            <Menu size={24} />
                        </button>

                        {/* Profile Button - Empty State */}
                        <button
                            onClick={() => navigate('/profile')}
                            className="absolute top-4 right-4 flex items-center gap-3 p-2 pr-4 bg-bg-paper/50 hover:bg-bg-paper rounded-full shadow-sm hover:shadow-md transition-all z-10 border border-transparent hover:border-border-default backdrop-blur-sm group"
                            title="Profile Settings"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
                                {user?.username?.[0]?.toUpperCase() || <User size={18} />}
                            </div>
                            <span className="font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                                {user?.username || 'Profile'}
                            </span>
                        </button>

                        <div className="relative z-10 flex flex-col items-center text-center p-8 max-w-md animate-slide-up">
                            <div className="w-32 h-32 bg-gradient-to-tr from-primary-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-8 relative">
                                <div className="absolute inset-0 rounded-full border border-primary-500/10 animate-[spin_10s_linear_infinite]"></div>
                                <MessageSquare size={48} className="text-primary-500 drop-shadow-lg" />
                                <div className="absolute -right-2 -bottom-2 p-3 bg-bg-paper rounded-full shadow-lg border border-border-default">
                                    <Send size={24} className="text-purple-500" />
                                </div>
                            </div>

                            <h2 className="text-3xl font-bold text-text-primary mb-3">
                                Welcome to Chat App
                            </h2>
                            <p className="text-text-secondary mb-8 text-lg leading-relaxed">
                                Select a conversation from the sidebar or start a new chat to begin messaging your friends and colleagues.
                            </p>

                            <div className="flex flex-col gap-3 w-full sm:w-auto">
                                <button
                                    onClick={() => { setIsNewChatModalOpen(true); setIsMobileMenuOpen(true); }}
                                    className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-semibold 
                                             shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:from-primary-600 hover:to-primary-700 
                                             transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center gap-3 w-full sm:w-auto"
                                >
                                    <span className="text-xl">+</span>
                                    Start New Conversation
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Video Call Modal */}
                {isCallActive && activeCallChat && (
                    <VideoCall
                        socket={socket}
                        user={user}
                        chat={activeCallChat}
                        onClose={endCall}
                        isInitiator={isInitiator}
                        incomingCallSignal={callSignal}
                        callType={callType}
                    />
                )}

                {/* Media Capture Modal */}
                {showCamera && (
                    <MediaCapture
                        onClose={() => setShowCamera(false)}
                        onSend={handleCameraCapture}
                    />
                )}
            </div>
        </div >
    );
};

export default Dashboard;
