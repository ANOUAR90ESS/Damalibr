import { describe, expect, it } from 'vitest';
import { sortBooks } from './catalogSort';
import { Book } from '../types';

const book = (id: string, title: string, rating: number, total_views: number, year: number) =>
  ({ id, title, rating, total_views, year }) as Book;

const BOOKS = [
  book('a', 'La Regenta', 4.8, 100, 1885),
  book('b', 'Don Quijote', 4.9, 300, 1605),
  book('c', 'Ángel Guerra', 4.5, 200, 1891),
];

const ids = (list: Book[]) => list.map(b => b.id);

describe('sortBooks', () => {
  it('keeps the catalog order for relevance and never mutates the input', () => {
    expect(ids(sortBooks(BOOKS, 'relevance'))).toEqual(['a', 'b', 'c']);
    sortBooks(BOOKS, 'rating');
    expect(ids(BOOKS)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by rating, views and year', () => {
    expect(ids(sortBooks(BOOKS, 'rating'))).toEqual(['b', 'a', 'c']);
    expect(ids(sortBooks(BOOKS, 'popular'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortBooks(BOOKS, 'oldest'))).toEqual(['b', 'a', 'c']);
  });

  it('sorts titles with Spanish collation so accented letters stay in place', () => {
    expect(ids(sortBooks(BOOKS, 'title'))).toEqual(['c', 'b', 'a']);
  });
});
