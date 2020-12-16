import { render, screen } from '@testing-library/react';
import Scraper from './App';

test('renders learn react link', () => {
  render(<Scraper />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
