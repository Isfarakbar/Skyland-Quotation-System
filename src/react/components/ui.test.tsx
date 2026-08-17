import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Button, EmptyState, Pagination } from './ui';

test('button exposes disabled state and readable label', () => {
  render(<Button disabled>Save quotation</Button>);
  expect(screen.getByRole('button', { name: 'Save quotation' })).toBeDisabled();
});

test('empty state explains the recovery action', () => {
  render(<EmptyState title="No quotations found" message="Change the selected filters." action={<Button>Clear filters</Button>}/>);
  expect(screen.getByText('No quotations found')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
});

test('pagination disables the previous action on page one', () => {
  render(<Pagination page={1} pages={3} onChange={() => {}}/>);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByText('Page 1 of 3')).toBeVisible();
});
