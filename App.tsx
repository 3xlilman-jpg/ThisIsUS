import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Loader } from './components/Loader';
import { GuideModal } from './components/GuideModal';
import { AssistantPanel } from './components/AssistantPanel';
import { CulinaryAssistant } from './components/CulinaryAssistant';
import { UserSelection } from './components/UserSelection';
import { generateImageVariant, generateMarketingContent, generateVideoScript, generateProactiveInsight, updateUserProfile } from './services/geminiService';
import type { ImageVariant, MarketingContent, VideoScript, ImageFile, ConversationTurn, GroundingSource, UserProfile } from './types';
import { IMAGE_VARIANTS } from './constants';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'creative' | 'culinary'>('creative');
  const [imageFile, setImageFile] = useState<ImageFile | null>(null);
  const [productDescription, setProductDescription] = useState('');
  const [generatedVariants, setGeneratedVariants] = useState<ImageVariant[]>([]);
  const [marketingContent, setMarketingContent] = useState<MarketingContent | null>(null);
  const [marketingSources, setMarketingSources] = useState<GroundingSource[]>([]);
  const [videoScript, setVideoScript] = useState<VideoScript | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGuideVisible, setIsGuideVisible] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [initialGreeting, setInitialGreeting] = useState<string | null>(null);


  // Load conversation history and user profile from storage when user changes
  useEffect(() => {
    if (!currentUser) return;

    // Load User Profile
    try {
      const savedProfile = localStorage.getItem(`${currentUser}_userProfile`);
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      } else {
        setUserProfile({}); // Reset for new user
      }
    } catch (error) {
       console.error("Failed to load or parse user profile:", error);
       setUserProfile({});
    }

    // Load Conversation History
    try {
      const savedHistory = localStorage.getItem(`${currentUser}_conversationHistory`);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (parsedHistory.length > 0) {
          setConversationHistory(parsedHistory);
          return;
        }
      }
    } catch (error) {
      console.error("Failed to load or parse conversation history:", error);
    }
    
    // Determine welcome message based on "voice learning"
    const voiceProfileLearned = localStorage.getItem(`${currentUser}_voiceProfileLearned`) === 'true';
    const welcomeMessage = voiceProfileLearned
      ? `Welcome back, ${currentUser}! It's good to hear your voice again. I'm Rose, your personal life assistant and marketing partner. How can I help you today?`
      : `Welcome back, ${currentUser}! It's great to see you. I'm Rose, your personal life assistant and marketing partner. I'm ready to help with your creative projects or just chat about life. What can I do for you today?`;

    setInitialGreeting(welcomeMessage);
    setConversationHistory([
      {
        speaker: 'assistant',
        text: welcomeMessage,
        isFinal: true,
      },
    ]);
  }, [currentUser]);

  // Save conversation history to localStorage
  useEffect(() => {
    if (!currentUser || conversationHistory.length === 0) return;
    try {
      localStorage.setItem(`${currentUser}_conversationHistory`, JSON.stringify(conversationHistory));
    } catch (error) {
      console.error("Failed to save conversation history:", error);
    }
  }, [conversationHistory, currentUser]);
  
  // Save user profile to localStorage
  useEffect(() => {
    if (!currentUser) return;
    try {
        localStorage.setItem(`${currentUser}_userProfile`, JSON.stringify(userProfile));
    } catch (error) {
        console.error("Failed to save user profile:", error);
    }
  }, [userProfile, currentUser]);
  
  const handleSelectUser = (user: string, method: 'click' | 'voice' = 'click') => {
    if (method === 'voice') {
      const loginCount = parseInt(localStorage.getItem(`${user}_voiceLoginCount`) || '0', 10) + 1;
      localStorage.setItem(`${user}_voiceLoginCount`, loginCount.toString());
      if (loginCount >= 3) {
        localStorage.setItem(`${user}_voiceProfileLearned`, 'true');
      }
    }
    setCurrentUser(user);
  };


  const handleFileSelect = async (file: File) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const fileWithPreview = {
        file,
        previewUrl: URL.createObjectURL(file),
        base64: base64String.split(',')[1],
        mimeType: file.type,
      };
      setImageFile(fileWithPreview);

      try {
        const insight = await generateProactiveInsight({ trigger: 'IMAGE_UPLOADED' });
        setConversationHistory(prev => [...prev, {
          speaker: 'assistant',
          text: insight,
          isFinal: true
        }]);
      } catch (e) {
        console.error("Failed to get image upload insight:", e);
      }

      handleGenerate(fileWithPreview);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (currentImageFile: ImageFile) => {
    if (!currentImageFile.base64 || !currentImageFile.mimeType) return;
    setIsLoading(true);
    setGeneratedVariants([]);
    setMarketingContent(null);
    setMarketingSources([]);
    setVideoScript(null);

    try {
      const variantsPromises = IMAGE_VARIANTS.map(v =>
        generateImageVariant(currentImageFile.base64!, currentImageFile.mimeType!, v.style)
          .then(url => ({ ...v, url }))
      );
      
      const marketingPromise = generateMarketingContent(currentImageFile.base64!, currentImageFile.mimeType!, productDescription);

      const variants = await Promise.all(variantsPromises);
      setGeneratedVariants(variants);

      const { content: marketing, sources } = await marketingPromise;
      setMarketingContent(marketing);
      setMarketingSources(sources);

      const insight = await generateProactiveInsight({ trigger: 'MARKETING_GENERATED', marketingContent: marketing, productDescription });
      setConversationHistory(prev => [...prev, {
        speaker: 'assistant',
        text: insight,
        isFinal: true
      }]);

    } catch (error) {
      console.error('Generation failed:', error);
      const errorMessage = 'An error occurred during generation. Please check the console for details and try again.';
       setConversationHistory(prev => [...prev, {
        speaker: 'assistant',
        text: errorMessage,
        isFinal: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!imageFile?.base64 || !marketingContent) return;
    setIsGeneratingScript(true);
    try {
      const ideas = marketingContent.postIdeas.join('; ');
      const script = await generateVideoScript(imageFile.base64, imageFile.mimeType!, ideas, productDescription);
      setVideoScript(script);

      const insight = await generateProactiveInsight({ trigger: 'VIDEO_SCRIPT_GENERATED', videoScript: script, marketingContent, productDescription });
       setConversationHistory(prev => [...prev, {
        speaker: 'assistant',
        text: insight,
        isFinal: true
      }]);
    } catch (error) {
      console.error('Script generation failed:', error);
      const errorMessage = 'An error occurred during script generation. Please check the console and try again.';
      setConversationHistory(prev => [...prev, {
        speaker: 'assistant',
        text: errorMessage,
        isFinal: true
      }]);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSwitchUser = useCallback(() => {
    setImageFile(null);
    setProductDescription('');
    setGeneratedVariants([]);
    setMarketingContent(null);
    setMarketingSources([]);
    setVideoScript(null);
    setIsLoading(false);
    setIsGeneratingScript(false);
    setIsGuideVisible(false);
    setConversationHistory([]);
    setUserProfile({});
    setActiveView('creative');
    setCurrentUser(null);
  }, []);

  const handleClearConversation = () => {
    if (!currentUser) return;
    localStorage.removeItem(`${currentUser}_conversationHistory`);
    setConversationHistory([
      {
        speaker: 'assistant',
        text: "Let's start fresh. What's on your mind?",
        isFinal: true,
      },
    ]);
  };
  
  const handleUpdateUserProfile = useCallback(async (history: ConversationTurn[]) => {
    if (!currentUser || history.length < 2) return; 
    try {
        const updatedProfile = await updateUserProfile(history, userProfile);
        setUserProfile(updatedProfile);
    } catch (error) {
        console.error("Failed to update user profile:", error);
    }
  }, [userProfile, currentUser]);

  const handleShowGuide = () => setIsGuideVisible(true);
  const handleCloseGuide = () => setIsGuideVisible(false);

  if (!currentUser) {
    return <UserSelection onSelectUser={handleSelectUser} />;
  }

  return (
    <div className="min-h-screen bg-transparent font-sans">
      <Header onSwitchUser={handleSwitchUser} activeView={activeView} setActiveView={setActiveView} />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {activeView === 'creative' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {!imageFile ? (
                <FileUpload onFileSelect={handleFileSelect} />
              ) : (
                <div className="space-y-8 animate-fade-in-up">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-1 space-y-4">
                       <img src={imageFile.previewUrl} alt="Original" className="rounded-2xl w-full h-auto object-cover shadow-2xl shadow-black/50" />
                       <textarea
                          value={productDescription}
                          onChange={(e) => setProductDescription(e.target.value)}
                          placeholder="Add a product description..."
                          className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-gray-300"
                          rows={4}
                       />
                       <button
                          onClick={() => handleGenerate(imageFile)}
                          disabled={isLoading}
                          className="w-full bg-amber-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-amber-500 transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                       >
                          {isLoading ? <Loader /> : '✨ Regenerate'}
                       </button>
                    </div>
                    <div className="md:col-span-2">
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-96 bg-black/30 rounded-2xl">
                          <Loader />
                          <p className="mt-4 text-amber-400 font-semibold">Generating Creative Assets...</p>
                          <p className="mt-1 text-sm text-gray-400">This can take up to 30 seconds.</p>
                        </div>
                      ) : (
                        <ResultsDisplay
                          variants={generatedVariants}
                          marketingContent={marketingContent}
                          marketingSources={marketingSources}
                          videoScript={videoScript}
                          onGenerateScript={handleGenerateScript}
                          isGeneratingScript={isGeneratingScript}
                          onShowGuide={handleShowGuide}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Assistant Panel */}
            <div className="lg:col-span-2 lg:sticky lg:top-28">
               <AssistantPanel
                  currentUser={currentUser}
                  conversationHistory={conversationHistory}
                  setConversationHistory={setConversationHistory}
                  userProfile={userProfile}
                  onUpdateUserProfile={handleUpdateUserProfile}
                  appContext={{
                    productDescription,
                    marketingContent,
                    videoScript,
                  }}
                  onClearConversation={handleClearConversation}
                  initialGreeting={initialGreeting}
                  onGreetingSpoken={() => setInitialGreeting(null)}
                />
            </div>
          </div>
        )}
        {activeView === 'culinary' && <CulinaryAssistant />}
      </main>

      {isGuideVisible && <GuideModal onClose={handleCloseGuide} />}
    </div>
  );
};

export default App;