import { create } from 'zustand';
import { storageService } from '../lib/supabase';

export interface BookReview {
  id: string;
  book_id: string;
  author_name: string;
  /** 1 to 5 stars */
  rating: number;
  comment: string;
  created_at: string;
}

export const REVIEW_MIN_LENGTH = 10;
export const REVIEW_MAX_LENGTH = 500;

const STORAGE_KEY = 'book_reviews';

interface ReviewsState {
  /** Reviews per book id, newest first. Kept on this device only. */
  reviewsByBook: Record<string, BookReview[]>;
  /** Validates and saves a review; returns an error message instead of saving when invalid. */
  addReview: (input: { bookId: string; authorName: string; rating: number; comment: string }) =>
    { ok: true; review: BookReview } | { ok: false; error: string };
  deleteReview: (bookId: string, reviewId: string) => void;
}

export function validateReview(rating: number, comment: string): string | null {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'Elige una valoración de 1 a 5 estrellas.';
  }
  const length = comment.trim().length;
  if (length < REVIEW_MIN_LENGTH) {
    return `La reseña debe tener al menos ${REVIEW_MIN_LENGTH} caracteres.`;
  }
  if (length > REVIEW_MAX_LENGTH) {
    return `La reseña no puede superar los ${REVIEW_MAX_LENGTH} caracteres.`;
  }
  return null;
}

/** Average star rating, rounded to one decimal, or null when there are no reviews. */
export function averageRating(reviews: BookReview[]): number | null {
  if (!reviews.length) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  reviewsByBook: storageService.get<Record<string, BookReview[]>>(STORAGE_KEY, {}),

  addReview: ({ bookId, authorName, rating, comment }) => {
    const error = validateReview(rating, comment);
    if (error) return { ok: false, error };

    const review: BookReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      book_id: bookId,
      author_name: authorName.trim() || 'Lector anónimo',
      rating,
      comment: comment.trim(),
      created_at: new Date().toISOString(),
    };
    const reviewsByBook = {
      ...get().reviewsByBook,
      [bookId]: [review, ...(get().reviewsByBook[bookId] || [])],
    };
    set({ reviewsByBook });
    storageService.set(STORAGE_KEY, reviewsByBook);
    return { ok: true, review };
  },

  deleteReview: (bookId, reviewId) => {
    const reviewsByBook = {
      ...get().reviewsByBook,
      [bookId]: (get().reviewsByBook[bookId] || []).filter(r => r.id !== reviewId),
    };
    set({ reviewsByBook });
    storageService.set(STORAGE_KEY, reviewsByBook);
  },
}));
