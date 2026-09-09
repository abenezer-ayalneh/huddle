import 'dart:io';

import 'package:flutter/material.dart';

import 'control_agent.dart';
import 'platform/windows_bridge.dart';

void main(List<String> arguments) async {
  WidgetsFlutterBinding.ensureInitialized();
  await WindowsBridge.instance.configureDpiAwareness();
  final link = arguments.cast<String?>().firstWhere((argument) => argument?.startsWith('huddle-control://') ?? false, orElse: () => null);
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

  @override
  void initState() {
    super.initState();
    _agent = WindowsControlAgent()..addListener(_refresh);
    _agent.initialize(widget.initialLink);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _agent
      ..removeListener(_refresh)
      ..dispose();
    _linkController.dispose();
    super.dispose();
  }

  Future<void> _elevate() async {
    await _agent.restartElevated();
    if (mounted) exit(0);
  }

  @override
  Widget build(BuildContext context) {
    final phase = _agent.phase;
    return MaterialApp(
      title: 'Huddle Control Agent',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xffd6a8ff), brightness: Brightness.dark, surface: const Color(0xff100d16)),
        scaffoldBackgroundColor: const Color(0xff100d16),
        useMaterial3: true,
      ),
      home: Scaffold(
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('HUDDLE', style: Theme.of(context).textTheme.labelLarge?.copyWith(letterSpacing: 3, color: const Color(0xffd6a8ff))),
                      const SizedBox(height: 10),
                      Text(_title(phase), style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 10),
                      Text(_description(phase), style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: const Color(0xffd4cddd))),
                      const SizedBox(height: 24),
                      if (phase == AgentPhase.waitingForLink || phase == AgentPhase.failed || phase == AgentPhase.ended) ...[
                        TextField(
                          controller: _linkController,
                          autocorrect: false,
                          enableSuggestions: false,
                          decoration: const InputDecoration(labelText: 'Huddle Control Agent link', hintText: 'huddle-control://join?...'),
                          minLines: 2,
                          maxLines: 4,
                        ),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: () => _agent.acceptLink(_linkController.text.trim()), child: const Text('Open approved link')),
                      ],
                      if (phase == AgentPhase.trustRequired) ...[
                        Text('Trust ${_agent.apiOrigin} on this computer before this agent redeems the one-time link. This stores only the server origin, never the room or token.'),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _agent.trustServer, child: const Text('Trust this Huddle server')),
                      ],
                      if (phase == AgentPhase.readyToConnect) ...[
                        Text(_agent.elevated ? 'Administrator-app mode is enabled for this one attended session.' : 'Use ordinary mode for normal desktop applications. You can instead request local UAC approval before connecting if the Sharer needs to control an administrator app.'),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            FilledButton(onPressed: _agent.connect, child: const Text('Connect to approved room')),
                            if (!_agent.elevated) OutlinedButton(onPressed: _elevate, child: const Text('Allow control of administrator apps')),
                          ],
                        ),
                        if (!_agent.elevated) const Padding(
                          padding: EdgeInsets.only(top: 12),
                          child: Text('Windows will ask the Sharer for local UAC approval. Secure-desktop prompts, sign-in screens, Ctrl+Alt+Delete, services, and unattended access remain unavailable.'),
                        ),
                      ],
                      if (phase == AgentPhase.connecting || phase == AgentPhase.awaitingActivation) const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: LinearProgressIndicator()),
                      if (phase == AgentPhase.chooseDisplay || phase == AgentPhase.readyToStart) ...[
                        Text(_agent.displayName == null ? 'Select one entire physical display. Huddle shares no audio and does not offer window sharing.' : 'Selected display: ${_agent.displayName}'),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton(onPressed: () => _agent.chooseDisplay(context), child: Text(_agent.displayName == null ? 'Select display' : 'Change display')),
                            if (phase == AgentPhase.readyToStart) FilledButton(onPressed: _agent.start, child: const Text('Start Remote Control')),
                          ],
                        ),
                      ],
                      if (phase == AgentPhase.active || phase == AgentPhase.switchingDisplay) ...[
                        Text(_agent.elevated ? 'Remote Control is active in administrator-app mode. The Sharer can stop it here at any time.' : 'Remote Control is active. The Sharer can stop it here at any time.'),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          children: [
                            OutlinedButton(onPressed: phase == AgentPhase.active ? () => _agent.switchDisplay(context) : null, child: const Text('Change display')),
                            FilledButton(onPressed: _agent.stop, style: FilledButton.styleFrom(backgroundColor: const Color(0xffc54d61)), child: const Text('Stop Remote Control')),
                          ],
                        ),
                      ],
                      if (_agent.error != null) Padding(padding: const EdgeInsets.only(top: 16), child: Text(_agent.error!, style: const TextStyle(color: Color(0xffffb4ab)))),
                      if (_agent.releaseStatus?.availableVersion != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text('Version ${_agent.releaseStatus!.availableVersion} is available. Download and install it manually after this attended session ends.'),
                        ),
                      const SizedBox(height: 24),
                      TextButton(
                        onPressed: () async {
                          final diagnostics = 'Huddle Control Agent Windows ${WindowsControlAgent.appVersion}\nElevated: ${_agent.elevated ? 'yes' : 'no'}\nConnection state: ${_agent.phase.name}';
                          await WindowsBridge.instance.writeClipboardText(diagnostics);
                        },
                        child: const Text('Copy sanitized diagnostics'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _title(AgentPhase phase) => switch (phase) {
        AgentPhase.waitingForLink => 'Open an approved Remote Control link',
        AgentPhase.trustRequired => 'Trust this Huddle server',
        AgentPhase.readyToConnect => 'Prepare for attended control',
        AgentPhase.connecting => 'Connecting safely',
        AgentPhase.chooseDisplay => 'Select a display',
        AgentPhase.awaitingActivation => 'Waiting for the room grant',
        AgentPhase.readyToStart => 'Start when you are ready',
        AgentPhase.active => 'Remote Control is active',
        AgentPhase.switchingDisplay => 'Switching display',
        AgentPhase.ended => 'Remote Control ended',
        AgentPhase.failed => 'This link needs attention',
      };

  String _description(AgentPhase phase) => switch (phase) {
        AgentPhase.waitingForLink => 'The Sharer starts inside an active Huddle room. Paste the full one-time link if the browser could not open this app.',
        AgentPhase.trustRequired => 'The link names a Huddle server this computer has not trusted yet.',
        AgentPhase.readyToConnect => 'The browser call remains the meeting. This companion shares one display and applies only approved input.',
        AgentPhase.connecting => 'The one-time code is being redeemed. It is never saved to disk.',
        AgentPhase.chooseDisplay || AgentPhase.awaitingActivation || AgentPhase.readyToStart => 'Choose the display locally, then explicitly start the attended session.',
        AgentPhase.active || AgentPhase.switchingDisplay => 'Input and clipboard sharing stop immediately if the grant, room, display, or local Windows session ends.',
        AgentPhase.ended => 'The agent disconnected and released all held input.',
        AgentPhase.failed => 'Correct the link or use the browser room to issue a fresh approved link.',
      };
}
