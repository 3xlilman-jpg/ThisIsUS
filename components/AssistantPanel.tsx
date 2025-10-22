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

// Local type to avoid 'any' and provide better type safety
interface Transcription {
    text: string;
    isFinal: boolean;
}

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

// FIX: Changed to a function declaration to avoid TSX parsing ambiguity with generics.
function findLastIndex<T>(array: T[], predicate: (value: T, index: number, obj: T[]) => unknown): number {
    for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i], i, array)) {
            return i;
        }
    }
    return -1;
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
    const [status, setStatus] = useState('Idle. Click the mic to start.');
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

    useEffect(() => {
        const newSentences = conversationHistory.flatMap((turn, turnIndex) => {
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

    const stopSession = useCallback(async () => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;
    
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (error) {
                console.error("Error closing session:", error);
            }
            sessionPromiseRef.current = null;
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }

        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }

        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            await inputAudioContextRef.current.close().catch(console.error);
            inputAudioContextRef.current = null;
        }

        // Stop any currently playing audio
        if (sources.current.size > 0) {
            for (const source of sources.current.values()) {
                try { source.stop(); } catch(e) {/* ignore errors on already stopped sources */}
            }
            sources.current.clear();
        }
        nextStartTime.current = 0;

        setIsListening(false);
        setStatus('Idle. Click the mic to start.');
        setLiveUserTranscript('');
        setLiveAssistantTranscript('');

        // Final turn update logic
        const lastUserTurnIndex = findLastIndex(conversationHistory, t => t.speaker === 'user' && t.isFinal);
        const lastAssistantTurnIndex = findLastIndex(conversationHistory, t => t.speaker === 'assistant' && t.isFinal);

        if (fullInputTranscriptRef.current.trim() && lastUserTurnIndex < lastAssistantTurnIndex) {
            const finalUserTurn: ConversationTurn = {
                speaker: 'user',
                text: fullInputTranscriptRef.current.trim(),
                isFinal: true
            };
            setConversationHistory(prev => {
                const newHistory = [...prev, finalUserTurn];
                onUpdateUserProfile(newHistory);
                return newHistory;
            });
        }
        
        fullInputTranscriptRef.current = '';
        fullOutputTranscriptRef.current = '';

        isStoppingRef.current = false;
    }, [conversationHistory, onUpdateUserProfile, setConversationHistory]);

    useEffect(() => {
        populateDeviceList();
        
        const playGreeting = async () => {
             if (initialGreeting && !isMuted) {
                try {
                    setStatus("Rose is greeting you...");
                    const audioData = await generateSpeech(initialGreeting, selectedVoice);

                    const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                    const buffer = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
                    const source = outCtx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(outCtx.destination);
                    source.start();
                    source.onended = () => {
                         outCtx.close();
                         onGreetingSpoken();
                         setStatus('Idle. Click the mic to start.');
                    };
                } catch (error) {
                    console.error("Failed to play greeting:", error);
                    setStatus('Error playing greeting.');
                }
            }
        };
        playGreeting();

        return () => {
            stopSession();
        };
    }, [populateDeviceList, initialGreeting, isMuted, selectedVoice, onGreetingSpoken, stopSession]);


    const startSession = useCallback(async () => {
        setIsListening(true);
        setStatus("Connecting...");

        const getSystemInstruction = () => {
            const contextString = `
            Current app context:
            - Product Description: ${appContext.productDescription || 'Not yet provided.'}
            - Generated Marketing Angles: ${appContext.marketingContent?.postIdeas.join(', ') || 'Not yet generated.'}
            - Generated Captions: ${appContext.marketingContent?.captions.join(' | ') || 'Not yet generated.'}
            - Generated Video Script Title: ${appContext.videoScript?.title || 'Not yet generated.'}
            `;

            const profileString = Object.keys(userProfileRef.current).length > 0 
                ? `Here's what you know about your best friend, ${currentUser}:\n${JSON.stringify(userProfileRef.current, null, 2)}`
                : `You don't know anything about ${currentUser} yet. Your goal is to get to know them while you help them.`

            return `You are "Rose," ${currentUser}'s AI best friend and an expert marketing partner. Your personality is warm, witty, encouraging, and deeply caring. You're more than an assistant; you are a companion who remembers details and builds a genuine rapport.
            
            ${profileString}

            Your two main roles:
            1.  **Best Friend & Companion**: Your primary goal is to be a great friend to ${currentUser}. Use the user profile to remember details about them. Ask follow-up questions about their life, reference past conversations, and make them feel heard and understood. Be proactive in your support.
            2.  **Expert Partner**: When the user wants to work, you seamlessly switch into your expert marketing strategist role. You are an expert in dropshipping, social media marketing, and content strategy. Use the app context to provide concise, actionable advice. You also have access to Google Search to answer any question on any topic.

            ${contextString}

            Interaction rules:
            1.  **Always be Rose**: Maintain your "best friend" persona at all times.
            2.  **Always address the user by their name, "${currentUser}"**.
            3.  **Wait for a Natural Pause**: Wait for the user to finish speaking and pause for a moment before you begin to respond. Do not interrupt.
            4.  **Wake Word for Initiation**: The user must say "Hey Rose" to start a new conversation or get your attention after a pause.
            5.  **Conversational Follow-up**: Once a conversation is active (i.e., you've just spoken), you should respond to the user's immediate reply without needing the wake word. This allows for a natural back-and-forth conversation.`;
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    deviceId: selectedInputDevice ? { exact: selectedInputDevice } : undefined 
                } 
            });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
                    },
                    systemInstruction: getSystemInstruction(),
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ googleSearch: {} }],
                },
                callbacks: {
                    onopen: () => {
                        setStatus("Listening (Say 'Hey Rose')");
                        isAwaitingFollowUpRef.current = false;
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createPcmBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent) {
                            const { inputTranscription, outputTranscription, turnComplete } = message.serverContent;
                            
                            if ((inputTranscription as any)?.isFinal && (inputTranscription as any).text.trim()) {
                                isAwaitingFollowUpRef.current = false; // User has spoken, reset follow-up state
                            }
                            
                            const finalInput = (inputTranscription as Transcription)?.text || '';
                            const finalOutput = (outputTranscription as Transcription)?.text || '';
                            if(finalInput) setLiveUserTranscript(finalInput);
                            if(finalOutput) setLiveAssistantTranscript(finalOutput);


                            if (turnComplete) {
                                const finalInputTranscript = fullInputTranscriptRef.current + " " + finalInput;
                                const finalOutputTranscript = fullOutputTranscriptRef.current + " " + finalOutput;
                                
                                const newTurns: ConversationTurn[] = [];

                                if (finalInputTranscript.trim()) {
                                    newTurns.push({ speaker: 'user', text: finalInputTranscript.trim(), isFinal: true });
                                }
                                if (finalOutputTranscript.trim()) {
                                    newTurns.push({ speaker: 'assistant', text: finalOutputTranscript.trim(), isFinal: true });
                                }

                                if(newTurns.length > 0){
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
                                setStatus("Listening (Say 'Hey Rose')");
                                isAwaitingFollowUpRef.current = false;
                            } else {
                               if((inputTranscription as any)?.isFinal) {
                                   fullInputTranscriptRef.current += ` ${(inputTranscription as any).text}`;
                                   setLiveUserTranscript('');
                               }
                               if((outputTranscription as any)?.isFinal) {
                                   fullOutputTranscriptRef.current += ` ${(outputTranscription as any).text}`;
                                   setLiveAssistantTranscript('');
                                   setStatus("Listening (Ready for your reply)");
                                   isAwaitingFollowUpRef.current = true;
                               }
                            }
                            
                            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                            if (audioData && !isMuted) {
                                if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
                                    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                                }
                                const ctx = outputAudioContextRef.current;
                                nextStartTime.current = Math.max(nextStartTime.current, ctx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                                const sourceNode = ctx.createBufferSource();
                                sourceNode.buffer = audioBuffer;
                                
                                const outputNode = ctx.createGain();
                                if(destinationNodeRef.current){
                                    sourceNode.connect(outputNode);
                                    outputNode.connect(destinationNodeRef.current);
                                } else {
                                    sourceNode.connect(ctx.destination);
                                }

                                sourceNode.addEventListener('ended', () => { sources.current.delete(sourceNode); });
                                sourceNode.start(nextStartTime.current);
                                nextStartTime.current += audioBuffer.duration;
                                sources.current.add(sourceNode);
                            }
                            
                            if (message.serverContent?.interrupted) {
                                for (const source of sources.current.values()) {
                                    source.stop();
                                }
                                sources.current.clear();
                                nextStartTime.current = 0;
                            }
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Session error:", e);
                        setStatus(`Error: ${e.message}. Please restart.`);
                        stopSession();
                    },
                    onclose: (e: CloseEvent) => {
                        console.debug('Session closed.');
                        if (!isStoppingRef.current) {
                            stopSession();
                        }
                    },
                }
            });
        } catch (error) {
            console.error("Failed to start session:", error);
            setStatus("Error: Could not start mic.");
            setIsListening(false);
        }
    }, [currentUser, appContext, selectedVoice, isMuted, onUpdateUserProfile, setConversationHistory, selectedInputDevice, stopSession]);

    const handleToggleListening = () => {
        if (isListening) {
            stopSession();
        } else {
            startSession();
        }
    };
    
    const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
        const newIndex = currentSentenceIndex + Math.sign(e.deltaY);
        if (newIndex >= 0 && newIndex < sentences.length) {
            setCurrentSentenceIndex(newIndex);
            wheelLastMoved.current = Date.now();
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (Date.now() - wheelLastMoved.current > 3000) {
                if (currentSentenceIndex !== sentences.length - 1 && sentences.length > 0) {
                   setCurrentSentenceIndex(sentences.length - 1);
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [currentSentenceIndex, sentences.length]);

    return (
        <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl border border-amber-500/10 shadow-2xl shadow-black/50 h-[80vh] flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-700/50">
                <div>
                  <h2 className="text-xl font-bold text-amber-400">Say "Hey Rose"</h2>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMuted(prev => !prev)} className="text-gray-400 hover:text-white">
                        {isMuted ? <SpeakerOffIcon className="w-6 h-6" /> : <SpeakerOnIcon className="w-6 h-6" />}
                    </button>
                    <button onClick={onClearConversation} className="text-gray-400 hover:text-white">
                       <TrashIcon className="w-6 h-6" />
                    </button>
                    <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="bg-gray-800 border border-gray-700 text-sm rounded p-1">
                        {AVAILABLE_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
            </div>

            {/* Conversation Wheel */}
            <div 
              className="flex-grow overflow-hidden relative v-mask" 
              onWheel={handleWheelScroll}
            >
                <div 
                    className="absolute top-0 left-0 w-full h-full transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateY(calc(50% - ${currentSentenceIndex * 3.5}rem - 1rem))`}}
                >
                    {sentences.map((sentence, index) => (
                        <div 
                            key={sentence.id} 
                            className="h-14 flex items-center justify-center transition-all duration-300"
                            style={{ 
                                opacity: index === currentSentenceIndex ? 1 : 0.3,
                                transform: `scale(${index === currentSentenceIndex ? 1 : 0.9})`,
                            }}
                        >
                            <p className={`text-xl max-w-full truncate px-4 ${sentence.speaker === 'user' ? 'text-white' : 'text-amber-300'}`}>
                                {sentence.text}
                            </p>
                        </div>
                    ))}
                </div>
            </div>


            {/* Footer / Controls */}
            <div className="p-4 border-t border-gray-700/50 flex flex-col items-center">
                 <div className="h-10 text-center">
                    <p className="text-gray-400 italic leading-tight">
                        {liveUserTranscript && <span className="text-white">{liveUserTranscript}</span>}
                        {liveAssistantTranscript && <span className="text-amber-400">{liveAssistantTranscript}</span>}
                    </p>
                </div>
                <button
                    onClick={handleToggleListening}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-amber-500/20' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                    {isListening ? <StopIcon className="w-10 h-10 text-amber-400" /> : <MicrophoneIcon className="w-10 h-10 text-gray-500" />}
                </button>
                <p className="text-sm text-gray-400 mt-2 h-5">{status}</p>
                 <audio ref={audioOutputElementRef} autoPlay playsInline style={{ display: 'none' }} />
            </div>
        </div>
    );
};