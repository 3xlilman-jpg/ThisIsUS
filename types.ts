// FIX: Removed self-import which was causing declaration conflicts with the locally defined types.

export interface ImageFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface ImageVariant {
  style: string;
  description: string;
  url: string;
}

export interface MarketingContent {
  postIdeas: string[];
  captions: string[];
  hashtags: string[];
}

export interface VideoScriptScene {
  scene: number;
  visual: string;
  voiceover: string;
}

export interface VideoScript {
  title: string;
  scenes: VideoScriptScene[];
}

export interface ConversationTurn {
  speaker: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface UserProfile extends Record<string, any> {
  name?: string;
  interests?: string[];
  goals?: string[];
}

export interface Recipe {
  title: string;
  description: string;
  cookTime: string;
  ingredients: string[];
  instructions: string[];
  imageUrl: string;
}