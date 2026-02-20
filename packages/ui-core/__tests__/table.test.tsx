import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableFooter,
} from '../src/components/table';

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

  it('Table has displayName "Table"', () => {
    expect(Table.displayName).toBe('Table');
  });

  it('TableHeader has displayName "TableHeader"', () => {
    expect(TableHeader.displayName).toBe('TableHeader');
  });

  it('TableBody has displayName "TableBody"', () => {
    expect(TableBody.displayName).toBe('TableBody');
  });

  it('TableRow has displayName "TableRow"', () => {
    expect(TableRow.displayName).toBe('TableRow');
  });

  it('TableHead has displayName "TableHead"', () => {
    expect(TableHead.displayName).toBe('TableHead');
  });

  it('TableCell has displayName "TableCell"', () => {
    expect(TableCell.displayName).toBe('TableCell');
  });
});
