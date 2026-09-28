export interface TextGenerationRequest { prompt: string; system?: string; model?: string; temperature?: number; maxOutputTokens?: number; }
export interface TextGenerationResult { text: string; provider: string; model?: string; usage?: Record<string, number>; }
export interface ImageGenerationRequest { prompt: string; width: number; height: number; model?: string; }
export interface ImageGenerationResult { assetKey: string; provider: string; model?: string; }
export interface VoiceGenerationRequest { text: string; voiceId?: string; language?: string; model?: string; }
export interface VoiceGenerationResult { assetKey: string; durationSeconds?: number; provider: string; model?: string; }
export interface VideoGenerationRequest { prompt: string; width: number; height: number; durationSeconds?: number; model?: string; }
export interface VideoGenerationResult { assetKey: string; durationSeconds?: number; provider: string; model?: string; }

export interface TextProvider { generate(request: TextGenerationRequest): Promise<TextGenerationResult>; }
export interface ImageProvider { generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>; }
export interface VoiceProvider { synthesize(request: VoiceGenerationRequest): Promise<VoiceGenerationResult>; }
export interface VideoProvider { generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>; }

export interface AIProviders {
  text: TextProvider;
  image: ImageProvider;
  voice: VoiceProvider;
  video?: VideoProvider;
}
