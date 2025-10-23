import React, { useState } from 'react';
import type { ImageVariant, MarketingContent, VideoScript, GroundingSource } from '../types';
import { Loader } from './Loader';
import { HashtagIcon, LightbulbIcon, ScriptIcon, TextIcon, RocketIcon, LinkIcon, CloseIcon, DownloadIcon } from './icons';

interface ResultsDisplayProps {
    variants: ImageVariant[];
    marketingContent: MarketingContent | null;
    marketingSources: GroundingSource[];
    videoScript: VideoScript | null;
    onGenerateScript: () => void;
    isGeneratingScript: boolean;
    onShowGuide: () => void;
}

const ResultCard: React.FC<{title: string; icon: React.ReactNode; children: React.ReactNode}> = ({ title, icon, children }) => (
    <div className="bg-black/50 p-6 rounded-2xl border border-gray-700 shadow-2xl shadow-black/30">
        <div className="flex items-center mb-4 border-b-2 border-amber-500/20 pb-3">
            <div className="text-amber-400 mr-3">{icon}</div>
            <h3 className="text-xl font-semibold text-amber-300">{title}</h3>
        </div>
        {children}
    </div>
);


export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ variants, marketingContent, marketingSources, videoScript, onGenerateScript, isGeneratingScript, onShowGuide }) => {
  const [isPromptsVisible, setIsPromptsVisible] = useState(false);

  const handleDownload = (url: string, style: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${style.toLowerCase().replace(/\s+/g, '-')}-variant.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="space-y-8 animate-fade-in">
        {/* Image Variants */}
        <ResultCard title="Generated Visuals" icon={<LightbulbIcon className="w-6 h-6" />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {variants.map(variant => (
                    <div key={variant.style} className="relative group">
                        <img src={variant.url} alt={`${variant.style} variant`} className="rounded-lg w-full h-auto object-cover" />
                         <button
                            onClick={() => handleDownload(variant.url, variant.style)}
                            aria-label={`Download ${variant.style} image`}
                            title={`Download ${variant.style} image`}
                            className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-gray-300 hover:text-white hover:bg-amber-500 transition-all duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                        <div className="mt-2 text-center">
                            <h4 className="font-bold text-amber-400">{variant.style}</h4>
                            <p className="text-xs text-gray-400">{variant.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </ResultCard>

        {/* TikTok Story Prompts */}
        {marketingContent && (
             <ResultCard title="TikTok Story Prompts" icon={<RocketIcon className="w-6 h-6" />}>
                <div>
                    <p className="text-gray-400 mb-4">View AI-generated marketing angles, captions, and hashtags tailored for TikTok.</p>
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <button
                            onClick={() => setIsPromptsVisible(true)}
                            className="w-full sm:w-auto bg-amber-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-amber-400 transition-all duration-300 ease-in-out"
                        >
                            View TikTok Prompts
                        </button>
                        <button
                            disabled
                            className="w-full sm:w-auto bg-gray-700 text-gray-400 font-bold py-2 px-6 rounded-lg cursor-not-allowed opacity-60"
                        >
                            Post To TIKTOK (COMING SOON)
                        </button>
                    </div>
                </div>
            </ResultCard>
        )}
        
        {/* Grounding Sources */}
        {marketingSources && marketingSources.length > 0 && (
            <ResultCard title="Sources" icon={<LinkIcon className="w-6 h-6" />}>
                <ul className="space-y-2">
                    {marketingSources.map((source, index) => (
                        <li key={index}>
                            <a
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-400 hover:text-amber-300 hover:underline transition-colors text-sm"
                            >
                                {source.title}
                            </a>
                        </li>
                    ))}
                </ul>
            </ResultCard>
        )}
        
        {/* Video Ad Script */}
        <ResultCard title="Video Ad Script" icon={<ScriptIcon className="w-6 h-6" />}>
            {!videoScript ? (
                <div>
                    <p className="text-gray-400 mb-4">Generate a short video ad script to bring your marketing to life.</p>
                    <button
                        onClick={onGenerateScript}
                        disabled={isGeneratingScript}
                        className="w-full sm:w-auto bg-amber-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-amber-400 transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isGeneratingScript ? <Loader small={true} /> : '🎬 Generate Script'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4 text-gray-300">
                    <h4 className="text-lg font-bold text-amber-400">{videoScript.title}</h4>
                    {videoScript.scenes.map(scene => (
                        <div key={scene.scene} className="p-4 bg-gray-800/50 rounded-lg border-l-4 border-amber-500">
                           <div className="flex justify-between items-start gap-4">
                                <div className="flex-grow">
                                    <p className="font-bold text-amber-400">Scene {scene.scene}</p>
                                    <p><span className="font-semibold text-gray-400">Visual:</span> {scene.visual}</p>
                                    <p><span className="font-semibold text-gray-400">Voiceover:</span> <em className="text-gray-400">"{scene.voiceover}"</em></p>
                                </div>
                                <button
                                    disabled
                                    className="flex-shrink-0 bg-gray-700 text-gray-400 font-bold py-1 px-3 rounded-lg cursor-not-allowed opacity-60 text-xs whitespace-nowrap mt-1"
                                >
                                    (Generate Now) Coming soon
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ResultCard>

        {/* Generate Ads Placeholder */}
        <ResultCard title="Generate Ads" icon={<RocketIcon className="w-6 h-6" />}>
            <div>
                <p className="text-gray-400 mb-4">Automatically generate and launch ad campaigns for platforms like Meta and TikTok.</p>
                <button
                    disabled
                    className="w-full sm:w-auto bg-gray-700 text-gray-400 font-bold py-2 px-6 rounded-lg cursor-not-allowed opacity-60"
                >
                    Generate Ads (COMING SOON)
                </button>
            </div>
        </ResultCard>

        {/* Guide Button */}
        <ResultCard title="Next Steps" icon={<RocketIcon className="w-6 h-6" />}>
             <div>
                <p className="text-gray-400 mb-4">Ready to launch? This guide will walk you through turning these assets into high-converting ads.</p>
                <button
                    onClick={onShowGuide}
                    className="w-full sm:w-auto bg-amber-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-amber-400 transition-all duration-300 ease-in-out flex items-center justify-center gap-2"
                >
                    How to Sell
                </button>
            </div>
        </ResultCard>

         {isPromptsVisible && marketingContent && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in"
            onClick={() => setIsPromptsVisible(false)}
          >
            <div 
              className="bg-gray-900 border border-amber-500/20 rounded-2xl shadow-2xl shadow-black/50 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-gray-900/80 backdrop-blur-md p-6 z-10 border-b border-gray-700">
                  <h2 className="text-3xl font-extrabold text-amber-400">TikTok Marketing Suite</h2>
                  <p className="text-gray-400">Your AI-generated content, ready for TikTok.</p>
                  <button onClick={() => setIsPromptsVisible(false)} className="absolute top-6 right-6 text-gray-500 hover:text-amber-400 transition-colors">
                      <CloseIcon className="w-8 h-8" />
                  </button>
              </div>
              <div className="p-8 space-y-8">
                  <ResultCard title="Marketing Angles / Post Ideas" icon={<LightbulbIcon className="w-6 h-6" />}>
                      <ul className="list-disc list-inside space-y-2 text-gray-300">
                          {marketingContent.postIdeas.map((idea, i) => <li key={i}>{idea}</li>)}
                      </ul>
                  </ResultCard>
                  <ResultCard title="Captions" icon={<TextIcon className="w-6 h-6" />}>
                      <div className="space-y-4">
                          {marketingContent.captions.map((caption, i) => (
                              <p key={i} className="p-4 bg-gray-800/50 rounded-lg text-gray-300 border-l-4 border-amber-500">{caption}</p>
                          ))}
                      </div>
                  </ResultCard>
                  <ResultCard title="Hashtags" icon={<HashtagIcon className="w-6 h-6" />}>
                      <div className="flex flex-wrap gap-2">
                          {marketingContent.hashtags.map((tag, i) => (
                              <span key={i} className="px-3 py-1 bg-gray-700 text-amber-300 text-sm rounded-full">{tag}</span>
                          ))}
                      </div>
                  </ResultCard>
              </div>
            </div>
          </div>
        )}

    </div>
  );
};