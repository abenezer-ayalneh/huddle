// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "HuddleControlAgentCore",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "ControlAgentCore", targets: ["ControlAgentCore"]),
        .executable(name: "HuddleControlAgent", targets: ["HuddleControlAgent"]),
    ],
    dependencies: [
        // Huddle's small ScreenCaptureKit patch is vendored from the exact
        // LiveKit 2.15.1 commit recorded in Vendor/client-sdk-swift/UPSTREAM.md.
        .package(path: "Vendor/client-sdk-swift"),
        .package(url: "https://github.com/sparkle-project/Sparkle.git", exact: "2.9.2"),
    ],
    targets: [
        .target(name: "ControlAgentCore"),
        .executableTarget(name: "HuddleControlAgent", dependencies: [
            "ControlAgentCore",
            .product(name: "LiveKit", package: "client-sdk-swift"),
            .product(name: "Sparkle", package: "Sparkle"),
        ]),
        .testTarget(name: "ControlAgentCoreTests", dependencies: ["ControlAgentCore"]),
    ]
)
