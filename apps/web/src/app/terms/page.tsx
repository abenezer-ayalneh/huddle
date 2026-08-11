/* eslint-disable react/no-unescaped-entities -- Long-form legal prose is more readable with normal punctuation. */
import type { Metadata } from 'next';
import LegalPage, { LegalCallout, LegalSection, type LegalTocItem } from '@/components/legal/LegalPage';
import { publicConfig } from '@/lib/public-config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'A template for using this Huddle deployment, meetings, recordings, and attended Remote Control.',
  alternates: { canonical: '/terms' },
};

const toc: LegalTocItem[] = [
  { id: 'agreement', label: 'Agreement and scope' },
  { id: 'service', label: 'The service' },
  { id: 'eligibility', label: 'Eligibility and accounts' },
  { id: 'meetings', label: 'Meeting responsibilities' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'content', label: 'Your content' },
  { id: 'recording', label: 'Recording' },
  { id: 'remote-control', label: 'Remote Control' },
  { id: 'third-parties', label: 'Third-party services' },
  { id: 'self-hosting', label: 'Self-hosted deployments' },
  { id: 'ownership', label: 'Ownership and licenses' },
  { id: 'termination', label: 'Suspension and termination' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Liability' },
  { id: 'indemnity', label: 'Indemnity' },
  { id: 'law', label: 'Governing law' },
  { id: 'changes', label: 'Changes' },
  { id: 'contact', label: 'Contact' },
];

export default function TermsPage() {
  return (
    <LegalPage
      kind="terms"
      eyebrow="Terms · Shared responsibility"
      title="Clear rules for a room you control."
      description="This template defines the boundary between this Huddle deployment, the people who host and join meetings, and attended Remote Control."
      updatedAt="August 4, 2026"
      toc={toc}
    >
      <LegalSection id="agreement" title="Agreement and scope">
        <p>
          These Terms of Service ("Terms") are intended to govern access to the Huddle website and service at <strong>{publicConfig.siteUrl}</strong>, its API,
          and any Control Agent distributed by this deployment. The operator is <strong>{publicConfig.operatorName}</strong> ("we," "us," or "our").
        </p>
        <p>
          By creating an account, joining or hosting a meeting, downloading or using the Control Agent, or otherwise using this deployment, you agree to
          these Terms and acknowledge the Privacy Policy. If you use Huddle for an organization, you confirm that you have authority to bind that organization.
          If you do not agree, do not use the service.
        </p>
        <LegalCallout title="Operator review required">
          <p>
            Huddle is self-hosted software. This is an operator-adaptable template, not legal advice. Before relying on it, the operator must review, adapt, and
            adopt it for the applicable jurisdiction, its users, infrastructure, policies, retention, security, and legal obligations.
          </p>
        </LegalCallout>
      </LegalSection>

      <LegalSection id="service" title="The service">
        <p>
          Huddle provides browser-based video meetings on self-hosted LiveKit infrastructure. Features may include accounts, Instant and Scheduled Meetings,
          account-free Guest links, a Waiting Room, camera and microphone publishing, Present, chat, Host controls, Recording, optional Google sign-in and
          Google Drive recording delivery, and attended macOS Remote Control.
        </p>
        <p>
          This deployment is currently offered without a subscription fee. We may add, remove, limit, or change features, providers, capacity, or
          availability and may introduce paid features later with notice before charges apply. We do not promise that every feature will be available in every
          browser, device, country, or self-hosted deployment.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="Eligibility and accounts">
        <ul>
          <li>You must be at least 16 and legally able to enter this agreement to create a Host account.</li>
          <li>You must provide accurate account information and keep it current.</li>
          <li>
            You are responsible for protecting your password, email account, session, Host keys, meeting links, and devices, and for activity performed through
            your account.
          </li>
          <li>
            You may not share account credentials, impersonate another person, register through automated means, or bypass email verification or access
            controls.
          </li>
          <li>Guests may join a meeting without an account when the Host permits it. A shared link does not guarantee admission.</li>
        </ul>
        <p>Notify us promptly through the contact method below if you believe your account or a meeting secret has been compromised.</p>
      </LegalSection>

      <LegalSection id="meetings" title="Meeting responsibilities">
        <h3>Hosts</h3>
        <p>
          A Host controls room creation, admission, removal, participant moderation, Recording decisions, and any connected Google Drive destination. Hosts are
          responsible for choosing participants, protecting Room Codes and links, responding to Knocks, communicating applicable meeting rules, and using
          moderation controls lawfully.
        </p>
        <h3>Participants</h3>
        <p>
          Participants must use an accurate, non-deceptive display name; respect Host decisions and other participants; avoid sharing content they are not
          authorized to disclose; and leave a meeting if they do not accept an active Recording, screen share, or other room-visible activity. A signed-in
          Guest's Direct Rejoin Grant is limited to the same active call and can be revoked by the Host.
        </p>
        <p>
          Huddle does not verify the identity, authority, or intentions of every Host or participant. Meeting organizers remain responsible for invitations,
          participant consent, workplace or contractual requirements, and any regulated or confidential use of a meeting.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <p>You may not use Huddle to:</p>
        <ul>
          <li>break applicable law, court orders, sanctions, or another person's privacy, publicity, intellectual-property, or contractual rights;</li>
          <li>harass, threaten, exploit, deceive, discriminate against, or endanger another person;</li>
          <li>share unlawful, abusive, sexually exploitative, malicious, or privacy-invasive content;</li>
          <li>record, monitor, screen-share, or remotely control a device without every consent and notice required by law;</li>
          <li>
            gain unauthorized access to an account, room, device, network, recording, Drive file, or service; probe security without written permission; or
            bypass a Waiting Room, Host decision, scoped token, permission, rate limit, release check, or Remote Control grant;
          </li>
          <li>deliver malware, destructive commands, credential-harvesting material, spam, or denial-of-service traffic;</li>
          <li>use Remote Control for unattended access, covert monitoring, theft, fraud, or access outside the active meeting and approved session;</li>
          <li>misrepresent Huddle or this deployment as endorsed, certified, secure, or compliant when it is not; or</li>
          <li>resell or commercially exploit this deployment without the operator's written permission.</li>
        </ul>
        <p>
          We may investigate suspected abuse and preserve relevant records. Security research must avoid personal data, disruption, persistence, social
          engineering, and access beyond the minimum needed to demonstrate an issue, and must be reported privately through the contact method below.
        </p>
      </LegalSection>

      <LegalSection id="content" title="Your content">
        <p>
          You retain the rights you already hold in the names, audio, video, screen shares, chat, files, and other content you provide ("Your Content"). You
          grant us a limited, worldwide, non-exclusive license to host, transmit, process, reproduce, and format Your Content only as needed to operate, secure,
          support, and improve the user-facing service, follow your instructions, and comply with law. This license ends when the relevant content is deleted
          from our systems, subject to normal backup cycles and legal retention.
        </p>
        <p>
          You represent that you have the rights and permissions needed to provide Your Content and permit this processing. You are responsible for deciding
          whether Huddle is appropriate for confidential, regulated, export-controlled, health, financial, employment, educational, or other sensitive
          information. This deployment is not offered under a special data-processing, business-associate, archival, or regulated-industry agreement unless
          we sign one separately.
        </p>
        <p>
          Other participants retain rights in their content. Access to a meeting does not give you permission to copy, publish, train models on, or reuse
          another person's content outside the meeting.
        </p>
      </LegalSection>

      <LegalSection id="recording" title="Recording">
        <p>
          Huddle displays a room-wide Recording Indicator when the service's Recording feature is active. A Recording creates a composited MP4 of meeting video
          and mixed audio. A screen shared during Recording—including the entire display exposed by attended Remote Control—may appear in the recording.
        </p>
        <ul>
          <li>
            The Host is responsible for deciding whether to permit Recording and for obtaining all notices and consents required in every participant's
            jurisdiction.
          </li>
          <li>
            A Recording Indicator is a product notice, not a substitute for legal consent. If you do not agree to be recorded, do not remain in the meeting.
          </li>
          <li>
            A Host may connect a private Google Drive destination. An eligible signed-in participant receives a per-file Drive permission only after explicit
            Recording Share Consent for that active call.
          </li>
          <li>
            Hosts control files delivered to their Drive and are responsible for later access, sharing, retention, and deletion there. Disconnecting Huddle does
            not remove an already delivered Drive file.
          </li>
          <li>
            Local recording availability is temporary and may end earlier after verified Drive delivery. Download important files before their stated or
            configured retention window ends.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="remote-control" title="Attended Remote Control">
        <p>
          Remote Control is a high-trust, attended feature. The Sharer explicitly approves a connected Controller, launches the macOS Control Agent, selects an
          entire physical display, grants macOS Screen Recording and Accessibility permissions, and confirms Start locally. The approved Controller can then
          send mouse, keyboard, Trackpad Scroll, and bounded plain-text Clipboard Sharing input to that display. The Sharer must reconfirm the session every 30
          minutes and either party can stop it.
        </p>
        <LegalCallout title="Stay present and protect sensitive information">
          <p>
            The selected display can reveal the menu bar, Dock, desktop, notifications, every visible window, and the Control Agent itself. Controller input can
            click buttons, enter text, move or delete information, submit forms, or trigger actions with the Sharer's logged-in privileges. Clipboard Sharing
            can transfer plain text in both directions. Do not approve someone you do not trust, expose credentials or sensitive material, or leave an approved
            session unattended.
          </p>
        </LegalCallout>
        <ul>
          <li>Controllers may act only within the task and authority the Sharer expressly granted.</li>
          <li>Sharers must supervise the session, review the selected display, and stop immediately if behavior is unexpected.</li>
          <li>Remote Control is not a support code, background agent, or unattended-access product. Attempting to convert it into one violates these Terms.</li>
          <li>
            The Control Agent may be distributed as beta software. Review the Downloads page for the current platform, signing, notarization, checksum,
            permission, and update status before installation.
          </li>
          <li>
            Huddle does not store input events or clipboard contents, but the parties remain responsible for the actions they take and information they expose.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="third-parties" title="Third-party services">
        <p>
          Huddle may link to or interoperate with Google sign-in, Google Drive, Sentry, an operator-selected email provider, GitHub Releases, browsers,
          operating systems, and other infrastructure. Those services are governed by their own terms and privacy policies. We are not responsible for their
          availability, policy changes, account restrictions, data handling, or content.
        </p>
        <p>
          You authorize Huddle to send information and instructions to a connected provider when you choose the related feature. You are responsible for
          maintaining any required provider account, permissions, storage, and compliance. Huddle may disable an integration if its authorization expires, the
          provider rejects requests, or continued use creates security or legal risk.
        </p>
      </LegalSection>

      <LegalSection id="self-hosting" title="Self-hosted deployments">
        <p>
          If you deploy Huddle yourself, you are the operator of that deployment. You are responsible for infrastructure, domains and TLS, LiveKit and TURN
          configuration, Postgres, Redis, MinIO, backups, secret management, email delivery, Sentry, Google credentials and verification, Control Agent
          distribution, updates, abuse response, accessibility, retention, privacy notices, user terms, and compliance with applicable law.
        </p>
        <p>
          You must not present this template as legal advice or as a substitute for an operator's own legal review. The deployment operator remains responsible
          for its policies, security, support, data handling, and service quality.
        </p>
      </LegalSection>

      <LegalSection id="ownership" title="Ownership and software licenses">
        <p>
          Huddle, its visual identity, website, documentation, and service software are protected by intellectual-property law. The Huddle source repository is
          released under the Apache License, Version 2.0, subject to the license and NOTICE files distributed with the relevant code. Huddle names, marks,
          designs, website content, and the official evaluation deployment remain separately protected.
        </p>
        <p>
          These Terms are a service agreement, not a replacement for the Apache-2.0 source license. Any right to copy, modify, distribute, or self-host Huddle
          code comes from the applicable license included with that software. Third-party components remain governed by their own licenses. The official
          deployment is a capacity-limited evaluation demo, not a promise of hosted production service or availability.
        </p>
        <p>
          If you voluntarily provide feedback, you grant us a perpetual, worldwide, royalty-free right to use it without restriction or compensation, provided
          we do not publicly identify you as its source without permission.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="Suspension and termination">
        <p>
          You may stop using Huddle at any time and may request deletion of your official-service account through the contact method below. Disconnect Google
          Drive separately and manage files already delivered there from your Google account.
        </p>
        <p>
          We may limit, suspend, or terminate access when reasonably necessary to address a Terms violation, security threat, legal requirement, fraud, abuse,
          excessive load, provider restriction, or risk to another person or the service. When practical, we will give notice and an opportunity to correct the
          issue. Serious or urgent harm may require immediate action.
        </p>
        <p>
          Sections that by their nature should survive termination—including ownership, disclaimers, liability limits, indemnity, and dispute terms—will
          survive. Data is handled after termination as described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="Disclaimers">
        <p>
          To the maximum extent permitted by law, this deployment, its Control Agent, downloads, and documentation are provided{' '}
          <strong>"as is" and "as available."</strong> We disclaim implied warranties of merchantability, fitness for a particular purpose, title,
          non-infringement, uninterrupted availability, error-free operation, compatibility, data preservation, and security.
        </p>
        <p>
          Huddle does not guarantee that a meeting will connect, that media quality will meet a particular level, that a Recording or Drive upload will
          complete, that deleted data can be recovered, that Remote Control input will produce the intended result, or that another participant will act
          lawfully. Source code, automated tests, or a successful build do not establish real-device WebRTC, macOS permission, external-provider, or production
          availability in every environment.
        </p>
        <p>Nothing in these Terms excludes a warranty or consumer right that applicable law does not allow us to exclude.</p>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Huddle and its operator will not be liable for indirect, incidental, special, consequential, exemplary, or
          punitive damages; loss of profits, revenue, business, goodwill, data, content, recordings, or access; service interruption; provider failure;
          participant conduct; or actions taken through Remote Control, even if advised that such harm was possible.
        </p>
        <p>
          To the maximum extent permitted by law, our total liability arising from or related to this deployment or these Terms will not exceed the greater
          of the amount you paid us for the service during the 12 months before the event giving rise to the claim or <strong>USD 50</strong>. This limit does
          not apply where liability cannot lawfully be limited, including liability arising from fraud or willful misconduct where applicable.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="Indemnity">
        <p>
          To the extent permitted by law, you will defend, indemnify, and hold harmless Huddle and its operator from third-party claims, losses, and reasonable
          costs arising from Your Content, your meetings, your Recording or Remote Control decisions, your self-hosted deployment, your violation of these
          Terms, or your infringement of another person's rights. This obligation does not apply to the extent a claim was caused by our own unlawful conduct.
        </p>
      </LegalSection>

      <LegalSection id="law" title="Governing law and disputes">
        <p>
          These Terms are governed by the laws of the <strong>Federal Democratic Republic of Ethiopia</strong>, without regard to conflict-of-law rules. Before
          filing a formal claim, you and Huddle agree to try in good faith to resolve the dispute through written notice for at least 30 days. If it cannot be
          resolved, the courts located in Addis Ababa, Ethiopia will have exclusive jurisdiction, except where applicable consumer law gives you a non-waivable
          right to bring a claim elsewhere.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to the service or these Terms">
        <p>
          We may update these Terms to reflect new features, providers, risks, or legal requirements. The page will show the new "Last updated" date. For
          material changes, we will provide reasonable additional notice through the service or account contact information where practical. Continued use after
          the effective date means you accept the updated Terms; if you do not agree, stop using the service.
        </p>
        <p>
          If any provision is unenforceable, it will be limited to the minimum extent necessary and the remaining provisions will continue. Failure to enforce a
          provision is not a waiver. You may not assign these Terms without our consent; we may assign them as part of a transfer of this deployment with
          appropriate notice. These Terms and the Privacy Policy are the entire agreement for this deployment unless we sign a separate agreement with you.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Send questions, legal notices, security reports, or account-deletion requests to <strong>{publicConfig.operatorName}</strong> through the{' '}
          <a href={publicConfig.operatorContactUrl}>operator contact page</a>. Include "Huddle" and the nature of the request, but do not send passwords,
          Host keys, meeting tokens, Control Agent links, Google tokens, or other secrets.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
