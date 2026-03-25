import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer'; // ERROR 1 FIXED: Added Peer import
import { Globe, MonitorUp, Plus, Moon, Sun, Mic, PhoneOff, Video, Send, MessageSquare, X } from 'lucide-react';

const socket = io.connect(process.env.REACT_APP_BACKEND_URL);

const App = () => {
  const [inCall, setInCall] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [message, setMessage] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [notification, setNotification] = useState('');
  const [roomId, setRoomId] = useState('');
  const [lang, setLang] = useState('English');
  const [stream, setStream] = useState(); // ERROR 2 FIXED: State for local stream
  const [remoteStream, setRemoteStream] = useState();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef(); // ERROR 7 FIXED: Ref for Peer object
  const currentRoom = useRef('');

  useEffect(() => {
    // ERROR 6 FIXED: Clean up listeners properly
    socket.on('receive-message', (data) => setChatLog((prev) => [...prev, data]));
    socket.on('notification', (msg) => {
      setNotification(msg);
      setTimeout(() => setNotification(''), 3000);
    });

    // WebRTC Signaling Events
    socket.on('user-joined', (newUserId) => {
      if (stream && connectionRef.current === undefined) {
        initiateCall(newUserId);
      }
    });

    socket.on('offer', async (offer, callerId) => {
      if (!stream) return;
      if (connectionRef.current === undefined) {
        createPeerConnection(callerId, false);
      }
      if (connectionRef.current) {
        await connectionRef.current.signal(offer);
      }
    });

    socket.on('answer', async (answer) => {
      if (connectionRef.current) {
        await connectionRef.current.signal(answer);
      }
    });

    socket.on('ice-candidate', async (candidate) => {
      if (connectionRef.current) {
        try {
          await connectionRef.current.addIceCandidate(candidate);
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    socket.on('user-disconnected', () => {
      endCall();
    });

    return () => {
      socket.off('receive-message');
      socket.off('notification');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-disconnected');
    };
  }, []);

  const startCall = () => {
    const targetRoom = roomId || 'Global-Room'; // ERROR 5 FIXED: Fallback Room ID
    currentRoom.current = targetRoom;
    setInCall(true);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      // ERROR 3 FIXED: Correct way to attach stream to video element
      if (myVideo.current) myVideo.current.srcObject = currentStream;
      
      socket.emit('join-room', targetRoom);
    });
  };

  const sendMessage = () => {
    if (message.trim()) {
      const messageData = {
        roomId: roomId || 'Global-Room',
        message: message.trim(),
        sender: 'Me',
        timestamp: Date.now()
      };
      socket.emit('send-message', messageData);
      setMessage('');
    }
  };

  if (!inCall) return (
    <div className={darkMode ? "bg-slate-900 text-white min-h-screen" : "bg-gray-50 text-slate-900 min-h-screen"}>
      <nav className="p-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-3xl font-black italic">MEETSPACE</div>
        <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-2xl bg-white dark:bg-slate-800">
          {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
        </button>
      </nav>
      <main className="max-w-4xl mx-auto pt-24 text-center">
        <h1 className="text-8xl font-black mb-8 italic leading-none">Limitless <br/><span className="text-blue-600">Calls.</span></h1>
        <div className="flex justify-center gap-4">
          <button onClick={startCall} className="bg-blue-600 px-10 py-5 rounded-[2rem] font-bold text-white shadow-2xl hover:scale-105 transition flex items-center gap-3">
            <Plus/> Start Meeting
          </button>
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] outline-none w-64 shadow-sm placeholder-slate-400 dark:placeholder-slate-500" />
        </div>
      </main>
    </div>
  );

  return (
    <div className={`h-screen flex flex-col p-4 overflow-hidden ${darkMode ? 'bg-black' : 'bg-gray-200'}`}>
      {notification && <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-3 rounded-full shadow-2xl z-50">{notification}</div>}
      <div className="flex-grow flex gap-4 overflow-hidden">
        <div className={`flex-grow grid ${showChat ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4 transition-all duration-500`}>
          {/* ERROR 3 FIXED: Use ref={myVideo} properly */}
          <div className="bg-slate-900 rounded-[3rem] border border-white/5 relative overflow-hidden">
            <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover" />
            <div className="absolute bottom-8 left-8 bg-black/40 backdrop-blur-md px-4 py-1 rounded-full text-xs text-white">You</div>
          </div>
          {!showChat && (
            <div className="bg-slate-900 rounded-[3rem] border border-white/5 relative overflow-hidden">
               <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
               {remoteStream ? (
                 <div className="absolute bottom-8 left-8 bg-black/40 backdrop-blur-md px-4 py-1 rounded-full text-xs text-white">Remote</div>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                   <span className="text-white/70 text-sm">Waiting for remote user...</span>
                 </div>
               )}
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-96 bg-slate-900 rounded-[3rem] flex flex-col border border-white/10 overflow-hidden shadow-2xl" role="complementary" aria-label="Chat panel">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h3 className="font-black text-white italic">ROOM CHAT</h3>
              <button onClick={() => setShowChat(false)} aria-label="Close chat panel" className="text-white/30 hover:text-white transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-grow p-6 overflow-y-auto space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
              {chatLog.length === 0 ? (
                <div className="text-center text-white/50 text-sm py-8">No messages yet. Start the conversation!</div>
              ) : (
                chatLog.map((chat, i) => (
                  <div key={`${chat.sender}-${chat.timestamp || i}`} className={`flex flex-col ${chat.sender === 'Me' ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-white/60 mb-1 px-2">{chat.sender}</span>
                    <div className={`p-4 rounded-3xl text-sm max-w-xs break-words ${chat.sender === 'Me' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'}`}>{chat.message}</div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (message.trim()) sendMessage(); }} className="p-6 bg-white/5">
              <div className="flex gap-3">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="bg-slate-800 border-none rounded-2xl p-4 text-sm text-white placeholder-white/50 flex-grow outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Chat message input"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  aria-label="Send message"
                  className="bg-blue-600 p-4 rounded-2xl text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500"
                >
                  <Send size={18}/>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="h-32 flex items-center justify-center gap-8" role="toolbar" aria-label="Call controls">
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={isMuted}
          className={`p-5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/50 ${isMuted ? 'bg-red-500' : 'bg-white/5'} text-white border border-white/5 hover:scale-110`}
        >
          <Mic size={24}/>
        </button>
        <button
          onClick={toggleVideo}
          title={isVideoOff ? 'Turn on video' : 'Turn off video'}
          aria-label={isVideoOff ? 'Enable camera' : 'Disable camera'}
          aria-pressed={isVideoOff}
          className={`p-5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/50 ${isVideoOff ? 'bg-red-500' : 'bg-white/5'} text-white border border-white/5 hover:scale-110`}
        >
          <Video size={24}/>
        </button>
        <button
          onClick={endCall}
          title="End call"
          aria-label="Disconnect from call"
          className="p-6 bg-red-500 rounded-full text-white shadow-xl hover:scale-110 transition focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          <PhoneOff size={28}/>
        </button>
        <button
          onClick={() => setShowChat(!showChat)}
          title="Toggle chat"
          aria-label={showChat ? 'Close chat panel' : 'Open chat panel'}
          aria-pressed={showChat}
          className={`p-5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-white/50 ${showChat ? 'bg-blue-600 text-white' : 'bg-white/5 text-white'} hover:scale-110`}
        >
          <MessageSquare size={24}/>
        </button>
        <button
          onClick={() => setLang(lang === 'English' ? 'Spanish' : 'English')}
          title={`Switch to ${lang === 'English' ? 'Spanish' : 'English'}`}
          aria-label={`Change language to ${lang === 'English' ? 'Spanish' : 'English'}`}
          className="p-5 bg-white/5 rounded-full text-white hover:bg-blue-600 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          <Globe size={24}/>
        </button>
      </div>
    </div>
  );
};

export default App;