import { useRef, useState, useEffect } from 'react';
import { X, Camera, Video, RefreshCw, Send, Circle, Square } from 'lucide-react';

const MediaCapture = ({ onClose, onSend }) => {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [mode, setMode] = useState('photo'); // 'photo' | 'video'
    const [capturedMedia, setCapturedMedia] = useState(null); // { type: 'image'|'video', url: string, blob: Blob }
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: mode === 'video'
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera");
            onClose();
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const takePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            setCapturedMedia({ type: 'image', url, blob });
        }, 'image/jpeg');
    };

    const toggleRecording = () => {
        if (isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        } else {
            chunksRef.current = [];
            const mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                setCapturedMedia({ type: 'video', url, blob });
            };

            mediaRecorder.start();
            setIsRecording(true);
            mediaRecorderRef.current = mediaRecorder;
        }
    };

    const handleSend = () => {
        if (capturedMedia) {
            // Create a File object from blob
            const extension = capturedMedia.type === 'image' ? 'jpg' : 'webm';
            const fileName = `capture_${Date.now()}.${extension}`;
            const file = new File([capturedMedia.blob], fileName, { type: capturedMedia.blob.type });
            onSend(file);
            onClose();
        }
    };

    const retake = () => {
        if (capturedMedia) {
            URL.revokeObjectURL(capturedMedia.url);
            setCapturedMedia(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header */}
            <div className="p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                <button onClick={onClose} className="text-white p-2 rounded-full bg-black/20 backdrop-blur">
                    <X size={24} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                {!capturedMedia ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={!isRecording} // Mute preview to avoid feedback
                        className="w-full h-full object-cover"
                    />
                ) : (
                    capturedMedia.type === 'image' ? (
                        <img src={capturedMedia.url} alt="Captured" className="w-full h-full object-contain" />
                    ) : (
                        <video src={capturedMedia.url} controls className="w-full h-full object-contain" />
                    )
                )}
            </div>

            {/* Controls */}
            <div className="p-8 pb-12 bg-black/40 backdrop-blur-sm">
                {!capturedMedia ? (
                    <div className="flex flex-col items-center gap-6">
                        {/* Mode Switcher */}
                        <div className="flex bg-black/50 rounded-full p-1 border border-white/10">
                            <button
                                onClick={() => setMode('photo')}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === 'photo' ? 'bg-white text-black' : 'text-white'}`}
                            >
                                Photo
                            </button>
                            <button
                                onClick={() => setMode('video')}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === 'video' ? 'bg-white text-black' : 'text-white'}`}
                            >
                                Video
                            </button>
                        </div>

                        {/* Shutter */}
                        <div className="flex items-center justify-between w-full max-w-xs px-8">
                            <div className="w-10" /> {/* Spacer */}

                            <button
                                onClick={mode === 'photo' ? takePhoto : toggleRecording}
                                className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 scale-110' : 'bg-white/20 hover:bg-white/40'}`}
                            >
                                {mode === 'photo' ? (
                                    <div className="w-16 h-16 bg-white rounded-full" />
                                ) : (
                                    isRecording ? <Square fill="white" className="text-white" /> : <div className="w-16 h-16 bg-red-500 rounded-full" />
                                )}
                            </button>

                            <button onClick={() => {
                                // Toggle camera facing mode logic could go here if implemented
                            }} className="w-10 flex justify-center text-white/80">
                                <RefreshCw size={24} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center px-8">
                        <button onClick={retake} className="text-white font-medium px-6 py-3 rounded-full bg-white/10 backdrop-blur">
                            Retake
                        </button>
                        <button onClick={handleSend} className="w-14 h-14 bg-primary-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                            <Send size={24} className="ml-1" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaCapture;
