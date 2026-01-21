import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, User, Phone as PhoneIcon, Camera, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

const Profile = () => {
    const { user, login } = useAuth(); // login is essentially setUser if we passed it, but we can refetch
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState(user?.username || '');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setUsername(user.username || '');
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const { data } = await authService.updateProfile({ username });

            // Update Global Context AND Local Storage
            const token = localStorage.getItem('token');
            // This updates both localStorage and React State
            login(token, data);

            setMessage('Profile updated successfully!');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-default flex items-center justify-center p-4 transition-colors duration-300">
            <div className="w-full max-w-md bg-bg-paper rounded-2xl shadow-xl border border-border-default overflow-hidden">
                {/* Header */}
                <div className="relative h-32 bg-gradient-to-r from-primary-500 to-primary-600">
                    <button
                        onClick={() => navigate('/')}
                        className="absolute top-4 left-4 p-2.5 bg-black/20 text-white rounded-xl hover:bg-black/40 transition-all backdrop-blur-md border border-white/10 shadow-lg hover:scale-105 active:scale-95"
                        title="Go to Home"
                    >
                        <Home size={22} />
                    </button>
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                        <div className="relative group cursor-pointer">
                            <div className="w-24 h-24 rounded-full bg-bg-paper p-1 shadow-xl">
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-3xl font-bold">
                                    {username?.[0]?.toUpperCase() || user?.phone_number?.[0] || '#'}
                                </div>
                            </div>
                            <div className="absolute bottom-1 right-1 p-1.5 bg-primary-500 rounded-full text-white shadow-lg border-2 border-bg-paper group-hover:bg-primary-600 transition-colors">
                                <Camera size={14} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-16 pb-8 px-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-text-primary">
                            {user?.phone_number}
                        </h2>
                        <p className="text-text-secondary">Customize your profile</p>
                    </div>

                    {message && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-sm text-center">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider ml-1">
                                Username
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-input-bg text-text-primary pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 border border-border-default transition-all"
                                    placeholder="Enter your name"
                                />
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider ml-1">
                                Phone Number
                            </label>
                            <div className="relative opacity-60">
                                <input
                                    type="text"
                                    value={user?.phone_number || ''}
                                    readOnly
                                    className="w-full bg-input-bg text-text-primary pl-10 pr-4 py-3 rounded-xl border border-border-default cursor-not-allowed"
                                />
                                <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold 
                                     hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary-500/30 
                                     hover:shadow-primary-500/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
