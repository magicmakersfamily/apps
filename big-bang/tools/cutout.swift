// Cuts the subject out of a picture (transparent background) using macOS's built-in "lift subject" (Vision framework), on-device.
//   swiftc -O big-bang/tools/cutout.swift -o /tmp/cutout && /tmp/cutout in.jpg out.png
// Used for the Cosmo and Professor character pictures in big-bang/characters/.
import Foundation
import Vision
import CoreImage
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let a = CommandLine.arguments
guard a.count == 3 else { print("usage: cutout in.jpg out.png"); exit(2) }
let url = URL(fileURLWithPath: a[1])
let handler = VNImageRequestHandler(url: url, options: [:])
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
guard let obs = req.results?.first else { print("no subject found"); exit(1) }
let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: true)
let ci = CIImage(cvPixelBuffer: buf)
let ctx = CIContext()
guard let cg = ctx.createCGImage(ci, from: ci.extent) else { print("render failed"); exit(1) }
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, cg, nil)
guard CGImageDestinationFinalize(dest) else { print("write failed"); exit(1) }
print("wrote", a[2], cg.width, "x", cg.height)
