import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableFooter,
  SortableTableHead,
  type SortableTableHeadProps,
} from '../src/react/components/table';

describe('Table components', () => {
  it('Table renders a table element', () => {
    const { container } = render(<Table />);
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('Table accepts className', () => {
    const { container } = render(<Table className="my-table" />);
    const table = container.querySelector('table');
    expect(table?.className).toContain('my-table');
  });

  it('TableHeader renders a thead element', () => {
    const { container } = render(
      <Table>
        <TableHeader />
      </Table>,
    );
    expect(container.querySelector('thead')).not.toBeNull();
  });

  it('TableBody renders a tbody element', () => {
    const { container } = render(
      <Table>
        <TableBody />
      </Table>,
    );
    expect(container.querySelector('tbody')).not.toBeNull();
  });

  it('TableRow renders a tr element', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow />
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('tr')).not.toBeNull();
  });

  it('TableHead renders a th element', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(container.querySelector('th')).not.toBeNull();
  });

  it('TableCell renders a td element', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('td')).not.toBeNull();
  });

  it('TableCaption renders a caption element', () => {
    const { container } = render(
      <Table>
        <TableCaption>My caption</TableCaption>
      </Table>,
    );
    expect(container.querySelector('caption')).not.toBeNull();
  });

  it('TableFooter renders a tfoot element', () => {
    const { container } = render(
      <Table>
        <TableFooter />
      </Table>,
    );
    expect(container.querySelector('tfoot')).not.toBeNull();
  });

  it('all components accept className', () => {
    const { container } = render(
      <Table className="t">
        <TableHeader className="th">
          <TableRow className="tr">
            <TableHead className="head">H</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="tb">
          <TableRow className="tr2">
            <TableCell className="cell">C</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('table')?.className).toContain('t');
    expect(container.querySelector('thead')?.className).toContain('th');
    expect(container.querySelector('th')?.className).toContain('head');
    expect(container.querySelector('tbody')?.className).toContain('tb');
    expect(container.querySelector('td')?.className).toContain('cell');
  });
});

function renderSortable(props: Partial<SortableTableHeadProps> = {}) {
  const onSort = vi.fn();
  render(
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead label="Goals" shortLabel="G" direction={null} onSort={onSort} {...props} />
        </TableRow>
      </TableHeader>
    </Table>,
  );
  return { onSort };
}

describe('SortableTableHead', () => {
  it('names the header and its button by the short label, then the full label', () => {
    renderSortable();
    expect(screen.getByRole('columnheader', { name: 'G, Goals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G, Goals' })).toBeInTheDocument();
  });

  it('names a header with no short label by its label alone', () => {
    renderSortable({ shortLabel: undefined });
    expect(screen.getByRole('columnheader', { name: 'Goals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Goals' })).toBeInTheDocument();
  });

  it('hides both visible labels from assistive technology, so neither is read beside the spoken name', () => {
    renderSortable();
    for (const text of ['G', 'Goals']) {
      expect(screen.getByText(text, { selector: 'span' })).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('says how the table is sorted by the column, and nothing when it is not', () => {
    renderSortable({ direction: 'asc' });
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('says a descending sort as descending', () => {
    renderSortable({ direction: 'desc' });
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  });

  it('carries no sort state while the table is not sorted by the column', () => {
    renderSortable();
    expect(screen.getByRole('columnheader')).not.toHaveAttribute('aria-sort');
  });

  it('heads its column, and sorts once per press without submitting a form around it', () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    const onSort = vi.fn();
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead label="Goals" direction={null} onSort={onSort} />
            </TableRow>
          </TableHeader>
        </Table>
      </form>,
    );
    expect(screen.getByRole('columnheader')).toHaveAttribute('scope', 'col');
    fireEvent.click(screen.getByRole('button', { name: 'Goals' }));
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('puts its classes on the header cell', () => {
    renderSortable({ className: 'figure-column' });
    expect(screen.getByRole('columnheader')).toHaveClass('figure-column');
  });
});
