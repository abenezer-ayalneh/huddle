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
        .package(url: "https://github.com/livekit/client-sdk-swift.git", exact: "2.15.1"),
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
