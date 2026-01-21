import { useState, useEffect } from 'react';
import { MessageSquare, ArrowRight, Phone } from 'lucide-react';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [step, setStep] = useState('PHONE'); // PHONE | OTP
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [systemMessage, setSystemMessage] = useState(null);
    const [resendTimer, setResendTimer] = useState(0);
    const { login } = useAuth();

    // Timer effect
    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const maskPhoneNumber = (phone) => {
        if (!phone || phone.length < 5) return phone;
        // Simple masking logic assuming standard lengths, or just show last 4
        return `${phone.slice(0, 3)} •••• ${phone.slice(-4)}`;
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSystemMessage(null); // Clear previous

        // Simulation of "Sending..." delay for realism
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            if (!phoneNumber || phoneNumber.length < 5) return setError('Invalid phone number');

            const { data } = await authService.sendOtp(phoneNumber);

            // Generate system-like message
            if (data.devOtp) {
                const masked = maskPhoneNumber(phoneNumber);
                setSystemMessage({
                    title: 'System Message',
                    text: `Verification code sent to ${masked}`,
                    code: `Code: ${data.devOtp}`,
                    expiry: 'Expires in 5 minutes'
                });
                // Start 30s cooldown
                setResendTimer(30);
            }
            setStep('OTP');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        await handleSendOtp({ preventDefault: () => { } });
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const { data } = await authService.verifyOtp(phoneNumber, otp);
            login(data.token, data.user);
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 relative overflow-hidden px-4 py-8">
            {/* Background Decor */}
            <div className="absolute top-[-20%] left-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-primary-500/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-primary-600/10 rounded-full blur-[100px]" />

            <div className="w-full max-w-md p-6 sm:p-8 glass rounded-2xl shadow-2xl relative z-10">
                <div className="flex flex-col items-center mb-6 sm:mb-8">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 text-primary-400">
                        <MessageSquare size={32} fill="currentColor" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-dark-50">Welcome Back</h1>
                    <p className="text-dark-300 text-center mt-2 text-sm sm:text-base">
                        {step === 'PHONE'
                            ? 'Enter your mobile number to get started'
                            : 'Enter the code sent to your phone'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-500/20">
                        {error}
                    </div>
                )}

                {step === 'PHONE' ? (
                    <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                                <Phone size={16} className="inline mr-2" />
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                placeholder="+1 555 000 0000"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="input-primary text-base"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Sending code...' : 'Continue'}
                            {!isLoading && <ArrowRight size={18} />}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4 animate-in slide-in-from-right duration-300">
                        {/* System Message - Realistic OTP Display */}
                        {systemMessage && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-2 flex items-start gap-3">
                                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                                <div className="text-xs text-blue-100/90 font-mono space-y-1">
                                    <p className="opacity-70 font-sans tracking-wide">AUTHENTICATION SERVICE</p>
                                    <p>{systemMessage.text}</p>
                                    <p className="text-white font-bold bg-white/10 px-2 py-0.5 rounded w-fit select-all">
                                        {systemMessage.code}
                                    </p>
                                    <p className="text-[10px] opacity-60 italic">{systemMessage.expiry}</p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-dark-200 mb-2">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                placeholder="000000"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength={6}
                                className="input-primary text-center tracking-[0.5em] text-lg sm:text-xl font-mono"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="flex flex-col gap-3 mt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20"
                            >
                                {isLoading ? 'Verifying...' : 'Verify & Login'}
                            </button>

                            <div className="flex items-center justify-between text-sm px-1">
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={resendTimer > 0 || isLoading}
                                    className={`font-medium transition-colors ${resendTimer > 0 ? 'text-dark-300 cursor-not-allowed' : 'text-primary-400 hover:text-primary-300'}`}
                                >
                                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Code'}
                                </button>

                                <button
                                    type="button"
                                    className="text-dark-300 hover:text-white transition-colors"
                                    onClick={() => {
                                        setStep('PHONE');
                                        setOtp('');
                                        setSystemMessage(null);
                                    }}
                                >
                                    Wrong number?
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
