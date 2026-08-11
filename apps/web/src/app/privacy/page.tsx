/* eslint-disable react/no-unescaped-entities -- Long-form legal prose is more readable with normal punctuation. */
import type { Metadata } from 'next';
import LegalPage, { LegalCallout, LegalSection, type LegalTocItem } from '@/components/legal/LegalPage';
import { publicConfig } from '@/lib/public-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Huddle handles account, meeting, recording, Google, diagnostic, and Remote Control data.',
  alternates: { canonical: '/privacy' },
};

const toc: LegalTocItem[] = [
  { id: 'scope', label: 'Scope and operator' },
  { id: 'information', label: 'Information we handle' },
  { id: 'use', label: 'How we use information' },
  { id: 'media', label: 'Meeting media and messages' },
  { id: 'google', label: 'Google user data' },
  { id: 'sharing', label: 'When information is shared' },
  { id: 'legal-bases', label: 'Legal bases' },
  { id: 'retention', label: 'Retention and deletion' },
  { id: 'choices', label: 'Your choices and rights' },
  { id: 'security', label: 'Security' },
  { id: 'transfers', label: 'International processing' },
  { id: 'children', label: 'Children' },
  { id: 'changes', label: 'Policy changes' },
  { id: 'contact', label: 'Contact' },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kind="privacy"
      eyebrow="Privacy · Data boundaries"
      title="Privacy, without vague edges."
      description="This template explains what this Huddle deployment processes, where meeting data travels, what is stored, and which choices remain with Hosts, Guests, and its operator."
      updatedAt="August 4, 2026"
      toc={toc}
    >
      <LegalSection id="scope" title="Scope and operator">
        <p>
          This Privacy Policy applies to the Huddle website and service at <strong>{publicConfig.siteUrl}</strong>, its API, and any Control Agent distributed
          by this deployment. This deployment is operated by <strong>{publicConfig.operatorName}</strong> ("we," "us," or "our").
        </p>
        <LegalCallout title="Operator review required">
          <p>
            Huddle is self-hosted software. This is an operator-adaptable template, not legal advice. Before making this deployment available to others, the
            operator must review, adapt, and adopt it for the applicable jurisdiction, actual infrastructure, retention settings, integrations, and backups.
          </p>
        </LegalCallout>
        <p>
          This policy covers information processed by this deployment. It does not govern the independent practices of meeting Hosts, other participants,
          Google, Sentry, an email provider, GitHub, your browser, or your device.
        </p>
      </LegalSection>

      <LegalSection id="information" title="Information we handle">
        <h3>Account and authentication data</h3>
        <p>
          Hosts create an account using a name, email address, and password, or may use Google sign-in when it is enabled. We process the account name, email,
          verification status, profile image if provided, provider identifiers, account creation and update times, and authentication credentials or tokens
          needed to maintain the account. Password credentials are stored in hashed form, not as readable passwords.
        </p>
        <p>
          Authentication sessions may include a session token, expiry time, IP address, and browser user-agent. We send account-verification messages through
          the email provider configured by the deployment operator.
        </p>

        <h3>Room and participation data</h3>
        <p>
          We process Room Codes, scheduled start times, Host ownership, display names, LiveKit participant identities, admission requests, Host decisions,
          presence, media permissions, and room state needed to operate a call. Guests may join without an account. A signed-in Guest may receive a call-scoped
          Direct Rejoin Grant after admission; this grant is limited to the same active call.
        </p>

        <h3>Audio, video, screen share, chat, and connection data</h3>
        <p>
          When you enable a camera, microphone, screen share, or chat, that content is transmitted through the deployment's self-hosted LiveKit infrastructure
          to authorized room participants. Connection setup may process network addresses, device and browser capabilities, track state, quality statistics, and
          similar technical metadata needed to establish and maintain WebRTC sessions.
        </p>

        <h3>Recordings and recording delivery</h3>
        <p>
          When the Recording Indicator is active, Huddle creates a room-composite MP4 containing the composited meeting video and mixed audio. The file is
          written to the deployment's MinIO object storage. We also retain recording metadata such as the Room Code association, who started it, status,
          timestamps, duration, size, storage key, delivery state, and error information.
        </p>
        <p>
          If a Host connects Google Drive, we process the connected Google account email, an encrypted refresh token, the Huddle Recordings folder identifier,
          upload state, Drive file identifier and URL, and delivery status. If an eligible signed-in participant explicitly asks to receive a recording, we
          process their name, email, consent time, and the resulting per-file Drive permission status.
        </p>

        <h3>Remote Control data</h3>
        <p>
          Attended Remote Control processes the Sharer's and Controller's display names and participant identities, room and session identifiers, Control Agent
          identity, approval state, start/end/renewal times, status, and end reason. While active, the approved Controller's mouse, keyboard, Trackpad Scroll,
          and bounded plain-text Clipboard Sharing messages travel over LiveKit directly to the Sharer's Control Agent.
        </p>
        <p>
          Huddle does <strong>not</strong> store Remote Control input events, clipboard contents, screenshots, desktop frames, or typed secrets in HTTP
          services, Redis, Postgres, room metadata, logs, or audit records. The selected display is still a room-visible screen-share track and may be included
          in a meeting Recording when Recording is active.
        </p>

        <h3>Browser and device storage</h3>
        <ul>
          <li>
            <strong>Essential session cookies</strong> keep signed-in users authenticated. Huddle does not use advertising cookies.
          </li>
          <li>
            <strong>Local storage</strong> remembers the camera, microphone, speaker, and start-muted choices made on that browser.
          </li>
          <li>
            <strong>Session storage</strong> temporarily holds the Host's room-scoped token, Host key, identity, and display name so those secrets do not appear
            in the meeting URL. It is cleared for that room when the Host leaves and is scoped to the browser tab session.
          </li>
        </ul>

        <h3>Diagnostics and support</h3>
        <p>
          If Sentry is enabled, the web app and API send unexpected error events and stack traces for debugging. Before transmission, Huddle removes user
          identity, headers, cookies, request bodies and query values, email addresses, room and recording identifiers, Control Agent links, and console
          breadcrumbs. Performance tracing and Session Replay are disabled. The macOS Control Agent has no automatic telemetry; its diagnostic summary is
          generated and shared only when the user chooses to copy it.
        </p>
      </LegalSection>

      <LegalSection id="use" title="How we use information">
        <p>We use information only as needed to:</p>
        <ul>
          <li>create and secure accounts, verify email addresses, and maintain signed-in sessions;</li>
          <li>create and schedule rooms, admit participants, issue scoped LiveKit tokens, and enforce Host authority;</li>
          <li>route meeting media and data, recover connections, and remember local device preferences;</li>
          <li>create, deliver, share, retain, and remove recordings according to the Host's choices and deployment configuration;</li>
          <li>authorize and audit attended Remote Control without retaining its input or clipboard contents;</li>
          <li>send transactional account and recording-delivery messages;</li>
          <li>protect the service, investigate abuse, diagnose unexpected faults, and maintain reliability; and</li>
          <li>comply with law and enforce the Terms of Service.</li>
        </ul>
        <p>
          We do not sell personal information, serve behavioral advertising, build advertising profiles, or use Google user data, meeting content, recordings,
          or Remote Control data to train general-purpose AI models.
        </p>
      </LegalSection>

      <LegalSection id="media" title="Meeting media and messages">
        <p>
          Live audio, camera video, screen shares, and in-call chat are processed through the LiveKit SFU and delivered to authorized participants in the room.
          Huddle's application API is not the normal media path. Media is encrypted in transit using the WebRTC transport, but Huddle does not claim that
          meetings are end-to-end encrypted: the self-hosted media infrastructure and Recording pipeline must process media to route or record it.
        </p>
        <p>
          Huddle does not intentionally retain a copy of live audio, video, screen share, or chat after transmission unless a participant starts a Recording.
          Chat messages use LiveKit data channels and are not persisted by Huddle. Participants can still capture content using their own devices or software,
          so do not share information solely because Huddle itself does not persist it.
        </p>
      </LegalSection>

      <LegalSection id="google" title="Google user data">
        <p>Huddle can interact with Google in two separate, optional ways:</p>
        <ul>
          <li>
            <strong>Google sign-in</strong> uses the identity information Google returns, such as your Google account identifier, name, email address,
            email-verification state, and profile image, to create or access your Huddle account.
          </li>
          <li>
            <strong>Google Drive delivery</strong> is connected separately by a Host. It requests the narrow{' '}
            <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-sm text-cyan">drive.file</code> scope to create or reuse a private Huddle
            Recordings folder, upload Huddle-created recording files, verify those uploads, and create a reader permission for an eligible participant who
            explicitly opted in to that specific Recording.
          </li>
        </ul>
        <p>
          Drive delivery does not ask to read unrelated Drive files. Huddle does not create public recording links or share the Huddle Recordings folder.
          Refresh tokens and resumable-upload session URLs are encrypted at rest; short-lived access tokens are used only while performing the requested Drive
          operation.
        </p>
        <p>
          Huddle's use and transfer of information received from Google APIs adheres to the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including its Limited Use
          requirements. Google user data is used only to provide or improve the user-facing sign-in and Drive-delivery features. It is not sold, used for
          advertising, credit decisions, surveillance, or general-purpose AI training, and is not transferred except as necessary to provide those features,
          comply with law, address security, or as part of a transaction permitted by Google's policy with appropriate notice and control.
        </p>
        <p>
          Disconnecting Drive makes a best-effort request to revoke Google's authorization, removes Huddle's stored refresh token, and stops future delivery
          work. It does not delete files already delivered to your Drive or undo file permissions already granted. You can also revoke access from your Google
          Account and delete or manage delivered files directly in Google Drive.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="When information is shared">
        <p>We disclose information only in the following limited situations:</p>
        <ul>
          <li>
            <strong>Other meeting participants.</strong> Your display name, live media, screen share, chat, presence, and room-visible activity are shared with
            people admitted to the meeting. Recording and Remote Control status are intentionally visible room-wide.
          </li>
          <li>
            <strong>Service infrastructure.</strong> This deployment's LiveKit, Postgres, Redis, MinIO, API, and web services process data under the
            operator's control.
          </li>
          <li>
            <strong>Google.</strong> At your direction, Google processes sign-in data or stores and shares Drive recordings under Google's own terms and privacy
            policy.
          </li>
          <li>
            <strong>Email delivery.</strong> The configured transactional email provider receives the destination address and message content needed to deliver
            verification or recording-status messages.
          </li>
          <li>
            <strong>Sentry.</strong> When enabled, Sentry receives privacy-scrubbed diagnostic events for unexpected web or API faults.
          </li>
          <li>
            <strong>Legal and safety reasons.</strong> We may preserve or disclose information when reasonably necessary to comply with law, protect users,
            investigate fraud or abuse, or defend legal rights.
          </li>
          <li>
            <strong>Business transition.</strong> If operation of this deployment is transferred, relevant information may transfer with it subject to this
            policy, applicable law, and notice where required.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="legal-bases" title="Legal bases for processing">
        <p>
          Where a law requires a legal basis, we rely on the basis appropriate to the activity: performance of our agreement with you to provide the service;
          your consent for optional access such as camera, microphone, screen sharing, Recording Share Consent, Remote Control, Google sign-in, or Google Drive;
          our legitimate interests in securing, debugging, and improving a privacy-conscious service; and compliance with legal obligations.
        </p>
        <p>
          You may withdraw consent for future processing by turning off a device, leaving a meeting, stopping a share, denying or stopping Remote Control,
          disconnecting Drive, or contacting us. Withdrawal does not make earlier lawful processing unlawful and may prevent the related feature from working.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="Retention and deletion">
        <ul>
          <li>
            <strong>Accounts, rooms, and metadata</strong> remain while needed to operate the account and this deployment, resolve disputes, secure the system,
            and meet legal obligations. Account-related rooms and metadata are designed to be removed when the account is deleted, subject to backups and
            records we must retain.
          </li>
          <li>
            <strong>Sessions, verification records, Knocks, OAuth state, and Direct Rejoin Grants</strong> expire or are removed according to their short-lived
            authentication or active-call purpose.
          </li>
          <li>
            <strong>Local Recording Copies</strong> are designed for a hard maximum of seven days after completion by default. After a Google Drive upload is
            verified, local deletion is normally accelerated to within 24 hours of delivery or the original deadline, whichever is earlier. A self-hosting
            operator may configure a different period and is responsible for disclosing it.
          </li>
          <li>
            <strong>Recording metadata</strong> remains after the local MP4 is deleted so Hosts can see status, history, and Drive delivery information.
            Disconnecting Drive does not delete files already stored in Drive.
          </li>
          <li>
            <strong>Remote Control audit metadata</strong> may remain with the room record. Input events, clipboard contents, screenshots, and desktop frames
            are not retained as audit data.
          </li>
          <li>
            <strong>Diagnostic events and server logs</strong> are retained for a limited operational period according to this deployment's Sentry and
            infrastructure settings.
          </li>
          <li>
            <strong>Backups</strong> may retain deleted information for a limited recovery cycle before it is overwritten, unless longer retention is legally
            required.
          </li>
        </ul>
        <p>
          Deletion can take time to propagate through active systems and backups. We may keep minimal records necessary to demonstrate a request, prevent abuse,
          comply with law, or establish and defend legal claims.
        </p>
      </LegalSection>

      <LegalSection id="choices" title="Your choices and rights">
        <p>You can control much of Huddle's processing directly:</p>
        <ul>
          <li>join as an anonymous Guest when an account is not required;</li>
          <li>
            turn camera, microphone, screen share, chat, Recording Share Consent, and Remote Control participation on or off through the available controls;
          </li>
          <li>clear Huddle's local device preferences through your browser's site-data settings;</li>
          <li>disconnect Google Drive in the Recordings page and revoke Huddle from your Google Account;</li>
          <li>manage or delete delivered files and permissions in Google Drive; and</li>
          <li>request access, correction, deletion, restriction, objection, or portability where applicable law provides those rights.</li>
        </ul>
        <p>
          This deployment does not currently provide a self-service account-deletion button. Submit a privacy request through the contact method below.
          We may need to verify your identity before acting. If another organization operates the Huddle deployment you use, direct your request to that
          operator.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Huddle uses scoped and expiring room tokens, server-enforced Host and participant authorization, encrypted transport, hashed password credentials,
          encrypted Google refresh tokens and upload-session URLs, private object storage, short-lived Remote Control bootstrap codes, and privacy scrubbing
          before diagnostic delivery. The browser never receives the LiveKit API secret or storage credentials.
        </p>
        <p>
          Remote Control requires room presence, explicit Sharer approval, a one-time Control Agent bootstrap, a server-backed identity-bound grant, local macOS
          permissions, and reconfirmation every 30 minutes. The Sharer or Controller can stop the session at any time.
        </p>
        <p>
          No system is perfectly secure. Protect account credentials and meeting links, keep devices and browsers updated, verify the current Control Agent
          download instructions, and avoid exposing sensitive material during a meeting or Remote Control session.
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="International processing">
        <p>
          This deployment, its configured providers, and meeting participants may be located in different countries. As a result, information may be
          processed outside your country, where privacy laws may differ. Where required, the operator will use an appropriate legal mechanism and safeguards for
          cross-border processing. A self-hosted operator selects its own hosting region and providers.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>
          This Huddle deployment is not directed to children under 16, and children under 16 may not create Host accounts. If a meeting organizer permits a
          minor to participate, the organizer is responsible for obtaining any consent required by law and for avoiding inappropriate Recording or Remote
          Control. Contact us if you believe a child provided account information without valid authorization.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We may update this policy when Huddle's features, providers, or legal obligations change. The updated page will show a new "Last updated" date. If a
          change materially expands how Google user data or other personal information is used, we will provide additional notice or request renewed consent
          where required before applying the new use.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          For questions or requests about this deployment, contact <strong>{publicConfig.operatorName}</strong> through the{' '}
          <a href={publicConfig.operatorContactUrl}>operator contact page</a>. Include "Huddle privacy" in your message and identify the account email or
          meeting context relevant to your request without sending passwords, Host keys, meeting tokens, Control Agent links, or other secrets.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
