import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { MarketingContent, VideoScript, GroundingSource, UserProfile, ConversationTurn, Recipe } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const getStylePrompt = (style: string): string => {
  switch (style) {
    case 'Cinematic':
      return "Transform this product photo into a cinematic marketing visual. Apply dramatic lighting, rich color grading, and a shallow depth of field to create a premium, movie-poster feel. The object should be the clear hero of the shot.";
    case 'Hyperreal':
      return "Enhance this product photo to be hyperrealistic for a high-impact marketing campaign. Sharpen every detail, perfect the textures to make them look tangible, and use ultra-realistic lighting to create a sense of presence and quality.";
    case 'Studio Pro':
      return "Recreate this image as a professional studio product shot. Place the object against a clean, minimalist studio background (like a soft gray or a seamless white infinity cove). Apply perfect, diffused studio lighting to eliminate harsh shadows and highlight the product's form and features elegantly.";
    default:
      return "Enhance this image for a professional marketing campaign.";
  }
};

export const generateImageVariant = async (base64Image: string, mimeType: string, style: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: getStylePrompt(style) },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const firstPart = response.candidates?.[0]?.content?.parts?.[0];
    if (firstPart?.inlineData) {
      return `data:${firstPart.inlineData.mimeType};base64,${firstPart.inlineData.data}`;
    }
    throw new Error('No image data returned from API.');
  } catch (error) {
    console.error(`Error generating ${style} image variant:`, error);
    throw new Error(`Failed to generate ${style} variant.`);
  }
};

const cleanAndParseJson = (text: string): any => {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    const jsonString = match ? match[1] : text;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        console.error("Raw response text:", text);
        throw new Error("The model returned an invalid JSON format.");
    }
}

export const generateMarketingContent = async (
    base64Image: string,
    mimeType: string,
    productDescription: string
): Promise<{ content: MarketingContent, sources: GroundingSource[] }> => {
  try {
    const promptText = `Analyze the object in this image. If a product description is provided, use it to refine your analysis.
Product Description: "${productDescription || 'Not provided. Analyze the image visually.'}"

You are a senior marketing strategist. Generate a creative suite of marketing content for this product. Leverage real-time search data to identify currently trending hashtags and viral post concepts related to the product. Your tone should be professional, aspirational, and compelling.

IMPORTANT: Provide the output as a valid JSON object adhering to this structure: { "postIdeas": ["idea1", "idea2", "idea3"], "captions": ["caption1", "caption2", "caption3"], "hashtags": ["hashtag1", "hashtag2", ...] }. Ensure the final output is ONLY the JSON object and nothing else.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType } },
                { text: promptText },
            ]
        },
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    
    const content: MarketingContent = cleanAndParseJson(response.text);

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = groundingChunks
        .map((chunk: any) => chunk?.web)
        .filter((web: any) => web?.uri && web?.title)
        .map((web: any) => ({ uri: web.uri, title: web.title }));
    
    return { content, sources };

  } catch (error) {
    console.error("Error generating marketing content:", error);
    throw new Error("Failed to generate marketing content.");
  }
};

export const generateVideoScript = async (base64Image: string, mimeType: string, marketingIdeas: string, productDescription: string): Promise<VideoScript> => {
  try {
    const promptText = `Based on the product in the image, its description, and the provided marketing ideas, create a short and punchy 15-30 second video ad script.
Product Description: "${productDescription || 'Not provided. Focus on the visual.'}"
Marketing Ideas: "${marketingIdeas}"

The script should be visually descriptive and include suggestions for a confident, inspiring voiceover. The goal is to create an engaging ad for social media platforms like Instagram Reels or TikTok. Provide the output in a JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: {
        parts: [
            { inlineData: { data: base64Image, mimeType } },
            { text: promptText },
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: 'A catchy title for the video ad.' },
                scenes: {
                    type: Type.ARRAY,
                    description: 'The scenes of the video script, between 2 and 4 scenes.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            scene: { type: Type.NUMBER, description: 'The scene number.' },
                            visual: { type: Type.STRING, description: 'A description of the visuals for this scene.' },
                            voiceover: { type: Type.STRING, description: 'The voiceover script for this scene.' },
                        },
                        required: ["scene", "visual", "voiceover"],
                    },
                },
            },
            required: ["title", "scenes"],
        },
      },
    });

    return JSON.parse(response.text);

  } catch (error) {
    console.error("Error generating video script:", error);
    throw new Error("Failed to generate video script.");
  }
};

type InsightTrigger = 'IMAGE_UPLOADED' | 'MARKETING_GENERATED' | 'VIDEO_SCRIPT_GENERATED';

interface InsightContext {
  trigger: InsightTrigger;
  marketingContent?: MarketingContent | null;
  videoScript?: VideoScript | null;
  productDescription?: string;
}

export const generateProactiveInsight = async (context: InsightContext): Promise<string> => {
  try {
    let contextPrompt = "You are Rose, an AI marketing expert. Based on the user's current action, provide a short, proactive, insightful comment or a targeted question (1-2 sentences) to help them think creatively and guide them to the next step.\n\n";
    
    switch (context.trigger) {
        case 'IMAGE_UPLOADED':
            contextPrompt += `The user just uploaded a new image.\n\n`;
            contextPrompt += `Your task: Acknowledge the image and prompt them to add a product description to improve the results. Example: "Great image! I'm ready to work my magic. For the best results, add a quick product description before you hit regenerate."`;
            break;
        case 'MARKETING_GENERATED':
            contextPrompt += `The user just generated these marketing angles: "${context.marketingContent?.postIdeas.join(', ')}".\n`;
            contextPrompt += `Product description: "${context.productDescription || 'none'}"\n\n`;
            contextPrompt += `Your task: Generate a helpful follow-up question about the results to encourage refinement. Example: "These marketing angles look promising! Which one resonates most with your target audience? We can generate a video script based on that."`;
            break;
        case 'VIDEO_SCRIPT_GENERATED':
            contextPrompt += `The user just generated a video script titled: "${context.videoScript?.title}".\n`;
            contextPrompt += `The marketing angles were: "${context.marketingContent?.postIdeas.join(', ')}".\n\n`;
            contextPrompt += `Your task: Generate a helpful follow-up question about the video script's tone. Example: "A perfect script for social media. For the voiceover, are we aiming for a confident and authoritative tone, or something more friendly and relatable?"`;
            break;
        default:
             return "Let's get creative. What's our first step?";
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contextPrompt,
      config: {
        maxOutputTokens: 150,
        temperature: 0.7,
      },
    });

    return response.text.trim();

  } catch (error) {
    console.error("Error generating proactive insight:", error);
    return "The assets look great! What should we do next?";
  }
};


export const updateUserProfile = async (
  conversationHistory: ConversationTurn[],
  currentUserProfile: UserProfile
): Promise<UserProfile> => {
  try {
    const recentConversation = conversationHistory
      .slice(-6) // Take last 3 user/assistant turns
      .map(turn => `${turn.speaker === 'user' ? 'User' : 'Rose'}: ${turn.text}`)
      .join('\n');

    const prompt = `You are a profile analysis AI. Your task is to read a conversation and a user's existing profile, then extract new, concrete facts about the user to update their profile.
- Only add new information or correct existing information.
- Be concise. Extract key details like name, interests, goals, profession, location, etc.
- If no new information is present, return the original profile.
- The output must be ONLY the updated, valid JSON object.

Existing Profile:
${JSON.stringify(currentUserProfile, null, 2)}

Recent Conversation:
${recentConversation}

Updated Profile:
`;
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    interests: { type: Type.ARRAY, items: { type: Type.STRING } },
                    goals: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                // Allow additional, dynamic properties
            }
        }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error updating user profile:", error);
    return currentUserProfile; // Return original profile on error
  }
};

export const generateCookingSuggestions = async (
    query: string,
    excludeTitles: string[] = []
): Promise<{ suggestions: Recipe[], sources: GroundingSource[] }> => {
    try {
        let exclusionPrompt = '';
        if (excludeTitles.length > 0) {
            exclusionPrompt = `\n\nIMPORTANT: To ensure variety, do NOT suggest any of the following recipes that have already been shown to the user: ${excludeTitles.join(', ')}. Provide completely new and different suggestions.`;
        }
        
        const prompt = `You are an expert chef and culinary assistant named "Rose". A user needs recipe suggestions.
        
User's Request: "${query}"

You have access to Google Search for inspiration. Your task is to:
1. Analyze the user's request and use Google Search to find relevant, popular, or unique ideas.
2. Synthesize this information to create 3-5 distinct and creative recipe suggestions.
3. For each recipe, provide a title, a brief compelling description, the estimated cook time (e.g., "Approx. 45 minutes"), a list of ingredients, and step-by-step instructions.
4. All output, including titles, descriptions, ingredients, and instructions, must be in English. If you find a recipe in another language, translate it fully to English.${exclusionPrompt}
5. IMPORTANT: Ensure the final response is ONLY a single, valid JSON object. The JSON object must conform to this structure: { "suggestions": [ { "title": "...", "description": "...", "cookTime": "...", "ingredients": [...], "instructions": [...] } ] }. Do not include any text or markdown formatting outside the JSON object.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const parsedData = cleanAndParseJson(response.text);
        const suggestions = parsedData.suggestions || [];
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources: GroundingSource[] = groundingChunks
            .map((chunk: any) => chunk?.web)
            .filter((web: any) => web?.uri && web?.title)
            .map((web: any) => ({ uri: web.uri, title: web.title }));
        
        return { suggestions, sources };

    } catch (error) {
        console.error("Error generating cooking suggestions:", error);
        throw new Error("Failed to generate cooking suggestions.");
    }
};

export const generateSpeech = async (text: string, voice: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    throw new Error("No audio data returned from TTS API.");
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error("Failed to generate speech.");
  }
};