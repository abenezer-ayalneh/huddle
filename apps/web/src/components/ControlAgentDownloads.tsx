'use client';

import { Apple, CheckCircle2, Download, Monitor, ShieldCheck } from 'lucide-react';
import { getNoCostControlAgentBeta } from '@/lib/controlAgentFreeBeta';
import { useMobileBrowserCapabilities } from '@/lib/mobileBrowserCapabilities';
import type { WindowsControlAgentPublicBeta } from '@/lib/windowsControlAgentPublicBeta';

type DownloadArtifact = { url: string };

export default function ControlAgentDownloads({
  repositoryUrl,
  windowsPublicBeta,
}: {
  repositoryUrl: string;
  windowsPublicBeta: WindowsControlAgentPublicBeta | null;
}) {
  const { isMobileBrowser } = useMobileBrowserCapabilities();

  const noCostBeta = getNoCostControlAgentBeta(repositoryUrl);

  if (isMobileBrowser) {
    return (
      <section className="downloads-release-station" aria-labelledby="downloads-mobile-title">
        <div className="downloads-release-station__header">
          <div>
            <p className="downloads-station-label">desktop companion</p>
            <h2 id="downloads-mobile-title">The Control Agent requires a desktop computer.</h2>
          </div>
        </div>
        <p className="downloads-unavailable">Use a desktop macOS or Windows browser to download, install, and prepare the Control Agent for Remote Control.</p>
      </section>
    );
  }

  return (
    <div className="downloads-agent">
      <section className="downloads-release-station" id="downloads" aria-labelledby="downloads-station-title">
        <div className="downloads-release-station__header">
          <div>
            <p className="downloads-station-label">desktop companions</p>
            <h2 id="downloads-station-title">Choose the build for your computer.</h2>
          </div>
        </div>

        <div className="downloads-architecture-list">
          {(() => {
            const artifact = noCostBeta ? { url: noCostBeta.downloadUrl } : undefined;

            return (
              <article className="downloads-architecture">
                <div className="downloads-architecture__identity">
                  <span className="downloads-architecture__icon" aria-hidden="true">
                    <Apple className="size-6" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h3>macOS · Apple Silicon</h3>
                    <p>Supported on macOS 13 or later · M1, M2, M3, M4</p>
                  </div>
                </div>
                {artifact ? (
                  <a href={artifact.url} className="downloads-download-button">
                    <Download className="size-4" aria-hidden="true" /> Download Apple Silicon DMG
                  </a>
                ) : (
                  <p className="downloads-unavailable">The Apple Silicon installer is temporarily unavailable. Please try again shortly.</p>
                )}
              </article>
            );
          })()}

          {(
            [
              {
                architecture: 'x64' as const,
                description: 'Windows 10 22H2 or Windows 11 · 64-bit Intel or AMD',
                label: 'Windows · x64',
              },
              {
                architecture: 'arm64' as const,
                description: 'Windows 10 22H2 or Windows 11 · Snapdragon and other Windows on ARM PCs',
                label: 'Windows · ARM64',
              },
            ] as const
          ).map(({ architecture, description, label }) => {
            const artifact: DownloadArtifact | undefined = windowsPublicBeta ? { url: windowsPublicBeta[architecture].downloadUrl } : undefined;

            return (
              <article className="downloads-architecture" key={architecture}>
                <div className="downloads-architecture__identity">
                  <span className="downloads-architecture__icon" aria-hidden="true">
                    <Monitor className="size-6" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h3>{label}</h3>
                    <p>{`Supported on ${description}`}</p>
                  </div>
                </div>
                {artifact ? (
                  <a href={artifact.url} className="downloads-download-button">
                    <Download className="size-4" aria-hidden="true" /> Download {architecture === 'arm64' ? 'Windows ARM64' : 'Windows x64'} installer
                  </a>
                ) : (
                  <p className="downloads-unavailable">This release does not include a Windows {architecture === 'arm64' ? 'ARM64' : 'x64'} installer.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="downloads-handoff-guide" aria-labelledby="downloads-guide-title">
        <div className="downloads-guide-heading">
          <p className="downloads-kicker">Your first handoff</p>
          <h2 id="downloads-guide-title">Prepare once. Keep control in the room.</h2>
        </div>
        <ol className="downloads-guide-list">
          <li>
            <CheckCircle2 className="size-5" aria-hidden="true" />
            <div>
              <strong>Install deliberately</strong>
              <p>{'On macOS, open the DMG and move the app to Applications. On Windows, run the installer that matches the PC processor.'}</p>
            </div>
          </li>
          <li>
            <ShieldCheck className="size-5" aria-hidden="true" />
            <div>
              <strong>Prepare explicitly</strong>
              <p>
                Trust the Huddle server, then choose a display locally. macOS asks for Screen Recording and Accessibility; Windows can request local UAC
                approval for administrator apps.
              </p>
            </div>
          </li>
          <li>
            <Monitor className="size-5" aria-hidden="true" />
            <div>
              <strong>Share while attended</strong>
              <p>Only the Sharer installs the agent. The Controller stays in the browser, and every session remains attended.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
