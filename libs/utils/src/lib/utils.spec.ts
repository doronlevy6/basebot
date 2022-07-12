import { formatDate, formatDaysOrWeeksUntil, snakeToTitleCase } from './utils';

describe('utils', () => {
  it('should format date string to MMM D YYYY', () => {
    expect(formatDate('2022-06-22')).toEqual('Jun 22 2022');
  });

  it('should format date to MMM D YYYY', () => {
    expect(formatDate(new Date('2022-06-23'))).toEqual('Jun 23 2022');
  });

  it('should format days or weeks until as days when less than 10', () => {
    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-23'),
    ).toEqual('1 day');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-24'),
    ).toEqual('2 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-25'),
    ).toEqual('3 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-26'),
    ).toEqual('4 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-27'),
    ).toEqual('5 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-28'),
    ).toEqual('6 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-29'),
    ).toEqual('7 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-06-30'),
    ).toEqual('8 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-07-01'),
    ).toEqual('9 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-07-02'),
    ).toEqual('10 days');

    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-07-03'),
    ).toEqual('2 weeks');
  });

  it('should format days or weeks until as weeks when greater than 10', () => {
    expect(
      formatDaysOrWeeksUntil(new Date('2022-06-22'), '2022-07-23'),
    ).toEqual('4 weeks');
  });

  it('should title case a snake cased value', () => {
    expect(snakeToTitleCase('not_started')).toEqual('Not Started');
    expect(snakeToTitleCase('waiting')).toEqual('Waiting');
    expect(snakeToTitleCase('on_hold')).toEqual('On Hold');
    expect(snakeToTitleCase('in_progress')).toEqual('In Progress');
    expect(snakeToTitleCase('done')).toEqual('Done');
  });
});
