import React, { useState } from 'react';
import { Star, Send, Trash2, MessageSquareQuote } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useReviewsStore, averageRating, REVIEW_MIN_LENGTH, REVIEW_MAX_LENGTH } from '../../stores/useReviewsStore';
import { showToast } from '../../stores/useToastStore';

const EMPTY_REVIEWS: never[] = [];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export const BookReviews: React.FC<{ bookId: string; bookTitle: string }> = ({ bookId, bookTitle }) => {
  const { user } = useAuthStore();
  const reviews = useReviewsStore(state => state.reviewsByBook[bookId] ?? EMPTY_REVIEWS);
  const { addReview, deleteReview } = useReviewsStore();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const average = averageRating(reviews);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = addReview({ bookId, authorName: user.display_name, rating, comment });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setRating(0);
    setComment('');
    showToast(`¡Gracias! Tu reseña de "${bookTitle}" se ha publicado.`, 'success');
  };

  return (
    <section aria-labelledby="reviews-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 id="reviews-heading" className="font-display text-sm font-bold text-slate-200">
          Reseñas de lectores ({reviews.length})
        </h3>
        {average !== null && (
          <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
            <Star className="w-3.5 h-3.5 fill-amber-400" /> {average.toFixed(1)} / 5
          </span>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3"
      >
        <fieldset>
          <legend className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Tu valoración
          </legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(value => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="review-rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  className="sr-only peer"
                />
                <span className="sr-only">{value} {value === 1 ? 'estrella' : 'estrellas'}</span>
                <Star
                  aria-hidden="true"
                  className={`w-7 h-7 rounded transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400 ${
                    value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600 hover:text-amber-300'
                  }`}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1">
          <label htmlFor="review-comment" className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Tu reseña
          </label>
          <textarea
            id="review-comment"
            name="comment"
            rows={3}
            required
            minLength={REVIEW_MIN_LENGTH}
            maxLength={REVIEW_MAX_LENGTH}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="¿Qué te ha parecido esta adaptación?"
            aria-describedby="review-help"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
          />
          <div id="review-help" className="flex justify-between text-[10px] text-slate-500">
            <span>Se guarda en este dispositivo como «{user.display_name}».</span>
            <span className="font-mono">{comment.trim().length}/{REVIEW_MAX_LENGTH}</span>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-400">{error}</p>
        )}

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Publicar reseña</span>
        </button>
      </form>

      {reviews.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <MessageSquareQuote className="w-4 h-4" /> Aún no hay reseñas. ¡Sé el primero en opinar!
        </p>
      ) : (
        <ul className="space-y-2">
          {reviews.map(review => (
            <li key={review.id} className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-100 truncate">{review.author_name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex" aria-label={`${review.rating} de 5 estrellas`}>
                    {[1, 2, 3, 4, 5].map(v => (
                      <Star
                        key={v}
                        aria-hidden="true"
                        className={`w-3 h-3 ${v <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                      />
                    ))}
                  </span>
                  <button
                    onClick={() => deleteReview(bookId, review.id)}
                    aria-label="Eliminar reseña"
                    className="text-slate-600 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{review.comment}</p>
              <time dateTime={review.created_at} className="text-[10px] text-slate-500 block">
                {formatDate(review.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
