'use client';

import { Check, Circle, Clipboard, Hand, Laptop, LockKeyhole, MessageSquare, MousePointer2, Play, ShieldCheck, TimerReset } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LandingMeetingCanvas } from './LandingProductScene';

export type LandingStoryStage = 'meet' | 'present' | 'approve' | 'collaborate';

const stages: Array<{ id: LandingStoryStage; title: string; description: string; signal: string }> = [
  { id: 'meet', title: 'Meet', description: 'Open one link, finish the Device Check, and let the room find its people.', signal: 'link → device check' },
  { id: 'present', title: 'Present', description: 'Bring the staging site into the room with camera, chat, and a visible Recording state.', signal: 'device check → present' },
  { id: 'approve', title: 'Approve', description: 'The client asks for control. The Sharer decides. The request stays attached to the room.', signal: 'request → consent' },
  { id: 'collaborate', title: 'Collaborate', description: 'Explore together, renew every 30 minutes, and stop from either side when the work is done.', signal: 'consent → handoff' },
];

export default function LandingStory() {
  const [stage, setStage] = useState<LandingStoryStage>('meet');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion || hasInteracted) return;
    const interval = window.setInterval(() => {
      setStage((currentStage) => {
        const currentIndex = stages.findIndex((item) => item.id === currentStage);
        return stages[(currentIndex + 1) % stages.length].id;
      });
    }, 5200);
    return () => window.clearInterval(interval);
  }, [hasInteracted, reducedMotion]);

  const activeStage = useMemo(() => stages.find((item) => item.id === stage) ?? stages[0], [stage]);

  function selectStage(nextStage: LandingStoryStage) {
    setHasInteracted(true);
    setStage(nextStage);
  }

  return (
    <div className="landing-story" data-testid="landing-story" data-stage={stage}>
      <div className="landing-story-tabs" role="tablist" aria-label="Signal handoff stages">
        {stages.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={stage === item.id}
            aria-controls={`landing-story-panel-${item.id}`}
            id={`landing-story-tab-${item.id}`}
            className={stage === item.id ? 'landing-story-tab landing-story-tab-active' : 'landing-story-tab'}
            onClick={() => selectStage(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                selectStage(stages[(index + 1) % stages.length].id);
              }
              if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                selectStage(stages[(index - 1 + stages.length) % stages.length].id);
              }
            }}
          >
            <span className="landing-story-tab-dot"><Circle className="size-2.5 fill-current" /></span>
            {item.title}
          </button>
        ))}
      </div>
      <div className="landing-story-body">
        <div className="landing-story-copy" id={`landing-story-panel-${stage}`} role="tabpanel" aria-labelledby={`landing-story-tab-${stage}`}>
          <span className="landing-mono-label">{activeStage.signal}</span>
          <h3>{activeStage.title}. Then the work keeps moving.</h3>
          <p>{activeStage.description}</p>
          <div className="landing-story-checks">
            {stage === 'meet' && <><span><Check /> Guest account not required</span><span><Check /> No meeting-app install</span></>}
            {stage === 'present' && <><span><Check /> Camera tiles + shared stage</span><span><Check /> Recording stays visible</span></>}
            {stage === 'approve' && <><span><Check /> Room-scoped identity binding</span><span><Check /> Sharer-controlled approval</span></>}
            {stage === 'collaborate' && <><span><Check /> Reconfirm every 30 minutes</span><span><Check /> Stop from either side</span></>}
          </div>
        </div>
        <LandingStoryScene stage={stage} />
      </div>
      <p className="landing-illustrative-note">Illustrative meeting scene · fictional project names and portraits</p>
    </div>
  );
}

function LandingStoryScene({ stage }: { stage: LandingStoryStage }) {
  return (
    <div className={`landing-story-scene landing-story-scene-${stage}`} aria-label={`${stage} stage demonstration`}>
      {(stage === 'meet' || stage === 'present') && <LandingMeetingCanvas compact={stage === 'meet'} />}
      {stage === 'approve' && (
        <div className="landing-control-scene">
          <div className="landing-control-scene-top"><span><Laptop className="size-4" /> Jun is viewing the shared display</span><span className="landing-chip landing-chip-yellow"><Circle className="size-2 fill-current" /> Awaiting decision</span></div>
          <div className="landing-control-stage"><div className="landing-control-browser"><span className="landing-site-label">STUDIO / NORTH</span><strong>Review the<br />next frame.</strong><span className="landing-control-cursor"><MousePointer2 className="size-4" /> Jun</span></div><div className="landing-control-callout"><LockKeyhole className="size-5" /><strong>Request control</strong><p>The Sharer sees the request before anything moves.</p><div><button type="button" className="landing-mini-button landing-mini-button-primary"><Check className="size-3" /> Approve</button><button type="button" className="landing-mini-button">Not now</button></div></div></div>
          <div className="landing-control-footer"><span><ShieldCheck className="size-4" /> Room-scoped</span><span><TimerReset className="size-4" /> 30 min renewal</span><span><Clipboard className="size-4" /> Plain text only</span></div>
        </div>
      )}
      {stage === 'collaborate' && (
        <div className="landing-collab-scene">
          <div className="landing-collab-top"><span className="landing-chip landing-chip-purple"><Circle className="size-2 fill-current" /> Control active</span><span><TimerReset className="size-4" /> Renews in 18:42</span><button type="button" className="landing-mini-button landing-mini-button-stop">Stop</button></div>
          <div className="landing-collab-stage"><div className="landing-control-browser landing-control-browser-collab"><span className="landing-site-label">STUDIO / NORTH</span><strong>Make space<br />for the next idea.</strong><span className="landing-control-cursor"><MousePointer2 className="size-4" /> Jun</span><span className="landing-collab-stamp"><Hand className="size-4" /> Guided edit</span></div><div className="landing-collab-log"><span className="landing-mono-label">SIGNAL LOG</span><p><Circle className="size-2 fill-current" /> Jun requested control</p><p><Check className="size-3" /> Maya approved the handoff</p><p><MessageSquare className="size-3" /> Clipboard sharing enabled</p><p><Play className="size-3" /> Stop remains visible to both</p></div></div>
          <div className="landing-collab-footer"><span>Files stay out.</span><span>Desktop audio stays out.</span><span>Unattended access stays out.</span></div>
        </div>
      )}
    </div>
  );
}
