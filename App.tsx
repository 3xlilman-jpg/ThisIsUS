import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Loader } from './components/Loader';
import { GuideModal } from './components/GuideModal';
import { PolicyModal } from './components/PolicyModal';
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
  const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);
  const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);
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
  const handleClosePrivacy = () => setIsPrivacyModalVisible(false);
  const handleCloseTerms = () => setIsTermsModalVisible(false);

  if (!currentUser) {
    return <UserSelection onSelectUser={handleSelectUser} />;
  }

  return (
    <div className="min-h-screen bg-transparent font-sans flex flex-col">
      <Header onSwitchUser={handleSwitchUser} activeView={activeView} setActiveView={setActiveView} />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        {activeView === 'creative' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {!imageFile ? (
                <div className="max-w-3xl mx-auto text-center">
                  <h2 className="text-4xl font-extrabold text-amber-400 sm:text-5xl">Your Instant Creative Suite</h2>
                  <p className="mt-4 text-lg text-gray-400">Describe your product, then upload an image to generate professional visuals and copy in seconds.</p>
                  
                  <div className="mt-8 text-left space-y-2">
                     <label htmlFor="product-description" className="text-lg font-semibold text-gray-300">
                      1. Tell me about your product
                     </label>
                     <textarea
                        id="product-description"
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                        placeholder="What is this product called? What does it do? Who is it for? E.g., 'This is the 'Artisan's Chrono', a handcrafted leather watch strap for the modern professional...'"
                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-gray-300"
                        rows={4}
                     />
                  </div>

                  <FileUpload onFileSelect={handleFileSelect} />
                </div>
              ) : (
                <div className="space-y-8 animate-fade-in-up">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <div className="md:col-span-1 space-y-4">
                       <img src={imageFile.previewUrl} alt="Original" className="rounded-2xl w-full h-auto object-cover shadow-2xl shadow-black/50" />
                       {productDescription && (
                         <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
                            <h4 className="font-bold text-amber-400 text-sm">Product Description</h4>
                            <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{productDescription}</p>
                         </div>
                       )}
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

      <footer className="w-full text-center p-4 mt-8 border-t border-gray-800 flex-shrink-0">
          <div className="container mx-auto text-xs text-gray-500">
              <p>&copy; {new Date().getFullYear()} ThisIsUs. All Rights Reserved.</p>
              <div className="mt-2 space-x-4">
                  <button onClick={() => setIsPrivacyModalVisible(true)} className="hover:text-amber-400 transition-colors">Privacy Policy</button>
                  <span>|</span>
                  <button onClick={() => setIsTermsModalVisible(true)} className="hover:text-amber-400 transition-colors">Terms of Service</button>
              </div>
          </div>
      </footer>

      {isGuideVisible && <GuideModal onClose={handleCloseGuide} />}

      {isPrivacyModalVisible && (
        <PolicyModal title="Privacy Policy" onClose={handleClosePrivacy}>
            <div className="space-y-6 text-gray-300">
              <p className="italic">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              
              <p>This Privacy Policy explains how ThisIsUs Creative Suite ("we," "us," or "our") collects, uses, and discloses your information when you use our application. Your privacy is critically important to us.</p>

              <h3 className="text-xl font-bold text-amber-400">1. Information We Collect</h3>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li><strong>User-Provided Information:</strong> This includes your chosen username, product descriptions, and any text or voice commands you provide to our AI assistant, Rose.</li>
                <li><strong>Uploaded Content:</strong> We process the images you upload to generate creative assets. These images are sent to Google's Gemini API for processing and are not stored on our servers long-term.</li>
                <li><strong>Voice Data:</strong> When you use voice login or speak to Rose, your voice data is processed to recognize your name or transcribe your commands. For login, we store a count of voice logins locally to enable features like personalized greetings. For conversation, audio is streamed to the Gemini API for real-time transcription and response.</li>
                <li><strong>Locally Stored Data:</strong> To provide a personalized experience, we use your browser's `localStorage` to save your conversation history with Rose and your user profile (which is built from your interactions). This data remains on your device and is not transmitted to our servers.</li>
              </ul>

              <h3 className="text-xl font-bold text-amber-400">2. How We Use Your Information</h3>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>To operate and provide the core functionalities of the app, such as generating images, marketing copy, and video scripts.</li>
                <li>To personalize your experience by remembering your conversation history and user profile details.</li>
                <li>To enable voice interactions with our AI assistant, Rose.</li>
                <li>To improve our services. We do not use your personal content to train our models without your explicit consent.</li>
              </ul>

              <h3 className="text-xl font-bold text-amber-400">3. Third-Party Services</h3>
              <div className="space-y-4">
                <p><strong>Google Gemini API:</strong> We utilize Google's Gemini API to power our AI features. Information you provide (images, text, voice data) is sent to Google for processing. We encourage you to review <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">Google's Privacy Policy</a> to understand how they handle data.</p>
                <p><strong>TikTok Integration (Future Feature):</strong> To enable features like "Post to TikTok," we will need to interact with the TikTok platform. When you authorize this feature, information such as the generated video or image content may be shared with TikTok to create a post on your behalf. We recommend you review <a href="https://www.tiktok.com/legal/page/us/privacy-policy/en" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline">TikTok's Privacy Policy</a> to understand how they handle your data.</p>
              </div>

              <h3 className="text-xl font-bold text-amber-400">4. Data Security & Storage</h3>
              <p>Your conversation history and user profile are stored in your browser's `localStorage`. This means the data resides on your computer and is specific to the browser you use. Clearing your browser's cache or storage will delete this data permanently. We do not have a central server that stores this personal information.</p>

              <h3 className="text-xl font-bold text-amber-400">5. Your Choices</h3>
              <p>You can clear your conversation history at any time using the "Clear Conversation" button. You can also clear your browser's `localStorage` to completely reset your profile and history for the application.</p>
              
              <h3 className="text-xl font-bold text-amber-400">6. Changes to This Policy</h3>
              <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy within the application. You are advised to review this Privacy Policy periodically for any changes.</p>
            </div>
        </PolicyModal>
      )}
      
      {isTermsModalVisible && (
        <PolicyModal title="Terms of Service" onClose={handleCloseTerms}>
            <div className="space-y-6 text-gray-300">
                <p className="italic">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

                <p>Welcome to ThisIsUs Creative Suite. By accessing or using our application, you agree to be bound by these Terms of Service ("Terms").</p>

                <h3 className="text-xl font-bold text-amber-400">1. Use of Service</h3>
                <p>ThisIsUs provides an AI-powered suite of tools for creative marketing. You agree to use our service in compliance with all applicable laws and not for any unlawful purpose.</p>

                <h3 className="text-xl font-bold text-amber-400">2. User-Generated Content</h3>
                <ul className="list-disc list-inside space-y-2 pl-4">
                    <li>You retain all ownership rights to the content you upload (e.g., your product images, descriptions).</li>
                    <li>By using the service, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, process, and display your content solely for the purpose of operating, providing, and improving the service for you.</li>
                    <li>You are solely responsible for the content you upload. You agree not to upload content that is illegal, infringing, defamatory, or obscene.</li>
                </ul>

                <h3 className="text-xl font-bold text-amber-400">3. AI-Generated Output</h3>
                <ul className="list-disc list-inside space-y-2 pl-4">
                    <li>The service uses artificial intelligence to generate content (images, text, scripts). While we strive for high quality, we do not guarantee the accuracy, uniqueness, or suitability of the generated content.</li>
                    <li>You are responsible for reviewing and validating all AI-generated content before use. We are not liable for any issues arising from the use of this content.</li>
                    <li>Subject to your compliance with these Terms, we grant you the right to use the AI-generated assets for any legal purpose, including commercial use.</li>
                </ul>

                <h3 className="text-xl font-bold text-amber-400">4. Disclaimers and Limitation of Liability</h3>
                <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMISSIBLE BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.</p>
                <p>IN NO EVENT SHALL THISISUS CREATIVE SUITE OR ITS DEVELOPERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.</p>

                <h3 className="text-xl font-bold text-amber-400">5. Termination</h3>
                <p>We reserve the right to terminate or suspend your access to the service at our sole discretion, without prior notice, for conduct that we believe violates these Terms or is harmful to other users of the service, us, or third parties, or for any other reason.</p>

                <h3 className="text-xl font-bold text-amber-400">6. Changes to Terms</h3>
                <p>We may modify these Terms at any time. We will notify you of any changes by posting the new Terms within the application. Your continued use of the service after such changes constitutes your acceptance of the new Terms.</p>
            </div>
        </PolicyModal>
      )}
    </div>
  );
};

export default App;