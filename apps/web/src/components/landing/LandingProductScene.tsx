import Image from 'next/image';
import { Check, Circle, MessageSquare, Mic, MoreHorizontal, Play, ScreenShare, ShieldCheck, Video, X } from 'lucide-react';
import HuddleIcon from '@/components/HuddleIcon';

type Portrait = { name: string; role: string; image: string; state: 'live' | 'waiting' | 'approved' };

const portraits: Portrait[] = [
  { name: 'Maya', role: 'Agency', image: '/landing-portraits/maya.png', state: 'live' },
  { name: 'Jun', role: 'Client', image: '/landing-portraits/jun.png', state: 'approved' },
  { name: 'Priya', role: 'Design', image: '/landing-portraits/priya.png', state: 'live' },
  { name: 'Andre', role: 'Build', image: '/landing-portraits/andre.png', state: 'waiting' },
];

export function LandingWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="landing-wordmark" aria-label="Huddle">
      <HuddleIcon className="landing-wordmark-icon" aria-hidden="true" />
      {!compact && <span>Huddle</span>}
    </span>
  );
}

export function LandingHeroScene() {
  return (
    <div className="landing-hero-scene" aria-label="Illustrative Huddle meeting workspace">
      <div className="landing-scene-topbar">
        <div className="flex items-center gap-2">
          <LandingWordmark compact />
          <span className="landing-scene-code">MAY-7Q9L</span>
        </div>
        <span className="landing-scene-status"><Circle className="size-2.5 fill-current" /> LIVE DEMO</span>
      </div>
      <div className="landing-scene-body">
        <div className="landing-scene-rail">
          <span className="landing-rail-active"><MessageSquare className="size-4" /></span>
          <span><ScreenShare className="size-4" /></span>
          <span><ShieldCheck className="size-4" /></span>
          <span><MoreHorizontal className="size-4" /></span>
        </div>
        <div className="landing-scene-canvas">
          <div className="landing-scene-canvas-head">
            <div>
              <span className="landing-mono-label">CLIENT REVIEW / 14:32</span>
              <h2>Homepage handoff</h2>
            </div>
            <span className="landing-chip landing-chip-yellow"><Circle className="size-2 fill-current" /> Recording</span>
          </div>
          <div className="landing-scene-workspace">
            <div className="landing-browser-frame">
              <div className="landing-browser-chrome"><span /><span /><span /><span className="landing-browser-url">staging.studio.test</span></div>
              <div className="landing-browser-content">
                <div className="landing-browser-wordmark">STUDIO / NORTH</div>
                <div className="landing-browser-title">Make space<br />for the next idea.</div>
                <div className="landing-browser-line landing-browser-line-wide" />
                <div className="landing-browser-line landing-browser-line-short" />
                <div className="landing-browser-buttons"><span>Explore work</span><span>About the studio</span></div>
              </div>
            </div>
            <div className="landing-stage-note"><span>01</span><strong>Approve this frame?</strong><small>Client can comment without leaving the room.</small></div>
          </div>
          <div className="landing-scene-tiles">
            {portraits.slice(0, 3).map((person) => <LandingPortraitTile key={person.name} person={person} />)}
          </div>
        </div>
      </div>
      <div className="landing-scene-controls">
        <span><Mic className="size-4" /> Maya</span>
        <span><Video className="size-4" /> Camera</span>
        <span><MessageSquare className="size-4" /> Chat</span>
        <button type="button" aria-label="Illustrative end call control"><X className="size-4" /></button>
      </div>
    </div>
  );
}

function LandingPortraitTile({ person }: { person: Portrait }) {
  return (
    <div className={`landing-portrait-tile landing-portrait-state-${person.state}`}>
      <Image src={person.image} alt="" fill sizes="(min-width: 1024px) 18vw, 30vw" className="object-cover" />
      <span className="landing-portrait-meta"><b>{person.name}</b><small>{person.role}</small></span>
      {person.state === 'live' && <span className="landing-portrait-live"><Circle className="size-2 fill-current" /> LIVE</span>}
    </div>
  );
}

export function LandingMeetingCanvas({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`landing-meeting-canvas${compact ? ' landing-meeting-canvas-compact' : ''}`}>
      <div className="landing-meeting-head">
        <div className="flex items-center gap-2"><LandingWordmark compact /><span className="landing-scene-code">MAY-7Q9L</span></div>
        <div className="flex items-center gap-2"><span className="landing-chip landing-chip-red"><Circle className="size-2 fill-current" /> Recording</span><button type="button" aria-label="Illustrative meeting menu"><MoreHorizontal className="size-4" /></button></div>
      </div>
      <div className="landing-meeting-grid">
        {portraits.map((person, index) => (
          <div key={person.name} className={`landing-meeting-tile landing-meeting-tile-${index + 1}`}>
            <Image src={person.image} alt="" fill sizes="(min-width: 1024px) 18vw, 40vw" className="object-cover" />
            <span className="landing-meeting-person"><b>{person.name}</b><small>{person.role}</small></span>
            <span className="landing-meeting-mic"><Mic className="size-3" /></span>
          </div>
        ))}
        <div className="landing-share-tile">
          <div className="landing-share-toolbar"><span>staging.studio.test</span><span><Check className="size-3" /> Shared</span></div>
          <div className="landing-share-site"><span className="landing-site-label">STUDIO / NORTH</span><strong>Make space<br />for the next idea.</strong><i /></div>
          <span className="landing-share-badge"><Play className="size-3 fill-current" /> Presenting</span>
        </div>
      </div>
      <div className="landing-meeting-foot"><span><Mic className="size-4" /> You are live</span><span><MessageSquare className="size-4" /> Chat</span><span><ScreenShare className="size-4" /> Present</span><span><ShieldCheck className="size-4" /> Host</span></div>
    </div>
  );
}
