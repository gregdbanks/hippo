import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tour } from '../tours';

const PAD = 0.8;

export function TourViewer({ tour, onClose }: { tour: Tour; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const step = tour.steps[index];
  const last = index === tour.steps.length - 1;

  useEffect(() => {
    setIndex(0);
  }, [tour.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, tour.steps.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour.steps.length, onClose]);

  return (
    <section className="tour" aria-label={tour.title}>
      <div className="tour-head">
        <div>
          <h2>{tour.title}</h2>
          <p className="muted small">Step {index + 1} of {tour.steps.length}. Use the arrow keys to move through it.</p>
        </div>
        <button className="btn btn-ghost btn-small" onClick={onClose}>Close</button>
      </div>

      <div className="tour-body">
        <div className="tour-text">
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>
        <div className="tour-shot">
          <img src={step.image} alt={step.title} />
          {step.hotspots.map((h, i) => (
            <div key={h.label}>
              <div className="tour-box" style={{ left: `${h.box[0] - PAD}%`, top: `${h.box[1] - PAD}%`, width: `${h.box[2] + PAD * 2}%`, height: `${h.box[3] + PAD * 2}%` }} />
              <span className="tour-dot" style={{ left: `${h.box[0] - PAD}%`, top: `${h.box[1] - PAD}%` }} aria-label={h.label}>{i + 1}</span>
            </div>
          ))}
        </div>

        <div className="tour-footer">
          <ol className="tour-legend">
            {step.hotspots.map((h, i) => (
              <li key={h.label}><span className="tour-dot tour-dot-inline">{i + 1}</span>{h.label}</li>
            ))}
          </ol>
          <button className="btn btn-ghost btn-small" onClick={() => navigate(step.route)}>Show me in Hippo</button>
        </div>
      </div>

      <div className="tour-nav">
        <button className="btn btn-ghost" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Back</button>
        <div className="tour-progress" aria-hidden="true">
          {tour.steps.map((s, i) => <button key={s.title} className={`tour-pip ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)} aria-label={`Step ${i + 1}`} />)}
        </div>
        {last
          ? <button className="btn btn-primary" onClick={onClose}>Done</button>
          : <button className="btn btn-primary" onClick={() => setIndex(i => i + 1)}>Next</button>}
      </div>
    </section>
  );
}
