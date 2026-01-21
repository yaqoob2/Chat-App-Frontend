import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Volume2, ChevronLeft, Disc } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VideoCall = ({ socket, user, chat, onClose, incomingCallSignal, isInitiator, callType = 'video' }) => {
    const [stream, setStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(true);
    const [callDuration, setCallDuration] = useState(0);
    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();
    const timerRef = useRef(null);

    // Update video elements when streams change
    useEffect(() => {
        if (myVideo.current && stream) {
            myVideo.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        if (userVideo.current && remoteStream) {
            console.log('Setting remote stream to video element');
            userVideo.current.srcObject = remoteStream;
            userVideo.current.play().catch(err => console.error('Error playing remote video:', err));
        }
    }, [remoteStream]);

    // Call duration timer
    useEffect(() => {
        if (callAccepted && !callEnded) {
            timerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [callAccepted, callEnded]);

    // Format call duration
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const constraints = {
            video: callType === 'video',
            audio: true
        };
        navigator.mediaDevices.getUserMedia(constraints)
            .then((currentStream) => {
                console.log('Got local stream:', currentStream);
                setStream(currentStream);

                if (isInitiator) {
                    console.log('Creating peer as initiator');
                    const peer = new Peer({
                        initiator: true,
                        trickle: false,
                        stream: currentStream,
                        config: {
                            iceServers: [
                                { urls: 'stun:stun.l.google.com:19302' },
                                { urls: 'stun:global.stun.twilio.com:3478' }
                            ]
                        }
                    });

                    peer.on('signal', (data) => {
                        console.log('Sending signal to other user');
                        socket.emit('call_user', {
                            userToCallId: chat.other_user_id,
                            signalData: data,
                            fromUser: user,
                            callType: callType
                        });
                    });

                    peer.on('stream', (receivedStream) => {
                        console.log('✅ Received remote stream (initiator):', receivedStream);
                        setRemoteStream(receivedStream);
                        setCallAccepted(true);
                    });

                    peer.on('error', (err) => {
                        console.error('Peer error:', err);
                    });

                    socket.on('call_answered', (data) => {
                        console.log('Call answered, signaling back');
                        peer.signal(data.signal);
                    });

                    connectionRef.current = peer;
                }
            })
            .catch(err => {
                console.error("Failed to get media", err);
                alert("Could not access camera/microphone. Please allow permissions.");
                onClose();
            });

        return () => {
            socket.off('call_answered');
        };
    }, []);

    const answerCall = () => {
        console.log('Answering call with stream:', stream);
        if (!stream) {
            console.error('No stream available to answer call!');
            return;
        }

        setCallAccepted(true);

        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: stream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('signal', (data) => {
            console.log('Sending answer signal');
            socket.emit('answer_call', { signal: data, to: chat.other_user_id });
        });

        peer.on('stream', (receivedStream) => {
            console.log('✅ Received remote stream (receiver):', receivedStream);
            setRemoteStream(receivedStream);
        });

        peer.on('error', (err) => {
            console.error('Peer error on answer:', err);
        });

        console.log('Signaling with incoming signal');
        peer.signal(incomingCallSignal);
        connectionRef.current = peer;
    };

    const leaveCall = () => {
        setCallEnded(true);
        if (connectionRef.current) connectionRef.current.destroy();
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
        socket.emit('end_call', { to: chat.other_user_id });
        onClose();
    };

    const toggleMic = () => {
        if (stream) {
            stream.getAudioTracks()[0].enabled = !micOn;
            setMicOn(!micOn);
        }
    };

    const toggleCamera = () => {
        if (stream) {
            stream.getVideoTracks()[0].enabled = !cameraOn;
            setCameraOn(!cameraOn);
        }
    };

    useEffect(() => {
        socket.on('call_ended', () => {
            setCallEnded(true);
            if (stream) stream.getTracks().forEach(track => track.stop());
            if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
            if (timerRef.current) clearInterval(timerRef.current);
            onClose();
            alert("Call ended by partner");
        });
        return () => socket.off('call_ended');
    }, [socket, stream, remoteStream]);

    return (
        <div className="fixed inset-0 z-[100] bg-black animate-in fade-in duration-300">
            {/* Background / Remote Video - Fullscreen */}
            <div className="absolute inset-0 z-0">
                {remoteStream ? (
                    <video
                        playsInline
                        ref={userVideo}
                        autoPlay
                        muted={false}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white">
                        <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mb-4 animate-pulse">
                            <VideoIcon size={40} className="text-gray-500" />
                        </div>
                        <p className="text-lg font-medium opacity-70">
                            {isInitiator ? 'Calling...' : 'Connecting...'}
                        </p>
                    </div>
                )}
                {/* Dark Gradient Overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
            </div>

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-12 sm:pt-6 flex justify-between items-start">
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/40 transition-all"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
                    <Disc size={14} className="text-red-500 animate-pulse fill-red-500" />
                    <span className="text-white font-mono text-sm font-medium tracking-wider">
                        {formatDuration(callDuration)}
                    </span>
                </div>
            </div>

            {/* PIP Local Video */}
            {cameraOn && stream && (
                <div className="absolute bottom-28 right-4 w-32 h-48 sm:w-40 sm:h-60 bg-black/50 rounded-2xl overflow-hidden border border-white/20 shadow-2xl z-30 transition-all hover:scale-105 cursor-pointer">
                    <video
                        playsInline
                        muted
                        ref={myVideo}
                        autoPlay
                        className="w-full h-full object-cover mirror"
                    />
                </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-10 left-4 right-4 z-40">
                <div className="flex items-center justify-between gap-4 max-w-sm mx-auto">

                    {/* Utilites Group */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleMic}
                            className={`w-12 h-12 rounded-xl backdrop-blur-md flex items-center justify-center border transition-all ${micOn
                                    ? 'bg-black/30 border-white/10 text-white hover:bg-black/50'
                                    : 'bg-white text-black border-white'
                                }`}
                        >
                            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>

                        <button
                            onClick={toggleCamera}
                            className={`w-12 h-12 rounded-xl backdrop-blur-md flex items-center justify-center border transition-all ${cameraOn
                                    ? 'bg-black/30 border-white/10 text-white hover:bg-black/50'
                                    : 'bg-white text-black border-white'
                                }`}
                        >
                            {cameraOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                        </button>

                        <button
                            className="w-12 h-12 rounded-xl bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/50 transition-all"
                        >
                            <Volume2 size={20} />
                        </button>
                    </div>

                    {/* End Call Button */}
                    <button
                        onClick={leaveCall}
                        className="flex-1 h-12 bg-red-500 hover:bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/30 transition-all active:scale-95"
                    >
                        <PhoneOff size={24} fill="currentColor" />
                    </button>
                </div>
            </div>

            {/* In-Call Answer Prompt (if receiving) */}
            {!isInitiator && !callAccepted && (
                <div className="absolute inset-x-0 bottom-32 flex flex-col items-center gap-6 z-50 animate-in slide-in-from-bottom-20">
                    <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-white font-medium">Incoming Call from {chat.other_username}</span>
                    </div>
                    <div className="flex gap-8">
                        <button
                            onClick={leaveCall}
                            className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                            <PhoneOff size={28} />
                        </button>
                        <button
                            onClick={answerCall}
                            className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform animate-bounce"
                        >
                            <Phone size={28} fill="currentColor" />
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .mirror {
                    transform: scaleX(-1);
                }
            `}</style>
        </div>
    );
};

export default VideoCall;
