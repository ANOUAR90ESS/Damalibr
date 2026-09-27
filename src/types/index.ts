export type BookFormat = 'drama' | 'film' | 'summary';

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  language: string;
  cover_url: string;
  backdrop_url: string;
  synopsis: string;
  source_text_url: string;
  genres: string[];
  era: string; // 'Siglo de Oro' | 'Romanticismo' | 'Realismo' | 'Renacimiento'
  status: 'draft' | 'ready' | 'archived';
  rating: number;
  total_views: number;
  featured?: boolean;
  kids_friendly?: boolean;
}

export interface Character {
  id: string;
  book_id: string;
  name: string;
  description: string;
  role: 'protagonista' | 'antagonista' | 'secundario' | 'narrador';
  personality: string;
  gender: 'masculino' | 'femenino' | 'neutro';
  age_range: string;
  voice_id: string;
  voice_name: string;
  avatar_url: string;
  reference_images?: string[];
}

export interface Adaptation {
  id: string;
  book_id: string;
  format: BookFormat;
  status: 'processing' | 'ready' | 'draft';
  total_duration: number; // in seconds
  episode_count: number;
  description: string;
  aspect_ratio: '9:16' | '16:9';
}

export interface ScriptLine {
  id: string;
  character_id: string;
  character_name: string;
  text: string;
  emotion: string; // 'tenso' | 'apasionado' | 'furioso' | 'melancólico' | 'sarcástico' | 'misterioso' | 'neutro'
  duration_seconds: number;
  audio_url?: string;
}

export interface ScriptScene {
  id: string;
  setting: string;
  visual_prompt: string;
  visual_mode: 'economic' | 'premium';
  image_url: string;
  video_url?: string;
  lines: ScriptLine[];
  duration: number;
}

export interface ScriptJSON {
  adaptation_id: string;
  episode_number: number;
  cliffhanger_text?: string;
  scenes: ScriptScene[];
}

export interface Episode {
  id: string;
  adaptation_id: string;
  book_id: string;
  number: number;
  title: string;
  format: BookFormat;
  script_json: ScriptJSON;
  video_url: string;
  hls_url?: string;
  thumbnail_url: string;
  duration: number; // in seconds
  is_free: boolean;
  coin_price: number;
  story_position_start: number; // 0.0 to 1.0 of full narrative arc
  story_position_end: number;   // 0.0 to 1.0 of full narrative arc
  cliffhanger: string;
}

export interface UserProgress {
  user_id: string;
  book_id: string;
  adaptation_id: string;
  episode_id: string;
  seconds: number;
  completed: boolean;
  updated_at: string;
}

export interface LibraryItem {
  user_id: string;
  book_id: string;
  state: 'to_watch' | 'started' | 'finished';
  is_bookmarked: boolean;
  is_downloaded: boolean;
  download_size_mb?: number;
  updated_at: string;
}

export interface UserSubscription {
  user_id: string;
  tier: 'free' | 'vip';
  status: 'active' | 'cancelled';
  current_period_end: string;
}

export interface CoinWallet {
  user_id: string;
  balance: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'purchase' | 'spend' | 'reward';
  amount: number;
  description: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  is_vip: boolean;
  kids_mode_enabled: boolean;
  kids_pin?: string;
  language: 'es-ES' | 'es-LA';
  daily_goal_minutes: number;
  streak_days: number;
  minutes_watched_today: number;
  total_minutes_watched: number;
  total_episodes_completed: number;
}

export interface PipelineJob {
  id: string;
  book_title: string;
  author: string;
  source_type: 'gutenberg' | 'wikisource' | 'custom_text';
  raw_text?: string;
  current_step: 'ingest' | 'analyze' | 'adapt' | 'voices' | 'visuals' | 'render' | 'review' | 'published';
  status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting_review';
  progress: number; // 0 to 100
  logs: Array<{ timestamp: string; message: string; type: 'info' | 'success' | 'warn' | 'error' }>;
  characters?: Character[];
  drama_episodes?: Partial<Episode>[];
  film_script?: Partial<Episode>;
  summary_script?: Partial<Episode>;
  voice_assignments?: Record<string, string>;
  visual_mode?: 'economic' | 'premium';
  render_options?: {
    quality: string[];
    subtitles_burned: boolean;
  };
  review_notes?: string;
}
