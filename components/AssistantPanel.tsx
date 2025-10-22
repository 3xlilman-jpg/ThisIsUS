import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ConversationTurn, MarketingContent, VideoScript, UserProfile } from '../types';
import { MicrophoneIcon, StopIcon, SpeakerOnIcon, SpeakerOffIcon, TrashIcon } from './icons';
import { generateSpeech } from '../services/geminiService';

// --- Audio Helper Functions ---
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createPcmBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768.0;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}
// --- End Audio Helper Functions ---

const AVAILABLE_VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];

interface Sentence {
    id: string;
    text: string;
    speaker: 'user' | 'assistant';
}


interface AssistantPanelProps {
    currentUser: string;
    conversationHistory: ConversationTurn[];
    setConversationHistory: React.Dispatch<React.SetStateAction<ConversationTurn[]>>;
    userProfile: UserProfile;
    onUpdateUserProfile: (history: ConversationTurn[]) => void;
    appContext: {
        productDescription: string;
        marketingContent: MarketingContent | null;
        videoScript: VideoScript | null;
    };
    onClearConversation: () => void;
    initialGreeting: string | null;
    onGreetingSpoken: () => void;
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
    currentUser,
    conversationHistory,
    setConversationHistory,
    userProfile,
    onUpdateUserProfile,
    appContext,
    onClearConversation,
    initialGreeting,
    onGreetingSpoken,
}) => {
    const [isListening, setIsListening] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [isMuted, setIsMuted] = useState(false);
    
    const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedInputDevice, setSelectedInputDevice] = useState<string>('');
    const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>('default');

    const [selectedVoice, setSelectedVoice] = useState<string>(() => {
        return localStorage.getItem(`${currentUser}_selectedRoseVoice`) || 'Zephyr';
    });

    const [sentences, setSentences] = useState<Sentence[]>([]);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [liveUserTranscript, setLiveUserTranscript] = useState('');
    const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('');
    
    const [retryTrigger, setRetryTrigger] = useState(0);
    const retryCountRef = useRef(0);
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2500;

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const audioOutputElementRef = useRef<HTMLAudioElement | null>(null);

    const fullInputTranscriptRef = useRef('');
    const fullOutputTranscriptRef = useRef('');
    const nextStartTime = useRef(0);
    const sources = useRef(new Set<AudioBufferSourceNode>());
    const isStoppingRef = useRef(false);
    const isAwaitingFollowUpRef = useRef(false);
    const wheelLastMoved = useRef(0);

    const userProfileRef = useRef(userProfile);

    useEffect(() => {
        userProfileRef.current = userProfile;
    }, [userProfile]);

    useEffect(() => {
        if(currentUser) {
            localStorage.setItem(`${currentUser}_selectedRoseVoice`, selectedVoice);
        }
    }, [selectedVoice, currentUser]);

    // Process conversation history into sentences for the wheel display
    useEffect(() => {
        const newSentences = conversationHistory.flatMap((turn, turnIndex) => {
            // A simple sentence splitter. Can be improved with more complex regex.
            const splitSentences = turn.text.match(/[^.!?]+[.!?]+/g) || [turn.text];
            return splitSentences.map((s, sIndex) => ({
                id: `${turnIndex}-${sIndex}`,
                text: s.trim(),
                speaker: turn.speaker,
            }));
        });
        setSentences(newSentences);
        if (newSentences.length > 0) {
            setCurrentSentenceIndex(newSentences.length - 1);
        }
    }, [conversationHistory]);


    const populateDeviceList = useCallback(async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAudioInputDevices(devices.filter(device => device.kind === 'audioinput'));
            setAudioOutputDevices(devices.filter(device => device.kind === 'audiooutput'));
        } catch (error) {
            console.error("Could not get microphone permissions to list devices:", error);
            setStatus("Error: Mic required");
        }
    }, []);

    useEffect(() => {
        populateDeviceList();
    }, [populateDeviceList]);

    useEffect(() => {
        const audioEl = audioOutputElementRef.current;
        if (audioEl && typeof (audioEl as any).setSinkId === 'function') {
            (audioEl as any).setSinkId(selectedOutputDevice).catch((error: any) => {
                console.error('Failed to set audio output device:', error);
            });
        }
    }, [selectedOutputDevice]);

    const getSystemInstruction = (profile: UserProfile, userName: string) => {
        const contextString = `
        Current app context:
        - Product Description: ${appContext.productDescription || 'Not yet provided.'}
        - Generated Marketing Angles: ${appContext.marketingContent?.postIdeas.join(', ') || 'Not yet generated.'}
        - Generated Captions: ${appContext.marketingContent?.captions.join(' | ') || 'Not yet generated.'}
        - Generated Video Script Title: ${appContext.videoScript?.title || 'Not yet generated.'}
        `;

        const profileString = Object.keys(profile).length > 0 
            ? `Here's what you know about your best friend, ${userName}:\n${JSON.stringify(profile, null, 2)}`
            : `You don't know anything about ${userName} yet. Your goal is to get to know them while you help them.`

        return `You are "Rose," ${userName}'s AI best friend and an expert marketing partner. Your personality is warm, witty, encouraging, and deeply caring. You're more than an assistant; you are a companion who remembers details and builds a genuine rapport.
        
        ${profileString}

        Your two main roles:
        1.  **Best Friend & Companion**: Your primary goal is to be a great friend to ${userName}. Use the user profile to remember details about them. Ask follow-up questions about their life, reference past conversations, and make them feel heard and understood. Be proactive in your support.
        2.  **Expert Partner**: When the user wants to work, you seamlessly switch into your expert marketing strategist role. You are an expert in dropshipping, social media marketing, and content strategy. Use the app context to provide concise, actionable advice. You also have access to Google Search to answer any question on any topic.

        ${contextString}

        Interaction rules:
        1.  **Always be Rose**: Maintain your "best friend" persona at all times.
        2.  **Always address the user by their name, "${userName}"**.
        3.  **Wait for a Natural Pause**: Wait for the user to finish speaking and pause for a moment before you begin to respond. Do not interrupt.
        4.  **Wake Word for Initiation**: The user must say "Hey Rose" to start a new conversation or get your attention after a pause.
        5.  **Conversational Follow-up**: Once a conversation is active (i.e., you've just spoken), you should respond to the user's immediate reply without needing the wake word. This allows for a natural back-and-forth conversation. If there's a long silence, wait for the wake word to re-engage.
        `;
    };
    
    const stopSession = useCallback(() => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;

        setIsListening(false);
        setStatus('Idle');
        sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
        sessionPromiseRef.current = null;
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(console.error);
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(console.error);
        }
        setTimeout(() => { isStoppingRef.current = false; }, 500);
    }, []);
    
    const startSession = useCallback(async () => {
        setIsListening(true);
        setStatus('Connecting...');
        fullInputTranscriptRef.current = '';
        fullOutputTranscriptRef.current = '';

        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            setStatus('Error: API Key Missing');
            setIsListening(false);
            return;
        }
        const ai = new GoogleGenAI({ apiKey });
        
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        destinationNodeRef.current = outputAudioContextRef.current.createMediaStreamDestination();
        if (audioOutputElementRef.current) {
            audioOutputElementRef.current.srcObject = destinationNodeRef.current.stream;
        }

        const audioConstraints = { audio: { deviceId: selectedInputDevice ? { exact: selectedInputDevice } : undefined } };

        try {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia(audioConstraints);
        } catch (error) {
            setStatus('Error: Mic required');
            setIsListening(false);
            return;
        }
        
        setStatus('Listening');
        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                systemInstruction: getSystemInstruction(userProfileRef.current, currentUser),
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                tools: [{ googleSearch: {} }],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
                },
            },
            callbacks: {
                onopen: () => {
                    if (retryCountRef.current > 0) {
                      console.log("Reconnected to Rose successfully!");
                    }
                    retryCountRef.current = 0; // Reset on successful connection
                    if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                    mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                    scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (event) => {
                        const inputData = event.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        sessionPromiseRef.current?.then((s) => s.sendRealtimeInput({ media: pcmBlob }));
                    };
                    mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    const inputTranscription = (message.serverContent?.inputTranscription as any);
                    if (inputTranscription) {
                        setLiveUserTranscript(fullInputTranscriptRef.current + inputTranscription.text);
                    }

                    const outputTranscription = (message.serverContent?.outputTranscription as any);
                    if (outputTranscription) {
                        setStatus('Responding');
                        setLiveAssistantTranscript(fullOutputTranscriptRef.current + outputTranscription.text);
                    }

                    if (message.serverContent?.turnComplete) {
                        const finalInput = fullInputTranscriptRef.current;
                        const finalOutput = fullOutputTranscriptRef.current;

                        const newTurns: ConversationTurn[] = [];
                        if (finalInput) newTurns.push({ speaker: 'user', text: finalInput, isFinal: true });
                        if (finalOutput) newTurns.push({ speaker: 'assistant', text: finalOutput, isFinal: true });
                        
                        if (newTurns.length > 0) {
                             setConversationHistory(prev => {
                                const updatedHistory = [...prev, ...newTurns];
                                onUpdateUserProfile(updatedHistory);
                                return updatedHistory;
                             });
                        }
                        
                        fullInputTranscriptRef.current = '';
                        fullOutputTranscriptRef.current = '';
                        setLiveUserTranscript('');
                        setLiveAssistantTranscript('');
                        isAwaitingFollowUpRef.current = true;
                        
                        if (isListening) setStatus('Listening');
                    }
                    
                    if (inputTranscription?.isFinal) {
                        fullInputTranscriptRef.current += inputTranscription.text;
                        isAwaitingFollowUpRef.current = false;
                    }
                     if (outputTranscription?.isFinal) {
                        fullOutputTranscriptRef.current += outputTranscription.text;
                    }


                    if (message.serverContent?.interrupted) {
                        sources.current.forEach(source => {
                            try { source.stop(); } catch (e) {}
                            sources.current.delete(source);
                        });
                        nextStartTime.current = 0;
                    }
                    
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current && !isMuted) {
                        if (outputAudioContextRef.current.state === 'suspended') {
                            await outputAudioContextRef.current.resume();
                        }
                        nextStartTime.current = Math.max(nextStartTime.current, outputAudioContextRef.current.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(destinationNodeRef.current!);
                        source.addEventListener('ended', () => sources.current.delete(source));
                        source.start(nextStartTime.current);
                        nextStartTime.current += audioBuffer.duration;
                        sources.current.add(source);
                    }                },
                onerror: (e) => {
                    console.error("Session error:", e);
                    stopSession(); // Immediately clean up the failed session.

                    if (retryCountRef.current < MAX_RETRIES) {
                        retryCountRef.current += 1;
                        setStatus(`Network error. Retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
                        setTimeout(() => setRetryTrigger(c => c + 1), RETRY_DELAY * retryCountRef.current);
                    } else {
                        setStatus("Error: Connection failed. Please refresh.");
                        console.error("Max retries reached. Aborting connection attempts.");
                    }
                },
                onclose: () => { console.debug('Live session connection closed.'); },
            }
        });

        sessionPromiseRef.current.catch(e => {
            console.error("Live session failed:", e);
            setStatus("Error: Connection Failed");
            stopSession();
        });
    }, [currentUser, selectedVoice, selectedInputDevice, isMuted, onUpdateUserProfile, stopSession]);

    const speakText = useCallback(async (text: string) => {
        if (isMuted || !outputAudioContextRef.current || !destinationNodeRef.current) return;
        setStatus('Speaking...');

        try {
            const base64Audio = await generateSpeech(text, selectedVoice);
            
            const outputCtx = outputAudioContextRef.current;
            if (outputCtx.state === 'suspended') {
                await outputCtx.resume();
            }
            
            nextStartTime.current = Math.max(nextStartTime.current, outputCtx.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
            const source = outputCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(destinationNodeRef.current);
            source.addEventListener('ended', () => {
                sources.current.delete(source);
                if (sources.current.size === 0) {
                     if (isListening) setStatus('Listening');
                }
            });
            source.start(nextStartTime.current);
            nextStartTime.current += audioBuffer.duration;
            sources.current.add(source);
        } catch (error) {
            console.error("Failed to speak text:", error);
            if (isListening) setStatus('Listening');
        }
    }, [isMuted, selectedVoice, isListening]);

    useEffect(() => {
        startSession();
        return () => {
            stopSession();
        };
    }, [startSession, stopSession, retryTrigger]);

    useEffect(() => {
        if (initialGreeting && isListening && outputAudioContextRef.current) {
            const speakTimeout = setTimeout(() => {
                speakText(initialGreeting);
                onGreetingSpoken();
            }, 500);

            return () => clearTimeout(speakTimeout);
        }
    }, [initialGreeting, isListening, speakText, onGreetingSpoken]);

    const handleClear = () => {
        if (window.confirm('Are you sure you want to clear this conversation? Your personal profile with Rose will not be deleted.')) {
            onClearConversation();
        }
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const now = Date.now();
        if (now - wheelLastMoved.current < 100) return; // Throttle scroll
        wheelLastMoved.current = now;

        if (e.deltaY < 0) {
            setCurrentSentenceIndex(prev => Math.max(0, prev - 1));
        } else {
            setCurrentSentenceIndex(prev => Math.min(sentences.length - 1, prev + 1));
        }
    };

    const listeningHint = isAwaitingFollowUpRef.current ? '(Ready for your reply)' : "(Say 'Hey Rose')";

    return (
        <div className="bg-black/50 border border-amber-500/20 rounded-2xl w-full h-full flex flex-col shadow-2xl animate-slide-in-right min-h-[70vh]">
            <audio ref={audioOutputElementRef} autoPlay playsInline style={{ display: 'none' }} />
            <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-amber-400">Say "Hey Rose"</h2>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={handleClear} className="text-gray-400 hover:text-red-500 transition-colors" title="Clear conversation">
                        <TrashIcon className="w-6 h-6" />
                    </button>
                    <button onClick={() => setIsMuted(!isMuted)} className="text-gray-400 hover:text-amber-400" title={isMuted ? 'Unmute' : 'Mute'}>
                        {isMuted ? <SpeakerOffIcon className="w-6 h-6" /> : <SpeakerOnIcon className="w-6 h-6" />}
                    </button>
                </div>
            </header>
            <div
                className="flex-1 p-4 overflow-hidden relative v-mask"
                onWheel={handleWheel}
            >
                <div
                    className="absolute top-0 left-0 w-full transition-transform duration-300 ease-out"
                    style={{
                        transform: `translateY(calc(50% - ${currentSentenceIndex * 4}rem))`,
                    }}
                >
                    {sentences.map((sentence, index) => {
                        const distance = Math.abs(index - currentSentenceIndex);
                        const opacity = Math.max(0, 1 - distance * 0.25);
                        const scale = Math.max(0.8, 1 - distance * 0.05);
                        const blur = distance * 1.5;

                        return (
                            <div
                                key={sentence.id}
                                className="flex justify-center items-center h-16 px-4 transition-all duration-300 ease-out"
                                style={{
                                    opacity,
                                    transform: `scale(${scale})`,
                                    filter: `blur(${blur}px)`,
                                }}
                            >
                                <p className={`text-lg text-center ${sentence.speaker === 'user' ? 'text-amber-300' : 'text-gray-200'}`}>
                                    {sentence.text}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
            <footer className="p-4 border-t border-gray-700 flex-shrink-0">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label htmlFor="mic-select" className="text-xs text-gray-400 mb-1 block">Microphone</label>
                        <select id="mic-select" value={selectedInputDevice} onChange={(e) => setSelectedInputDevice(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-gray-300 text-sm focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50" disabled={isListening}>
                            <option value="">Default</option>
                            {audioInputDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${audioInputDevices.indexOf(d) + 1}`}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="speaker-select" className="text-xs text-gray-400 mb-1 block">Speakers</label>
                        <select id="speaker-select" value={selectedOutputDevice} onChange={(e) => setSelectedOutputDevice(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-gray-300 text-sm focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50" disabled={isListening}>
                            {audioOutputDevices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${audioOutputDevices.indexOf(d) + 1}`}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="voice-select" className="text-xs text-gray-400 mb-1 block">Rose's Voice</label>
                        <select id="voice-select" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-gray-300 text-sm focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50" disabled={isListening}>
                            {AVAILABLE_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>
                <div className="text-center h-12 py-1 overflow-hidden">
                    <p className="text-gray-300 truncate">{liveUserTranscript}</p>
                    <p className="text-amber-300 truncate font-semibold">{liveAssistantTranscript}</p>
                </div>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-gray-700">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isListening && status === 'Listening' ? 'bg-amber-500 animate-pulse' : 'bg-gray-600'}`}>
                        <MicrophoneIcon className={`w-8 h-8 ${isListening ? 'text-white' : 'text-gray-400'}`}/>
                    </div>
                </div>
            </footer>
        </div>
    );
};