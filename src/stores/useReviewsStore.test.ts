// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useReviewsStore, validateReview, averageRating, BookReview } from './useReviewsStore';

const BOOK = 'book-quijote';

describe('useReviewsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useReviewsStore.setState({ reviewsByBook: {} });
  });

  it('saves a valid review newest first and persists it on this device', () => {
    const add = useReviewsStore.getState().addReview;
    add({ bookId: BOOK, authorName: 'Ana', rating: 4, comment: 'Una adaptación preciosa.' });
    add({ bookId: BOOK, authorName: '  ', rating: 5, comment: '  Me encantó el último episodio.  ' });

    const reviews = useReviewsStore.getState().reviewsByBook[BOOK];
    expect(reviews.map(r => r.rating)).toEqual([5, 4]);
    expect(reviews[0]).toMatchObject({ author_name: 'Lector anónimo', comment: 'Me encantó el último episodio.' });
    expect(JSON.parse(localStorage.getItem('lamina_book_reviews')!)[BOOK]).toHaveLength(2);
  });

  it('rejects an invalid review without saving it', () => {
    const result = useReviewsStore.getState().addReview({ bookId: BOOK, authorName: 'Ana', rating: 0, comment: 'Muy buena obra.' });
    expect(result.ok).toBe(false);
    expect(useReviewsStore.getState().reviewsByBook[BOOK]).toBeUndefined();
  });

  it('deletes a review', () => {
    const result = useReviewsStore.getState().addReview({ bookId: BOOK, authorName: 'Ana', rating: 3, comment: 'Correcta, sin más.' });
    if (!result.ok) throw new Error(result.error);
    useReviewsStore.getState().deleteReview(BOOK, result.review.id);
    expect(useReviewsStore.getState().reviewsByBook[BOOK]).toEqual([]);
  });
});

describe('validateReview', () => {
  it('requires a whole rating between 1 and 5', () => {
    expect(validateReview(6, 'Texto suficientemente largo')).toMatch(/1 a 5/);
    expect(validateReview(2.5, 'Texto suficientemente largo')).toMatch(/1 a 5/);
    expect(validateReview(5, 'Texto suficientemente largo')).toBeNull();
  });

  it('checks the trimmed comment length', () => {
    expect(validateReview(4, '   corta   ')).toMatch(/al menos/);
    expect(validateReview(4, 'x'.repeat(501))).toMatch(/superar/);
  });
});

describe('averageRating', () => {
  it('returns null without reviews and a one-decimal average otherwise', () => {
    expect(averageRating([])).toBeNull();
    const reviews = [5, 4, 4].map(rating => ({ rating }) as BookReview);
    expect(averageRating(reviews)).toBe(4.3);
  });
});
