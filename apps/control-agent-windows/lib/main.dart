import 'dart:io';

import 'package:flutter/material.dart';

import 'control_agent.dart';
import 'platform/windows_bridge.dart';

void main(List<String> arguments) async {
  WidgetsFlutterBinding.ensureInitialized();
  await WindowsBridge.instance.configureDpiAwareness();
  final link = arguments.cast<String?>().firstWhere(
      (argument) => argument?.startsWith('huddle-control://') ?? false,
      orElse: () => null);
  runApp(ControlAgentApp(initialLink: link));
}

class ControlAgentApp extends StatefulWidget {
  const ControlAgentApp({super.key, this.initialLink});

  final String? initialLink;

  @override
  State<ControlAgentApp> createState() => _ControlAgentAppState();
}

class _ControlAgentAppState extends State<ControlAgentApp> {
  late final WindowsControlAgent _agent;
  final _linkController = TextEditingController();
  bool _helpExpanded = false;

  @override
  void initState() {
    super.initState();
    _agent = WindowsControlAgent()..addListener(_refresh);
    WindowsBridge.instance.setIncomingLinkHandler(_agent.acceptLink);
    _agent.initialize(widget.initialLink);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    WindowsBridge.instance.clearIncomingLinkHandler();
    _agent
      ..removeListener(_refresh)
      ..dispose();
    _linkController.dispose();
    super.dispose();
  }

  Future<void> _elevateManualLink() async {
    final started =
        await _agent.restartElevatedWithLink(_linkController.text.trim());
    if (started && mounted) exit(0);
  }

  Future<void> _copyDiagnostics() async {
    final diagnostics =
        'Huddle Control Agent Windows ${WindowsControlAgent.appVersion}\n'
        'Elevated: ${_agent.elevated ? 'yes' : 'no'}\n'
        'Connection state: ${_agent.phase.name}';
    await WindowsBridge.instance.writeClipboardText(diagnostics);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sanitized diagnostics copied to the clipboard.'),
        ),
      );
    }
  }

  Future<void> _forgetTrustedServers() async {
    await _agent.forgetTrustedServers();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Trusted Huddle servers were forgotten.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Huddle Control Agent',
      debugShowCheckedModeBanner: false,
      theme: _HuddleTheme.materialTheme,
      home: Scaffold(
        backgroundColor: _HuddleTheme.background,
        body: Stack(
          children: [
            const Positioned.fill(child: _HuddleBackdrop()),
            SafeArea(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 660),
                  child: Scrollbar(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(28, 28, 28, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _header(),
                          if (_agent.releaseStatus?.availableVersion !=
                              null) ...[
                            const SizedBox(height: 20),
                            _StateNotice(
                              icon: Icons.system_update_alt_rounded,
                              color: _HuddleTheme.yellow,
                              text:
                                  'Version ${_agent.releaseStatus!.availableVersion} is available. Download and install it manually after this attended session ends.',
                            ),
                          ],
                          if (_agent.error != null) ...[
                            const SizedBox(height: 20),
                            _StateNotice(
                              icon: Icons.error_outline_rounded,
                              color: _HuddleTheme.red,
                              text: _agent.error!,
                            ),
                          ],
                          const SizedBox(height: 20),
                          _sessionStep(),
                          const SizedBox(height: 20),
                          _accessStep(),
                          const SizedBox(height: 20),
                          _displayStep(),
                          const SizedBox(height: 20),
                          _updateStep(),
                          const SizedBox(height: 20),
                          _helpSection(),
                          const SizedBox(height: 22),
                          Center(
                            child: Text(
                              'Huddle Control Agent ${WindowsControlAgent.appVersion} · Attended and room-scoped',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelSmall
                                  ?.copyWith(color: _HuddleTheme.muted),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _header() {
    final status = _statusFor(_agent.phase);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'HUDDLE / REMOTE CONTROL',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: _HuddleTheme.purple,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.8,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'Control handoff',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 4),
              Text(
                _headerStatus(_agent.phase),
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: _HuddleTheme.muted),
              ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        _StatusPill(status: status),
      ],
    );
  }

  Widget _sessionStep() {
    final phase = _agent.phase;
    final sessionConfirmed = _agent.hasLink &&
        phase != AgentPhase.trustRequired &&
        phase != AgentPhase.waitingForLink &&
        phase != AgentPhase.failed &&
        phase != AgentPhase.ended;

    return _HuddleCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeading(
            number: 1,
            title: 'Confirm the Huddle session',
            complete: sessionConfirmed,
          ),
          const SizedBox(height: 12),
          if (phase == AgentPhase.trustRequired) ...[
            Text(
              'Trust this Huddle server?',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            SelectableText(
              _agent.apiOrigin?.toString() ?? 'Huddle server',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: _HuddleTheme.purple,
                    fontFamily: 'monospace',
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Only this server origin is remembered. The room and one-time link are never saved.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: _HuddleTheme.muted),
            ),
            const SizedBox(height: 12),
            _HuddleButton(
              label: 'Trust & continue',
              onPressed: _agent.trustServer,
              tone: _HuddleButtonTone.primary,
            ),
          ] else if (sessionConfirmed) ...[
            _InfoBadge(
              icon: Icons.verified_user_outlined,
              title: _sessionTitle(phase),
              detail: _sessionDetail(phase),
              color: _HuddleTheme.purple,
            ),
          ] else ...[
            _InfoBadge(
              icon: phase == AgentPhase.failed || phase == AgentPhase.ended
                  ? Icons.refresh_rounded
                  : Icons.swap_horiz_rounded,
              title: phase == AgentPhase.failed || phase == AgentPhase.ended
                  ? 'Open a fresh approved link'
                  : 'Open Remote Control from your Huddle room',
              detail: phase == AgentPhase.failed || phase == AgentPhase.ended
                  ? 'Return to the browser room to issue a new one-time link.'
                  : 'This app stays inert until the Sharer approves a request and opens the one-time link.',
              color: phase == AgentPhase.failed
                  ? _HuddleTheme.red
                  : _HuddleTheme.purple,
            ),
          ],
        ],
      ),
    );
  }

  Widget _accessStep() {
    return _HuddleCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeading(
            number: 2,
            title: 'Choose Windows app access',
            complete: _agent.elevated,
          ),
          const SizedBox(height: 12),
          Text(
            'The Control Agent starts as a standard app. Use administrator-app mode only when control of another administrator app is needed.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: _HuddleTheme.muted),
          ),
          const SizedBox(height: 10),
          _InfoBadge(
            icon: _agent.elevated
                ? Icons.admin_panel_settings_outlined
                : Icons.shield_outlined,
            title: _agent.elevated
                ? 'Administrator-app mode'
                : 'Standard app mode',
            detail: _agent.elevated
                ? 'UAC was approved locally before this one-time link was redeemed.'
                : 'Use the manual fallback below to restart with UAC before opening an approved link.',
            color: _agent.elevated ? _HuddleTheme.purple : _HuddleTheme.muted,
          ),
          const SizedBox(height: 10),
          Text(
            'UAC secure desktop, sign-in, Ctrl+Alt+Delete, services, and unattended access remain unavailable.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: _HuddleTheme.muted),
          ),
        ],
      ),
    );
  }

  Widget _displayStep() {
    final phase = _agent.phase;
    final selectingDisplay =
        phase == AgentPhase.chooseDisplay || phase == AgentPhase.readyToStart;

    return _HuddleCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepHeading(
            number: 3,
            title: 'Choose a display and start',
            complete: phase == AgentPhase.active,
          ),
          const SizedBox(height: 12),
          if (phase == AgentPhase.active) ...[
            const _InfoBadge(
              icon: Icons.desktop_windows_outlined,
              title: 'Remote Control is active',
              detail:
                  'The entire selected display is visible, including this Control Agent window. Either person can stop the session.',
              color: _HuddleTheme.purple,
              highlighted: true,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HuddleButton(
                  label: 'Change display',
                  onPressed: () => _agent.switchDisplay(context),
                  tone: _HuddleButtonTone.secondary,
                ),
                _HuddleButton(
                  label: 'Stop',
                  onPressed: _agent.stop,
                  tone: _HuddleButtonTone.danger,
                ),
              ],
            ),
          ] else if (phase == AgentPhase.switchingDisplay) ...[
            const LinearProgressIndicator(),
            const SizedBox(height: 12),
            Text(
              'Switching display… The Controller is disabled until the selected display is live.',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: _HuddleTheme.purple),
            ),
            const SizedBox(height: 12),
            _HuddleButton(
              label: 'Stop session',
              onPressed: _agent.stop,
              tone: _HuddleButtonTone.danger,
            ),
          ] else if (selectingDisplay) ...[
            _InfoBadge(
              icon: _agent.displayName == null
                  ? Icons.monitor_outlined
                  : Icons.display_settings_outlined,
              title: _agent.displayName == null
                  ? 'Select one entire display'
                  : _agent.displayName!,
              detail: _agent.displayName == null
                  ? 'Huddle shares no audio and does not offer window sharing.'
                  : 'Only this physical display can be shared. Desktop audio is never captured.',
              color: _HuddleTheme.purple,
              highlighted: _agent.displayName != null,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HuddleButton(
                  label: _agent.displayName == null
                      ? 'Select display'
                      : 'Change display',
                  onPressed: () => _agent.chooseDisplay(context),
                  tone: _HuddleButtonTone.secondary,
                ),
                if (phase == AgentPhase.readyToStart)
                  _HuddleButton(
                    label: 'Start Remote Control',
                    onPressed: _agent.start,
                    tone: _HuddleButtonTone.primary,
                  ),
              ],
            ),
          ] else if (phase == AgentPhase.awaitingActivation) ...[
            const LinearProgressIndicator(),
            const SizedBox(height: 12),
            Text(
              'The selected display is ready. Waiting for the approved room grant before it can be published.',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: _HuddleTheme.muted),
            ),
          ] else if (phase == AgentPhase.connecting ||
              phase == AgentPhase.readyToConnect) ...[
            const LinearProgressIndicator(),
            const SizedBox(height: 12),
            Text(
              'Connecting to the approved Huddle room…',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: _HuddleTheme.muted),
            ),
          ] else ...[
            const _InfoBadge(
              icon: Icons.lock_outline_rounded,
              title: 'Complete the approved link first',
              detail:
                  'Choose a local display and explicitly start only after the one-time Huddle link is confirmed.',
              color: _HuddleTheme.muted,
            ),
          ],
        ],
      ),
    );
  }

  Widget _updateStep() {
    final release = _agent.releaseStatus;
    final message = release?.configured == true
        ? 'The signed release manifest is checked before a new approved link is redeemed. Updates are manual and never install during a Remote Control session.'
        : 'This local build has no signed update channel. Install a configured public beta to receive update notices.';
    return _HuddleCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.system_update_alt_rounded,
                size: 19,
                color: _HuddleTheme.text,
              ),
              const SizedBox(width: 9),
              Text(
                'Control Agent updates',
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            message,
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: _HuddleTheme.muted),
          ),
        ],
      ),
    );
  }

  Widget _helpSection() {
    final hasManualLink = _linkController.text.trim().isNotEmpty;
    return _HuddleCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _helpExpanded = !_helpExpanded),
            borderRadius: BorderRadius.circular(9),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  const Icon(
                    Icons.help_outline_rounded,
                    size: 19,
                    color: _HuddleTheme.text,
                  ),
                  const SizedBox(width: 9),
                  Text(
                    'Having trouble?',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const Spacer(),
                  Icon(
                    _helpExpanded
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                    color: _HuddleTheme.purple,
                  ),
                ],
              ),
            ),
          ),
          if (_helpExpanded) ...[
            const SizedBox(height: 14),
            const Divider(height: 1, color: _HuddleTheme.border),
            const SizedBox(height: 14),
            Text(
              'Manual launch fallback',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 5),
            Text(
              'Paste the complete huddle-control:// link from the Huddle room. It is cleared immediately after parsing.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: _HuddleTheme.muted),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _linkController,
              onChanged: (_) => setState(() {}),
              autocorrect: false,
              enableSuggestions: false,
              minLines: 2,
              maxLines: 4,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(fontFamily: 'monospace'),
              decoration: const InputDecoration(
                hintText: 'huddle-control://join?...',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HuddleButton(
                  label: 'Open approved link',
                  onPressed: hasManualLink
                      ? () => _agent.acceptLink(_linkController.text.trim())
                      : null,
                  tone: _HuddleButtonTone.secondary,
                ),
                if (!_agent.elevated)
                  _HuddleButton(
                    label: 'Open in administrator-app mode',
                    onPressed: hasManualLink ? _elevateManualLink : null,
                    tone: _HuddleButtonTone.primary,
                  ),
              ],
            ),
            const SizedBox(height: 14),
            const Divider(height: 1, color: _HuddleTheme.border),
            const SizedBox(height: 14),
            Text(
              'Diagnostics contain only app version, Windows mode, and connection state. Nothing is sent automatically.',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: _HuddleTheme.muted),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HuddleButton(
                  label: 'Copy sanitized diagnostics',
                  onPressed: _copyDiagnostics,
                  tone: _HuddleButtonTone.secondary,
                ),
                _HuddleButton(
                  label: 'Forget trusted servers',
                  onPressed: _forgetTrustedServers,
                  tone: _HuddleButtonTone.danger,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  _AgentStatus _statusFor(AgentPhase phase) => switch (phase) {
        AgentPhase.active => const _AgentStatus(
            'ACTIVE',
            Icons.near_me_outlined,
            _HuddleTheme.yellow,
          ),
        AgentPhase.switchingDisplay => const _AgentStatus(
            'CONNECTED',
            Icons.link_rounded,
            _HuddleTheme.purple,
          ),
        AgentPhase.chooseDisplay ||
        AgentPhase.awaitingActivation ||
        AgentPhase.readyToStart =>
          const _AgentStatus(
            'CONNECTED',
            Icons.link_rounded,
            _HuddleTheme.purple,
          ),
        AgentPhase.readyToConnect ||
        AgentPhase.connecting =>
          const _AgentStatus(
            'CONNECTING',
            Icons.sync_rounded,
            _HuddleTheme.purple,
          ),
        AgentPhase.failed => const _AgentStatus(
            'ATTENTION',
            Icons.error_outline_rounded,
            _HuddleTheme.red,
          ),
        AgentPhase.ended => const _AgentStatus(
            'ENDED',
            Icons.stop_circle_outlined,
            _HuddleTheme.muted,
          ),
        _ => const _AgentStatus(
            'WAITING',
            Icons.circle_outlined,
            _HuddleTheme.muted,
          ),
      };

  String _headerStatus(AgentPhase phase) => switch (phase) {
        AgentPhase.waitingForLink =>
          'Waiting for a Huddle Remote Control link.',
        AgentPhase.trustRequired =>
          'Confirm the Huddle server before continuing.',
        AgentPhase.readyToConnect ||
        AgentPhase.connecting =>
          'Checking the approved room and release.',
        AgentPhase.chooseDisplay =>
          'Connected to the approved room. Choose a display locally.',
        AgentPhase.awaitingActivation =>
          'Waiting for the room grant before publishing the selected display.',
        AgentPhase.readyToStart =>
          'The selected display is ready for an explicit local start.',
        AgentPhase.active => 'Remote Control is active and remains attended.',
        AgentPhase.switchingDisplay =>
          'Switching display. The Controller is temporarily disabled.',
        AgentPhase.ended =>
          'Control Agent stopped and released all held input.',
        AgentPhase.failed => 'This approved link needs attention.',
      };

  String _sessionTitle(AgentPhase phase) => switch (phase) {
        AgentPhase.readyToConnect ||
        AgentPhase.connecting =>
          'Session approved',
        AgentPhase.chooseDisplay ||
        AgentPhase.awaitingActivation ||
        AgentPhase.readyToStart =>
          'Session confirmed',
        AgentPhase.active ||
        AgentPhase.switchingDisplay =>
          'Attended session in progress',
        _ => 'Session approved',
      };

  String _sessionDetail(AgentPhase phase) => switch (phase) {
        AgentPhase.readyToConnect ||
        AgentPhase.connecting =>
          'The one-time code is being redeemed. It is never saved to disk.',
        AgentPhase.chooseDisplay ||
        AgentPhase.awaitingActivation ||
        AgentPhase.readyToStart =>
          'The Sharer selects a display locally and explicitly starts Remote Control.',
        AgentPhase.active ||
        AgentPhase.switchingDisplay =>
          'Input and clipboard sharing stop immediately when the grant, room, display, or local Windows session ends.',
        _ => 'The approved Huddle session is ready.',
      };
}

class _HuddleTheme {
  static const background = Color(0xff1a0f0f);
  static const backgroundDeep = Color(0xff241515);
  static const surface = Color(0xff2a1b19);
  static const surfaceStrong = Color(0xff33221d);
  static const purple = Color(0xffc15a9e);
  static const purpleDark = Color(0xffe182bc);
  static const yellow = Color(0xfff3b01c);
  static const red = Color(0xffff6b5e);
  static const text = Color(0xfffaf4e9);
  static const muted = Color(0xffd1c1ad);
  static const border = Color(0xff624a3e);
  static const borderStrong = Color(0xff866957);

  static final materialTheme = ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    scaffoldBackgroundColor: background,
    colorScheme: const ColorScheme.dark(
      primary: purple,
      onPrimary: surface,
      secondary: yellow,
      onSecondary: surface,
      error: red,
      onError: surface,
      surface: surface,
      onSurface: text,
    ),
    textTheme: const TextTheme(
      headlineMedium: TextStyle(
        fontSize: 27,
        height: 1.12,
        fontWeight: FontWeight.w800,
        color: text,
      ),
      titleMedium: TextStyle(
        fontSize: 17,
        height: 1.25,
        fontWeight: FontWeight.w800,
        color: text,
      ),
      titleSmall: TextStyle(
        fontSize: 14,
        height: 1.3,
        fontWeight: FontWeight.w700,
        color: text,
      ),
      bodyMedium: TextStyle(fontSize: 14, height: 1.42, color: text),
      bodySmall: TextStyle(fontSize: 12.5, height: 1.38, color: text),
      labelSmall: TextStyle(
        fontSize: 10,
        height: 1.2,
        fontWeight: FontWeight.w700,
        color: text,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: backgroundDeep,
      hintStyle: const TextStyle(color: muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 11, vertical: 10),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(9),
        borderSide: const BorderSide(color: borderStrong),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(9),
        borderSide: const BorderSide(color: purpleDark, width: 1.5),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: purple),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: surfaceStrong,
      contentTextStyle: TextStyle(color: text),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

class _HuddleBackdrop extends StatelessWidget {
  const _HuddleBackdrop();

  @override
  Widget build(BuildContext context) =>
      CustomPaint(painter: _HandoffRoutePainter());
}

class _HandoffRoutePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    _drawRoute(
      canvas,
      center: Offset(size.width * 0.82, -size.height * 0.12),
      width: size.width * .7,
      angle: 15,
      color: _HuddleTheme.purple.withValues(alpha: .42),
    );
    _drawRoute(
      canvas,
      center: Offset(-size.width * .08, size.height * .82),
      width: size.width * .48,
      angle: -11,
      color: _HuddleTheme.yellow.withValues(alpha: .62),
    );
  }

  void _drawRoute(
    Canvas canvas, {
    required Offset center,
    required double width,
    required double angle,
    required Color color,
  }) {
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(angle * 3.141592653589793 / 180);
    final line = Paint()
      ..color = color
      ..strokeWidth = 1;
    final ring = Paint()
      ..color = _HuddleTheme.background
      ..style = PaintingStyle.fill;
    final ringStroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final left = Offset(-width / 2, 0);
    final right = Offset(width / 2, 0);
    canvas.drawLine(left, right, line);
    canvas.drawCircle(left, 3.5, ring);
    canvas.drawCircle(right, 3.5, ring);
    canvas.drawCircle(left, 3.5, ringStroke);
    canvas.drawCircle(right, 3.5, ringStroke);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _HandoffRoutePainter oldDelegate) => false;
}

class _HuddleCard extends StatelessWidget {
  const _HuddleCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: _HuddleTheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _HuddleTheme.borderStrong),
          boxShadow: [
            BoxShadow(
              color: _HuddleTheme.purple.withValues(alpha: .14),
              offset: const Offset(7, 9),
            ),
          ],
        ),
        child: child,
      );
}

class _StepHeading extends StatelessWidget {
  const _StepHeading({
    required this.number,
    required this.title,
    required this.complete,
  });

  final int number;
  final String title;
  final bool complete;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: complete
                  ? _HuddleTheme.yellow.withValues(alpha: .28)
                  : _HuddleTheme.backgroundDeep,
              borderRadius: BorderRadius.circular(7),
            ),
            child: complete
                ? const Icon(
                    Icons.check_rounded,
                    size: 15,
                    color: _HuddleTheme.purple,
                  )
                : Text(
                    '$number',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: _HuddleTheme.muted,
                    ),
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontSize: 16,
                  ),
            ),
          ),
        ],
      );
}

class _InfoBadge extends StatelessWidget {
  const _InfoBadge({
    required this.icon,
    required this.title,
    required this.detail,
    required this.color,
    this.highlighted = false,
  });

  final IconData icon;
  final String title;
  final String detail;
  final Color color;
  final bool highlighted;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: highlighted
              ? _HuddleTheme.backgroundDeep
              : _HuddleTheme.backgroundDeep.withValues(alpha: .72),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 21),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    detail,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: _HuddleTheme.muted),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

class _StateNotice extends StatelessWidget {
  const _StateNotice({
    required this.icon,
    required this.color,
    required this.text,
  });

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(color: color.withValues(alpha: .22)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                text,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: color),
              ),
            ),
          ],
        ),
      );
}

enum _HuddleButtonTone { primary, secondary, danger }

class _HuddleButton extends StatelessWidget {
  const _HuddleButton({
    required this.label,
    required this.onPressed,
    required this.tone,
  });

  final String label;
  final VoidCallback? onPressed;
  final _HuddleButtonTone tone;

  @override
  Widget build(BuildContext context) {
    final foreground = tone == _HuddleButtonTone.primary
        ? _HuddleTheme.surface
        : tone == _HuddleButtonTone.danger
            ? _HuddleTheme.red
            : _HuddleTheme.purple;
    final background = tone == _HuddleButtonTone.primary
        ? _HuddleTheme.purple
        : tone == _HuddleButtonTone.danger
            ? _HuddleTheme.red.withValues(alpha: .08)
            : _HuddleTheme.surface;
    final border = tone == _HuddleButtonTone.primary
        ? _HuddleTheme.purpleDark
        : tone == _HuddleButtonTone.danger
            ? _HuddleTheme.red.withValues(alpha: .65)
            : _HuddleTheme.borderStrong;
    final style = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(0, 36)),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: 14),
      ),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
      ),
      textStyle: const WidgetStatePropertyAll(
        TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      ),
      foregroundColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.disabled)
            ? foreground.withValues(alpha: .42)
            : foreground,
      ),
      backgroundColor: WidgetStateProperty.resolveWith(
        (states) {
          if (states.contains(WidgetState.disabled)) {
            return background.withValues(alpha: .42);
          }
          return states.contains(WidgetState.pressed)
              ? background.withValues(alpha: .72)
              : background;
        },
      ),
      side: WidgetStateProperty.resolveWith(
        (states) => BorderSide(
          color: states.contains(WidgetState.disabled)
              ? border.withValues(alpha: .42)
              : border,
        ),
      ),
      overlayColor: WidgetStatePropertyAll(foreground.withValues(alpha: .12)),
      mouseCursor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.disabled)
            ? SystemMouseCursors.basic
            : SystemMouseCursors.click,
      ),
    );
    final child = Text(label);
    return tone == _HuddleButtonTone.primary
        ? FilledButton(onPressed: onPressed, style: style, child: child)
        : OutlinedButton(onPressed: onPressed, style: style, child: child);
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final _AgentStatus status;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: status.color.withValues(
            alpha: status.label == 'WAITING' || status.label == 'ENDED'
                ? .08
                : .22,
          ),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: status.label == 'WAITING' || status.label == 'ENDED'
                ? _HuddleTheme.borderStrong
                : status.color.withValues(alpha: .5),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(status.icon, size: 13, color: status.color),
            const SizedBox(width: 5),
            Text(
              status.label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: status.color,
                    fontFamily: 'monospace',
                    letterSpacing: .6,
                  ),
            ),
          ],
        ),
      );
}

class _AgentStatus {
  const _AgentStatus(this.label, this.icon, this.color);

  final String label;
  final IconData icon;
  final Color color;
}
