import { buildSignalHandoffEmail } from './signal-handoff-email';

describe('buildSignalHandoffEmail', () => {
  it('renders a responsive table-first Signal Handoff message and preserves a plain-text fallback', () => {
    const message = buildSignalHandoffEmail({
      preheader: 'Preview',
      route: 'ACCOUNT HANDOFF',
      title: 'Confirm <this> address.',
      body: 'Use the secure link.',
      action: { href: 'https://huddle.example/verify?token=abc&next=home', label: 'Verify email' },
      fallbackLabel: 'Copy this link:',
      note: 'Ignore this message if it was not requested.',
    });

    expect(message.html).toContain('class="email-card email-shadow" role="presentation" width="600"');
    expect(message.html).toContain('@media only screen and (max-width: 620px)');
    expect(message.html).toContain('background-color:#f6eedb');
    expect(message.html).toContain('background-color:#8d2676');
    expect(message.html).toContain('background-color:#f3b01c');
    expect(message.html.indexOf('Huddle')).toBeLessThan(message.html.indexOf('ACCOUNT HANDOFF'));
    expect(message.html).toContain('Confirm &lt;this&gt; address.');
    expect(message.html).toContain('https://huddle.example/verify?token=abc&amp;next=home');
    expect(message.text).toContain('Verify email: https://huddle.example/verify?token=abc&next=home');
  });
});
