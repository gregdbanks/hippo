import toursData from './tours.json';
import shotsData from './shots.json';

export interface Hotspot {
  label: string;
  x: number;
  y: number;
  box: number[];
}

export interface TourStep {
  title: string;
  text: string;
  route: string;
  image: string;
  hotspots: Hotspot[];
  expectedHotspots: number;
}

export interface Tour {
  id: string;
  title: string;
  summary: string;
  steps: TourStep[];
}

const images = import.meta.glob<string>('./img/*.jpg', { eager: true, import: 'default', query: '?url' });
const shots = shotsData as Record<string, { hotspots: Hotspot[] }>;

export function loadTours(): Tour[] {
  return toursData.map(tour => ({
    id: tour.id,
    title: tour.title,
    summary: tour.summary,
    steps: tour.steps.map((step, i) => {
      const key = `${tour.id}-${i + 1}`;
      return {
        title: step.title,
        text: step.text,
        route: step.route,
        image: images[`./img/${key}.jpg`] ?? '',
        hotspots: shots[key]?.hotspots ?? [],
        expectedHotspots: step.hotspots.length,
      };
    }),
  }));
}
