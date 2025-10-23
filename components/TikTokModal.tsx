import React, { useState } from 'react';
import { CloseIcon, RocketIcon, CheckCircleIcon } from './icons';
import type { ImageVariant, MarketingContent } from '../types';

interface TikTokModalProps {
  onClose: () => void;
  variants: ImageVariant[];
  marketingContent: MarketingContent | null;
}

export const TikTokModal: React.FC<TikTokModalProps> = ({ onClose, variants, marketingContent }) => {
  const [selectedVariant, setSelectedVariant] = useState<ImageVariant | null>(null);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!marketingContent || variants.length === 0) {
     // Render a fallback or loading state if content isn't ready
    return (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in"
          onClick={onClose}
        >
             <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-8 text-center">
                 <p className="text-gray-300">Generating content... please wait.</p>
             </div>
        </div>
    );
  }

  const handlePreparePost = () => {
    if (!selectedVariant || !selectedCaption) return;

    // 1. Copy text to clipboard
    const fullText = `${selectedCaption}\n\n${marketingContent.hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });

    // 2. Download image
    const link = document.createElement('a');
    link.href = selectedVariant.url;
    link.download = `${selectedVariant.style.toLowerCase().replace(/\s+/g, '-')}-tiktok.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 3. Open TikTok
    window.open('https://www.tiktok.com/upload', '_blank');
    
    // 4. Close modal after a delay to show feedback
    setTimeout(onClose, 1200);
  };

  const isReady = selectedVariant && selectedCaption;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-amber-500/20 rounded-2xl shadow-2xl shadow-black/50 max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/80 backdrop-blur-md p-6 z-10 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-3xl font-extrabold text-amber-400">TikTok Post Builder</h2>
            <p className="text-gray-400">Combine your assets to create the perfect post.</p>
            <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-amber-400 transition-colors">
                <CloseIcon className="w-8 h-8" />
            </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
            {/* Step 1: Visuals */}
            <div>
                <h3 className="text-xl font-bold text-amber-300 mb-4">1. Choose a Visual</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {variants.map((variant) => (
                        <div 
                            key={variant.style} 
                            className={`cursor-pointer rounded-lg overflow-hidden transition-all duration-300 ${selectedVariant?.style === variant.style ? 'ring-4 ring-amber-400 shadow-lg' : 'ring-2 ring-transparent hover:ring-amber-500/50'}`}
                            onClick={() => setSelectedVariant(variant)}
                        >
                            <img src={variant.url} alt={variant.style} className="w-full h-auto object-cover"/>
                             <p className="text-center bg-black/50 p-1 text-sm font-semibold text-amber-300">{variant.style}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 2: Captions */}
            <div>
                <h3 className="text-xl font-bold text-amber-300 mb-4">2. Choose a Caption</h3>
                <div className="space-y-3">
                    {marketingContent.captions.map((caption, index) => (
                         <div 
                            key={index} 
                            className={`p-4 rounded-lg cursor-pointer border-2 transition-all duration-300 ${selectedCaption === caption ? 'bg-amber-500/10 border-amber-400' : 'bg-gray-800 border-gray-700 hover:border-amber-500/50'}`}
                            onClick={() => setSelectedCaption(caption)}
                        >
                            <p className="text-gray-300">{caption}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step 3: Hashtags */}
            <div>
                <h3 className="text-xl font-bold text-amber-300 mb-4">3. Hashtags <span className="text-sm font-normal text-gray-400">(will be copied with your caption)</span></h3>
                <div className="flex flex-wrap gap-2">
                  {marketingContent.hashtags.map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-700 text-amber-300 text-sm rounded-full">{tag}</span>
                  ))}
              </div>
            </div>
        </div>
        
        {/* Footer Action */}
        <div className="p-6 border-t border-gray-700 mt-auto flex-shrink-0 bg-gray-900/80 backdrop-blur-sm">
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                <p className="text-sm text-amber-200">
                    <strong>Quick Tip:</strong> TikTok automatically turns your photo into a video post! We'll download the image for you to upload.
                </p>
            </div>
            <button
                onClick={handlePreparePost}
                disabled={!isReady || isCopied}
                className="w-full bg-[#ff0050] text-white font-bold py-3 px-6 rounded-lg hover:bg-[#E50048] transition-all duration-300 ease-in-out flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                {isCopied ? <><CheckCircleIcon className="w-6 h-6"/> Success! Check your downloads.</> : <><RocketIcon className="w-5 h-5" /> Prepare Post & Open TikTok</>}
            </button>
        </div>
      </div>
    </div>
  );
};