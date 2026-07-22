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
    ],
    targets: [
        .target(name: "ControlAgentCore"),
        .executableTarget(name: "HuddleControlAgent", dependencies: ["ControlAgentCore", .product(name: "LiveKit", package: "client-sdk-swift")]),
        .testTarget(name: "ControlAgentCoreTests", dependencies: ["ControlAgentCore"]),
    ]
)
