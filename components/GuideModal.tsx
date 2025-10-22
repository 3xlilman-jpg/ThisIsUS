import React from 'react';
import { CloseIcon } from './icons';

interface GuideModalProps {
  onClose: () => void;
}

const GuideSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="text-2xl font-bold text-amber-400 border-b-2 border-amber-500/30 pb-2 mb-4">{title}</h3>
        <div className="space-y-3 text-gray-300">{children}</div>
    </div>
);

const Step: React.FC<{ num: number; title: string; children: React.ReactNode }> = ({ num, title, children }) => (
    <div>
        <h4 className="text-lg font-semibold text-amber-300">Step {num}: {title}</h4>
        <p className="text-gray-400 text-sm pl-6 border-l-2 border-gray-700 ml-2 py-2">{children}</p>
    </div>
)

export const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-amber-500/20 rounded-2xl shadow-2xl shadow-black/50 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/80 backdrop-blur-md p-6 z-10 border-b border-gray-700">
            <h2 className="text-3xl font-extrabold text-amber-400">How to Sell: A Step-by-Step Guide</h2>
            <p className="text-gray-400">Your step-by-step path to launching winning ads.</p>
            <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-amber-400 transition-colors">
                <CloseIcon className="w-8 h-8" />
            </button>
        </div>

        <div className="p-8">
            <GuideSection title="Section 1: Launching on TikTok">
                <p>TikTok ads thrive on authentic, eye-catching content. The 'Cinematic' or 'Hyperreal' images are perfect for this platform.</p>
                <Step num={1} title="Create a TikTok Video">
                    Use a free mobile video editor (like CapCut or InShot) to create a simple slideshow video. Use all 3 generated images, lasting 3-4 seconds each. Add a trending, commercially-approved sound from TikTok's library.
                </Step>
                 <Step num={2} title="Set Up Your Ad in TikTok Ads Manager">
                    Choose the "Website Conversions" objective to drive sales. Upload your new video as the ad creative.
                </Step>
                <Step num={3} title="Write Your Ad Copy">
                    Copy and paste one of your generated <strong>Captions</strong>. Keep it short and punchy. Make sure to add a strong Call to Action like "Shop Now!" or "Get Yours Today!". Use your generated <strong>Hashtags</strong>.
                </Step>
                <Step num={4} title="Define Your Audience">
                    Start broad. Target interests related to your product (e.g., if you're selling a watch, target 'Fashion', 'Luxury Goods', 'Accessories'). Let TikTok's algorithm find the best customers for you.
                </Step>
                 <Step num={5} title="Launch!">
                    Set a daily budget (starting with $20-$30/day is common) and launch your campaign. Monitor its performance after 24-48 hours.
                </Step>
            </GuideSection>

            <GuideSection title="Section 2: Winning with Meta Ads (Facebook & Instagram)">
                 <p>Meta ads are powerful for targeting specific interests. The 'Studio Pro' image is excellent for clean, professional-looking ads in the feed.</p>
                 <Step num={1} title="Go to Meta Ads Manager">
                    Click 'Create' and select the "Sales" campaign objective. This tells Facebook to find people most likely to buy.
                </Step>
                <Step num={2} title="Design Your Ad Creative">
                    You have two great options:
                    <br/>- <strong>Single Image Ad:</strong> Use the 'Studio Pro' image for a clean, high-end look.
                    <br/>- <strong>Carousel Ad:</strong> Upload all 3 generated images to showcase your product from different stylistic angles.
                </Step>
                 <Step num={3} title="Write Your Primary Text">
                    Use one of your generated <strong>Captions</strong>. You can be a bit more descriptive here than on TikTok. Use one of your <strong>Marketing Angles</strong> as inspiration for the Headline (e.g., "The Last Watch You'll Ever Need").
                </Step>
                <Step num={4} title="Detailed Audience Targeting">
                    This is Meta's strength. Go to the "Ad Set" level and find the "Detailed Targeting" section. Add interests that your ideal customer would have. Think about magazines they read, brands they follow, or hobbies they enjoy.
                </Step>
                 <Step num={5} title="Choose Placements">
                    For beginners, "Advantage+ placements" (Automatic) is the best option. Meta will automatically show your ad where it's most likely to perform well (e.g., Instagram Feed, Stories, Reels).
                </Step>
                 <Step num={6} title="Set Budget and Launch">
                    As with TikTok, start with a modest daily budget, launch your ad, and give it a day or two before making any judgments.
                </Step>
            </GuideSection>
            
             <GuideSection title="Pro-Tips for Success">
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                    <li><strong>A/B Test Everything:</strong> Don't assume you know what will work. Create a second ad that's slightly different (e.g., use a different caption or a different image) and see which one performs better.</li>
                    <li><strong>Your Landing Page Matters:</strong> A great ad can get clicks, but a great product page gets sales. Make sure your website is fast, easy to navigate, and has a clear 'Add to Cart' button.</li>
                    <li><strong>Patience is Key:</strong> You will rarely find a winning product on your first try. The key is to test, learn, and iterate. This tool gives you the creative assets to test faster than anyone else. Good luck!</li>
                </ul>
            </GuideSection>
        </div>
      </div>
    </div>
  );
};