import { describe, expect, it } from 'vitest';
import { loadTours } from '../index';

describe('tours', () => {
  const tours = loadTours();

  it('has every step backed by a screenshot', () => {
    for (const tour of tours) for (const step of tour.steps) expect(step.image, `${tour.id}: ${step.title}`).toBeTruthy();
  });

  it('has a dot for every highlight the step describes', () => {
    for (const tour of tours) {
      for (const step of tour.steps) expect(step.hotspots.length, `${tour.id}: ${step.title}`).toBe(step.expectedHotspots);
    }
  });

  it('keeps steps short enough to read at a glance', () => {
    for (const tour of tours) {
      expect(tour.steps.length, tour.id).toBeLessThanOrEqual(6);
      for (const step of tour.steps) expect(step.text.split(/\s+/).length, `${tour.id}: ${step.title}`).toBeLessThanOrEqual(40);
    }
  });

  it('sends Show me to a page that works without a chosen file', () => {
    for (const tour of tours) {
      for (const step of tour.steps) expect(step.route, `${tour.id}: ${step.title}`).not.toMatch(/^\/edit/);
    }
  });

  it('starts with the getting around tour', () => {
    expect(tours[0].id).toBe('getting-around');
  });
});
