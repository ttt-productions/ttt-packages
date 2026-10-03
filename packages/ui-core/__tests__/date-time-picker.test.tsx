import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DateTimePicker } from '../src/react/components/date-time-picker';

// Local-time construction, so the tests hold in any time zone.
const at = (y: number, m1: number, day: number, h = 0, min = 0) => new Date(y, m1 - 1, day, h, min, 0, 0);

function Controlled(props: { initial?: Date; min?: Date; max?: Date; minuteStep?: number; onChange?: (d: Date) => void }) {
  const [value, setValue] = useState<Date | undefined>(props.initial);
  return (
    <DateTimePicker
      value={value}
      min={props.min}
      max={props.max}
      minuteStep={props.minuteStep}
      onChange={(d) => {
        setValue(d);
        props.onChange?.(d);
      }}
    />
  );
}

const button = (name: string) => screen.getByRole('button', { name });

describe('DateTimePicker', () => {
  it('renders no native date or time input', () => {
    const { container } = render(<DateTimePicker value={at(2030, 3, 10, 18, 30)} />);
    expect(container.querySelector('input')).toBeNull();
  });

  it('gives a day picked with no value yet the end of that day', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={undefined} onChange={onChange} />);
    const today = new Date();
    const label = `${today.toLocaleString('en-US', { month: 'long' })} ${today.getDate()}, ${today.getFullYear()}`;
    await user.click(button(label));
    const picked = onChange.mock.calls[0][0] as Date;
    expect([picked.getHours(), picked.getMinutes(), picked.getSeconds()]).toEqual([23, 59, 0]);
  });

  it('keeps the chosen time of day when another day is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={at(2030, 3, 10, 9, 15)} onChange={onChange} />);
    await user.click(button('March 20, 2030'));
    expect(onChange).toHaveBeenLastCalledWith(at(2030, 3, 20, 9, 15));
  });

  it('sets hour, minute, and AM/PM from the time columns', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={at(2030, 3, 10, 9, 15)} onChange={onChange} />);
    await user.click(button("4 o'clock"));
    expect(onChange).toHaveBeenLastCalledWith(at(2030, 3, 10, 4, 15));
    await user.click(button('45 minutes'));
    expect(onChange).toHaveBeenLastCalledWith(at(2030, 3, 10, 4, 45));
    await user.click(button('PM'));
    expect(onChange).toHaveBeenLastCalledWith(at(2030, 3, 10, 16, 45));
  });

  it('disables every day before the minimum and every earlier time on the minimum day', () => {
    const min = at(2030, 3, 10, 14, 30);
    render(<DateTimePicker value={at(2030, 3, 10, 18, 0)} min={min} />);
    expect(button('March 9, 2030')).toBeDisabled();
    expect(button('March 10, 2030')).toBeEnabled();
    // 6 PM is chosen: every PM hour from 2 on is allowed, 1 PM is not.
    expect(button("1 o'clock")).toBeDisabled();
    expect(button("2 o'clock")).toBeEnabled();
    expect(button('AM')).toBeDisabled();
  });

  it('moves a kept time that falls before the minimum to the earliest allowed time', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={at(2030, 3, 12, 8, 0)} min={at(2030, 3, 10, 14, 30)} onChange={onChange} />);
    await user.click(button('March 10, 2030'));
    expect(onChange).toHaveBeenLastCalledWith(at(2030, 3, 10, 14, 30));
  });

  it('never offers a minute before a minimum that falls inside the hour', () => {
    render(<DateTimePicker value={at(2030, 3, 10, 14, 40)} min={at(2030, 3, 10, 14, 30)} />);
    expect(button('29 minutes')).toBeDisabled();
    expect(button('30 minutes')).toBeEnabled();
  });

  it('disables every day and time after the maximum', () => {
    render(<DateTimePicker value={at(2030, 3, 10, 9, 0)} max={at(2030, 3, 10, 12, 0)} />);
    expect(button('March 11, 2030')).toBeDisabled();
    expect(button('PM')).toBeEnabled();
    expect(button("1 o'clock")).toBeEnabled();
  });

  it('disables a day whose only window holds no offered minute, and every day outside the range', () => {
    render(
      <DateTimePicker
        value={at(2030, 3, 12, 9, 0)}
        min={at(2030, 3, 10, 14, 31)}
        max={at(2030, 3, 10, 14, 33)}
        minuteStep={5}
      />,
    );
    expect(button('March 10, 2030')).toBeDisabled();
    expect(button('March 9, 2030')).toBeDisabled();
    expect(button('March 11, 2030')).toBeDisabled();
  });

  it('keeps every day strictly between the bounds available', () => {
    render(<DateTimePicker value={at(2030, 3, 12, 9, 0)} min={at(2030, 3, 10, 23, 30)} max={at(2030, 3, 20, 0, 10)} />);
    expect(button('March 11, 2030')).toBeEnabled();
    expect(button('March 19, 2030')).toBeEnabled();
    expect(button('March 10, 2030')).toBeEnabled();
    expect(button('March 20, 2030')).toBeEnabled();
    expect(button('March 21, 2030')).toBeDisabled();
  });

  it('offers only minutes on the step', () => {
    render(<DateTimePicker value={at(2030, 3, 10, 9, 0)} minuteStep={15} />);
    expect(button('45 minutes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '50 minutes' })).toBeNull();
  });

  it('moves focus through a time column with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<DateTimePicker value={at(2030, 3, 10, 9, 0)} />);
    button("9 o'clock").focus();
    await user.keyboard('{ArrowDown}');
    expect(button("10 o'clock")).toHaveFocus();
    await user.keyboard('{Home}');
    expect(button("12 o'clock")).toHaveFocus();
  });
});
