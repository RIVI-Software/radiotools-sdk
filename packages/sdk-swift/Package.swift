// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "RadioToolsSDK",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "RadioToolsSDK", targets: ["RadioToolsSDK"]),
    ],
    targets: [
        .target(name: "RadioToolsSDK"),
    ]
)
