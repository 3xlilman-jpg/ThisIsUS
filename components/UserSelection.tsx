import React, { useEffect, useState, useRef } from 'react';
import { MicrophoneIcon } from './icons';

interface UserSelectionProps {
    onSelectUser: (user: string, method: 'click' | 'voice') => void;
}

const users = ['Millie', 'Yolanda', 'Lilman'];
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export const UserSelection: React.FC<UserSelectionProps> = ({ onSelectUser }) => {
    const [status, setStatus] = useState("Say your name to begin...");
    const [error, setError] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError('Voice recognition is not supported by your browser. Please select a profile manually.');
            return;
        }

        if (!recognitionRef.current) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.interimResults = false;
            recognitionRef.current.maxAlternatives = 1;

            recognitionRef.current.onresult = (event: any) => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                const transcript = event.results[0][0].transcript.toLowerCase();
                const matchedUser = users.find(user => transcript.includes(user.toLowerCase()));

                if (matchedUser) {
                    setStatus(`Welcome, ${matchedUser}!`);
                    setTimeout(() => onSelectUser(matchedUser, 'voice'), 1200);
                } else {
                    setStatus("Sorry, I didn't recognize that name. Please try again.");
                    setTimeout(startRecognition, 2000);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                setIsListening(false);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                if (event.error === 'no-speech' || event.error === 'audio-capture') {
                   setStatus("I didn't hear anything. Let's try again...");
                   setTimeout(startRecognition, 1500); 
                } else if (event.error !== 'aborted') {
                    console.error('Speech recognition error:', event.error);
                    setError(`Voice recognition error. Please select your profile manually.`);
                }
            };
            
            recognitionRef.current.onspeechstart = () => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
        
        const startRecognition = () => {
            if (isListening) return;
            setIsListening(true);
            setStatus("Listening...");
            recognitionRef.current.start();
            
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => {
                if (isListening) {
                   recognitionRef.current.stop();
                }
            }, 2500);
        };
        
        startRecognition();

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };

    }, []); // Removed dependencies to avoid re-triggering useEffect on state changes

    return (
        <div className="min-h-screen flex flex-col items-center justify-center animate-fade-in-up p-4">
            <div className="text-center">
                <div className="flex items-center justify-center space-x-4 mb-4">
                     <div className="text-amber-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl font-bold text-amber-400 tracking-wider">
                        ThisIsUs
                      </h1>
                      <p className="text-sm text-gray-400">Creative Suite</p>
                    </div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-200 mt-8">Who's working with Rose today?</h2>
            </div>

            <div className="mt-8 flex flex-col items-center space-y-4">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-amber-500/20 animate-pulse-slow' : 'bg-gray-800'}`}>
                    <MicrophoneIcon className={`w-12 h-12 ${isListening ? 'text-amber-400' : 'text-gray-500'}`} />
                </div>
                <p className="text-amber-300 h-6">{status}</p>
                {error && <p className="text-red-400 text-center max-w-sm">{error}</p>}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                {users.map(user => (
                    <button
                        key={user}
                        onClick={() => onSelectUser(user, 'click')}
                        className="px-8 py-4 bg-gray-800 text-amber-400 font-bold text-lg rounded-lg border-2 border-gray-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all duration-300 ease-in-out"
                    >
                        {user}
                    </button>
                ))}
            </div>
        </div>
    );
};